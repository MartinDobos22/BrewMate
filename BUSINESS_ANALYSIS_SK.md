# BrewMate – business analýza a návrhy ďalších funkcií

## 1) Kde je dnes hodnota produktu

BrewMate už dnes rieši tri silné „jobs-to-be-done“:

1. **Objaviť a pochopiť kávu rýchlo**
   - OCR sken etikety + AI profil chute znižujú bariéru pri výbere kávy.
2. **Nájsť kávu podľa vlastnej preferencie**
   - Dotazník vytvára chuťový profil používateľa a porovnanie so skenovanou kávou.
3. **Premeniť zrná na dobrý výsledok doma**
   - Foto analýza + generovanie receptu (gramáž, čas, teplota) pomáha začiatočníkom aj pokročilým.

To je veľmi dobrý základ pre „AI coffee companion“: od výberu zrna až po prípravu.

## 2) Čo by som implementoval ako prvé (najvyšší business dopad)

## A) „Reorder & stock alerts“ pre inventár

**Problém:** používateľ síce vidí inventár, ale appka aktívne nepomáha predchádzať tomu, že káva dôjde.

**Návrh:**
- pridať ku každej káve:
  - dátum otvorenia,
  - odhad spotreby (g/deň),
  - zostatok (g),
  - "dochádza o X dní".
- push notifikácia: „Tvoja obľúbená káva dôjde o 3 dni“.

**Business efekt:** vyššia retencia (D7/D30), priestor na affiliate/e-shop partnerstvá.

## B) „Smart recommendations feed“ (personalizovaný katalóg)

**Problém:** dnes používateľ musí najprv naskenovať konkrétnu kávu.

**Návrh:**
- feed odporúčaných káv podľa tasteVector + histórie „loved“.
- filtre: praženie, acidita, cena, spôsob prípravy (espresso/filter).
- pri každej položke „prečo odporúčané“ (explainability).

**Business efekt:** vyšší engagement a jasný základ pre monetizáciu (affiliate CPA/CPS).

## C) „Brew log“ + uzavretá spätná väzba pre AI

**Problém:** AI dá recept, ale appka sa systematicky neučí z výsledku (chutilo/nechutilo pri konkrétnych parametroch).

**Návrh:**
- po príprave jednoduché hodnotenie 1–5 + „čo upraviť“ (kyslosť, horkosť, telo).
- uložiť parametre prípravy (mlynček, ratio, čas, teplota).
- ďalší recept automaticky optimalizovať z tejto histórie.

**Business efekt:** vyšší perceived value („appka ma reálne pozná“), menší churn.

## 3) Monetizácia – realistický model na 2 fázy

## Fáza 1: Freemium

**Free plán**
- limit skenov / mesiac,
- základný dotazník,
- základné recepty.

**Premium (napr. 4.99–9.99 €/mes.)**
- neobmedzené skeny,
- pokročilé recepty podľa vybavenia,
- trendové grafy chuťového profilu,
- prioritné AI (rýchlejšie odpovede),
- export histórie (CSV/PDF).

## Fáza 2: Affiliate + B2B

- affiliate marketplace (pražiarne, e-shopy, príslušenstvo),
- B2B „white-label recommendations API“ pre kaviarne/e-shopy.

## 4) KPI, ktoré by som sledoval od prvého dňa

- **Activation rate:** % používateľov, ktorí v prvom dni spravia (dotazník + aspoň 1 sken).
- **Aha moment:** čas po „prvý úspešný recept“.
- **D7/D30 retention:** hlavný health metric produktu.
- **Recipe-to-love conversion:** koľko receptov vedie k označeniu „loved“.
- **Scan success rate:** % úspešných OCR + profile requestov.
- **Cost per active user:** náklad AI volaní / MAU.

## 5) Prioritizovaný roadmap (8–10 týždňov)

1. **Týždeň 1–2:** Brew log + rýchle hodnotenie výsledku receptu.
2. **Týždeň 3–4:** Spotreba a dochádzanie zásob + push notifikácie.
3. **Týždeň 5–6:** Personalizované odporúčania + explainability.
4. **Týždeň 7–8:** Freemium paywall + limity AI volaní.
5. **Týždeň 9–10:** Affiliate integrácie + prvé partnerstvá.

## 6) Rýchle UX winy (nízka náročnosť, vysoký efekt)

- onboarding v 3 krokoch (dotazník -> prvý sken -> prvý recept),
- „one-tap rescan“ pri OCR chybe,
- zjednotiť jazyk UI (SK/EN mix),
- zobrazovať „confidence“ a čo chýba pre lepší výsledok,
- CTA po výsledku: „Ulož do inventára“ + „Vyskúšaj recept teraz“.

## 7) Najväčšie riziká a mitigácia

- **Náklad AI volaní:** cache výsledkov, menšie modely pre lacnejšie kroky, limity vo free pláne.
- **Nekonzistentné OCR vstupy:** lepší upload flow + fallback manuálna editácia etikety.
- **Nízká návratnosť používateľov:** pravidelná hodnota cez notifikácie (reorder, tip dňa, personal picks).

---

Ak chceš, v ďalšom kroku ti môžem pripraviť aj konkrétny **implementačný backlog** (user stories + acceptance criteria + odhad náročnosti) pre najbližší sprint.
