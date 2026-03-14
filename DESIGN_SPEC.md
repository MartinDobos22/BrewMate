# BrewMate Redesign - Design Specification

## Design Philosophy
Modern minimalist. Clean, airy, sophisticated. Think Apple-level polish for a coffee app.

## Color Palette
- **Background**: `#FAFAFA` (very light gray, not pure white)
- **Primary**: `#2C2C2C` (near-black for buttons, text emphasis)  
- **Accent**: `#8B7355` (warm brown, used sparingly for highlights, links, active states)
- **Surface**: `#FFFFFF` (cards, inputs)
- **Surface Alt**: `#F5F5F5` (secondary cards, pill backgrounds)
- **Outline**: `#E8E8E8` (subtle borders)
- **Text**: `#1A1A1A` (primary text)
- **Text Secondary**: `#6B6B6B` (labels, descriptions)
- **Text Tertiary**: `#999999` (placeholders, captions)
- **Error**: `#D64545`
- **Success**: `#4A9B6E`
- **Warning**: `#C08B3E`

## Typography
- Display: 28-34px, weight 700, slight negative letter-spacing
- Headline: 22px, weight 600
- Title: 17px, weight 600
- Body: 15px, weight 400
- Label: 13px, weight 600
- Caption: 12px, weight 400

## Components Design Rules

### Cards
- White background (#FFFFFF)
- Border radius: 16px
- NO borders — use subtle shadow instead (shadowOpacity: 0.04, shadowRadius: 8)
- Padding: 20px
- Margin between cards: 12px

### Buttons
- **Primary**: background #2C2C2C, text white, borderRadius: 12, paddingVertical: 16, shadow
- **Secondary**: background #F5F5F5, text #2C2C2C, borderRadius: 12, paddingVertical: 14, no border
- **Outline**: background transparent, border 1.5px #E8E8E8, text #2C2C2C, borderRadius: 12
- **Ghost/Link**: no background, accent color text (#8B7355)
- **Destructive**: background #D64545, text white
- All buttons: fontWeight 600, fontSize 15

### Inputs
- Background: #F5F5F5  
- Border radius: 12px
- Padding: 14px horizontal, 14px vertical
- Text color: #1A1A1A
- Placeholder color: #999999
- No visible border (or very subtle #E8E8E8 if needed)
- Focus state: subtle accent border

### Pills / Chips / Filter Tabs
- Inactive: background #F5F5F5, text #6B6B6B, borderRadius: 999
- Active: background #2C2C2C, text white, borderRadius: 999
- Padding: 8px 16px

### Progress Bars / Taste Bars
- Track: #F0F0F0, height 6px, borderRadius: 999
- Fill: #8B7355 (accent), borderRadius: 999

### Metric Cards (Dashboard)
- Background: #F5F5F5
- Border radius: 16px
- Value: fontSize 24, fontWeight 700, color #1A1A1A
- Label: fontSize 12, fontWeight 500, color #6B6B6B, uppercase, letterSpacing 0.5

### Section Headers
- fontSize: 17, fontWeight 600, color #1A1A1A
- "See all" links: fontSize 13, color #8B7355, fontWeight 600

### Status Badges
- Positive: background #E8F5ED, text #4A9B6E
- Negative: background #FDEAEA, text #D64545
- Neutral: background #F5F5F5, text #6B6B6B

### Dividers
- Use spacing/whitespace instead of lines wherever possible
- If needed: 1px #F0F0F0

### General Layout
- Screen padding: 20-24px horizontal
- Content gap: 12-16px between sections
- Generous whitespace — let content breathe
- No heavy borders anywhere

### StatusBar
- barStyle: "dark-content" (dark icons on light background)
- backgroundColor: #FAFAFA

### Navigation Header
- Clean white background (#FFFFFF)
- Subtle bottom shadow
- Title: 17px, fontWeight 600, color #1A1A1A
- Back button tint: #2C2C2C
