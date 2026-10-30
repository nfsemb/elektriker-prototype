// Felles skript for resultatsidene i sok/<yrke>/ og for sok/ (som sender søket til riktig yrke).
(function () {
  'use strict';

  // ---------- Yrkene i prototypen ----------
  // Søket fra forsiden ligger bare i nettleseren (sessionStorage) og sendes ingen steder.
  var NOKKEL_SOK = 'ki-sok:sporsmal';
  var NOKKEL_GRUPPE = 'ki-sok:gruppe:'; // + yrke, så valgt tema huskes per yrke

  // Ord som viser at søket handler om et yrke. Grensene (G) gjør at for eksempel «politiker» ikke treffer «politi».
  var G = '(^|[^a-zæøå])';
  var YRKER = [
    { id: 'elektriker', navn: 'elektriker', ord: new RegExp(G + 'elektrik(er|ar)') },
    { id: 'sykepleier', navn: 'sykepleier', ord: new RegExp(G + 'sykepleie') },
    { id: 'advokat', navn: 'advokat', ord: new RegExp(G + '(advokat|jurist|juss?([^a-zæøå]|$)|jusstudi|rettsvitenskap)') },
    { id: 'politi', navn: 'politi', ord: new RegExp(G + 'politi(?!k|sk)') },
    { id: 'lege', navn: 'lege', ord: new RegExp(G + '(lege(r|n|ne|vakt|yrket|studiet|utdanning(en)?|spesialist(er)?)?([^a-zæøå]|$)|medisin|doktor)') },
    { id: 'psykolog', navn: 'psykolog', ord: new RegExp(G + 'psykolog') },
    // «lærer» er også et verb («hva lærer man?»), så det teller bare når ingen andre yrker er nevnt, og ikke etter et pronomen.
    { id: 'laerer', navn: 'lærer', ord: new RegExp(G + '(lærer(e|en|ne|yrket|utdanning(en)?)?|lektor(er)?|adjunkt)([^a-zæøå]|$)'), sist: true }
  ];
  // «jeg lærer» er et verb, men «blir jeg lærer», «som lærer» og «bli lærer» handler om yrket.
  var VERB_LAERER = /(jeg|du|man|han|hun|vi|de|dere|ikke|mer|mest) lærer|lærer (jeg|du|man|han|hun|vi|de|dere|meg|deg|seg|om|av)([^a-zæøå]|$)/;
  var YRKE_LAERER = /(bli|blir|ble|er|være|vært|som|en|til) (jeg |du |man )?lærer/;

  // Returnerer yrket søket handler om, eller null. Nevnes flere, vinner det som står først i teksten.
  function finnYrke(tekst) {
    if (!tekst) return null;
    var t = tekst.toLowerCase();
    var best = null, bestPos = Infinity;
    YRKER.forEach(function (y) {
      if (y.sist) return;
      var m = y.ord.exec(t);
      if (m && m.index < bestPos) { best = y; bestPos = m.index; }
    });
    if (best) return best.id;
    var laerer = YRKER.filter(function (y) { return y.sist; })[0];
    return laerer.ord.test(t) && (!VERB_LAERER.test(t) || YRKE_LAERER.test(t)) ? laerer.id : null;
  }

  function hentSok() { try { return sessionStorage.getItem(NOKKEL_SOK); } catch (e) { return null; } }

  window.KiSok = { YRKER: YRKER, finnYrke: finnYrke, hentSok: hentSok, NOKKEL_SOK: NOKKEL_SOK, NOKKEL_GRUPPE: NOKKEL_GRUPPE };

  var yrke = document.body.getAttribute('data-yrke');
  if (!yrke) return; // sok/ bruker bare funksjonene over

  // ---------- Lenker ----------
  var lenker = {};
  try { lenker = JSON.parse(document.getElementById('lenker').textContent); } catch (e) { console.error('Kunne ikke lese lenketabellen', e); }

  function kod(s) { return encodeURIComponent(s).replace(/-/g, '%2D'); }

  function lagHref(l) {
    if (!l || !l.side) return null;
    var fragment = '';
    if (l.tekst && l.tekst.start && l.side.indexOf('#') === -1) {
      fragment = ':~:text=' + kod(l.tekst.start) + (l.tekst.slutt ? ',' + kod(l.tekst.slutt) : '');
    }
    if (l.anker || fragment) {
      if (l.side.indexOf('#') !== -1) return l.side;
      return l.side + '#' + (l.anker || '') + fragment;
    }
    return l.side;
  }

  document.querySelectorAll('[data-lenke]').forEach(function (el) {
    var href = lagHref(lenker[el.getAttribute('data-lenke')]);
    if (href) {
      el.setAttribute('href', href);
    } else {
      el.removeAttribute('href');
      el.setAttribute('aria-disabled', 'true');
      el.classList.add('mangler');
    }
  });
  if (/[?&]vis-mangler\b/.test(location.search)) document.documentElement.classList.add('vis-mangler');

  // ---------- Søket ----------
  // Uten søk, eller når søket bare er et yrke, vises standard sortering.
  // Er søket et spørsmål som passer med en av gruppene, flyttes den gruppen øverst, og resten følger i standard rekkefølge.
  // Prototypen har ingen KI, så nøkkelord står i stedet for semantisk matching. Uttrykk med flere ord teller dobbelt,
  // fordi de er mer presise. Ved likt antall poeng vinner gruppen som står først her. Teksten om temaet står i data-tema på gruppen.
  var MATCH = [
    { gruppe: 'lonn', ord: ['tjen', 'lønn', 'betal', 'penger', 'inntekt', 'kroner'] },
    { gruppe: 'hvor', ord: ['bedrift', 'arbeidsgiver', 'læreplass', 'hvor kan jeg jobbe', 'hvor kan man jobbe', 'hvor kan du jobbe', 'hvor jobber', 'arbeidsplass'] },
    { gruppe: 'etterpa', ord: ['etterpå', 'videre', 'fagskole', 'ingeniør', 'y-vei', 'senere', 'karriere', 'spesialis', 'videreutdann', 'doktorgrad'] },
    { gruppe: 'bli', ord: ['bli ', 'blir ', 'utdann', 'skole', 'vgs', 'videregående', 'vg1', 'vg2', 'fagbrev', 'studere', 'studi', 'krav', 'kvalifik', 'praksiskandidat', 'opptak', 'komme inn', 'karakter', 'poeng', 'høgskole', 'høyskole', 'universitet', 'bachelor', 'master', 'autorisasjon', 'bevilling'] },
    { gruppe: 'jobben', ord: ['arbeidsoppgave', 'oppgave', 'gjør', 'hverdag', 'arbeidsdag', 'i praksis', 'hvordan er det å'] },
    { gruppe: 'hvem', ord: ['kvinne', 'jente', 'menn', 'gutt', 'kjønn', 'ansatte', 'hvor mange', 'sektor', 'deltid', 'heltid', 'hvem jobber'] },
    { gruppe: 'lignende', ord: ['ligner', 'lignende', 'alternativ', 'andre yrker', 'i stedet'] },
    { gruppe: 'utforsk', ord: ['passer for meg', 'passer meg', 'interesse', 'hva kan jeg bli', 'vet ikke', 'usikker', 'andre muligheter'] }
  ];

  function finnGruppe(tekst) {
    var t = ' ' + tekst.toLowerCase().replace(/[?!.,;:«»"]/g, ' ').replace(/\s+/g, ' ') + ' ';
    var best = null, bestPoeng = 0;
    MATCH.forEach(function (m) {
      if (!document.querySelector('[data-gruppe="' + m.gruppe + '"]')) return;
      var poeng = m.ord.reduce(function (sum, o) {
        return t.indexOf(o) === -1 ? sum : sum + (o.trim().indexOf(' ') !== -1 ? 2 : 1);
      }, 0);
      if (poeng > bestPoeng) { best = m; bestPoeng = poeng; }
    });
    return best;
  }

  // Søket brukes bare når det handler om dette yrket, eller ikke nevner noe yrke (valgt fra listen i sok/).
  // Handler det om et annet yrke, for eksempel etter en lenke under «Lignende yrker», vises bare yrkesnavnet.
  var sok = hentSok();
  var sokYrke = finnYrke(sok);
  if (sok && (sokYrke === yrke || sokYrke === null)) {
    document.getElementById('sok').value = sok;
    var treff = finnGruppe(sok);
    var forste = treff && document.querySelector('[data-gruppe="' + treff.gruppe + '"]');
    if (forste) {
      var forsteGruppe = document.querySelector('[data-gruppe]');
      if (forste !== forsteGruppe) forsteGruppe.parentNode.insertBefore(forste, forsteGruppe);
      // Chipen for gruppen flyttes rett etter «Alle», så rekkefølgen er den samme som på siden.
      var chipFlytt = document.querySelector('[data-velg="' + treff.gruppe + '"]');
      if (chipFlytt) {
        var alleChip = document.querySelector('[data-velg="alle"]').parentNode;
        alleChip.parentNode.insertBefore(chipFlytt.parentNode, alleChip.nextSibling);
      }
      var tolkning = document.querySelector('[data-tolkning]');
      tolkning.textContent = ' Vi starter med ' + forste.getAttribute('data-tema') + ', som du spurte om.';
      tolkning.hidden = false;
    }
  }

  // ---------- Antall ----------
  // «Lignende yrker» og «Utforsk» handler ikke om dette yrket og telles ikke med i «Alle».
  var grupper = Array.prototype.slice.call(document.querySelectorAll('[data-gruppe]'));
  var antall = { alle: 0 };
  grupper.forEach(function (g) {
    var id = g.getAttribute('data-gruppe');
    antall[id] = g.querySelectorAll(id === 'lignende' ? '[data-yrke]' : '[data-kort]').length;
    if (id !== 'lignende' && id !== 'utforsk') antall.alle += antall[id];
  });
  document.querySelectorAll('[data-antall]').forEach(function (el) {
    var tekst = '(' + antall[el.getAttribute('data-antall')] + ')';
    if (el.textContent !== tekst) { console.warn('Antall i markupen stemmer ikke:', el.getAttribute('data-antall'), el.textContent, '→', tekst); el.textContent = tekst; }
  });
  var ingress = document.querySelector('[data-antall-ingress]');
  if (ingress && ingress.textContent !== String(antall.alle)) { console.warn('Antall i ingressen stemmer ikke'); ingress.textContent = antall.alle; }

  // ---------- Se mer ----------
  // Viser resten av kortene i en gruppe eller et kort, og skjuler dem igjen.
  document.querySelectorAll('.se-mer').forEach(function (knapp) {
    var ekstraKort = knapp.closest('.kort, .gruppe').querySelectorAll('[data-ekstra]');
    var tekst = knapp.textContent;
    knapp.addEventListener('click', function () {
      var apne = knapp.getAttribute('aria-expanded') !== 'true';
      ekstraKort.forEach(function (k) { k.hidden = !apne; });
      knapp.setAttribute('aria-expanded', String(apne));
      knapp.textContent = apne ? 'Se færre' : tekst;
    });
  });

  // ---------- Velg tema ----------
  var NOKKEL = NOKKEL_GRUPPE + yrke;
  var brikker = document.querySelectorAll('[data-velg]');

  function lagre(id) { try { sessionStorage.setItem(NOKKEL, id); } catch (e) {} }
  function hent() { try { return sessionStorage.getItem(NOKKEL); } catch (e) { return null; } }

  // På desktop vises chipsene på én linje. De som ikke får plass, skjules bak «Vis N temaer til».
  var desktop = window.matchMedia('(min-width: 768px)');
  var rad = document.querySelector('.brikker');
  var flereLi = rad.querySelector('.vis-flere-plass');
  var flere = flereLi.querySelector('button');
  var chipLi = Array.prototype.filter.call(rad.children, function (li) { return li !== flereLi; });
  var apen = false;

  function settTekst(tekst, opp) {
    flere.querySelector('span').textContent = tekst;
    flere.querySelector('path').setAttribute('d', opp ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7');
  }

  function tilpass() {
    chipLi.forEach(function (li) { li.hidden = false; });
    rad.classList.toggle('apen', apen);
    flere.setAttribute('aria-expanded', String(apen));
    flereLi.hidden = !desktop.matches;
    if (!desktop.matches) return;
    if (apen) { settTekst('Vis færre', true); return; }
    var gap = parseFloat(getComputedStyle(rad).columnGap) || 0;
    var bredder = chipLi.map(function (li) { return li.offsetWidth; });
    var sum = bredder.reduce(function (a, b) { return a + b; }, 0) + gap * (chipLi.length - 1);
    if (sum <= rad.clientWidth) { flereLi.hidden = true; return; }
    settTekst('Vis ' + chipLi.length + ' temaer til', false);
    var plass = rad.clientWidth - flereLi.offsetWidth - gap;
    var brukt = 0, skjult = 0;
    chipLi.forEach(function (li, i) {
      var b = bredder[i] + (i ? gap : 0);
      if (skjult || brukt + b > plass) { li.hidden = true; skjult++; } else { brukt += b; }
    });
    settTekst('Vis ' + skjult + (skjult === 1 ? ' tema til' : ' temaer til'), false);
  }

  flere.addEventListener('click', function () { apen = !apen; tilpass(); });
  window.addEventListener('resize', tilpass);
  if (document.fonts) document.fonts.ready.then(tilpass);
  tilpass();

  function velg(id, rull) {
    if (id !== 'alle' && !document.querySelector('[data-gruppe="' + id + '"]')) id = 'alle';
    grupper.forEach(function (g) { g.hidden = !(id === 'alle' || g.getAttribute('data-gruppe') === id); });
    brikker.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-velg') === id)); });
    // Sørg for at valgt chip synes i den vannrette raden (for eksempel etter Tilbake)
    var chip = document.querySelector('[data-velg="' + id + '"]');
    if (chip.parentNode.hidden) { apen = true; tilpass(); }
    if (rull !== false) rad.scrollLeft = Math.max(0, chip.offsetLeft - rad.offsetLeft - 16);
    return id;
  }

  brikker.forEach(function (b) {
    // Trykk én gang for å velge et tema, og én gang til for å slå det av (tilbake til «Alle»).
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-velg');
      var av = id !== 'alle' && b.getAttribute('aria-pressed') === 'true';
      lagre(av ? velg('alle', false) : velg(id));
    });
  });
  velg(hent() || 'alle');
  window.addEventListener('pageshow', function (e) { if (e.persisted) velg(hent() || 'alle'); });
})();
