# BrewMate – kompletná logika zapisovania gramov kávy

Tento dokument je finálny návrh, ako implementovať tracking spotreby kávy tak, aby bol:
- presný pre používateľov, ktorí chcú čísla,
- rýchly pre používateľov, ktorí nechcú nič vypĺňať,
- použiteľný pre notifikácie „dochádza zásoba“.

## 1) Ciele systému

1. Udržať frikciu nízku (max 1 klik po príprave kávy).
2. Vedieť vypočítať `remaining_g` (zostávajúce gramy) čo najpresnejšie.
3. Vedieť fungovať aj bez gramov (fallback režim).
4. Nepoužívať hard-delete ako predvolenú akciu, ale lifecycle stavy (`active`, `empty`, `archived`).

---

## 2) Dátový model

## 2.1 `user_coffee` (rozšírenie existujúcej tabuľky)

Navrhované stĺpce navyše:

- `package_size_g integer` – veľkosť balíka (napr. 250, 500, 1000).
- `remaining_g integer` – aktuálny odhad zostatku v gramoch.
- `opened_at timestamptz` – dátum otvorenia balíka.
- `status text not null default 'active'` – `active | empty | archived`.
- `tracking_mode text not null default 'manual'` – `manual | estimated`.
- `preferred_dose_g integer` – preferovaná dávka používateľa pre quick action.
- `brew_method_default text` – `espresso | filter | other` (voliteľné).
- `last_consumed_at timestamptz` – posledná zmena zásob.

Obmedzenia:
- `remaining_g >= 0`
- `package_size_g > 0` ak je vyplnené
- `status IN ('active','empty','archived')`
- `tracking_mode IN ('manual','estimated')`

## 2.2 Nová tabuľka `user_coffee_consumption_events`

Aby sa dalo auditovať a učiť personalizáciu:

- `id uuid pk`
- `user_coffee_id uuid fk`
- `user_id text fk`
- `consumed_g integer not null` (kladné číslo)
- `brew_method text` (`espresso|filter|other`)
- `source text` (`quick_action|custom|slider|recipe_log|adjustment`)
- `created_at timestamptz default now()`

Výhody:
- história pre analytiku,
- „undo“ alebo korekcie,
- lepší tréning default dávky.

---

## 3) UX flow v aplikácii (inventár)

## 3.1 Pri ukladaní novej kávy

Po „Uložiť do inventára“ sa zobrazí mini modal:
- Veľkosť balíka: `250g / 500g / 1kg / vlastné`.
- „Balík som už otvoril“ (prepínač).
- Voliteľne: „Koľko približne ostáva teraz?“ (slider/input).

Inicializácia:
- ak user zadá len veľkosť balíka: `remaining_g = package_size_g`
- ak zadá aj aktuálny zostatok: `remaining_g = custom`
- ak nezadá nič: `tracking_mode='estimated'`

## 3.2 Na karte kávy (rýchle odpočty)

Quick actions (1 tap):
- `-10g`
- `-15g`
- `-18g`
- `-20g`
- `Custom`
- `Balík je prázdny`

Pravidlá:
- prvé tlačidlo je personalizované (`preferred_dose_g`), ak existuje,
- inak default 18g,
- používateľ môže dávku zmeniť bez vstupu do nastavení.

## 3.3 Custom zadanie

Používateľ môže:
1. zadať `consumed_g` (koľko minul), alebo
2. nastaviť priamo `remaining_g` sliderom.

Pre UX je vhodné mať obe možnosti:
- „Minul som X g“ (behaviorálne prirodzené po príprave),
- „Aktuálne ostáva Y g“ (korekcia reality).

## 3.4 Používateľ nič nevypĺňa

Fallback:
- stále má tlačidlo `Balík je prázdny`,
- položka môže bežať v `tracking_mode='estimated'`,
- zobrazuj „Odhad nízkej presnosti“.

---

## 4) API logika

## 4.1 Endpointy

### PATCH `/api/user-coffee/:id/consume`
Body:
```json
{
  "consumed_g": 18,
  "brew_method": "espresso",
  "source": "quick_action"
}
```

Server logika:
1. načítaj položku,
2. validuj ownership,
3. `new_remaining = max(0, remaining_g - consumed_g)`,
4. update `remaining_g`, `last_consumed_at`,
5. vlož záznam do `consumption_events`,
6. ak `new_remaining == 0`, nastav `status='empty'`,
7. odpovedz novým stavom položky.

### PATCH `/api/user-coffee/:id/remaining`
Body:
```json
{
  "remaining_g": 120,
  "source": "slider"
}
```

Použitie:
- pri manuálnej korekcii,
- pri prvotnom nastavení po otvorení balíka.

### PATCH `/api/user-coffee/:id/status`
Body:
```json
{ "status": "empty" }
```

Použitie:
- 1-tap „Balík je prázdny“.

### DELETE `/api/user-coffee/:id`
Hard delete nech ostane, ale len sekundárna akcia v UI.

---

## 5) Výpočet „dochádza o X dní"

## 5.1 Priamy výpočet (manual mode)

Ak máme dosť udalostí spotreby, napr. min. 5 za posledných 21 dní:

- `daily_consumption_g = sum(consumed_g_last_21d) / active_days`
- `days_left = remaining_g / daily_consumption_g`

Potom:
- `days_left <= 3` => notifikácia „dochádza“
- `days_left <= 1` => notifikácia „takmer prázdny“

## 5.2 Fallback pri slabých dátach

Ak je málo udalostí:
- použi konzervatívny default podľa metódy:
  - espresso: 16g
  - filter: 24g
  - mixed: 18g
- alebo nezobrazuj konkrétne dni, len stav:
  - „dostatok“ / „dochádza“ / „takmer prázdny“.

## 5.3 Odhadový režim (`estimated`)

Ak user nikdy nezadáva gramy:
- neukazuj „X g“,
- ukazuj len orientačný stav,
- zvýrazni CTA „Spresniť odhad“.

---

## 6) Personalizácia dávky (10g, 18g, atď.)

## 6.1 Ako nevnútiť 18g

18g je iba fallback, nie pravidlo.

Personalizácia:
1. sleduj posledných N consumption eventov (napr. 10),
2. vypočítaj medián `consumed_g` podľa `brew_method`,
3. ak stabilita dosť vysoká (malá odchýlka), navrhni:
   - „Nastaviť 10g ako predvolenú dávku pre espresso?“
4. po potvrdení zapíš `preferred_dose_g`.

## 6.2 Predvolené quick actions

Namiesto fixných tlačidiel:
- tlačidlo 1: personalizovaná dávka (napr. `-10g`),
- tlačidlá 2-4: štandardné možnosti,
- tlačidlo 5: custom.

---

## 7) Stavový model položky

- `active` – bežná položka v inventári,
- `empty` – balík dopitý/minutý,
- `archived` – historická položka mimo hlavného zoznamu.

Odporúčanie:
- default zoznam = len `active`,
- prepínač „Zobraziť aj prázdne/archív“,
- hard delete až v detaile položky.

Dôvod:
- história zlepšuje odporúčania,
- lepšie analytické KPI,
- používateľ má prehľad čo mu chutilo.

---

## 8) Edge cases a pravidlá

1. `consumed_g > remaining_g` => clamp na 0 a `status='empty'`.
2. záporné alebo nulové `consumed_g` => validation error.
3. zmena `package_size_g` počas života balíka => nepísať históriu, len prepočítať konzistentne cez korekčný event.
4. paralelné kliky na quick action => backend transakcia / row lock.
5. offline režim => queue lokálne, sync po reconnecte.

---

## 9) KPI pre túto funkcionalitu

- `% coffee items with tracking_mode=manual`
- `% active users with >=1 consumption event / week`
- `median taps to log consumption`
- `stockout notification open rate`
- `prediction error` (ak user dá „balík je prázdny“, porovnať očakávaný zostatok vs realita)

---

## 10) Implementačný plán (MVP -> V2)

## MVP (1–2 sprinty)

1. DB: `package_size_g`, `remaining_g`, `status`, `opened_at`, `tracking_mode`.
2. API: `consume`, `remaining`, `status` endpointy.
3. UI: quick actions + „balík je prázdny“.
4. Notifikácia len pre manuálny režim s gramami.

## V2

1. `consumption_events` audit tabuľka.
2. personalizovaná default dávka (`preferred_dose_g`).
3. presnejší model `days_left` + confidence.
4. soft recommendation „Spresniť odhad“ pre estimated users.

---

## 11) Stručné rozhodnutia (TL;DR)

- **Nie fixných 18g pre všetkých.**
- **Áno quick actions + custom input + empty button.**
- **Áno status model (`active/empty/archived`) namiesto default mazania.**
- **Áno podpora userov bez gramov cez estimated mode.**
- **Áno postupné učenie personalizovanej dávky podľa histórie.**
