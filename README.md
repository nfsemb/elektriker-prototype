# Brukertestprototype: KI-søket på utdanning.no

Statisk prototype av søkeresultatsiden i KI-søket på utdanning.no, med treffene gruppert etter spørsmål. Den er laget for en brukertest med ungdom på mobil. Sidene er statiske, uten byggesteg og uten sporing.

Prototypen har resultatsider for sju yrker: elektriker, sykepleier, advokat, politi, lærer, lege og psykolog.

- `index.html`: forsiden med «Hva lurer du på?». Deltakeren skriver inn et spørsmål og trykker Enter eller «Spør», eller velger et ferdig utfylt søk. «Elektriker» og «Hva tjener en elektriker?» vises, og ett eksempel for hvert av de andre yrkene ligger bak «Vis flere». Teksten lagres bare i nettleseren (sessionStorage) og sendes ingen steder. Et tomt felt gjør ingenting.
- `sok/index.html`: sender søket videre til yrket det handler om (`finnYrke` i `sok/felles.js`). Nevner søket ikke noe av yrkene, vises «Hvilket yrke vil du vite mer om?» med de sju yrkene. Uten søk går siden til elektriker, så gamle lenker til `/sok/` virker som før.
- `sok/<yrke>/index.html`: resultatsiden for ett yrke (`elektriker`, `sykepleier`, `advokat`, `politi`, `laerer`, `lege`, `psykolog`). Innholdet står som HTML i hver side. Søkefeltet viser det deltakeren skrev. Passer søket med en av gruppene (nøkkelordene står i `MATCH` i `felles.js`), flyttes den gruppen øverst, og ingressen sier «Vi starter med …, som du spurte om.» Ellers vises standard rekkefølge.
- `sok/felles.css` og `sok/felles.js`: stiler, fonter og skript som alle resultatsidene deler. Endringer i utseende eller oppførsel gjøres her, ikke i hver side.

Elektrikersiden er malen for de andre. Innholdsrapportene for hvert yrke ligger i `docs/innhold-<yrke>.md`.

## Vise siden lokalt

```bash
python3 -m http.server 8000
# forsiden: http://localhost:8000/
# en resultatside: http://localhost:8000/sok/elektriker/ (legg til ?vis-mangler for å se lenker som mangler adresse)
```

## Lenker

Alle adresser for en side ligger i lenketabellen øverst i `sok/<yrke>/index.html` (`<script type="application/json" id="lenker">`). Hver lenke har `side`, og eventuelt `anker` og `tekst` (tekstfragment). Skriptet bygger og koder `href` selv. En relativ `side` (for eksempel `"../psykolog/"`) er en lenke til en annen side i prototypen. Lenker du legger inn manuelt, får `"status": "manuell"`. Kjør sjekken etter alle endringer:

```bash
node scripts/sjekk-lenker.mjs              # alle yrkene
node scripts/sjekk-lenker.mjs sykepleier   # ett yrke
```

Den sjekker svarkode, domene, at ankeret finnes og at teksten i tekstfragmentet står på siden, at lenker til egne sider finnes, og at alle bildene laster.

## Publisering

Siden publiseres med GitHub Pages fra `main` / `(root)`. Endringer kan bruke omtrent 10 minutter på å komme fram, fordi GitHub bufrer sidene.
