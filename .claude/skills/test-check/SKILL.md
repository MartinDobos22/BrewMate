---
name: test-check
description: Manuálny spúšťač testovania a code review. Použi keď chceš nezávisle otestovať a zrevidovať existujúci kód bez plného /implement pipeline. Vhodné pre hotový kód alebo pull request review.
---

# BrewMate Test & Review

Tento skill spúšťa testovanie a review NEZÁVISLE od implementácie. Použi ho na existujúci kód.

## Krok 1: Identifikácia zmenených súborov

Zisti aké súbory boli zmenené:

```bash
git diff --name-only HEAD                          # zmenené tracked súbory
git ls-files --others --exclude-standard           # nové untracked súbory
```

Alebo sa spýtaj používateľa ktoré súbory chce skontrolovať.

Kategorizuj:
- `src/` — klientské komponenty, hooks, utility, typy
- `server/` — backend routes, moduly, middleware
- `__tests__/` / `server/__tests__/` — existujúce testy
- `supabase/` — migrácie (tieto sa netestujú cez Jest)

## Krok 2: Test coverage check

Pre každý zmenený `.ts` / `.tsx` / `.js` súbor over:
- Existuje zodpovedajúci testovací súbor?
- Ak nie → navrhni aké testy treba napísať (unit testy pre logiku, integračné pre API)
- Ak áno → skontroluj či pokrývajú nové/zmenené prípady

## Krok 3: Spusti test suite

Na základe zmenených súborov vyber príkaz:

```bash
# Iba klientské zmeny (src/)
npm run test:client

# Iba serverové zmeny (server/)
npm run test:server

# Oboje
npm test

# Jeden konkrétny súbor
npx jest __tests__/NazovSuboru.test.tsx
npx jest --config jest.server.config.cjs server/__tests__/nazov.test.js

# Podľa názvu testu
npx jest -t "názov testu"
```

Výstup:
- ✅ X passed
- ❌ Y failed → vypíš chybové hlásenia a navrhni opravy

Ak testy zlyhávajú → analyzuj príčinu, navrhni opravu, počkaj na schválenie.

## Krok 4: Code review (cez code-reviewer subagent)

Spusti `code-reviewer` subagent. Predaj mu:
- Zoznam zmenených súborov
- Stručný kontext čo sa zmenilo a prečo

Reviewer skontroluje:
1. Design system compliance (žiadne raw hex, magic numbers)
2. TypeScript kvalitu (žiadne `any`, `Props` interface)
3. React Native best practices (re-rendery, StyleSheet.create)
4. Konzistencia s existujúcimi vzormi
5. Edge cases (loading/error/empty states, null safety)

## Krok 5: Záverečné zhrnutie

```
### Test & Review Report

**Testy:** X passed / Y failed
**Review:** PASS / NEEDS FIXES

**Critical nálezy** (blokujú merge):
- súbor:riadok — popis

**Odporúčané akcie:**
- [ ] oprava 1
- [ ] oprava 2

**Info:**
- nice-to-have poznámky
```

Ak sú Critical nálezy → oprav ich a zopakuj Krok 3 a Krok 4.
