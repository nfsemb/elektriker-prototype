import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const KiSok = createRequire(import.meta.url)('../sok/ruting.js');

const SAKER = [
  // Yrkessidene skal rutes som før
  ['Elektriker', 'elektriker'], ['Hva tjener en elektriker?', 'elektriker'],
  ['Hvordan blir jeg sykepleier?', 'sykepleier'], ['Hvordan blir man psykolog?', 'psykolog'],
  ['Hva gjør en psykolog?', 'psykolog'],
  ['Hvor kan jeg jobbe som advokat?', 'advokat'], ['Politi', 'politi'],
  ['Jeg liker å hjelpe barn. Kan jeg bli lærer?', 'laerer'],
  ['Hva kan jeg spesialisere meg i som lege?', 'lege'], ['Hva lærer man på medisin?', 'lege'],
  ['Hvordan blir jeg elektrikerlærling?', 'elektriker'], ['Hva kan jeg bli som elektriker?', 'elektriker'],
  ['cv elektriker', 'elektriker'], ['hvordan blir man elektriker som voksen?', 'elektriker'],
  ['yrkesfaglærer', 'laerer'], ['Hva lærer man?', 'uklart'], ['politiker', 'uklart'],
  // Situasjonene
  ['sykepleie', 'sykepleie'], ['sykepleie bergen', 'sykepleie'],
  ['Hvor mange poeng trenger jeg for sykepleie?', 'sykepleie'], ['  SYKEPLEIE!! ', 'sykepleie'],
  ['Jeg aner ikke hva jeg vil bli', 'utforsk'], ['interessetest', 'utforsk'],
  ['Om man har to yrker man vil ta, hvordan velger man en av dem?', 'utforsk'],
  ['Hva kan jeg bli med psykologi?', 'bli-med-psykologi'],
  ['hva kan jeg bli hvis jeg studerer historie', 'utforsk'],
  ['Hva er forskjellen på yrkesfag og studieforberedende?', 'videregaende'],
  ['yrkesfag', 'videregaende'], ['hvordan skaffe læreplass', 'videregaende'],
  ['jobbkompasset', 'verktoy'], ['karakterkalkulator', 'verktoy'], ['finn lærebedrift', 'verktoy'],
  ['Er det mulig å bli ambulansearbeider når man er over 19år', 'voksen'],
  ['Kan jeg ta fagbrev som voksen?', 'voksen'],
  ['sykeplier', 'uklart'], ['psykolg', 'uklart'], ['asdfgh', 'uklart'], ['pilot', 'uklart'],
  ['Hvem vinner fotball-VM?', 'uklart'],
  ['hvordan skrive cv', 'jobbsoking'], ['cv mal', 'jobbsoking'], ['interessetest og cv', 'jobbsoking'],
  ['hvilke it-relaterte firmaer søker praktikanter til uke 44 i 2026 akkurat nå?', 'utenfor'],
  ['sommerjobb', 'utenfor'],
  // Rekkefølgen: «psykologi» + «bli med» (A1) og «sykepleie» (A2) går foran yrkene (B), og verktøy foran situasjonene
  ['Hva kan jeg bli med psykologi som psykolog?', 'bli-med-psykologi'],
  ['sykepleie eller medisin', 'sykepleie'],
  ['verktøy', 'verktoy'],
  // Lærlinger: «hvilke bedrifter» alene er ikke «utenfor», men «akkurat nå» er det (siden har Finn lærebedrift for lærling-søk)
  ['hvilke bedrifter tar inn lærlinger i bergen', 'videregaende'],
  ['hvilke firmaer som tar lærlinger', 'videregaende'],
  ['lærlingplass akkurat nå', 'utenfor'],
  ['hvilke bedrifter søker sommerstudenter', 'utenfor'],
  ['hvilke firmaer søker lærlinger', 'utenfor'],
  // Ord som manglet
  ['hva kan jeg bli med yrkesfag', 'verktoy'], ['Hva kan du bli med yrkesfag?', 'verktoy'],
  ['vanskelig å velge', 'utforsk'], ['yrkestest', 'utforsk'], ['personlighetstest', 'utforsk'], ['quiz', 'utforsk'],
  ['deltidsjobb', 'jobbsoking'], ['ekstrajobb', 'jobbsoking'], ['få jobb', 'jobbsoking'], ['hvordan får jeg jobb', 'jobbsoking'],
  ['23/5', 'voksen'], ['23/5-regelen', 'voksen'], ['23/6', 'voksen'],
  ['studiekompetanse', 'videregaende'], ['generell studiekompetanse', 'videregaende'],
  ['godkjenning av utenlandsk utdanning', 'voksen'],
  // «over 2*» var for bredt: alder (19 og 20–99) går til voksen, beløp og andre tall gjør ikke det
  ['Jeg er over 30 og vil bytte', 'voksen'], ['over 25 år', 'voksen'], ['over 19 år', 'voksen'], ['over 40år', 'voksen'],
  ['lønn over 200 000 kroner', 'uklart'], ['over 20 000 i året', 'uklart'], ['over 2 år', 'uklart'], ['over 190 000', 'uklart'],
  // Et tegn som er skrevet som grunntegn + tegn over (NFD) skal rutes som det sammensatte
  ['påbygg'.normalize('NFD'), 'videregaende'],
];

for (const [sok, side] of SAKER) {
  test(`«${sok}» → ${side}`, () => assert.equal(KiSok.finnSide(sok).side, side));
}

test('tomt søk gir elektriker', () => {
  assert.equal(KiSok.finnSide(null).side, 'elektriker');
  assert.equal(KiSok.finnSide('').side, 'elektriker');
});
test('verktøy-id', () => {
  assert.equal(KiSok.finnSide('jobbkompass').verktoy, 'jobbkompasset');
  assert.equal(KiSok.finnSide('kalkulator').verktoy, 'karakterkalkulator');
  assert.equal(KiSok.finnSide('finn lærebedrift').verktoy, 'finn-laerebedrift');
  assert.equal(KiSok.finnSide('sammenlign').verktoy, 'sammenlign');
  assert.equal(KiSok.finnSide('yrker').verktoy, 'alle-yrker');
  assert.equal(KiSok.finnSide('verktøy').verktoy, 'alle-verktoy');
  assert.equal(KiSok.finnSide('hva kan jeg bli med yrkesfag').verktoy, 'muligheter-med-yrkesfag');
  assert.equal(KiSok.finnSide('Hva kan du bli med yrkesfag?').verktoy, 'muligheter-med-yrkesfag');
});
test('mente du', () => {
  assert.equal(KiSok.finnSide('sykeplier').mente, 'sykepleier');
  assert.equal(KiSok.finnSide('psykolg').mente, 'psykolog');
  assert.equal(KiSok.finnSide('elektrikker').mente, 'elektriker');
  assert.equal(KiSok.finnSide('polti').mente, 'politi');
  assert.equal(KiSok.finnSide('asdfgh').mente, undefined);
  assert.equal(KiSok.finnSide('pilot').mente, undefined);
  assert.equal(KiSok.finnSide('lager').mente, undefined);
});
test('harOrd', () => {
  assert.equal(KiSok.harOrd('IT-relaterte firmaer', ['it']), true);
  assert.equal(KiSok.harOrd('Italia', ['it']), false);
  assert.equal(KiSok.harOrd('praktikanter', ['praktikant*']), true);
  assert.equal(KiSok.harOrd('over 19år', ['over 19*']), true);
});
test('normaliser slår sammen tegn og tegn over (NFC)', () => {
  assert.equal(KiSok.normaliser('p\u0061\u030Abygg'), KiSok.normaliser('p\u00E5bygg'));
  assert.equal(KiSok.normaliser('p\u0061\u030Abygg'), ' påbygg ');
  assert.equal(KiSok.harOrd('p\u0061\u030Abygg', ['påbygg*']), true);
});
test('samme svar hver gang', () => {
  assert.deepEqual(KiSok.finnSide('interessetest og cv'), KiSok.finnSide('interessetest og cv'));
});
