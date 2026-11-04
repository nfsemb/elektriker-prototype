// Kontrollerer intervjukortene på resultatsidene mot intervjuene på utdanning.no.
// Bruk: node scripts/sjekk-sitater.mjs                          alle mapper i sok/
//       node scripts/sjekk-sitater.mjs sykepleier               bare én side
//       node scripts/sjekk-sitater.mjs sykepleier --rot <mappe>  ta sok/ fra en annen repo-rot
// (Node 18+, ingen avhengigheter)
//
// For hvert kort (li.intervju med data-kort) slås lenke-id fra data-lenke opp i lenketabellen,
// og intervjuet «side» lastes ned. Kortet er OK når alt dette står i intervjuet:
//   sitat ordrett (uten tankestrek først), navn, alder («<alder> år»), stilling, arbeidsgiver
//   og tekst.start fra lenketabellen (hvis satt).
// Studentintervjuer har ikke alltid alder. Står det ingen alder i navnet på kortet («Navn (28)»), sjekkes bare at
// navnet står i intervjuet, og kortet skal da heller ikke påstå noen alder.
// Stillingen sammenlignes uten hensyn til store og små bokstaver («Sykepleierstudent» mot «sykepleierstudent»).
// Sammenligningen normaliserer mellomrom, typografiske anførselstegn og mellomrom før tegnsetting.
// Skriver side, gruppe, navn, stilling, arbeidsgiver og sitat for hvert kort, og OK eller FEIL.
//
// ung.no-kortene (li.kort--ung med data-kort) sjekkes mot siden på ung.no på samme måte:
//   spørsmål og svar: tittelen med kjønn og alder rett etter («Hvilken linje …? Jente, 14»), sitatet ordrett
//   (uten «»), hvem som svarte (fra «Svar fra <svarer>, <dato>», mellom spørsmålet og «Besvart: <dato>» på siden,
//   uten hensyn til store og små bokstaver) og tekst.start.
//   artikkel (li.kort--ung-artikkel): tittelen, ingressen ordrett, «Skrevet av <forfatter>», «Sist oppdatert <dato>»
//   og tekst.start.
// Sider uten intervjukort og ung.no-kort hoppes over. Siste linjer er «Intervjuer: <antall>», «ung.no-kort: <antall>»
// og «Feil: <antall>». Avslutter med kode 1 hvis noe feiler.
// Mellomlagrer nedlastede intervjuer i <tempmappe>/sjekk-sitater i seks timer.
// Slett mappen for å tvinge ny nedlasting.

import { readFile, readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BRUK = 'Bruk: node scripts/sjekk-sitater.mjs [side] [--rot <mappe>]';
const MELLOMLAGER = join(tmpdir(), 'sjekk-sitater');
const MELLOMLAGER_TID = 6 * 60 * 60 * 1000;

const avslutt = (melding) => { console.error(melding); process.exit(2); };

// --- Argumenter -----------------------------------------------------------------------------------

let rot = fileURLToPath(new URL('..', import.meta.url));
let side = null;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--rot') {
    rot = args[++i];
    if (!rot) avslutt(BRUK);
  } else if (args[i].startsWith('-') || side !== null) {
    avslutt(BRUK);
  } else {
    side = args[i].replace(/\/+$/, '');
    if (!side || side === '.' || side.includes('/') || side.includes('\\') || side.includes('..')) avslutt(`Ugyldig side: ${args[i]}\n${BRUK}`);
  }
}

// --- Tekst fra HTML -------------------------------------------------------------------------------

// Latin-1-entitetene i HTML står i samme rekkefølge som tegnene 160 til 255.
const LATIN1 = ('nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot '
  + 'cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute '
  + 'Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde '
  + 'auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave '
  + 'uacute ucirc uuml yacute thorn yuml').split(' ');
const ENTITETER = new Map([
  ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"],
  ['ndash', '–'], ['mdash', '—'], ['lsquo', '‘'], ['rsquo', '’'], ['sbquo', '‚'], ['ldquo', '“'], ['rdquo', '”'], ['bdquo', '„'],
  ['hellip', '…'], ['bull', '•'], ['euro', '€'], ['trade', '™'],
  ...LATIN1.map((navn, i) => [navn, String.fromCharCode(160 + i)])
]);
const ukjenteEntiteter = new Set();
const windows1252 = new TextDecoder('windows-1252');

// Gjør om &navn;, &#123; og &#x1F; til tegn, i ett løp (&amp;lt; blir &lt;).
function dekod(s) {
  return s.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([A-Za-z][A-Za-z0-9]*));/g, (hele, des, hex, navn) => {
    if (navn) {
      if (ENTITETER.has(navn)) return ENTITETER.get(navn);
      ukjenteEntiteter.add(hele);
      return hele;
    }
    const kode = des ? parseInt(des, 10) : parseInt(hex, 16);
    if (kode >= 0x80 && kode <= 0x9f) return windows1252.decode(Uint8Array.of(kode));
    if (kode === 0 || kode > 0x10ffff || (kode >= 0xd800 && kode <= 0xdfff)) return '�';
    return String.fromCodePoint(kode);
  });
}

// All synlig tekst på en side som én linje. Tagger blir til mellomrom.
const sideTekst = (html) => dekod(html
  .replace(/<!--[\s\S]*?-->|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' '))
  .replace(/ /g, ' ').replace(/‑/g, '-')
  .replace(/\s+/g, ' ');

// Ord som er lenker i intervjuet, gir et mellomrom før tegnsettingen når taggene fjernes.
const norm = (s) => s
  .replace(/’/g, "'").replace(/[«»]/g, '"')
  .replace(/\s+/g, ' ').trim()
  .replace(/ ([.,;:!?])/g, '$1');

// --- Nedlasting -----------------------------------------------------------------------------------

async function lastNed(url) {
  const nokkel = url.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(-80) + '-' + createHash('sha1').update(url).digest('hex').slice(0, 8);
  const fil = join(MELLOMLAGER, nokkel + '.html');
  try {
    if (Date.now() - (await stat(fil)).mtimeMs < MELLOMLAGER_TID) return await readFile(fil, 'utf8');
  } catch { /* ikke mellomlagret */ }
  const svar = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
  if (svar.status !== 200) throw new Error('svarkode ' + svar.status);
  const html = await svar.text();
  await mkdir(MELLOMLAGER, { recursive: true });
  await writeFile(fil, html);
  return html;
}

const nedlastinger = new Map();
function hentTekst(url) {
  const adresse = url.split('#')[0];
  if (!nedlastinger.has(adresse)) {
    nedlastinger.set(adresse, lastNed(adresse).then((html) => ({ tekst: norm(sideTekst(html)) }), (e) => ({ feil: e.message })));
  }
  return nedlastinger.get(adresse);
}

// --- Kortene på en resultatside -------------------------------------------------------------------

const attributt = (tag, navn) => {
  const m = tag.match(new RegExp(`\\s${navn}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m ? dekod(m[1] ?? m[2]) : null;
};
const rydd = (s) => dekod(s.replace(/<[^>]+>/g, '')).trim();
const tilLukketag = (html, fra, tag) => {
  const re = new RegExp(`</${tag}\\s*>`, 'gi');
  re.lastIndex = fra;
  const m = re.exec(html);
  return html.slice(fra, m ? m.index : undefined);
};

// Kortene i dokumentrekkefølge, med gruppen (h2.seksjon) hvert kort står under.
function finnKort(html) {
  const kort = [];
  let gruppe = null;
  for (const m of html.matchAll(/<(h2|li)\b[^>]*>/gi)) {
    const klasser = (attributt(m[0], 'class') ?? '').split(/\s+/);
    const innhold = () => tilLukketag(html, m.index + m[0].length, m[1].toLowerCase());
    if (m[1].toLowerCase() === 'h2') {
      if (klasser.includes('seksjon')) gruppe = rydd(innhold()).replace(/\s+/g, ' ');
    } else if (attributt(m[0], 'data-kort') !== null && (klasser.includes('intervju') || klasser.includes('kort--ung'))) {
      const type = klasser.includes('intervju') ? 'intervju' : klasser.includes('kort--ung-artikkel') ? 'ung-artikkel' : 'ung-svar';
      kort.push({ id: attributt(m[0], 'data-kort'), type, gruppe, html: innhold() });
    }
  }
  return kort;
}

function lesLenketabell(html) {
  const m = html.match(/<script\b[^>]*\bid=["']lenker["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return { feil: 'fant ikke lenketabellen' };
  try { return { lenker: JSON.parse(m[1]) }; } catch (e) { return { feil: 'lenketabellen er ugyldig JSON: ' + e.message }; }
}

// Lengste starten av sitatet som finnes på siden, for å vise hvor sitatet begynner å avvike.
function avvik(sitat, tekst) {
  let lo = 0;
  let hi = sitat.length;
  while (lo < hi) {
    const midt = Math.ceil((lo + hi) / 2);
    if (tekst.includes(sitat.slice(0, midt))) lo = midt; else hi = midt - 1;
  }
  if (lo === 0) return 'ingen del av starten på sitatet finnes på siden';
  if (lo === sitat.length) return null;
  const foran = sitat.slice(Math.max(0, lo - 40), lo);
  return `sitatet stemmer til og med «${lo > 40 ? '…' : ''}${foran}», men avviker fra «${sitat.slice(lo, lo + 40)}${lo + 40 < sitat.length ? '…' : ''}»`;
}

// Slår opp kortets data-lenke i lenketabellen og henter siden. Gir { lenke, tekst } eller { feil }.
async function hentKilde(kort, tabell) {
  const lenkeId = (kort.html.match(/data-lenke="([^"]+)"/) ?? [])[1];
  if (!lenkeId) return { feil: 'kortet har ingen data-lenke' };
  if (tabell.feil) return { feil: tabell.feil };
  const lenke = tabell.lenker[lenkeId];
  if (!lenke) return { feil: `lenke-id «${lenkeId}» finnes ikke i lenketabellen` };
  if (!/^https?:\/\//.test(lenke.side ?? '')) return { feil: `«${lenkeId}» har ingen nettadresse i «side»` };
  const svar = await hentTekst(lenke.side);
  if (svar.feil) return { feil: `kunne ikke hente ${lenke.side}: ${svar.feil}` };
  return { lenke, tekst: svar.tekst };
}

// Sjekker ett ung.no-kort. Gir { sitat, felt, status, merknad } som sjekkKort. felt har tittel og svarer (eller forfatter).
async function sjekkUngKort(kort, tabell) {
  const avsnitt = (klasse) => rydd((kort.html.match(new RegExp(`<p class="[^"]*\\b${klasse}\\b[^"]*"[^>]*>([\\s\\S]*?)</p>`, 'i')) ?? [])[1] ?? '');
  const artikkel = kort.type === 'ung-artikkel';
  const tittel = rydd((kort.html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) ?? [])[1] ?? '');
  const sitat = avsnitt(artikkel ? 'ung-ingress' : 'ung-sitat').replace(/^«/, '').replace(/»$/, '');
  const linje = avsnitt('ung-svarer');
  const hvem = artikkel
    ? linje.match(/^Skrevet av (.+)\. Sist oppdatert (\d{1,2}\.\d{1,2}\.\d{4})\.$/)
    : linje.match(/^Svar fra (.+), (\d{1,2}\.\d{1,2}\.\d{4})$/);
  const felt = { tittel, [artikkel ? 'forfatter' : 'svarer']: hvem ? hvem[1] : null };
  const resultat = { sitat, felt, merknad: null };
  const feil = (tekst) => ({ ...resultat, status: 'FEIL: ' + tekst });
  if (!hvem) return feil(artikkel ? '«Skrevet av …. Sist oppdatert <dato>.» mangler eller har feil form' : '«Svar fra …, <dato>» mangler eller har feil form');
  const [, person, dato] = hvem;

  const kilde = await hentKilde(kort, tabell);
  if (kilde.feil) return feil(kilde.feil);
  const { lenke, tekst: t } = kilde;
  const finnes = (tekst) => tekst.trim() !== '' && t.includes(norm(tekst));
  const ordrett = artikkel ? 'ingress ordrett' : 'sitat ordrett';

  let sjekk;
  if (artikkel) {
    sjekk = {
      'tittel': finnes(tittel),
      'ingress ordrett': finnes(sitat),
      'forfatter': finnes('Skrevet av ' + person),
      'dato': finnes('Sist oppdatert ' + dato)
    };
  } else {
    // Hvem som svarte skal stå i svaret, mellom spørsmålet og «Besvart: <dato>», ikke et annet sted på siden.
    const spurt = avsnitt('ung-spurt');
    const fra = t.indexOf(norm(`${tittel} ${spurt}`));
    const til = t.indexOf(norm('Besvart: ' + dato));
    sjekk = {
      'tittel med kjønn og alder': spurt !== '' && fra !== -1,
      'sitat ordrett': finnes(sitat),
      'dato': til !== -1,
      'svarer': fra !== -1 && til > fra && t.slice(fra, til).toLowerCase().includes(norm(person).toLowerCase())
    };
  }
  sjekk['tekst.start'] = !lenke.tekst?.start || t.includes(norm(lenke.tekst.start));
  const feilede = Object.keys(sjekk).filter((k) => !sjekk[k]);
  if (!sjekk[ordrett] && sitat) resultat.merknad = avvik(norm(sitat), t);
  return { ...resultat, status: feilede.length ? 'FEIL: ' + feilede.join(', ') : 'OK' };
}

// Sjekker ett kort. Gir { sitat, felt, status, merknad } der status er 'OK' eller en tekst som begynner med 'FEIL'.
async function sjekkKort(kort, tabell) {
  const felt = {};
  for (const m of kort.html.matchAll(/class="[^"]*\bintervju-(navn|stilling|arbeidsgiver)\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)) {
    felt[m[1]] ??= rydd(m[2]);
  }
  const bq = kort.html.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
  const sitat = bq ? rydd(bq[1]).replace(/^[–-]\s*/, '') : '';
  const resultat = { sitat, felt, merknad: null };
  const feil = (tekst) => ({ ...resultat, status: 'FEIL: ' + tekst });

  const kilde = await hentKilde(kort, tabell);
  if (kilde.feil) return feil(kilde.feil);
  const { lenke, tekst: t } = kilde;

  // Et felt som mangler eller er tomt, skal feile (en tom tekst finnes alltid i en annen tekst).
  const finnes = (tekst) => tekst.trim() !== '' && t.includes(norm(tekst));
  const medAlder = (felt.navn ?? '').match(/^(.*) \((\d+)\)$/);
  const navnTekst = medAlder ? medAlder[1] : (felt.navn ?? '');
  const sjekk = {
    'sitat ordrett': finnes(sitat),
    'navn': finnes(navnTekst),
    'alder': !medAlder || new RegExp(`\\b${medAlder[2]} år`).test(t),
    'stilling': (felt.stilling ?? '').trim() !== '' && t.toLowerCase().includes(norm(felt.stilling).toLowerCase()),
    'arbeidsgiver': finnes(felt.arbeidsgiver ?? ''),
    'tekst.start': !lenke.tekst?.start || t.includes(norm(lenke.tekst.start))
  };
  const feilede = Object.keys(sjekk).filter((k) => !sjekk[k]);
  if (!sjekk['sitat ordrett'] && sitat) resultat.merknad = avvik(norm(sitat), t);
  return { ...resultat, status: feilede.length ? 'FEIL: ' + feilede.join(', ') : 'OK' };
}

// --- Kjøring --------------------------------------------------------------------------------------

const sokMappe = join(rot, 'sok');
let yrker;
if (side) {
  yrker = [side];
} else {
  try {
    yrker = (await readdir(sokMappe, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch { avslutt(`Fant ikke mappen ${sokMappe}`); }
}

let antall = 0;
let antallUng = 0;
let antallFeil = 0;
for (const yrke of yrker) {
  let html;
  try {
    html = await readFile(join(sokMappe, yrke, 'index.html'), 'utf8');
  } catch {
    if (side) avslutt(`Fant ikke ${join(sokMappe, yrke, 'index.html')}`);
    continue; // en mappe uten resultatside
  }
  const kort = finnKort(html);
  if (!kort.length) { console.log(`${yrke}: ingen intervjukort eller ung.no-kort, hoppet over\n`); continue; }
  const tabell = lesLenketabell(html);
  for (const k of kort) {
    const ung = k.type !== 'intervju';
    const r = ung ? await sjekkUngKort(k, tabell) : await sjekkKort(k, tabell);
    if (ung) antallUng++; else antall++;
    if (r.status !== 'OK') antallFeil++;
    const beskrivelse = ung
      ? `ung.no ${k.type === 'ung-artikkel' ? 'artikkel' : 'svar'} | ${r.felt.tittel || '[mangler]'} | ${r.felt.svarer ?? r.felt.forfatter ?? '[mangler]'}`
      : `${r.felt.navn ?? '[mangler]'} | ${r.felt.stilling ?? '[mangler]'} | ${r.felt.arbeidsgiver ?? '[mangler]'}`;
    console.log(`${yrke.padEnd(11)} | ${k.gruppe ?? "(ingen gruppe)"} | ${beskrivelse}\n            «${r.sitat}»\n            ${r.status}`);
    if (r.merknad) console.log(`            ${r.merknad}`);
    console.log('');
  }
}

if (ukjenteEntiteter.size) console.error(`ADVARSEL: ukjente HTML-entiteter i intervjuene, ikke dekodet: ${[...ukjenteEntiteter].join(' ')}`);
console.log(`Intervjuer: ${antall}`);
console.log(`ung.no-kort: ${antallUng}`);
console.log(`Feil: ${antallFeil}`);
process.exitCode = antallFeil ? 1 : 0;
