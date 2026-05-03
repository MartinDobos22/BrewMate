---
description: Orchestruje kompletný implementačný flow — explore → plan → implement → test → review
---

Implementuj nasledovnú úlohu pomocou štandardného BrewMate workflow:

**Úloha:** $ARGUMENTS

## Postup

### Krok 1 — Explore
Spusti `explorer` subagent s popisom úlohy. Počkaj na výsledok — zoznam relevantných súborov a existujúcich patterns.

### Krok 2 — Plan
Na základe výsledkov z explore vytvor plán:
- Scope: ktoré súbory sa menia
- Poradie zmien (závislosti)
- Mirrored files ktoré treba aktualizovať súčasne

Predlož plán na schválenie pred implementáciou.

### Krok 3 — Implement
Po schválení implementuj podľa plánu. Dodržuj:
- `appTheme.colors/spacing/shape/typescale` — žiadne hardcoded hodnoty
- `Props` interface pre každý nový komponent
- `StyleSheet.create()` pre statické štýly
- Žiadne `any` typy

### Krok 4 — Test
Spusti relevantné testy:
- Zmeny v `src/` → `npm run test:client`
- Zmeny v `server/` → `npm run test:server`
- Oboje → `npm test`

### Krok 5 — Review
Spusti `code-reviewer` subagent. Predaj mu zoznam zmenených súborov.

### Krok 6 — Fix & Retest
Oprav všetky 🔴 Critical nálezy z review. Znova spusti testy.
