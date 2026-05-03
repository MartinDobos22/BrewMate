---
name: design-system
description: BrewMate Design System v5 referenčná príručka. Použi automaticky pri vytváraní alebo úprave UI komponentov, štýlov, alebo pri otázkach o vizuálnom dizajne appky.
---

# BrewMate Design System v5

Všetky tokeny sú v `src/theme/theme.ts`. V komponentoch vždy použi `useTheme()` z `src/theme/useTheme.ts` — nikdy nepriamo importuj `appTheme` (dark mode future-proofing).

```typescript
import { useTheme } from '../theme/useTheme';

const MyComponent = () => {
  const theme = useTheme();
  // theme.colors.*, theme.spacing.*, theme.shape.*, theme.typescale.*
};
```

---

## Farby — `theme.colors.*`

Sémantické tokeny z MD3 light scheme (dark scheme sa prepína automaticky cez `useTheme()`):

| Token | Svetlá hodnota | Použitie |
|---|---|---|
| `primary` | `#6B4F3A` | Espresso brown — CTA tlačidlá, aktívne stavy |
| `onPrimary` | `#FFFFFF` | Text/ikona na primary ploche |
| `primaryContainer` | `#EECAAE` | Karty, chips, backgrounds |
| `onPrimaryContainer` | `#2A1A0F` | Text na primaryContainer |
| `secondary` | `#86643F` | Caramel — sekundárne prvky |
| `secondaryContainer` | `#FFE2BF` | Sekundárne karty |
| `tertiary` | `#4A6B4C` | Cardamom sage — akcenty, success |
| `tertiaryContainer` | `#CDF4D8` | Success backgrounds |
| `error` | `#B3261E` | Chybové stavy |
| `errorContainer` | `#F9DEDC` | Error backgrounds |
| `background` | `#FFF8EF` | Pozadie obrazoviek |
| `surface` | `#FFF8EF` | Plochy kariet |
| `surfaceVariant` | `#EBDDCE` | Alternatívne povrchy |
| `onSurface` | `#1C1712` | Primárny text |
| `onSurfaceVariant` | `#4B4339` | Sekundárny text, ikony |
| `outline` | `#7D7366` | Okraje, delidory |
| `outlineVariant` | `#CEC1B3` | Jemné okraje |
| `surfaceContainerLow` | `#FFF3E5` | Nízko vyvýšené karty |
| `surfaceContainer` | `#F9ECD7` | Štandardné karty |
| `surfaceContainerHigh` | `#F3E4CB` | Vysoké karty, modaly |

---

## Spacing — `theme.spacing.*`

```
xxs  →  2px    xs   →  4px    sm   →  8px
md   → 12px    lg   → 16px    xl   → 20px
xxl  → 24px    xxxl → 32px    huge → 48px
```

Príklady:
```typescript
paddingHorizontal: theme.spacing.lg,   // 16 — štandardný okraj obrazovky
gap: theme.spacing.md,                 // 12 — medzera medzi prvkami
marginBottom: theme.spacing.xxl,       // 24 — sekcia spacing
padding: theme.spacing.sm,             // 8  — kompaktný padding
```

---

## Shape (border radius) — `theme.shape.*`

```
none → 0    extraSmall → 4    small → 8
medium → 12    large → 16    extraLarge → 28
extraLarge2 → 32    full → 9999
```

Príklady:
```typescript
borderRadius: theme.shape.medium,      // 12 — bežné karty
borderRadius: theme.shape.large,       // 16 — prominentné karty
borderRadius: theme.shape.full,        // 9999 — pills, FAB, avatar
borderRadius: theme.shape.small,       // 8  — chips, badges
```

---

## Typografia — `theme.typescale.*`

Všetky role sú bez `fontFamily` — systémový font. Hodnoty: `{ fontSize, lineHeight, fontWeight, letterSpacing }`.

| Token | fontSize | fontWeight | Použitie |
|---|---|---|---|
| `displayLarge` | 57 | 400 | Veľké hero nadpisy |
| `headlineLarge` | 32 | 600 | Nadpisy obrazoviek |
| `headlineMedium` | 28 | 600 | Sekčné nadpisy |
| `headlineSmall` | 24 | 600 | Subsekcie |
| `titleLarge` | 22 | 600 | Názvy kariet |
| `titleMedium` | 16 | 600 | Titulky, labels |
| `titleSmall` | 14 | 600 | Malé titulky |
| `bodyLarge` | 16 | 400 | Hlavný text |
| `bodyMedium` | 14 | 400 | Sekundárny text |
| `bodySmall` | 12 | 400 | Pomocný text |
| `labelLarge` | 14 | 600 | Tlačidlá, tagy |
| `labelMedium` | 12 | 600 | Chips, badges |
| `labelSmall` | 11 | 600 | Captions, timestamps |

```typescript
// Správne použitie v StyleSheet
const styles = StyleSheet.create({
  title: {
    ...theme.typescale.titleLarge,
    color: theme.colors.onSurface,
  },
  body: {
    ...theme.typescale.bodyMedium,
    color: theme.colors.onSurfaceVariant,
  },
});
```

---

## Elevation — `theme.elevation.*`

MD3 elevation cez shadow + tint overlay (nie border):

```typescript
// level0 – level5
const cardStyle = {
  ...theme.elevation.level2.shadow,   // shadowColor, shadowOpacity, shadowRadius, shadowOffset, elevation
  backgroundColor: theme.colors.surfaceContainer,
};
```

---

## MD3 komponenty — `src/components/md3.tsx`

Primitíva sú v `src/components/md3.tsx`. Vždy uprednostni existujúce MD3 komponenty pred custom implementáciou.

---

## Zakázané vzory

```typescript
// ❌ Raw hex — nikdy
color: '#6B4F3A'
backgroundColor: '#FFF8EF'

// ✅ Token
color: theme.colors.primary
backgroundColor: theme.colors.background

// ❌ Magic number spacing — nikdy
marginTop: 16
paddingHorizontal: 24

// ✅ Spacing token
marginTop: theme.spacing.lg       // 16
paddingHorizontal: theme.spacing.xxl  // 24

// ❌ Raw border radius — nikdy
borderRadius: 12

// ✅ Shape token
borderRadius: theme.shape.medium  // 12

// ❌ Raw font definície — nikdy
fontSize: 16
fontWeight: '600'

// ✅ Typescale spread
...theme.typescale.titleMedium

// ❌ Priamy import appTheme
import { appTheme } from '../theme/theme'

// ✅ Hook (dark mode safe)
const theme = useTheme()

// ❌ Emoji ako ikony
<Text>☕</Text>

// ✅ SVG komponenta z src/components/
<CoffeeIcon />
```

---

## Vzorový komponent

```typescript
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface Props {
  title: string;
  subtitle?: string;
}

export const InfoCard = ({ title, subtitle }: Props) => {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: theme.shape.large,
      padding: theme.spacing.lg,
      ...theme.elevation.level1.shadow,
    },
    title: {
      ...theme.typescale.titleMedium,
      color: theme.colors.onSurface,
    },
    subtitle: {
      ...theme.typescale.bodyMedium,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.xs,
    },
  });
```
