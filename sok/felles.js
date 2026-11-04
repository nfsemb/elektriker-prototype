// Felles skript for resultatsidene i sok/<side>/. Rutingen (yrkene, søket og hvilken side søket skal til) ligger i ruting.js,
// som må lastes først. Yrkessidene har data-yrke på body, situasjonssidene har data-side. Begge brukes som side-id.
(function () {
  'use strict';

  var erYrkesside = !!document.body.getAttribute('data-yrke');
  var side = document.body.getAttribute('data-yrke') || document.body.getAttribute('data-side');
  if (!side) return; // felles.js brukes bare på resultatsidene

  // ---------- Andre kilder ----------
  // BRYTER: false fjerner alt innhold som ikke er fra utdanning.no, det vil si alt med data-annen-kilde. I dag er det bare ung.no:
  // kortene, listen under valgkortene på «Hva kan jeg bli med psykologi?» og raden «Fra ung.no» i «Farger og ikoner».
  // Tallene i markupen gjelder med innholdet, så de regnes om uten advarsel (se «Antall»).
  var VIS_ANDRE_KILDER = false; // true viser alt, false fjerner alt som ikke er fra utdanning.no
  if (!VIS_ANDRE_KILDER) {
    document.querySelectorAll('[data-annen-kilde]').forEach(function (el) { el.parentNode.removeChild(el); });
  }

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

  // Resten bygger på ruting.js (window.KiSok). Mangler den, for eksempel når en gammel HTML-fil i nettleserens hurtigminne møter
  // en ny felles.js, står siden som den er, uten tilpasning til søket. Lenkene over virker fortsatt.
  if (!window.KiSok) {
    console.error('felles.js: ruting.js er ikke lastet (window.KiSok mangler), så siden vises uten tilpasning til søket. Last siden på nytt uten hurtigminne.');
    return;
  }

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

  // Situasjonssidene gir hver gruppe egne ord i data-ord="a|b|c". Finnes data-ord på minst én gruppe, brukes de i stedet for MATCH.
  // Reglene er de samme: hele ord (* på slutten treffer ordstart), uttrykk med flere ord teller dobbelt, og ved likt antall
  // poeng vinner gruppen som står først på siden. Sider uten data-ord, som yrkessidene, bruker MATCH som før.
  var harDataOrd = !!document.querySelector('[data-gruppe][data-ord]');

  function poengFor(tekst, uttrykk) {
    return uttrykk.reduce(function (sum, o) {
      if (!KiSok.harOrd(tekst, [o])) return sum;
      return sum + (KiSok.normaliser(o.replace(/\*$/, '')).trim().indexOf(' ') !== -1 ? 2 : 1);
    }, 0);
  }

  function finnGruppeMedDataOrd(tekst) {
    var best = null, bestPoeng = 0;
    Array.prototype.forEach.call(document.querySelectorAll('[data-gruppe][data-ord]'), function (g) {
      var poeng = poengFor(tekst, g.getAttribute('data-ord').split('|').filter(Boolean));
      if (poeng > bestPoeng) { best = { gruppe: g.getAttribute('data-gruppe'), poeng: poeng }; bestPoeng = poeng; }
    });
    return best;
  }

  function finnGruppe(tekst) {
    if (harDataOrd) return finnGruppeMedDataOrd(tekst);
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

  // Det effektive søket: det lagrede søket når rutingen sender det til denne siden, ellers eksempelsøket som står i markupen.
  // Handler det lagrede om noe annet, for eksempel etter en lenke under «Lignende yrker», vises bare eksempelet.
  // Alt som avhenger av søket, bruker det effektive søket, så en side som åpnes direkte (en delt lenke), ser ut som eksempelet.
  var felt = document.getElementById('sok');
  var lagret = KiSok.hentSok();
  var bruktLagret = !!lagret && KiSok.finnSide(lagret).side === side;
  var sok = bruktLagret ? lagret : felt.value;
  felt.value = sok;

  // Gruppene flyttes etter søket på yrkessidene (MATCH) og på situasjonssider som har data-ord på gruppene.
  // Andre situasjonssider har egne grupper og egne regler.
  if ((erYrkesside || harDataOrd) && bruktLagret) {
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
      var tema = forste.getAttribute('data-tema');
      if (tolkning && tema) {
        // Yrkessidene (MATCH) har alltid sagt «som du spurte om». På situasjonssidene sier siden det bare når gruppen fikk minst to poeng
        // (et uttrykk med flere ord, eller to ord som treffer). Ett vidt ord som «yrkesfag» eller «liker» er ikke det samme som å spørre om temaet.
        var spurtOm = !harDataOrd || treff.poeng >= 2;
        tolkning.textContent = ' Vi starter med ' + tema + (spurtOm ? ', som du spurte om.' : '.');
        tolkning.hidden = false;
      }
    }
  }

  // ---------- Det søket sier ----------
  // Situasjonssidene tilpasses søket med attributter i markupen. Yrkessidene har ingen av dem.
  // Et element som ikke passer søket, får hidden og data-irrelevant. Det telles ikke, og «Velg tema» viser det aldri.
  function vis(el, skalVises) {
    el.hidden = !skalVises;
    if (skalVises) el.removeAttribute('data-irrelevant'); else el.setAttribute('data-irrelevant', '');
  }
  function uttrykkene(el, attributt) { return el.getAttribute(attributt).split('|').filter(Boolean); }

  // data-sok-tekst: det effektive søket som tekst.
  document.querySelectorAll('[data-sok-tekst]').forEach(function (el) { el.textContent = sok; });

  // data-mente-boks: vises når søket ligner et yrke vi har (skrivefeil). a[data-mente] inni peker til yrkessiden.
  // data-uten-mente: motsatt, vises når søket ikke ligner noe yrke.
  var mente = KiSok.finnSide(sok).mente;
  var menteYrke = KiSok.YRKER.filter(function (y) { return y.id === mente; })[0];
  document.querySelectorAll('[data-mente-boks]').forEach(function (boks) {
    vis(boks, !!menteYrke);
    if (!menteYrke) return;
    boks.querySelectorAll('a[data-mente]').forEach(function (a) {
      a.setAttribute('href', '../' + menteYrke.id + '/');
      a.textContent = menteYrke.navn.charAt(0).toUpperCase() + menteYrke.navn.slice(1);
    });
  });
  document.querySelectorAll('[data-uten-mente]').forEach(function (el) { vis(el, !menteYrke); });

  // data-vis-hvis="a|b": vises når søket har et av uttrykkene som hele ord (uttrykk med * på slutten treffer ordstart).
  // data-vis-ikke-hvis="a|b": vises når søket ikke har noen av dem.
  // data-vis-hvis-lik="a|b": vises når hele søket er lik et av dem (store bokstaver og tegnsetting teller ikke).
  document.querySelectorAll('[data-vis-hvis]').forEach(function (el) {
    vis(el, KiSok.harOrd(sok, uttrykkene(el, 'data-vis-hvis')));
  });
  document.querySelectorAll('[data-vis-ikke-hvis]').forEach(function (el) {
    vis(el, !KiSok.harOrd(sok, uttrykkene(el, 'data-vis-ikke-hvis')));
  });
  document.querySelectorAll('[data-vis-hvis-lik]').forEach(function (el) {
    vis(el, uttrykkene(el, 'data-vis-hvis-lik').some(function (u) { return KiSok.normaliser(u) === KiSok.normaliser(sok); }));
  });

  // ---------- Verktøyet øverst ----------
  // Verktøysiden har ett kort per verktøy i [data-verktoy-pool] (skjult, med data-verktoy="id" på hvert kort). Kortet for verktøyet
  // søket gjelder, flyttes inn i [data-verktoy-plass]. De andre blir i poolen, som er skjult og ikke telles. Gjelder søket
  // ikke noe verktøy vi har kort for, vises Jobbkompasset, som er eksempelsøket.
  // data-verktoy-kort="id" skjules når id er verktøyet øverst (det står der allerede). data-kun-verktoy="id" vises bare da.
  var verktoyPlass = document.querySelector('[data-verktoy-plass]');
  var verktoyPool = document.querySelector('[data-verktoy-pool]');
  if (verktoyPlass && verktoyPool) {
    var verktoyId = KiSok.finnSide(sok).verktoy;
    var toppkort = verktoyId && verktoyPool.querySelector('[data-verktoy="' + verktoyId + '"]');
    if (!toppkort) {
      verktoyId = 'jobbkompasset';
      toppkort = verktoyPool.querySelector('[data-verktoy="jobbkompasset"]');
    }
    if (toppkort) verktoyPlass.appendChild(toppkort);
    document.querySelectorAll('[data-verktoy-kort]').forEach(function (el) {
      vis(el, el.getAttribute('data-verktoy-kort') !== verktoyId);
    });
    document.querySelectorAll('[data-kun-verktoy]').forEach(function (el) {
      vis(el, el.getAttribute('data-kun-verktoy') === verktoyId);
    });
  }

  // ---------- Antall ----------
  // Kort i et element med data-irrelevant telles ikke, og heller ikke kortene som blir igjen i verktøypoolen eller ligger i en variant
  // som ikke er valgt (se «Valg»). På yrkessidene handler «Lignende yrker» og «Utforsk» ikke om dette yrket og telles ikke med i «Alle».
  // På situasjonssidene telles alle gruppene. Tellingen kjøres på nytt når et valg endres.
  var grupper = Array.prototype.slice.call(document.querySelectorAll('[data-gruppe]'));
  var antall = { alle: 0 };
  // Tallene i markupen gjelder eksempelsøket. Har siden elementer som ikke passer søket, kan de med rette avvike.
  var avviker = VIS_ANDRE_KILDER && !document.querySelector('[data-irrelevant]');

  function tell(advar) {
    antall = { alle: 0 };
    grupper.forEach(function (g) {
      var id = g.getAttribute('data-gruppe');
      var iAlle = !(erYrkesside && (id === 'lignende' || id === 'utforsk'));
      var kort = g.querySelectorAll(erYrkesside && id === 'lignende' ? '[data-yrke]' : '[data-kort]');
      antall[id] = Array.prototype.filter.call(kort, function (k) { return !k.closest('[data-irrelevant], [data-verktoy-pool], [data-valg][hidden], [data-filtrert]'); }).length;
      if (iAlle) antall.alle += antall[id];
    });
    document.querySelectorAll('[data-antall]').forEach(function (el) {
      var tekst = '(' + antall[el.getAttribute('data-antall')] + ')';
      if (el.textContent !== tekst) {
        if (advar && avviker) console.warn('Antall i markupen stemmer ikke:', el.getAttribute('data-antall'), el.textContent, '→', tekst);
        el.textContent = tekst;
      }
    });
    var ingress = document.querySelector('[data-antall-ingress]');
    if (ingress && ingress.textContent !== String(antall.alle)) {
      if (advar && avviker) console.warn('Antall i ingressen stemmer ikke');
      ingress.textContent = antall.alle;
    }
    // Sider uten «Alle (N)» (ingen «Velg tema») har tallet her, så testsiden kan sjekke at det følger kortene som vises.
    document.body.setAttribute('data-antall-kort', String(antall.alle));
  }

  // ---------- Valg ----------
  // «Hva kan jeg bli med psykologi?» spør først hvilken utdanning deltakeren mener. Hver knapp button[data-valg-knapp="id"] velger
  // en utdanning, og elementene med data-valg="id" er innholdet for den. Før et valg er alle [data-valg] skjult og telles ikke.
  // Et trykk viser elementene med samme id, skjuler de andre og setter aria-pressed på knappene. Valget kan endres, og trykk på
  // den valgte knappen beholder valget. En gruppe der alt er varianter, vises bare når en av variantene vises. Valget lagres ikke.
  var valgKnapper = document.querySelectorAll('button[data-valg-knapp]');
  var valgElementer = document.querySelectorAll('[data-valg]');

  function settValg(id) {
    valgElementer.forEach(function (el) { el.hidden = el.getAttribute('data-valg') !== id; });
    valgKnapper.forEach(function (k) { k.setAttribute('aria-pressed', String(k.getAttribute('data-valg-knapp') === id)); });
    grupper.forEach(function (g) {
      if (g.querySelector('[data-valg]')) g.hidden = g.hasAttribute('data-irrelevant') || !g.querySelector('[data-valg]:not([hidden])');
    });
  }

  // Ingen utdanning er valgt når siden åpnes. Første telling kommer etter dette, så den teller riktige kort.
  if (valgElementer.length) settValg(null);
  tell(true);
  valgKnapper.forEach(function (knapp) {
    knapp.addEventListener('click', function () {
      settValg(knapp.getAttribute('data-valg-knapp'));
      tell(false);
      filtrer(aktivType); // gruppene for valget skal også følge filteret på innholdstype
    });
  });

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

  // ---------- Nytt søk ----------
  // En knapp med data-nytt-sok="tekst" starter et nytt søk, slik forsiden gjør: teksten blir søket, valgt tema nullstilles
  // for alle sider, og rutingen i sok/ velger siden. Søket går bare via sessionStorage og sendes ingen steder.
  document.querySelectorAll('button[data-nytt-sok]').forEach(function (knapp) {
    knapp.addEventListener('click', function () {
      try {
        sessionStorage.setItem(KiSok.NOKKEL_SOK, knapp.getAttribute('data-nytt-sok'));
        Object.keys(sessionStorage).filter(function (k) { return k.indexOf(KiSok.NOKKEL_GRUPPE) === 0; }).forEach(function (k) { sessionStorage.removeItem(k); });
      } catch (e) {}
      location.href = '../';
    });
  });

  // ---------- Innholdstype ----------
  // Radene i «Farger og ikoner» (li[data-type], bare på desktop) er også filter. Et trykk viser bare kortene av den typen i gruppene,
  // og grupper uten slike kort skjules. Trykk igjen for å se alt, eller på en annen type for å bytte. Filteret lagres ikke.
  // En type får knapp bare hvis siden har kort av den typen. Ellers skjules raden.
  // Kort i ingressen (valgkortene og ung.no-kortet på «Hva kan jeg bli med psykologi?») og veilederbanneret påvirkes ikke.
  // Det filteret skjuler, får data-filtrert (display: none i felles.css), så hidden fra de andre delene får stå i fred.
  // Kort bak «Se mer» som passer, vises mens filteret er på, og «Se mer» i gruppen skjules.
  var TYPER = { ung: 'kort--ung', yrke: 'kort--yrke', utdanning: 'kort--utdanning', artikkel: 'kort--artikkel', verktoy: 'kort--verktoy', intervju: 'intervju' };
  var TYPENAVN = { yrke: 'yrker og yrkesvideoer', utdanning: 'utdanninger', artikkel: 'artikler', verktoy: 'verktøy', intervju: 'intervjuer', ung: 'innhold fra ung.no' };
  var aktivType = null;
  var typeKnapper = [];
  var filterTekst = null;
  var gruppeSeMer = Array.prototype.filter.call(document.querySelectorAll('[data-gruppe] .se-mer'), function (b) { return !b.closest('.kort, .intervju'); });

  function typeAv(k) {
    for (var t in TYPER) if (k.classList.contains(TYPER[t])) return t;
    return k.hasAttribute('data-yrke') ? 'yrke' : null; // «Lignende yrker» er li[data-yrke] uten kortklasse
  }
  function kortIGruppe(g) { return g.querySelectorAll('[data-kort], li[data-yrke]'); }

  function filtrer(t) {
    aktivType = t;
    grupper.forEach(function (g) {
      var treff = 0;
      Array.prototype.forEach.call(kortIGruppe(g), function (k) {
        var passer = !t || typeAv(k) === t;
        if (passer) k.removeAttribute('data-filtrert'); else k.setAttribute('data-filtrert', '');
        // Kort bak «Se mer»: vises mens de passer filteret, og får tilbake tilstanden fra «Se mer» når filteret slås av eller byttes
        if (k.hasAttribute('data-ekstra')) {
          if (t && passer && k.hidden) { k.hidden = false; k.setAttribute('data-filter-viste', ''); }
          else if (k.hasAttribute('data-filter-viste') && !(t && passer)) { k.hidden = true; k.removeAttribute('data-filter-viste'); }
        }
        if (passer && !k.hidden && !k.closest('[data-irrelevant], [data-verktoy-pool], [data-valg][hidden]')) treff++;
      });
      if (!t || treff) g.removeAttribute('data-filtrert'); else g.setAttribute('data-filtrert', '');
    });
    gruppeSeMer.forEach(function (b) { if (t) b.setAttribute('data-filtrert', ''); else b.removeAttribute('data-filtrert'); });
    typeKnapper.forEach(function (k) { k.setAttribute('aria-pressed', String(k.getAttribute('data-type') === t)); });
    if (filterTekst) { filterTekst.hidden = !t; filterTekst.textContent = t ? 'Viser bare ' + TYPENAVN[t] + '.' : ''; }
    tell(false);
    // Et valgt tema uten kort av typen går tilbake til «Alle» (et trykk på valgt chip slår den av). Chips med 0 kan ikke trykkes.
    var valgt = document.querySelector('[data-velg][aria-pressed="true"]');
    if (t && valgt && valgt.getAttribute('data-velg') !== 'alle' && !antall[valgt.getAttribute('data-velg')]) valgt.click();
    document.querySelectorAll('[data-velg]').forEach(function (b) {
      var id = b.getAttribute('data-velg');
      b.disabled = !!t && id !== 'alle' && !antall[id];
    });
  }

  (function lagTypeKnapper() {
    var rader = document.querySelectorAll('.legende li[data-type]');
    if (!rader.length) return;
    var paSiden = {};
    document.querySelectorAll('.resultater [data-kort], [data-gruppe] li[data-yrke]').forEach(function (k) { var t = typeAv(k); if (t) paSiden[t] = true; });
    rader.forEach(function (li) {
      var t = li.getAttribute('data-type');
      if (!paSiden[t]) { li.hidden = true; return; }
      var knapp = document.createElement('button');
      knapp.type = 'button';
      knapp.className = 'legende-knapp';
      knapp.setAttribute('data-type', t);
      knapp.setAttribute('aria-pressed', 'false');
      knapp.setAttribute('style', li.getAttribute('style') || '');
      li.removeAttribute('style');
      while (li.firstChild) knapp.appendChild(li.firstChild);
      var hake = document.createElement('span');
      hake.className = 'legende-hake';
      hake.setAttribute('aria-hidden', 'true');
      hake.textContent = '✓';
      knapp.insertBefore(hake, knapp.lastElementChild); // foran ikonet
      li.classList.add('legende-rad');
      li.appendChild(knapp);
      knapp.addEventListener('click', function () { filtrer(aktivType === t ? null : t); });
      typeKnapper.push(knapp);
    });
    var tittel = document.querySelector('.legende-tittel');
    if (tittel && typeKnapper.length) {
      var hjelp = document.createElement('p');
      hjelp.className = 'legende-hjelp';
      hjelp.textContent = 'Trykk på en type for å vise bare den. Trykk igjen for å se alle.';
      tittel.parentNode.insertBefore(hjelp, tittel.nextSibling);
    }
    // «Viser bare …» står under første avsnitt i ingressen (p.meta eller p.avvisning), og leses opp av skjermlesere når filteret endres
    var forste = document.querySelector('.treff > p');
    if (forste) {
      filterTekst = document.createElement('p');
      filterTekst.className = 'meta filter-tekst';
      filterTekst.setAttribute('role', 'status');
      filterTekst.hidden = true;
      forste.parentNode.insertBefore(filterTekst, forste.nextSibling);
    }
  })();

  // ---------- Velg tema ----------
  // Sider uten «Velg tema» (bli-med-psykologi) har ingen chips å styre, og alt under her gjelder bare chipsene. Denne delen må stå sist.
  if (!document.querySelector('.brikker')) return;
  var NOKKEL = KiSok.NOKKEL_GRUPPE + side;
  var brikker = document.querySelectorAll('[data-velg]');

  function lagre(id) { try { sessionStorage.setItem(NOKKEL, id); } catch (e) {} }
  function hent() { try { return sessionStorage.getItem(NOKKEL); } catch (e) { return null; } }

  // På desktop vises chipsene på én linje. De som ikke får plass, skjules bak «Vis N temaer til».
  var desktop = window.matchMedia('(min-width: 768px)');
  var rad = document.querySelector('.brikker');
  var flereLi = rad.querySelector('.vis-flere-plass');
  var flere = flereLi.querySelector('button');
  var chipLi = Array.prototype.filter.call(rad.children, function (li) { return li !== flereLi; });
  // Chipen for en gruppe som ikke passer søket, skjules for godt og tas ikke med i «Vis N temaer til».
  function erIrrelevant(id) {
    var g = id !== 'alle' && document.querySelector('[data-gruppe="' + id + '"]');
    return !!g && g.hasAttribute('data-irrelevant');
  }
  chipLi = chipLi.filter(function (li) {
    var borte = erIrrelevant(li.querySelector('[data-velg]').getAttribute('data-velg'));
    if (borte) li.hidden = true;
    return !borte;
  });
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
    if (id !== 'alle' && (!document.querySelector('[data-gruppe="' + id + '"]') || erIrrelevant(id))) id = 'alle';
    // En gruppe som ikke passer søket, vises aldri
    grupper.forEach(function (g) { g.hidden = g.hasAttribute('data-irrelevant') || !(id === 'alle' || g.getAttribute('data-gruppe') === id); });
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
