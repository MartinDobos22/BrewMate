# BrewMate MD3 Design Specification

## Design Philosophy
Minimalist Material Design 3 with coffee-inspired, calm, neutral aesthetic.
Tile/card-based layout system with spacious, breathable layouts.

## Tech Stack
- react-native-paper v5+ (MD3 support)
- React Navigation v6+ with Bottom Tabs
- 8pt spacing system
- Rounded corners: 16dp globally

## Color Palette (MD3 Tokens)
| Token | Value | Usage |
|-------|-------|-------|
| background | `#F6F3EE` | Warm off-white screen bg |
| surface | `#FFFFFF` | Cards, navigation bars |
| surfaceVariant | `#EDE8E1` | Tiles, secondary cards |
| primary | `#6B4F3A` | Soft coffee brown — CTAs |
| onPrimary | `#FFFFFF` | Text on primary buttons |
| primaryContainer | `#D9C4B0` | Highlight backgrounds |
| onPrimaryContainer | `#2C1A0E` | Text on highlight bg |
| secondary | `#8A9A5B` | Muted sage green |
| onSecondary | `#FFFFFF` | Text on secondary |
| secondaryContainer | `#D6E4A1` | Secondary highlight bg |
| onSecondaryContainer | `#2E3A10` | Text on secondary bg |
| outline | `#C4BDB5` | Soft neutral borders |
| outlineVariant | `#E0D9D1` | Very subtle borders |
| error | `#B3261E` | MD3 default error |

## Typography Scale
- `displayLarge/Medium` — Major screen titles
- `headlineLarge/Medium` — Section headers
- `titleLarge/Medium` — Card titles
- `bodyLarge/Medium` — Main content text
- `labelLarge/Medium` — Buttons, tags, chips

All typography uses Paper's `<Text variant="...">` component.

## Spacing (8pt Grid)
```
xs:   4dp   — micro spacing
sm:   8dp   — small gaps
md:   12dp  — tile gutters
lg:   16dp  — standard padding
xl:   24dp  — section spacing
xxl:  32dp  — large spacing
xxxl: 48dp  — major breaks
```

## Layout System

### Tile Grid
- 2-column responsive grid
- Card tiles: surfaceVariant background, 16dp radius
- No heavy elevation — color contrast only
- 16dp inner padding, 12dp gutters

### Bottom Navigation (4 tabs)
| Tab | Icon | Screen |
|-----|------|--------|
| Domov | home-outline | HomeScreen (dashboard + scanner + foto recept) |
| Inventár | package-variant | CoffeeInventoryScreen |
| Recepty | coffee-outline | CoffeeRecipesSavedScreen |
| Profil | account-outline | ProfileHome (taste profile, questionnaire, journal, logout) |

### Navigation Headers
- MD3 style AppBar
- No heavy shadow
- Surface background
- headlineMedium typography

## Component Rules
- NO inline styles — StyleSheet.create() only
- NO hardcoded colors — theme.colors tokens only
- Use MD3 components: Card, Surface, Appbar, Text, Button, Chip, ProgressBar
- Typography via `<Text variant="...">` only
