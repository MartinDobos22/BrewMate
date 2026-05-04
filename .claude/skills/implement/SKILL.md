---
name: implement
description: Kompletný implementačný pipeline pre BrewMate. Použi vždy keď používateľ chce pridať novú funkciu, zmeniť existujúcu, alebo refaktorovať kód. Orchestruje explore → plan → implement → test → review flow.
---

# BrewMate Implementation Pipeline

Tento skill orchestruje kompletný vývojový cyklus. Dodržuj tieto fázy PRESNE v tomto poradí. Nikdy nepreskakuj fázu.

## Pravidlá komunikácie (povinné počas celého flow)

- **Vždy oznám začiatok každej fázy** textom napr. `**Fáza 0 — CLARIFY**` pred tým ako niečo spustíš.
- **Nikdy nevypisuj celý kód** do chatu — píš len čo robíš: `"Vytváram komponent X"`, `"Odstraňujem starú logiku z Y"`.
- **Dve povinné zastávky**: po Fáze 0 a po Fáze 2 — vždy čakaj na odpoveď používateľa.
- **Priebežné aktualizácie**: pri každom väčšom kroku v implementácii napíš jednu vetu čo sa práve deje.

### Kontext status (povinný po každej fáze)

Po dokončení každej fázy pridaj riadok v tomto formáte:

```
> **Kontext:** ~XX% využitý — zostatok ~YYk tokenov  (`/cost` pre presné API náklady)
```

**Ako odhadnúť:**
- Model: claude-sonnet-4-6, okno: **200 000 tokenov**
- Krátka konverzácia (< 5 správ, málo súborov): ~5–15 %
- Po Clarify + Explore (subagenti, čítanie súborov): ~15–30 %
- Po Plan (ďalší subagent): ~25–40 %
- Po Implement (veľa editov, dlhé súbory): ~40–65 %
- Po Test + Review (výstup testov, ďalší subagent): ~55–80 %
- Komprimovaný kontext (objavil sa summary na začiatku): odpočítaj ~30–40 % — konverzácia bola skomprimovaná

Ak odhad prekročí **75 %**, pridaj varovanie:
`⚠️ Kontext je z viac ako 75 % využitý — pri ďalšej dlhej fáze zvážte /compact.`

---

## Fáza 0: CLARIFY (povinná — Opus)

**Oznám:** `**Fáza 0 — CLARIFY:** Spúšťam task-clarifier agenta na upresnenie zadania…`

Spusti `task-clarifier` subagent s pôvodným vstupom používateľa. Počkaj na výsledok.

Predlož výstup používateľovi a počkaj na potvrdenie alebo úpravu.
**ZASTAV SA** — nepokračuj do Fázy 1 kým používateľ neodsúhlasí zdokonalenú špecifikáciu.

---

## Fáza 0.5: BRANCH (povinná — hneď po schválení špecifikácie)

Zisti aktuálnu branch:
```bash
git branch --show-current
```

Ak je výsledok `main` alebo `master`:
1. Z názvu úlohy vytvor kebab-case slug (max 40 znakov, len `a-z`, `0-9`, `-`)
2. Vytvor a prepni sa na novú branch:
   ```bash
   git checkout -b claude/<slug>
   ```
   Príklady: `mdobos/pridaj-filter-podla-intenzity`, `mdobos/oprav-ocr-timeout`, `mdobos/refactor-inventory-hook`

**Ak si už na feature branchi (nie main/master)** — zostań na nej a pokračuj. Nevytvára sa nová branch, nerobia sa žiadne git operácie.

Informuj používateľa na akej branch pracuješ.

---

## Fáza 1: EXPLORE (povinná)

**Oznám:** `**Fáza 1 — EXPLORE:** Mapujem relevantné súbory a existujúce vzory…`

Spusti `explorer` subagent s popisom úlohy. Počkaj na výsledok.

Identifikuj:
- Existujúce komponenty, hooks, utility ktoré možno znovupoužiť
- Design tokeny a vzory (`useTheme()`, `appTheme.colors.*`, `appTheme.spacing.*`)
- Typy a interfaces (navigácia, API responses)
- Existujúce testy pre dané moduly

---

## Fáza 2: PLAN (povinná — zastav pred implementáciou)

**Oznám:** `**Fáza 2 — PLAN:** Vytváram plán implementácie…`

Na základe explorácie vytvor štruktúrovaný plán v tomto formáte:

```
### Plán: [názov úlohy]

**Scope**
- Zmenené súbory: [zoznam]
- Nové súbory: [zoznam]

**Kroky**
1. [krok] — [jednoduchý / stredný / zložitý]
2. ...

**Riziká**
- [potenciálne problémy, mirrored files, breaking changes]

**Testy**
- [aké testy treba napísať alebo upraviť]
```

**ZASTAV SA** a počkaj na schválenie používateľa. Ak plán odmietne alebo upraví, prepracuj ho a znova požiadaj o schválenie.

---

## Fáza 3: IMPLEMENT (povinná)

**Oznám:** `**Fáza 3 — IMPLEMENT:** Začínam implementáciu podľa schváleného plánu.`

Implementuj PRESNE podľa schváleného plánu. Pri každom kroku napíš jednu vetu čo robíš — bez toho aby si vypisoval celý kód.

Povinné pravidlá:
- Farby: `theme.colors.primary`, `theme.colors.tertiary`, … — nikdy raw hex
- Spacing: `theme.spacing.md`, `theme.spacing.lg`, … — nikdy čísla priamo
- Shape: `theme.shape.medium`, `theme.shape.large`, … — nikdy raw border radius
- Typografia: `theme.typescale.bodyLarge`, `theme.typescale.titleMedium`, … — nikdy raw fontSize
- Vždy `useTheme()` z `src/theme/useTheme.ts`, nie priamy import `appTheme`
- `Props` interface pre každý nový komponent
- `StyleSheet.create()` pre statické štýly; inline `style=` len pre dynamické hodnoty
- Žiadne `any` typy — explicitné typy alebo generics
- Mirrored files (`src/utils/brewCalc.ts` ↔ `server/brewCalc.js`, `src/constants/apiVersion.ts` ↔ `server/apiVersion.js`) menia sa vždy súčasne

PostToolUse hook automaticky formátuje každý uložený súbor cez Prettier.

---

## Fáza 4: TEST (povinná)

**Oznám:** `**Fáza 4 — TEST:** Spúšťam testy…`

1. Napíš unit testy pre novú logiku (ak existuje testovateľná logika)
2. Spusti relevantné testy:
   - Zmeny v `src/` → `npm run test:client`
   - Zmeny v `server/` → `npm run test:server`
   - Oboje → `npm test`
3. Ak testy zlyhávajú → analyzuj, oprav, spusti znova — pri každej oprave napíš jednou vetou čo bolo zlé
4. **Nepokračuj kým VŠETKY testy neprechádzajú**

Výsledok oznám stručne: `✅ 46 testov prechádza` alebo `❌ X testov zlyhalo — [čo bolo zlé] — opravujem`.

---

## Fáza 5: REVIEW (povinná)

**Oznám:** `**Fáza 5 — REVIEW:** Spúšťam nezávislý code review…`

Spusti `code-reviewer` subagent. Predaj mu zoznam zmenených súborov a kontext úlohy.

Výsledky predlož ako zoznam nálezov a povedz čo opravuješ a čo nie:
- 🔴 **Critical** → oprav vždy pred dokončením, potom retest; oznám `"Opravujem: [popis]"`
- 🟡 **Warning** → oprav ak je zmena jednoduchá; inak pridaj `// TODO: <popis>`; oznám rozhodnutie
- 🟢 **Info** → zaznameň do summary

---

## Fáza 5b: SECURITY REVIEW (len ak sú zmenené `server/` súbory)

**Oznám:** `**Fáza 5b — SECURITY REVIEW:** Spúšťam bezpečnostný review server/ zmien…`

Ak úloha mení akýkoľvek súbor v `server/`, spusti `security-reviewer` subagent.
Predaj mu zoznam zmenených `server/` súborov.

Postup po review:
- 🔴 **Critical** → oprav vždy pred dokončením, potom retest
- 🟡 **Warning** → oprav ak je zmena jednoduchá; inak pridaj `// TODO: <popis>`

---

## Fáza 6: SUMMARY (povinná)

**Oznám:** `**Fáza 6 — SUMMARY**`

Záverečné zhrnutie v tomto formáte:

```
### Hotovo: [názov úlohy]

**Zmenené súbory**
- `cesta/k/súboru.ts` — čo sa zmenilo

**Nové súbory**
- `cesta/k/súboru.ts` — čo robí

**Kľúčové rozhodnutia**
- [dôvod pre netriviálne voľby]

**TODO (ak nejaké)**
- [ ] [zostatok]

**Odporúčané ďalšie kroky**
- [čo prirodzene nasleduje]
```
