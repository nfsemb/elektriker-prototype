// Sjekker alle lenker og bilder på resultatsidene i sok/<yrke>/index.html, og bildene på forsiden.
// Bruk: node scripts/sjekk-lenker.mjs                 alle yrkessidene
//       node scripts/sjekk-lenker.mjs sykepleier      bare én side
// (Node 18+, ingen avhengigheter)
//
// Lenker med relativ «side» (for eksempel "../psykolog/") er lenker til en annen side i prototypen.
// Der sjekkes bare at filen finnes.
// En lenke er OK når målsiden svarer 200 etter omdirigering, havner på et tillatt domene,
// har id-en i «anker» (hvis satt) og inneholder teksten i «tekst.start» (hvis satt).
// Søkesidene og sammenligningsverktøyet rendres i nettleseren, så der sjekkes bare svar og domene.
// Bilder med relativ sti (for eksempel ../bilder/ung-no-logo.png) er filer i prototypen. Der sjekkes bare at filen finnes.
// Avslutter med kode 1 hvis noe feiler.

import { readFile, readdir, access } from 'node:fs/promises';

const TILLATTE_DOMENER = ['utdanning.no', 'karriereveiledning.no', 'ung.no'];
// Bildene til utdanning.no ligger på s3.hkdir-production.openstack.itpartner.no (flyttet fra s3.utdanning.no i 2026).
const TILLATTE_BILDEVERTER = ['utdanning.no', 's3.hkdir-production.openstack.itpartner.no', 'i.vimeocdn.com'];

const sokMappe = new URL('../sok/', import.meta.url);
// Bare mapper med en resultatside. sok/bilder/ har bildene i prototypen og ingen index.html.
const alleYrker = [];
for (const navn of (await readdir(sokMappe, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  try { await access(new URL(`${navn}/index.html`, sokMappe)); alleYrker.push(navn); } catch { /* ikke en resultatside */ }
}
const yrker = process.argv[2] ? [process.argv[2]] : alleYrker;
const forside = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const erTillatt = (url, verter) => {
  try {
    const host = new URL(url).hostname;
    return verter.some((d) => host === d || host.endsWith('.' + d));
  } catch { return false; }
};

const somTekst = (s) => s
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
  .replace(/\s+/g, ' ')
  .toLowerCase();

const sideCache = new Map();
async function hent(url) {
  const side = url.split('#')[0];
  if (!sideCache.has(side)) {
    sideCache.set(side, fetch(side, { redirect: 'follow', headers: { 'user-agent': 'elektriker-prototype lenkesjekk' } })
      .then(async (r) => ({ status: r.status, endelig: r.url, html: await r.text() }))
      .catch((e) => ({ feil: e.message })));
  }
  return sideCache.get(side);
}

let feil = 0;
const mangler = [];
const linje = (...k) => console.log(k.join('\t'));
// Sidene med mappen de ligger i, så lokale bildestier løses opp fra riktig sted (forsiden ligger i roten, resultatsidene i sok/<side>/).
const bildeKilder = [{ html: forside, mappe: new URL('../', import.meta.url) }];

for (const yrke of yrker) {
  const html = await readFile(new URL(`${yrke}/index.html`, sokMappe), 'utf8');
  bildeKilder.push({ html, mappe: new URL(`${yrke}/`, sokMappe) });
  const json = html.match(/<script type="application\/json" id="lenker">([\s\S]*?)<\/script>/);
  if (!json) { console.error(`Fant ikke lenketabellen i sok/${yrke}/index.html`); process.exitCode = 1; continue; }
  const lenker = JSON.parse(json[1]);
  const brukteIder = new Set([...html.matchAll(/data-lenke="([^"]+)"/g)].map((m) => m[1]));
  // sok/ikke-klar/ velger lenken ut fra ?yrke= i nettleseren. Lenkene i yrkestabellen der regnes som brukt.
  const yrkerJson = html.match(/<script type="application\/json" id="yrker">([\s\S]*?)<\/script>/);
  if (yrkerJson) for (const y of Object.values(JSON.parse(yrkerJson[1]))) brukteIder.add(y.lenke);

  console.log(`LENKER sok/${yrke}/`);
  for (const [id, l] of Object.entries(lenker)) {
    if (!brukteIder.has(id)) linje(id, l.status, '-', 'ADVARSEL', 'brukes ikke på siden');
    if (!l.side) { mangler.push(`${yrke}: ${id}`); continue; }
    const grunner = [];
    const advarsler = [];
    let svar = {};
    if (!/^https?:/.test(l.side)) {
      // Lenke til en annen side i prototypen. ?yrke=… og #… hører til siden, ikke til filnavnet.
      const fil = l.side.split(/[?#]/)[0];
      try { await access(new URL(fil.replace(/\/?$/, '/') + 'index.html', new URL(`${yrke}/`, sokMappe))); svar = { status: 'fil', endelig: l.side }; }
      catch { grunner.push(`finnes ikke i prototypen: ${l.side}`); }
    } else {
      if (!erTillatt(l.side, TILLATTE_DOMENER)) grunner.push('ikke tillatt domene');
      svar = await hent(l.side);
      if (svar.feil) grunner.push('nettverksfeil: ' + svar.feil);
      else {
        if (svar.status !== 200) grunner.push('svarkode ' + svar.status);
        if (!erTillatt(svar.endelig, TILLATTE_DOMENER)) grunner.push('omdirigert til ' + svar.endelig);
        if (l.anker && !svar.html.includes(`id="${l.anker}"`)) grunner.push(`id="${l.anker}" finnes ikke`);
        if (l.tekst?.start && !l.side.includes('#') && !somTekst(svar.html).includes(l.tekst.start.toLowerCase())) {
          // Med anker faller lenken tilbake til ankeret. Teksten kan også være rendret i nettleseren.
          if (l.anker) advarsler.push(`teksten «${l.tekst.start}» finnes ikke i HTML-en fra serveren (kan være rendret i nettleseren; ankeret brukes ellers)`);
          else grunner.push(`teksten «${l.tekst.start}» finnes ikke i HTML-en`);
        }
      }
    }
    if (grunner.length) feil++;
    linje(id, l.status, svar.status ?? '-', grunner.length ? 'FEIL' : advarsler.length ? 'ADVARSEL' : 'OK', grunner.concat(advarsler).join('; ') || svar.endelig);
  }
  for (const id of brukteIder) if (!(id in lenker)) { feil++; linje(id, '-', '-', 'FEIL', 'data-lenke uten oppføring i lenketabellen'); }
  console.log('');
}

// Hvert bilde én gang: bilder på nettet etter adressen, bilder i prototypen etter filen stien peker på.
const bilder = new Map();
for (const { html, mappe } of bildeKilder) {
  for (const m of html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) {
    const src = m[1].replaceAll('&amp;', '&');
    const nokkel = /^https?:/.test(src) ? src : new URL(src.split(/[?#]/)[0], mappe).href;
    if (!bilder.has(nokkel)) bilder.set(nokkel, src);
  }
}

console.log('BILDER');
for (const [nokkel, src] of bilder) {
  const grunner = [];
  if (!/^https?:/.test(src)) {
    // Et bilde i prototypen (for eksempel ung.no-logoen og verktøyikonene i sok/bilder/). Det sjekkes bare at filen finnes.
    let status = 'fil';
    try { await access(new URL(nokkel)); }
    catch { status = '-'; grunner.push('finnes ikke i prototypen'); }
    if (grunner.length) feil++;
    linje(src.slice(0, 90), status, grunner.length ? 'FEIL' : 'OK', grunner.join('; '));
    continue;
  }
  if (!erTillatt(src, TILLATTE_BILDEVERTER)) grunner.push('ikke tillatt bildevert');
  let status = '-';
  try {
    const r = await fetch(src, { headers: { referer: 'https://nfsemb.github.io/' }, signal: AbortSignal.timeout(30000) });
    status = r.status;
    if (r.status !== 200) grunner.push('svarkode ' + r.status);
    if (!(r.headers.get('content-type') || '').startsWith('image/')) grunner.push('ikke et bilde');
    await r.arrayBuffer();
  } catch (e) { grunner.push('nettverksfeil: ' + e.message); }
  if (grunner.length) feil++;
  linje(src.slice(0, 90), status, grunner.length ? 'FEIL' : 'OK', grunner.join('; '));
}

if (mangler.length) console.log('\nMANGLER ADRESSE\n' + mangler.join('\n'));
console.log(`\n${feil ? feil + ' feil' : 'Alt OK'}`);
process.exitCode = feil ? 1 : 0;
