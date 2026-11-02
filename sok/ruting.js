// Rutingen: finner ut hvilken side søket fra forsiden skal til, og hva siden ellers trenger å vite om søket.
// Brukes av sok/ (som sender søket videre), av resultatsidene (via felles.js) og av scripts/test-ruting.mjs (Node).
// Ingen avhengigheter, og ingenting her sender søket noe sted.
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
    { id: 'laerer', navn: 'lærer', ord: new RegExp(G + '((yrkesfag)?lærer(e|en|ne|yrket|utdanning(en)?)?|lektor(er)?|adjunkt)([^a-zæøå]|$)'), sist: true }
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

  // ---------- Tekstvask ----------
  // Først NFC, så en «å» som er skrevet som «a» + tegn over (slik noen tastaturer og innlimte tekster gjør) blir den vanlige «å».
  // Så små bokstaver, og alt som ikke er bokstav, tall eller skråstrek blir mellomrom. Ett mellomrom foran og bak,
  // så «sykepleie!!» og «  Sykepleie » er den samme teksten, og et helt ord alltid kan søkes opp som « ord ».
  function normaliser(tekst) {
    var t = String(tekst == null ? '' : tekst).normalize('NFC').toLowerCase();
    return (' ' + t + ' ').replace(/[^a-z0-9æøåéü\/]+/g, ' ');
  }

  // Sann når et av uttrykkene står i teksten som hele ord. Et uttrykk som slutter på «*», treffer også ord som
  // begynner slik, så «praktikant*» treffer «praktikanter». Uttrykkene vaskes på samme måte som teksten.
  function harOrd(tekst, ord) {
    var t = normaliser(tekst);
    return ord.some(function (o) {
      var stjerne = o.charAt(o.length - 1) === '*';
      var n = normaliser(stjerne ? o.slice(0, -1) : o);
      return t.indexOf(stjerne ? n.slice(0, -1) : n) !== -1;
    });
  }

  // ---------- Skrivefeil på yrkesnavn ----------
  // Damerau–Levenshtein: antall innsettinger, slettinger, bytter og ombyttinger av to nabobokstaver mellom to ord.
  function avstand(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) { d[0][j] = j; }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        var kost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + kost);
        if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }

  // «lege» (fire bokstaver) er for kort til å gjette på, så det er ikke med.
  var NAERME_YRKER = YRKER.filter(function (y) { return y.navn.length >= 5; });

  // Yrket søket sannsynligvis mente når ingenting annet passer, ellers null. Bare ord på minst fem bokstaver teller,
  // og ordet må ligge nær yrkesnavnet uten å være likt det: én feil for korte navn, opptil to for navn på åtte bokstaver
  // eller mer. Ligger flere nær, vinner den med minst avstand, og ved likhet den som kommer først.
  function naermesteYrke(tekst) {
    var ord = normaliser(tekst).trim().split(' ').filter(function (o) { return o.length >= 5; });
    var best = null, bestAvstand = Infinity;
    ord.forEach(function (o) {
      NAERME_YRKER.forEach(function (y) {
        var maks = y.navn.length >= 8 ? 2 : 1;
        var a = avstand(o, y.navn);
        if (a >= 1 && a <= maks && a < bestAvstand) { best = y; bestAvstand = a; }
      });
    });
    return best ? best.id : null;
  }

  // ---------- Verktøyene ----------
  // Rekkefølgen avgjør når søket treffer flere: den første i lista vinner.
  var VERKTOY = [
    { id: 'jobbkompasset', ord: ['jobbkompass*'] },
    { id: 'utdanningskompasset', ord: ['utdanningskompass*'] },
    { id: 'karakterkalkulator', ord: ['karakterkalkulator*', 'kalkulator*', 'poengkalkulator*'] },
    { id: 'studievelgeren', ord: ['studievelger*'] },
    { id: 'fagskolevelgeren', ord: ['fagskolevelger*'] },
    { id: 'finn-laerebedrift', ord: ['finn lærebedrift', 'lærebedrift*', 'finnlærebedrift', 'finnlarebedrift'] },
    { id: 'sammenlign', ord: ['sammenlign*'] },
    { id: 'jobbkartet', ord: ['jobbkart*'] },
    { id: 'likestilling', ord: ['likestilling'] },
    { id: 'muligheter-med-yrkesfag', ord: ['muligheter med yrkesfag', 'hva kan du bli med yrkesfag', 'hva kan jeg bli med yrkesfag', 'hva kan man bli med yrkesfag'] },
    { id: 'veien-til-fagbrev', ord: ['veien til fagbrev'] },
    { id: 'veien-til-studiekompetanse', ord: ['veien til studiekompetanse'] },
    { id: 'realkompetansevurdering', ord: ['realkompetansevurdering*'] },
    { id: 'utdanningssystemet', ord: ['utdanningssystem*'] },
    { id: 'yrkesfaghandboka', ord: ['yrkesfaghåndbok*'] },
    { id: 'veien-til-utveksling', ord: ['veien til utveksling'] },
    { id: 'alle-yrker', ord: ['interessevelger*', 'alle yrker'] },
    { id: 'alle-verktoy', ord: ['alle verktøy'] }
  ];
  // To verktøy treffer også når hele søket er ett bestemt ord.
  var HELE_SOKET = { 'yrker': 'alle-yrker', 'verktøy': 'alle-verktoy' };

  // ---------- Situasjonene ----------
  // Uttrykk som viser at deltakeren utforsker, for eksempel «hva kan jeg bli med psykologi?».
  var BLI_MED = ['bli med', 'jobbe med', 'jobb med', 'hvis jeg studerer', 'hvis jeg tar', 'etter en bachelor i', 'etter en master i'];
  var SYKEPLEIE = /(^|[^a-zæøå])sykepleie(?!r)/; // «sykepleier» er yrket, «sykepleie» er utdanningen
  var JOBBSOKING = ['cv', 'cv-mal*', 'jobbsøknad*', 'søknadsbrev*', 'jobbintervju*', 'søke jobb', 'søker jobb', 'jobbsøking', 'deltidsjobb*', 'ekstrajobb*', 'få jobb', 'får jeg jobb', 'får man jobb'];
  // «hvilke bedrifter» og «hvilke firmaer» alene er ikke nok: «hvilke bedrifter tar inn lærlinger» skal til videregående, ikke hit.
  var UTENFOR = ['praktikant*', 'praksisplass*', 'ledige stillinger', 'ledig stilling*', 'sommerjobb*', 'akkurat nå', 'hvilke firmaer søker', 'hvilke bedrifter søker'];
  var UTFORSK = ['aner ikke', 'vet ikke hva', 'usikker på hva', 'hva passer', 'passer for meg', 'passer meg', 'interessetest*', 'yrkestest*', 'personlighetstest*', 'quiz', 'vanskelig å velge', 'hva kan jeg bli', 'hva kan man bli', 'hva skal jeg bli', 'hva skal jeg velge', 'hvordan velger*', 'jeg liker', 'interessert i'];
  var VOKSEN = ['som voksen', 'voksen*', 'realkompetanse', 'bytte yrke', 'bytte jobb', 'omskoler*', 'karriereskifte', 'godkjenning*', 'utenlandsk utdanning', 'praksiskandidat*', '23/5', '23/6'];
  // «over 19» og «over 20» til «over 99» er en alder. «over 2*» og «over 19*» tok også med beløp som «over 200 000» og «over 190 000»,
  // så tallet må stå helt for seg selv (eventuelt med «år» rett etter), og et tresifret tall etter mellomrom («over 20 000») er et beløp.
  var ALDER_OVER = / over (?:19|[2-9][0-9])(?:år)?(?= )(?! [0-9]{3})/;
  var VIDEREGAENDE = ['yrkesfag*', 'studieforberedende', 'studiespesialisering', 'utdanningsprogram*', 'vg1', 'vg2', 'vg3', 'påbygg*', 'studiekompetanse*', 'lærling*', 'læreplass*', 'opplæringskontor*', 'fagbrev*', 'yff', 'taf', 'videregående', 'vgs'];

  // Hvilken side søket skal til. Den første regelen som passer, vinner, så samme tekst gir alltid samme side:
  // utforsking av psykologi, utdanningen sykepleie, et yrke, et verktøy, jobbsøking, noe prototypen ikke dekker,
  // utforsking, voksen, videregående, en skrivefeil, og til slutt «uklart».
  // Uten søk går siden til elektriker, slik sok/ alltid har gjort. Returnerer { side }, og i tillegg
  // verktoy (id) for verktøyene og mente (yrke-id) når søket ligner et yrkesnavn.
  function finnSide(tekst) {
    if (!tekst) return { side: 'elektriker' };
    var t = normaliser(tekst);

    if (harOrd(t, ['psykologi']) && harOrd(t, BLI_MED)) return { side: 'bli-med-psykologi' };
    if (SYKEPLEIE.test(t)) return { side: 'sykepleie' };

    var yrke = finnYrke(t);
    if (yrke) return { side: yrke };

    for (var i = 0; i < VERKTOY.length; i++) {
      if (harOrd(t, VERKTOY[i].ord)) return { side: 'verktoy', verktoy: VERKTOY[i].id };
    }
    if (HELE_SOKET.hasOwnProperty(t.trim())) return { side: 'verktoy', verktoy: HELE_SOKET[t.trim()] };

    if (harOrd(t, JOBBSOKING)) return { side: 'jobbsoking' };
    if (harOrd(t, UTENFOR)) return { side: 'utenfor' };
    if (harOrd(t, BLI_MED)) return { side: 'utforsk' };
    if (harOrd(t, UTFORSK)) return { side: 'utforsk' };
    if (ALDER_OVER.test(t) || harOrd(t, VOKSEN)) return { side: 'voksen' };
    if (harOrd(t, VIDEREGAENDE)) return { side: 'videregaende' };

    var mente = naermesteYrke(t);
    return mente ? { side: 'uklart', mente: mente } : { side: 'uklart' };
  }

  var KiSok = {
    NOKKEL_SOK: NOKKEL_SOK, NOKKEL_GRUPPE: NOKKEL_GRUPPE,
    YRKER: YRKER, finnYrke: finnYrke, hentSok: hentSok,
    normaliser: normaliser, harOrd: harOrd, naermesteYrke: naermesteYrke,
    VERKTOY: VERKTOY, finnSide: finnSide
  };

  // I nettleseren slås det sammen med det som alt ligger på window.KiSok. I Node (testene) eksporteres det.
  if (typeof window !== 'undefined') window.KiSok = Object.assign(window.KiSok || {}, KiSok);
  if (typeof module !== 'undefined') module.exports = KiSok;
})();
