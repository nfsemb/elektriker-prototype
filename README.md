# Brukertestprototype: KI-søket på utdanning.no

Statisk prototype av søkeresultatsiden i KI-søket på utdanning.no, med treffene gruppert etter spørsmål. Den er laget for en brukertest med ungdom på mobil. Sidene er statiske, uten byggesteg og uten sporing.

Prototypen har 16 resultatsider. Sju er for yrker (elektriker, sykepleier, advokat, politi, lærer, lege og psykolog), og ni er for situasjoner: det deltakeren skriver, kan like gjerne være en utdanning, et valg på videregående, et verktøy eller noe vi ikke forstår, som et yrke.

- `index.html`: forsiden med «Hva lurer du på?». Deltakeren skriver inn et spørsmål og trykker Enter eller «Spør», eller velger et ferdig utfylt søk. «Elektriker» og «Hva tjener en elektriker?» vises, og 15 eksempler ligger bak «Vis flere»: ett for hvert av de andre yrkene og ett for hver situasjon (se tabellen under). Teksten lagres bare i nettleseren (sessionStorage) og sendes ingen steder. Et tomt felt gjør ingenting.
- `sok/index.html`: sender søket videre til siden rutingen finner for det. Uten søk går siden til elektriker, så gamle lenker til `/sok/` virker som før. Søk som ikke passer noe sted, havner på `sok/uklart/`.
- `sok/ruting.js`: rutingen (`KiSok.finnSide`). Den sjekker nøkkelord i en fast rekkefølge, og den første regelen som passer, vinner: utforsking av psykologi, utdanningen sykepleie, et av de sju yrkene, et verktøy, jobbsøking, noe prototypen ikke dekker, utforsking, voksen, videregående, en skrivefeil på et yrkesnavn og til slutt «uklart». Skriptet gjør ingenting med søket annet enn å lese det. Testes med `node --test scripts/test-ruting.mjs`.
- `sok/<yrke>/index.html`: resultatsiden for ett yrke (`elektriker`, `sykepleier`, `advokat`, `politi`, `laerer`, `lege`, `psykolog`). Innholdet står som HTML i hver side. Søkefeltet viser det deltakeren skrev. Passer søket med en av gruppene (nøkkelordene står i `MATCH` i `felles.js`), flyttes den gruppen øverst, og ingressen sier «Vi starter med …, som du spurte om.» Ellers vises standard rekkefølge.
- `sok/<situasjon>/index.html`: resultatsiden for én situasjon (se tabellen under). Bygd med de samme byggeklossene som yrkessidene, men gruppene har egne nøkkelord i `data-ord`, og ingressen sier hvordan søket er forstått. Innholdet som bare passer eksempelsøket, vises bare når søket inneholder det.
- `sok/ikke-klar/index.html`: siden for et KI-søk vi ikke har laget ennå. Lenkene under «Hvilke yrker ligner?» på yrkessidene går hit med yrket i adressen (`?yrke=automatiker`), og siden sier at søkeresultatet ikke er klart. Den lenker til det vanlige søket på utdanning.no for yrket og til søkene som er klare. Yrker som har egen side i prototypen (Politibetjent på advokat-siden), lenker rett dit. Søket står i adressen, ikke i sessionStorage, så Tilbake gir deltakeren det opprinnelige søket. Yrkene og søkelenkene står i tabellene øverst i siden.
- `sok/felles.css` og `sok/felles.js`: stiler, fonter og skript som alle resultatsidene deler. Endringer i utseende eller oppførsel gjøres her, ikke i hver side.

| Situasjon | Side | Eksempel på forsiden |
| --- | --- | --- |
| En utdanning | `sok/sykepleie/` | sykepleie |
| Vet ikke hva jeg vil | `sok/utforsk/` | Jeg aner ikke hva jeg vil bli |
| Hva kan jeg bli med en utdanning | `sok/bli-med-psykologi/` | Hva kan jeg bli med psykologi? |
| Valg på videregående | `sok/videregaende/` | Hva er forskjellen på yrkesfag og studieforberedende? |
| Et verktøy | `sok/verktoy/` | jobbkompasset |
| Personlig situasjon (voksen) | `sok/voksen/` | Er det mulig å bli ambulansearbeider når man er over 19år |
| Uklart | `sok/uklart/` | sykeplier |
| Jobbsøking | `sok/jobbsoking/` | hvordan skrive cv |
| Utenfor det vi har | `sok/utenfor/` | Hvilke IT-firmaer søker praktikanter akkurat nå? |

Elektrikersiden er malen for yrkessidene. Innholdsrapportene for hver side ligger i `docs/innhold-<side>.md`.

## Vise siden lokalt

```bash
python3 -m http.server 8000
# forsiden: http://localhost:8000/
# en resultatside: http://localhost:8000/sok/elektriker/ (legg til ?vis-mangler for å se lenker som mangler adresse)
# testsiden for alle sidene: http://localhost:8000/test/sider.html
```

## Lenker

Alle adresser for en side ligger i lenketabellen øverst i `sok/<side>/index.html` (`<script type="application/json" id="lenker">`). Hver lenke har `side`, og eventuelt `anker` og `tekst` (tekstfragment). Skriptet bygger og koder `href` selv. En relativ `side` (for eksempel `"../psykolog/"`) er en lenke til en annen side i prototypen. Lenker du legger inn manuelt, får `"status": "manuell"`. Kjør sjekken etter alle endringer:

```bash
node scripts/sjekk-lenker.mjs              # alle sidene
node scripts/sjekk-lenker.mjs sykepleier   # én side
```

Den sjekker svarkode, domene, at ankeret finnes og at teksten i tekstfragmentet står på siden, at lenker til egne sider finnes, og at alle bildene laster.

## Kontroll

```bash
node --test scripts/test-ruting.mjs        # rutingen: hvilken side får hvert søk
node scripts/sjekk-sitater.mjs             # intervjukortene mot intervjuene på utdanning.no
node scripts/sjekk-lenker.mjs              # lenker og bilder
```

Testsiden `test/sider.html` (åpnes over http, se over) kjører søk mot alle 16 sidene i en nettleser og sjekker at hvert søk lander riktig, at gruppene står i riktig rekkefølge, at ingressen sier det den skal, at antallene stemmer og at lange søkeord ikke gir vannrett rulling på mobil. Resultatet står i `body.dataset.feil` og `body.dataset.mangler`, og begge skal være `0`.

## Publisering

Siden publiseres med GitHub Pages fra `main` / `(root)`. Endringer kan bruke omtrent 10 minutter på å komme fram, fordi GitHub bufrer sidene.
