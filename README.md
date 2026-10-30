# Brukertestprototype: «elektriker»

Statisk prototype av søkeresultatsiden i KI-søket på utdanning.no, med treffene gruppert etter spørsmål. Den er laget for en brukertest med ungdom på mobil. Det er to statiske sider, uten byggesteg og uten sporing:

- `index.html`: forsiden med «Hva lurer du på?». Deltakeren skriver inn et spørsmål og trykker Enter eller «Spør», eller velger et ferdig utfylt søk («elektriker» eller «Hva tjener en elektriker?»). Alle søk fører til resultatsiden. Teksten lagres bare i nettleseren (sessionStorage) og sendes ingen steder. Et tomt felt gjør ingenting.
- `sok/index.html`: resultatsiden for «elektriker». Logoen fører tilbake til forsiden. Søkefeltet viser det deltakeren skrev. Innholdet er alltid det samme, men passer søket med en av gruppene (nøkkelordene står i `MATCH` i skriptet), flyttes den gruppen øverst, og ingressen sier «Vi starter med …, som du spurte om.» Ellers vises standard rekkefølge.

## Vise siden lokalt

```bash
python3 -m http.server 8000
# forsiden: http://localhost:8000/
# resultatsiden: http://localhost:8000/sok/ (legg til ?vis-mangler for å se lenker som mangler adresse)
```

## Lenker

Alle adresser ligger i lenketabellen øverst i `sok/index.html` (`<script type="application/json" id="lenker">`). Hver lenke har `side`, og eventuelt `anker` og `tekst` (tekstfragment). Skriptet på siden bygger og koder `href` selv. Lenker du legger inn manuelt, får `"status": "manuell"`. Kjør sjekken etter alle endringer:

```bash
node scripts/sjekk-lenker.mjs
```

Den sjekker svarkode, domene, at ankeret finnes og at teksten i tekstfragmentet står på siden, og at alle bildene laster.

## Publisering

Siden publiseres med GitHub Pages fra `main` / `(root)`. Endringer kan bruke omtrent 10 minutter på å komme fram, fordi GitHub bufrer sidene.
