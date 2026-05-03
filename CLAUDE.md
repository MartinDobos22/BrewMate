# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Technické detaily architektúry sú v `.claude/rules/` (načítavané automaticky podľa kontextu).

---

## Projekt

BrewMate je React Native (TypeScript, RN CLI 0.83.1) mobilná appka pre coffee lovers.

- **Backend:** Node.js + Express 5 + PostgreSQL (Supabase) + Firebase Auth
- **Design systém:** Material Design 3 — tokeny v `src/theme/theme.ts`
- **UI jazyk:** slovenčina (primárna), angličtina pre kód a komentáre

---

## Konvencie kódu

- **Žiadne hardcoded hodnoty** — farby, spacing, font sizes vždy cez theme tokeny (viď Design systém nižšie)
- **Žiadne `any` typy** — vždy explicitné typy alebo generics
- **Komponenty:** functional components s hooks; žiadne class components
- **Naming:** `PascalCase` komponenty, `camelCase` funkcie/premenné, `UPPER_SNAKE` konštanty
- **Importy:** React/RN → third-party → lokálne (relatívne cesty)
- **Props:** každý komponent musí mať `Props` interface
- **Styling:** `StyleSheet.create()` pre statické štýly; inline `style=` len pre dynamické hodnoty (vypočítané za behu)

---

## Design systém v5

Všetky tokeny sú v `src/theme/theme.ts`, exportované ako `appTheme`. Používaj `useTheme()` v komponentoch.

### Farby — `appTheme.colors.*`

| Token | Hex | Použitie |
|---|---|---|
| `primary` | #6B4226 | espresso brown — CTA, active states |
| `onPrimary` | #FFFFFF | text na primary ploche |
| `primaryContainer` | warm tint | karty, chips |
| `tertiary` | #4A6130 | cardamom sage — sekundárne akcie |
| `surface` | warm cream | plochy kariet |
| `background` | warm cream | pozadie obrazoviek |
| `error` | MD3 red | chybové stavy |

### Spacing — `appTheme.spacing.*`

`xxs`(2) · `xs`(4) · `sm`(8) · `md`(12) · `lg`(16) · `xl`(20) · `xxl`(24) · `xxxl`(32) · `huge`(48)

### Shape (border radius) — `appTheme.shape.*`

`none` · `extraSmall` · `small` · `medium` · `large` · `extraLarge` · `full`

### Typografia — `appTheme.typescale.*`

`displayLarge` · `headlineLarge` · `titleMedium` · `bodyLarge` · `labelSmall` (a ďalšie MD3 škály)

### Pravidlá

- Ikony: SVG (`src/components/`), nie emoji
- Žiadne raw hex farby v komponentoch — vždy `appTheme.colors.*`
- Žiadne magic number spacing — vždy `appTheme.spacing.*`
- Tmavý mód: `useTheme()` namiesto priameho importu `appTheme` (future-proof)

---

## Agent Delegation Rules

Pre **každú úlohu ktorá mení viac ako 2 súbory**:

1. **Explore** — spusti `explorer` subagent na zmapovanie relevantných súborov a existujúcich patterns
2. **Plan** — vytvor plán so scope a poradím zmien; predlož na schválenie
3. **Implement** — implementuj podľa schváleného plánu
4. **Test** — spusti `npm run test:client` a/alebo `npm run test:server` podľa toho, čo sa zmenilo
5. **Review** — spusti `code-reviewer` subagent na nezávislý review
6. **Fix** — oprav critical nálezy z review
7. **Retest** — znova spusti testy

Príkaz `/implement` v `.claude/commands/implement.md` orchestruje tento flow automaticky.
