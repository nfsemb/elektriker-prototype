// Testsaker for søkesidene. Hver sak er { sok, side, forste?, synlig?, skjult?, tekst?, klikk?, direkte? }:
//   sok     søket som settes i sessionStorage (utelates når direkte er true)
//   side    siden søket skal ende på: data-yrke eller data-side på body
//   forste  id (data-gruppe) på den første gruppen som er synlig
//   synlig  selektorer der alle treff er synlige (minst ett treff)
//   skjult  selektorer der ingen treff er synlige (ingen treff er også greit)
//   tekst   { selektor: tekst }: alle treff inneholder teksten (minst ett treff)
//   klikk   liste med selektorer som trykkes én etter én før sjekkene kjøres (for eksempel et valg på «Hva kan jeg bli med psykologi?»)
//   direkte true: siden åpnes uten søk, som en delt lenke
//   adresse     tillegg til adressen når siden åpnes direkte, for eksempel 'yrke=automatiker' (sok/ikke-klar/)
//   ingress    liste med tekster som alle står i det som vises i ingressen (.treff, bare synlig tekst, mellomrom slått sammen)
//   ikkeIngress liste med tekster som ikke står i den synlige ingressen
//   href        { selektor: href }: alle treff har akkurat denne href-en (minst ett treff)
//   bredde      bredden på iframen i px (mobil: 390). Da sjekkes det også at siden ikke ruller vannrett.
//   Sider uten «Alle (N)» (ingen «Velg tema») skriver antallet synlige kort i body[data-antall-kort], og det sjekkes mot kortene som vises.
// Hver sideoppgave legger til sine rader her.

// Én rad for verktøysiden: søket (første uttrykk i ord for verktøyet i ruting.js, uten *, skrevet inn her med vilje) skal gi
// verktøykortet øverst. Poolen med de andre kortene skal være skjult, og «Hva er Jobbkompasset?» vises bare for Jobbkompasset.
function verktoyRad(sok, id, ekstra) {
  ekstra = ekstra || {};
  var sak = {
    sok: sok, side: 'verktoy', forste: 'verktoyet',
    synlig: ['[data-verktoy-plass] [data-verktoy="' + id + '"]'].concat(ekstra.synlig || []),
    skjult: ['[data-verktoy-pool] [data-verktoy]'].concat(ekstra.skjult || [])
  };
  if (id !== 'jobbkompasset') sak.skjult.push('[data-kun-verktoy="jobbkompasset"]');
  return sak;
}

// Ett langt ord uten mellomrom, bredere enn en mobilskjerm
var LANGT_ORD = 'ordutenmellomromsomerlangtnoktilatdetikkefarplassp\u00e5enmobilskjerm'.repeat(2);

var SAKER = [
  { sok: 'Elektriker', side: 'elektriker' },
  { sok: 'Hva tjener en elektriker?', side: 'elektriker', forste: 'lonn' },
  { sok: 'Hvordan blir jeg sykepleier?', side: 'sykepleier', forste: 'bli' },
  { sok: 'Hvordan blir man psykolog?', side: 'psykolog', forste: 'bli', ingress: ['Vi starter med hvordan du blir psykolog, som du spurte om.'] },
  { sok: 'Hva gjør en psykolog?', side: 'psykolog' },
  // «Farger og ikoner» som filter (desktop): ett trykk viser bare den typen, grupper uten typen skjules, tallene følger med.
  { sok: 'Psykolog', side: 'psykolog', klikk: ['.legende-knapp[data-type="intervju"]'],
    synlig: ['[data-kort="intervju-kaja"]', '[data-gruppe="etterpa"] .intervju', '.legende-knapp[data-type="intervju"][aria-pressed="true"]', '[data-velg="lonn"]:disabled'],
    skjult: ['[data-gruppe="lonn"]', '[data-gruppe="jobben"]', '[data-gruppe="bli"] .kort--utdanning', '[data-kort="ung-psykolog-linje"]'],
    ingress: ['Viser bare intervjuer.'] },
  // Trykk igjen: alt er tilbake
  { sok: 'Psykolog', side: 'psykolog', klikk: ['.legende-knapp[data-type="intervju"]', '.legende-knapp[data-type="intervju"]'],
    synlig: ['[data-gruppe="lonn"]', '[data-kort="ung-psykolog-linje"]', '.legende-knapp[data-type="intervju"][aria-pressed="false"]'], skjult: ['[data-velg="lonn"]:disabled'], ikkeIngress: ['Viser bare'] },
  // En annen type bytter filteret
  { sok: 'Psykolog', side: 'psykolog', klikk: ['.legende-knapp[data-type="intervju"]', '.legende-knapp[data-type="ung"]'],
    synlig: ['[data-kort="ung-psykolog-linje"]'], skjult: ['[data-kort="intervju-kaja"]'], ingress: ['Viser bare innhold fra ung.no.'] },
  // Kort bak «Se mer» som passer, vises med en gang, og «Se mer» skjules mens filteret er på
  { sok: 'Psykolog', side: 'psykolog', klikk: ['.legende-knapp[data-type="verktoy"]'],
    synlig: ['[data-kort="jobbkompasset"]', '[data-kort="karakterkalkulatoren"]'], skjult: ['[data-gruppe="utforsk"] .pill.se-mer', '[data-gruppe="etterpa"]'] },
  // Et tema uten typen går tilbake til «Alle»
  { sok: 'Psykolog', side: 'psykolog', klikk: ['[data-velg="lonn"]', '.legende-knapp[data-type="intervju"]'],
    synlig: ['[data-velg="alle"][aria-pressed="true"]', '[data-kort="intervju-kaja"]'] },
  // Typer uten kort får ingen rad. Psykologsiden har ingen artikler.
  { sok: 'Psykolog', side: 'psykolog', synlig: ['.legende-knapp[data-type="intervju"]'], skjult: ['.legende [data-type="artikkel"]'] },
  // Kortene i ingressen på «Hva kan jeg bli med psykologi?» gir raden «Fra ung.no», og filteret rører dem ikke
  { sok: 'Hva kan jeg bli med psykologi?', side: 'bli-med-psykologi', klikk: ['.legende-knapp[data-type="verktoy"]'],
    synlig: ['.legende-knapp[data-type="ung"]', '.treff [data-kort="ung-psykologi-forskjell"]', '.treff [data-kort="valg-fag"]', '[data-kort="forslag-utdanninger-yrker"]'], skjult: ['.legende [data-type="artikkel"]'] },
  // ung.no-kortet står i gruppen der spørsmålet hører hjemme, og fargeforklaringen har raden «Fra ung.no».
  { sok: 'Hvordan blir man psykolog?', side: 'psykolog', forste: 'bli',
    synlig: ['[data-gruppe="bli"] [data-kort="ung-psykolog-linje"]'],
    tekst: { '[data-kort="ung-psykolog-linje"] .ung-svarer': 'Svar fra Karriereveiledning.no, 30.3.2026', '.legende-ung': 'Fra ung.no' } },
  { sok: 'Hvordan blir jeg elektriker?', side: 'elektriker', synlig: ['[data-gruppe="bli"] [data-kort="ung-elektriker-matte"]'],
    tekst: { '[data-kort="ung-elektriker-matte"] .ung-svarer': 'Svar fra rådgiver og karriereveileder vgs, 6.8.2024', '.legende-ung': 'Fra ung.no' } },
  { sok: 'Hvordan blir jeg lege?', side: 'lege', synlig: ['[data-gruppe="bli"] [data-kort="ung-lege-karakterer"]'],
    tekst: { '[data-kort="ung-lege-karakterer"] .ung-svarer': 'Svar fra Karriereveiledning.no, 4.8.2025', '.legende-ung': 'Fra ung.no' } },
  { sok: 'Hvordan blir jeg sykepleier?', side: 'sykepleier', synlig: ['[data-gruppe="bli"] [data-kort="ung-sykepleier-yrkesfag"]'],
    tekst: { '[data-kort="ung-sykepleier-yrkesfag"] .ung-svarer': 'Svar fra rådgiver og karriereveileder, 21.4.2026', '.legende-ung': 'Fra ung.no' } },
  { sok: 'Hva gjør en lærer?', side: 'laerer', synlig: ['[data-gruppe="jobben"] [data-kort="ung-laerer-gjor"]'],
    tekst: { '[data-kort="ung-laerer-gjor"] .ung-svarer': 'Svar fra rådgiver og karriereveileder, 4.9.2026', '.legende-ung': 'Fra ung.no' } },
  { sok: 'Hvordan blir jeg politi?', side: 'politi', synlig: ['[data-gruppe="bli"] [data-kort="ung-politi-krav"]'],
    tekst: { '[data-kort="ung-politi-krav"] .ung-svarer': 'Svar fra Karriereveiledning.no, 1.6.2026', '.legende-ung': 'Fra ung.no' } },
  { sok: 'Hvordan blir jeg advokat?', side: 'advokat', synlig: ['[data-gruppe="bli"] [data-kort="ung-advokat-snitt"]'],
    tekst: { '[data-kort="ung-advokat-snitt"] .ung-svarer': 'Svar fra Karriereveiledning.no, 27.3.2026', '.legende-ung': 'Fra ung.no' } },
  { sok: 'Hvor kan jeg jobbe som advokat?', side: 'advokat', forste: 'hvor' },
  { sok: 'Politi', side: 'politi' },
  { sok: 'Jeg liker å hjelpe barn. Kan jeg bli lærer?', side: 'laerer' },
  { sok: 'Hva kan jeg spesialisere meg i som lege?', side: 'lege', forste: 'etterpa' },
  { sok: 'hvordan blir man elektriker som voksen?', side: 'elektriker', forste: 'bli' },
  { sok: 'yrkesfaglærer', side: 'laerer' },
  { sok: 'sykepleie', side: 'sykepleie', forste: 'laere' },
  { sok: 'sykepleie bergen', side: 'sykepleie', forste: 'hvor', synlig: ['[data-vis-hvis="bergen"]'] },
  // «Se snitt» på utdanningskortet går til Vestland-filteret når søket nevner Bergen
  { sok: 'sykepleie bergen', side: 'sykepleie', skjult: ['[data-kort="utdanning-sykepleie"] [data-vis-ikke-hvis="bergen"]'],
    href: { '[data-kort="utdanning-sykepleie"] .handlinger [data-vis-hvis="bergen"]': 'https://utdanning.no/utdanningsoversikt/sykepleie?f%5B0%5D=fylke_gs%3AVestland' } },
  { sok: 'Hvor mange poeng trenger jeg for sykepleie?', side: 'sykepleie', forste: 'poeng' },
  // Ingressen på utforsk: «aner ikke» gir en setning om at det er vanlig å ikke vite. «Vi starter med …» kommer bare når søket traff en gruppe,
  // og «som du spurte om» bare når den fikk minst to poeng (et uttrykk med flere ord, eller to ord).
  { sok: 'Jeg aner ikke hva jeg vil bli', side: 'utforsk', forste: 'begynne',
    ingress: ['Det er helt vanlig å ikke vite. Her er måter å finne ut av det på.'], ikkeIngress: ['Vi starter med', 'så vi starter'] },
  { sok: 'interessetest', side: 'utforsk', forste: 'passe',
    ingress: ['Her er måter å finne ut av det på. Vi starter med verktøy og tester, som du spurte om.'], ikkeIngress: ['helt vanlig'] }, // to poeng: interessetest* og interesse*
  { sok: 'Om man har to yrker man vil ta, hvordan velger man en av dem?', side: 'utforsk', forste: 'finne-ut',
    ingress: ['Vi starter med måter å sjekke yrker og utdanninger på, som du spurte om.'], ikkeIngress: ['helt vanlig'] },
  { sok: 'Jeg liker å jobbe med hendene og vil ut i jobb fort. Hva kan jeg bli?', side: 'utforsk', forste: 'passe',
    ingress: ['Vi starter med verktøy og tester.'], ikkeIngress: ['som du spurte om'] },
  // «Hva kan jeg bli med psykologi?»: før valget vises bare de to utdanningskortene og «Vil du utforske flere muligheter?».
  // Et trykk på en av knappene viser variantene for den utdanningen, og valget kan endres. «Alle (N)» (body[data-antall-kort]) følger kortene som vises.
  { sok: 'Hva kan jeg bli med psykologi?', side: 'bli-med-psykologi', forste: 'utforske',
    synlig: ['[data-valg-knapp="profesjon"][aria-pressed="false"]', '[data-valg-knapp="fag"][aria-pressed="false"]', '[data-gruppe="utforske"]'],
    skjult: ['[data-valg]', '[data-gruppe="jobber"]', '[data-gruppe="ligner"]', '[data-gruppe="andre"]'] },
  { sok: 'Hva kan jeg bli med psykologi?', side: 'bli-med-psykologi', klikk: ['[data-valg-knapp="profesjon"]'], forste: 'jobber',
    synlig: ['[data-valg="profesjon"]', '[data-valg-knapp="profesjon"][aria-pressed="true"]', '[data-valg-knapp="fag"][aria-pressed="false"]', '[data-gruppe="utforske"]'],
    skjult: ['[data-valg="fag"]', '[data-gruppe="andre"]'] },
  { sok: 'Hva kan jeg bli med psykologi?', side: 'bli-med-psykologi', klikk: ['[data-valg-knapp="fag"]'], forste: 'jobber',
    synlig: ['[data-valg="fag"]', '[data-valg-knapp="fag"][aria-pressed="true"]', '[data-valg-knapp="profesjon"][aria-pressed="false"]', '[data-gruppe="andre"]', '[data-gruppe="utforske"]'],
    skjult: ['[data-valg="profesjon"]'] },
  // Valget kan endres, begge veier
  { sok: 'Hva kan jeg bli med psykologi?', side: 'bli-med-psykologi', klikk: ['[data-valg-knapp="profesjon"]', '[data-valg-knapp="fag"]'], forste: 'jobber',
    synlig: ['[data-valg="fag"]', '[data-valg-knapp="fag"][aria-pressed="true"]', '[data-gruppe="andre"]'],
    skjult: ['[data-valg="profesjon"]', '[data-valg-knapp="profesjon"][aria-pressed="true"]'] },
  { sok: 'Hva kan jeg bli med psykologi?', side: 'bli-med-psykologi', klikk: ['[data-valg-knapp="fag"]', '[data-valg-knapp="profesjon"]'], forste: 'jobber',
    synlig: ['[data-valg="profesjon"]', '[data-valg-knapp="profesjon"][aria-pressed="true"]'],
    skjult: ['[data-valg="fag"]', '[data-valg-knapp="fag"][aria-pressed="true"]', '[data-gruppe="andre"]'] },
  // Et trykk på valgt knapp igjen beholder valget
  { sok: 'Hva kan jeg bli med psykologi?', side: 'bli-med-psykologi', klikk: ['[data-valg-knapp="fag"]', '[data-valg-knapp="fag"]'],
    synlig: ['[data-valg="fag"]', '[data-valg-knapp="fag"][aria-pressed="true"]'], skjult: ['[data-valg="profesjon"]'] },
  // Andre formuleringer, store bokstaver og tegnsetting gir samme side, og søket står i ingressen
  { sok: 'hvis jeg studerer psykologi, hva kan jeg jobbe med?', side: 'bli-med-psykologi', skjult: ['[data-valg]'], tekst: { '[data-sok-tekst]': 'hvis jeg studerer psykologi' } },
  { sok: '  HVA KAN JEG BLI MED PSYKOLOGI!! ', side: 'bli-med-psykologi', skjult: ['[data-valg]'] },
  // ung.no-kortet står under de to valgkortene, før og etter valget, og telles ikke
  { sok: 'Hva kan jeg bli med psykologi?', side: 'bli-med-psykologi', synlig: ['.treff [data-kort="ung-psykologi-forskjell"]'] },
  { sok: 'Hva kan jeg bli med psykologi?', side: 'bli-med-psykologi', klikk: ['[data-valg-knapp="fag"]'], synlig: ['.treff [data-kort="ung-psykologi-forskjell"]'] },
  { sok: 'Hva kan jeg bli med psykologi?', side: 'bli-med-psykologi', klikk: ['[data-valg-knapp="profesjon"]'], synlig: ['.treff [data-kort="ung-psykologi-forskjell"]'] },
  { side: 'bli-med-psykologi', direkte: true, forste: 'utforske', skjult: ['[data-valg]'], tekst: { '[data-sok-tekst]': 'Hva kan jeg bli med psykologi?' } },
  { sok: 'Hva er forskjellen på yrkesfag og studieforberedende?', side: 'videregaende', forste: 'forskjell', skjult: ['[data-vis-hvis-lik="yrkesfag"]'],
    ingress: ['Vi starter med forskjellen på yrkesfag og studieforberedende, som du spurte om.'] },
  // Ett vidt ord (1 poeng) gir «Vi starter med …» uten «som du spurte om»
  { sok: 'yrkesfag', side: 'videregaende', synlig: ['[data-vis-hvis-lik="yrkesfag"]'],
    ingress: ['Vi starter med forskjellen på yrkesfag og studieforberedende.'], ikkeIngress: ['som du spurte om'] },
  { sok: 'hvordan skaffe læreplass', side: 'videregaende', forste: 'laerling' },
  { sok: 'Kan jeg gå påbygg etter yrkesfag?', side: 'videregaende', forste: 'fast',
    ingress: ['Vi starter med omvalg og videre studier, som du spurte om.'] },
  { sok: 'studiekompetanse', side: 'videregaende', forste: 'fast',
    ingress: ['Vi starter med omvalg og videre studier.'], ikkeIngress: ['som du spurte om'] },
  { sok: 'generell studiekompetanse', side: 'videregaende', forste: 'fast' },
  // Lærling-søk: «hvilke bedrifter» alene er ikke «utenfor»
  { sok: 'hvilke bedrifter tar inn lærlinger i bergen', side: 'videregaende', forste: 'laerling' },
  // Verktøysiden: verktøyet det søkes etter, står øverst. Resten av siden er felles (se verktoyRad under).
  verktoyRad('jobbkompasset', 'jobbkompasset', { synlig: ['[data-kun-verktoy="jobbkompasset"]'] }),
  verktoyRad('utdanningskompass', 'utdanningskompasset', { skjult: ['[data-verktoy-kort="utdanningskompasset"]'] }),
  verktoyRad('karakterkalkulator', 'karakterkalkulator'),
  verktoyRad('studievelger', 'studievelgeren'),
  verktoyRad('fagskolevelger', 'fagskolevelgeren'),
  verktoyRad('finn lærebedrift', 'finn-laerebedrift'),
  verktoyRad('sammenlign', 'sammenlign'),
  verktoyRad('jobbkart', 'jobbkartet'),
  verktoyRad('likestilling', 'likestilling'),
  verktoyRad('muligheter med yrkesfag', 'muligheter-med-yrkesfag'),
  verktoyRad('veien til fagbrev', 'veien-til-fagbrev'),
  verktoyRad('veien til studiekompetanse', 'veien-til-studiekompetanse'),
  verktoyRad('realkompetansevurdering', 'realkompetansevurdering'),
  verktoyRad('utdanningssystem', 'utdanningssystemet'),
  verktoyRad('yrkesfaghåndbok', 'yrkesfaghandboka'),
  verktoyRad('veien til utveksling', 'veien-til-utveksling'),
  verktoyRad('interessevelger', 'alle-yrker', { skjult: ['[data-verktoy-kort="alle-yrker"]'] }),
  verktoyRad('alle verktøy', 'alle-verktoy', { skjult: ['[data-verktoy-kort="alle-verktoy"]'] }),
  // Store bokstaver og tegnsetting, og et besøk uten søk, gir eksempelet
  verktoyRad('  JOBBKOMPASSET!! ', 'jobbkompasset', { synlig: ['[data-kun-verktoy="jobbkompasset"]'] }),
  { side: 'verktoy', direkte: true, forste: 'verktoyet', synlig: ['[data-verktoy-plass] [data-verktoy="jobbkompasset"]', '[data-kun-verktoy="jobbkompasset"]'] },
  // Ingressen på voksen har fire varianter: yrket og alderen, bare yrket, godkjenning, og den generelle. Gruppen og chipen for et yrke eller en
  // godkjenning vises bare når søket nevner det. Skjules chipen ikke, kan deltakeren trykke på noe som ikke finnes.
  { sok: 'Er det mulig å bli ambulansearbeider når man er over 19år', side: 'voksen',
    synlig: ['[data-gruppe="ambulanse"]', '[data-velg="ambulanse"]'], skjult: ['[data-gruppe="godkjenning"]', '[data-velg="godkjenning"]'],
    ingress: ['Du spør om du kan bli ambulansearbeider når du er over 19 år.', 'Vi starter med videregående som voksen, som du spurte om.'], ikkeIngress: ['Vi tror du lurer', 'godkjenning'] },
  { sok: 'Hvordan blir jeg ambulansearbeider som voksen?', side: 'voksen', forste: 'ambulanse',
    synlig: ['[data-velg="ambulanse"]'],
    ingress: ['Du spør om å bli ambulansearbeider.', 'Vi starter med veien til ambulansearbeider som voksen.'], ikkeIngress: ['over 19', 'Vi tror du lurer'] },
  { sok: 'Kan jeg ta fagbrev som voksen?', side: 'voksen', forste: 'erfaring',
    skjult: ['[data-gruppe="ambulanse"]', '[data-velg="ambulanse"]', '[data-gruppe="godkjenning"]', '[data-velg="godkjenning"]'],
    ingress: ['Vi tror du lurer på noe om voksne som vil ta utdanning.', 'Vi starter med hvordan erfaringen din kan telle.'], ikkeIngress: ['ambulansearbeider', 'over 19', 'godkjenning'] },
  { sok: 'godkjenning av utenlandsk utdanning', side: 'voksen', forste: 'godkjenning',
    synlig: ['[data-gruppe="godkjenning"]', '[data-kort="godkjenning-utland"]', '[data-velg="godkjenning"]'], skjult: ['[data-gruppe="ambulanse"]', '[data-velg="ambulanse"]'],
    ingress: ['Vi tror du lurer på godkjenning av utdanning fra utlandet.', 'Vi starter med godkjenning av utdanning fra utlandet, som du spurte om.'], ikkeIngress: ['noe om voksne som vil ta utdanning', 'ambulansearbeider'] },
  { sok: '23/5', side: 'voksen' },
  { side: 'voksen', direkte: true, synlig: ['[data-gruppe="ambulanse"]'], skjult: ['[data-gruppe="godkjenning"]', '[data-velg="godkjenning"]'],
    ingress: ['Du spør om du kan bli ambulansearbeider når du er over 19 år.'] },
  // Uklart: med «Mente du» sier ingressen at vi ikke skjønte søket og peker på yrket (lenken bygges av søket). Uten sier den bare at vi ikke fant noe som
  // passer, og peker på forslagene under. Den sier aldri noe om hva søket handler om. Teksten under «Slik kan du spørre» lenker til forsiden.
  { sok: 'sykeplier', side: 'uklart', synlig: ['[data-mente-boks]', '[data-gruppe="sporsmal"] a[href="../../"]'], skjult: ['[data-uten-mente]'],
    tekst: { '[data-mente]': 'Sykepleier', '[data-sok-tekst]': 'sykeplier' }, href: { 'a[data-mente]': '../sykepleier/' },
    ingress: ['Vi skjønte ikke helt hva du mente med «sykeplier».'], ikkeIngress: ['Vi fant ikke noe'] },
  { sok: 'psykolg', side: 'uklart', tekst: { '[data-mente]': 'Psykolog' }, href: { 'a[data-mente]': '../psykolog/' } },
  { sok: 'asdfgh', side: 'uklart', skjult: ['[data-mente-boks]'], synlig: ['[data-uten-mente]'],
    ingress: ['Vi fant ikke noe som passer godt med «asdfgh». Under finner du forslag til hvordan du kan søke videre.'], ikkeIngress: ['Vi skjønte ikke', 'handler om'] },
  { sok: 'pilot', side: 'uklart', skjult: ['[data-mente-boks]'], synlig: ['[data-uten-mente]'],
    ingress: ['Vi fant ikke noe som passer godt med «pilot».'], ikkeIngress: ['handler om', 'Vi skjønte ikke'] },
  { sok: 'Hvem vinner fotball-VM?', side: 'uklart', skjult: ['[data-mente-boks]'] },
  { side: 'uklart', direkte: true, synlig: ['[data-mente-boks]'], skjult: ['[data-uten-mente]'],
    ingress: ['Vi skjønte ikke helt hva du mente med «sykeplier».'] },
  { sok: 'hvordan skrive cv', side: 'jobbsoking', forste: 'cv' },
  { sok: 'cv mal', side: 'jobbsoking', forste: 'mal' },
  { sok: 'jobbintervju', side: 'jobbsoking', forste: 'soknad' },
  // Ord som ruter hit uten å være CV eller søknad: gruppen «Hvor finner jeg jobb?» står først
  { sok: 'deltidsjobb', side: 'jobbsoking', forste: 'finne' },
  { sok: 'ekstrajobb', side: 'jobbsoking', forste: 'finne' },
  { sok: 'hvordan får jeg jobb', side: 'jobbsoking', forste: 'finne' },
  // Utenfor: ingressen sier praktikanter når søket nevner det, ellers ledige jobber og praksisplasser. Finn lærebedrift vises bare for lærling-søk.
  { sok: 'hvilke it-relaterte firmaer søker praktikanter til uke 44 i 2026 akkurat nå?', side: 'utenfor', synlig: ['[data-gruppe="it"]'], skjult: ['[data-kort="finn-laerebedrift"]'],
    ingress: ['Vi har ikke oversikt over hvilke bedrifter som tar inn praktikanter akkurat nå'], ikkeIngress: ['alle ledige jobber'] },
  { sok: 'sommerjobb', side: 'utenfor', skjult: ['[data-gruppe="it"]', '[data-kort="finn-laerebedrift"]'],
    ingress: ['Vi har ikke oversikt over alle ledige jobber og praksisplasser'], ikkeIngress: ['praktikanter'] },
  { sok: 'lærlingplass akkurat nå', side: 'utenfor', synlig: ['[data-kort="finn-laerebedrift"]'], skjult: ['[data-gruppe="it"]'] },
  { side: 'utenfor', direkte: true, synlig: ['[data-gruppe="it"]'], skjult: ['[data-kort="finn-laerebedrift"]'] },
  // «Hvilke yrker ligner?»: yrkene uten egen side går til sok/ikke-klar/ med yrket i adressen. Politibetjent på advokat-siden går til politisiden.
  { sok: 'Elektriker', side: 'elektriker', href: { '#lignende [data-yrke="automatiker"] a': '../ikke-klar/?yrke=automatiker', '#lignende [data-yrke="elektroingenior"] a': '../ikke-klar/?yrke=elektroingenior' } },
  { sok: 'Advokat', side: 'advokat', href: { '#lignende [data-yrke="jurist"] a': '../ikke-klar/?yrke=jurist', '#lignende [data-yrke="politi"] a': '../politi/' } },
  // Siden sier at søkeresultatet ikke er klart, med yrket i søkefeltet og i teksten, og lenker til det vanlige søket for yrket.
  { side: 'ikke-klar', direkte: true, adresse: 'yrke=energimontor', bredde: 390, synlig: ['[data-med-yrke]', '[data-gruppe="klare"]'], skjult: ['[data-uten-yrke]'],
    ingress: ['Søkeresultatet for «Energimontør» er ikke klart ennå.'], tekst: { '[data-kort="vanlig-sok"] .korttittel': 'Energimontør' },
    href: { '[data-kort="vanlig-sok"] .pill': 'https://utdanning.no/sok/#query_value=energimont%C3%B8r' } },
  // Uten yrke i adressen vises eksempelet. Et ukjent yrke gir den generelle teksten og ingen lenke til det vanlige søket.
  { side: 'ikke-klar', direkte: true, ingress: ['Søkeresultatet for «Automatiker» er ikke klart ennå.'] },
  { side: 'ikke-klar', direkte: true, adresse: 'yrke=finnesikke', synlig: ['[data-uten-yrke]'], skjult: ['[data-med-yrke]'], ikkeIngress: ['«'] },
  // Lange ord uten mellomrom i søket skal ikke gi vannrett rulling på mobil. Yrkessidene er med for å vise at de ikke endres.
  { sok: 'sykepleie ' + LANGT_ORD, side: 'sykepleie', bredde: 390 },
  { sok: 'jobbkompasset ' + LANGT_ORD, side: 'verktoy', bredde: 390 },
  { sok: 'yrkesfag ' + LANGT_ORD, side: 'videregaende', bredde: 390 },
  { sok: 'asdfgh' + LANGT_ORD, side: 'uklart', bredde: 390 },
  { sok: 'elektriker ' + LANGT_ORD, side: 'elektriker', bredde: 390 },
  { sok: 'politi ' + LANGT_ORD, side: 'politi', bredde: 390 },
  { sok: 'sykepleier ' + LANGT_ORD, side: 'sykepleier', bredde: 390 },
  { sok: 'advokat ' + LANGT_ORD, side: 'advokat', bredde: 390 },
  { sok: 'lege ' + LANGT_ORD, side: 'lege', bredde: 390 },
  { sok: 'psykolog ' + LANGT_ORD, side: 'psykolog', bredde: 390 },
  // ung.no-kortene på situasjonssidene, i gruppen der spørsmålet hører hjemme
  { sok: 'Hvor mange poeng trenger jeg for sykepleie?', side: 'sykepleie', forste: 'poeng', synlig: ['[data-gruppe="poeng"] [data-kort="ung-sykepleie-matte"]', '[data-gruppe="soke"] [data-kort="ung-sykepleie-studieplass"]'],
    // Sitatet stopper etter opptakskravet. Setningen etter («Det betyr at du kan komme inn med karakter 2 …») gir et feil bilde i en gruppe om poeng.
    tekst: { '[data-kort="ung-sykepleie-matte"] .ung-sitat': 'uten bestemte krav til karakterer eller fag.»' } },
  { sok: 'Jeg aner ikke hva jeg vil bli', side: 'utforsk', forste: 'begynne', synlig: ['[data-gruppe="begynne"] [data-kort="ung-utforsk-stressa"]', '[data-gruppe="begynne"] [data-kort="ung-utforsk-hva-bli"]'] },
  { sok: 'Kan jeg gå påbygg etter yrkesfag?', side: 'videregaende', forste: 'fast', synlig: ['[data-gruppe="fast"] [data-kort="ung-videregaende-pabygg"]'] },
  { sok: 'Hvordan blir jeg ambulansearbeider som voksen?', side: 'voksen', forste: 'ambulanse', synlig: ['[data-gruppe="ambulanse"] [data-kort="ung-voksen-vernepleier"]'] },
  { sok: 'hvordan skrive cv', side: 'jobbsoking', forste: 'cv', synlig: ['[data-gruppe="cv"] [data-kort="ung-jobbsoking-cv"]'] },
  { sok: 'hvilke it-relaterte firmaer søker praktikanter til uke 44 i 2026 akkurat nå?', side: 'utenfor', synlig: ['[data-gruppe="lete"] [data-kort="ung-utenfor-ledige-jobber"]'] },
  { sok: 'Jeg aner ikke hva jeg vil bli ' + LANGT_ORD, side: 'utforsk', bredde: 390 },
  { sok: 'Er det mulig å bli ambulansearbeider når man er over 19år ' + LANGT_ORD, side: 'voksen', bredde: 390 },
  { sok: 'hvordan skrive cv ' + LANGT_ORD, side: 'jobbsoking', bredde: 390 },
  { sok: 'hvilke it-relaterte firmaer søker praktikanter til uke 44 i 2026 akkurat nå? ' + LANGT_ORD, side: 'utenfor', bredde: 390 },
  { sok: 'bli lærer ' + LANGT_ORD, side: 'laerer', bredde: 390 }
];

(function () {
  'use strict';

  // Nøklene er skrevet inn her med vilje: testsiden skal ikke bruke koden den tester.
  var NOKKEL_SOK = 'ki-sok:sporsmal';
  var NOKKEL_GRUPPE = 'ki-sok:gruppe:';
  var VENTETID = 300; // ms etter at siden er lastet, så felles.js og fontene er ferdige
  var TIDSFRIST = 8000; // ms før en side regnes som hengt

  var rader = document.getElementById('rader');
  var ramme = document.getElementById('ramme');
  var oppsummering = document.getElementById('oppsummering');

  function vent(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  // Hent filene på nytt, så en endring i JS, CSS eller HTML ikke hindres av nettleserens hurtigminne.
  function oppfrisk(adresser) {
    return Promise.all(adresser.map(function (a) { return fetch(a, { cache: 'reload' }).catch(function () {}); }));
  }

  function nullstill(sak) {
    if (sak.direkte) sessionStorage.removeItem(NOKKEL_SOK); else sessionStorage.setItem(NOKKEL_SOK, sak.sok);
    Object.keys(sessionStorage).filter(function (k) { return k.indexOf(NOKKEL_GRUPPE) === 0; }).forEach(function (k) { sessionStorage.removeItem(k); });
  }

  // Venter til iframen står på /sok/<noe>/ og har lastet ferdig. /sok/ sender videre med location.replace, så den første siden regnes ikke.
  function ventPaaSide(iframe) {
    return new Promise(function (ok, feil) {
      var start = Date.now();
      (function sjekk() {
        var klar = false;
        try {
          var w = iframe.contentWindow;
          klar = /^\/sok\/[^/]+\/$/.test(w.location.pathname) && w.document.readyState === 'complete';
        } catch (e) { /* iframen er midt i en navigasjon */ }
        if (klar) return ok();
        if (Date.now() - start > TIDSFRIST) return feil(new Error('tidsavbrudd: iframen ble aldri stående på /sok/<side>/'));
        setTimeout(sjekk, 50);
      })();
    });
  }

  function erSynlig(el) { return el.getClientRects().length > 0; }
  function alle(doc, selektor) { return Array.prototype.slice.call(doc.querySelectorAll(selektor)); }

  // Returnerer { status: 'OK' | 'FEIL' | 'MANGLER', grunner: [] }
  function sjekk(sak, doc) {
    var grunner = [];
    var body = doc.body;
    var side = body && (body.dataset.yrke || body.dataset.side);
    // Ingen av attributtene: siden finnes ikke ennå (404)
    if (!side) return { status: 'MANGLER', grunner: [] };
    if (side !== sak.side) return { status: 'FEIL', grunner: ['havnet på «' + side + '»'] };

    var felt = doc.getElementById('sok');
    if (!sak.direkte && (!felt || felt.value !== sak.sok)) grunner.push('søkefeltet viser «' + (felt ? felt.value : '(mangler)') + '»');

    var gruppene = alle(doc, '[data-gruppe]').filter(erSynlig);
    if (sak.forste) {
      var forste = gruppene[0] && gruppene[0].getAttribute('data-gruppe');
      if (forste !== sak.forste) grunner.push('første gruppe er «' + forste + '», ventet «' + sak.forste + '»');
    }

    (sak.synlig || []).forEach(function (selektor) {
      var treff = alle(doc, selektor);
      if (!treff.length) grunner.push(selektor + ' finnes ikke');
      else if (!treff.every(erSynlig)) grunner.push(selektor + ' er skjult');
    });
    (sak.skjult || []).forEach(function (selektor) {
      if (alle(doc, selektor).some(erSynlig)) grunner.push(selektor + ' er synlig');
    });
    Object.keys(sak.tekst || {}).forEach(function (selektor) {
      var treff = alle(doc, selektor);
      if (!treff.length) grunner.push(selektor + ' finnes ikke');
      else treff.forEach(function (el) {
        if (el.textContent.indexOf(sak.tekst[selektor]) === -1) grunner.push(selektor + ' har teksten «' + el.textContent.trim() + '», ventet «' + sak.tekst[selektor] + '»');
      });
    });

    // Ingressen: bare det som vises (innerText ser bort fra skjulte spenn), med mellomrom slått sammen
    var treffEl = doc.querySelector('.treff');
    var ingressTekst = treffEl ? treffEl.innerText.replace(/\s+/g, ' ') : '';
    (sak.ingress || []).forEach(function (t) {
      if (ingressTekst.indexOf(t) === -1) grunner.push('ingressen mangler «' + t + '», den sier «' + ingressTekst.trim() + '»');
    });
    (sak.ikkeIngress || []).forEach(function (t) {
      if (ingressTekst.indexOf(t) !== -1) grunner.push('ingressen skulle ikke ha «' + t + '», den sier «' + ingressTekst.trim() + '»');
    });
    Object.keys(sak.href || {}).forEach(function (selektor) {
      var treff = alle(doc, selektor);
      if (!treff.length) grunner.push(selektor + ' finnes ikke');
      else treff.forEach(function (el) {
        if (el.getAttribute('href') !== sak.href[selektor]) grunner.push(selektor + ' har href «' + el.getAttribute('href') + '», ventet «' + sak.href[selektor] + '»');
      });
    });
    if (sak.bredde) {
      var rot = doc.documentElement;
      if (rot.scrollWidth > rot.clientWidth) grunner.push('vannrett rulling: siden er ' + rot.scrollWidth + ' px bred i en ramme på ' + rot.clientWidth + ' px');
    }

    // «Alle (N)» skal telle de kortene som vises. Yrkessidene teller ikke «Lignende yrker» og «Utforsk».
    // Sider uten «Alle» (ingen «Velg tema») har antallet i body[data-antall-kort].
    var alleTall = doc.querySelector('[data-antall="alle"]');
    var tallIBody = body.getAttribute('data-antall-kort');
    if (alleTall || tallIBody !== null) {
      var yrkesside = !!body.dataset.yrke;
      // Kort bak «Se mer» (data-ekstra) er resultater som vises når knappen trykkes, så de teller med så lenge gruppen vises.
      var kort = alle(doc, '[data-gruppe] [data-kort]').filter(function (k) {
        if (yrkesside && k.closest('[data-gruppe="lignende"], [data-gruppe="utforsk"]')) return false;
        // Kort som filteret på innholdstype skjuler («Farger og ikoner»), er ikke resultater så lenge filteret er på
        if (k.closest('[data-filtrert]')) return false;
        if (k.hasAttribute('data-ekstra') && !k.closest('[data-irrelevant]')) return erSynlig(k.closest('[data-gruppe]'));
        return erSynlig(k);
      });
      var ventet = '(' + kort.length + ')';
      if (alleTall && alleTall.textContent.trim() !== ventet) grunner.push('«Alle» viser ' + alleTall.textContent.trim() + ', ' + kort.length + ' kort er synlige');
      if (!alleTall && '(' + tallIBody + ')' !== ventet) grunner.push('body[data-antall-kort] er ' + tallIBody + ', ' + kort.length + ' kort er synlige');
    }

    return { status: grunner.length ? 'FEIL' : 'OK', grunner: grunner };
  }

  // Trykker på selektorene i sak.klikk, én etter én. Hoppes over når siden ikke finnes ennå (da gir sjekk() MANGLER SIDE).
  function trykk(sak, doc) {
    var body = doc.body;
    if (!sak.klikk || !body || !(body.dataset.yrke || body.dataset.side)) return Promise.resolve();
    return sak.klikk.reduce(function (forrige, selektor) {
      return forrige.then(function () {
        var el = doc.querySelector(selektor);
        if (!el) throw new Error('klikk: ' + selektor + ' finnes ikke');
        el.click();
        return vent(150);
      });
    }, Promise.resolve());
  }

  function kjorSak(sak) {
    nullstill(sak);
    // ?t=…: nettleseren har egne hurtigminneoppføringer for sider som lastes i en iframe, og de oppdateres ikke av fetch() i oppfrisk().
    // Uten et nytt søkeargument kan iframen vise en HTML-fil fra før siste endring. /sok/ sender søkeargumentet videre til siden.
    var adresse = (sak.direkte ? '../sok/' + sak.side + '/' : '../sok/') + '?t=' + Date.now() + (sak.adresse ? '&' + sak.adresse : '');
    return oppfrisk(['../sok/', '../sok/' + sak.side + '/']).then(function () {
      ramme.textContent = '';
      var iframe = document.createElement('iframe');
      iframe.title = 'Siden som testes';
      if (sak.bredde) iframe.style.width = sak.bredde + 'px';
      ramme.appendChild(iframe);
      iframe.src = adresse;
      return ventPaaSide(iframe).then(function () { return vent(VENTETID); }).then(function () {
        return trykk(sak, iframe.contentDocument);
      }).then(function () {
        return sjekk(sak, iframe.contentDocument);
      });
    }).catch(function (e) { return { status: 'FEIL', grunner: [e.message] }; });
  }

  function skrivRad(nr, sak, svar) {
    var tr = document.createElement('tr');
    var tekst = svar.status === 'OK' ? 'OK' : svar.status === 'MANGLER' ? 'MANGLER SIDE' : 'FEIL: ' + svar.grunner.join('; ');
    [nr, sak.direkte ? '(ingen søk, åpnet direkte)' : sak.sok, sak.side, tekst].forEach(function (t, i) {
      var td = document.createElement('td');
      td.textContent = t;
      if (i === 3) td.className = svar.status === 'OK' ? 'ok' : svar.status === 'MANGLER' ? 'mangler' : 'feil';
      tr.appendChild(td);
    });
    rader.appendChild(tr);
  }

  var tall = { OK: 0, FEIL: 0, MANGLER: 0 };
  // Saker kjøres én og én. Alle bruker samme sessionStorage, så de kan ikke kjøres samtidig.
  var kjoring = oppfrisk(['../sok/felles.js', '../sok/ruting.js', '../sok/felles.css']);
  SAKER.forEach(function (sak, i) {
    kjoring = kjoring.then(function () { return kjorSak(sak); }).then(function (svar) {
      tall[svar.status]++;
      skrivRad(String(i + 1), sak, svar);
    });
  });
  kjoring.catch(function (e) {
    // Feil i testsiden selv, ikke i en side som testes. Teller som feil, så det ikke ser grønt ut.
    tall.FEIL++;
    console.error('Testsiden feilet', e);
  }).then(function () {
    sessionStorage.removeItem(NOKKEL_SOK);
    ramme.textContent = '';
    oppsummering.textContent = tall.OK + ' OK, ' + tall.FEIL + ' FEIL, ' + tall.MANGLER + ' MANGLER SIDE';
    document.body.dataset.feil = String(tall.FEIL);
    document.body.dataset.mangler = String(tall.MANGLER);
    document.body.dataset.ferdig = 'ja';
  });
})();
