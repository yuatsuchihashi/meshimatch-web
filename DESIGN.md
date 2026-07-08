---
colors:
  primary: "#F05A28"        # Primary Orange – CTA, brand, active states
  coral: "#FF8A5B"          # Coral – hover/pressed, warm secondary accents
  cream: "#FFF5EC"          # Cream – page background canvas
  sage: "#A8C686"           # Sage – success, positive votes (○), "decided"
  espresso: "#4A352A"       # Espresso – primary text, dark surfaces
  honey: "#F3C96B"          # Honey – ratings, badges, highlights
  surface: "#FFFFFF"
  surface-warm: "#FDF0E4"   # Cream を一段濃くした面 (選択チップ背景など)
  text-primary: "#4A352A"
  text-secondary: "#8A7568" # Espresso を薄めた温かいグレー
  text-tertiary: "#B8A99E"
  border: "#F0E2D6"
  border-strong: "#E2CFC0"
  danger: "#D64545"         # ×投票、削除、エラー
typography:
  font-family: "var(--font-geist-sans), -apple-system, 'Hiragino Sans', sans-serif"
  display: { size: 26px, weight: 800, line-height: 1.25, letter-spacing: -0.02em }
  title: { size: 20px, weight: 700, line-height: 1.3 }
  body: { size: 15px, weight: 400, line-height: 1.6 }
  caption: { size: 13px, weight: 500, line-height: 1.4 }
  micro: { size: 11px, weight: 600, line-height: 1.3, letter-spacing: 0.02em }
rounded:
  sm: 10px
  md: 16px
  lg: 20px
  full: 100px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary: { bg: colors.primary, color: "#FFFFFF", rounded: rounded.full, height: 52px, pressed-bg: colors.coral }
  button-secondary: { bg: colors.surface, color: colors.text-primary, border: colors.border-strong, rounded: rounded.full, height: 52px }
  card: { bg: colors.surface, rounded: rounded.lg, border: colors.border, shadow: "0 1px 3px rgba(74,53,42,0.05), 0 6px 16px rgba(74,53,42,0.04)" }
  chip: { bg: colors.surface, border: colors.border-strong, rounded: rounded.full, selected-bg: colors.primary, selected-color: "#FFFFFF" }
  badge-endorsement: { bg: colors.honey, color: colors.espresso, rounded: rounded.full }
  badge-favorite: { bg: colors.primary, color: "#FFFFFF", rounded: rounded.full }
  vote-yes: { bg: colors.sage, color: "#FFFFFF" }
  vote-no: { bg: colors.surface, color: colors.danger, border: colors.danger }
---

# MeshiMatch Design System

## Overview

MeshiMatch is a group dining decision app. The design should feel like a warm
table, not a form: cream canvas, one confident orange, appetizing warmth.
Deciding where to eat together should feel playful and fast, never bureaucratic.

Principles:

1. **One chromatic voice.** Primary Orange is the only loud color. Sage and
   Honey are supporting cast (success / highlight). If everything is orange,
   nothing is.
2. **Warm neutrals only.** No cold greys, no navy. Text is Espresso; greys are
   warmed (brown-tinted). White cards float on Cream.
3. **Rounded, soft, tactile.** Full-round buttons and chips, 20px cards,
   generous tap targets (min 48px). Motion is quick (150-300ms) and springy.
4. **Decisions look like cards, not lists.** Restaurants are presented as
   swipeable/tappable cards with photo-area, name, and reason tags. Votes are
   binary and satisfying (○ sage / × danger).

## Colors

- **Primary Orange `#F05A28`** – CTAs, selected chips, brand marks, member
  favorite badges. Hover/pressed shifts to **Coral `#FF8A5B`**.
- **Cream `#FFF5EC`** – the page background everywhere. Never pure white pages.
- **Espresso `#4A352A`** – all primary text and the dark auth backdrop. Never
  use black or navy.
- **Sage `#A8C686`** – success states, "everyone responded", ○ votes, decided
  restaurants.
- **Honey `#F3C96B`** – ratings, endorsement badges ("〇〇のおすすめ！"),
  highlights. Text on Honey is Espresso, never white.
- **Danger `#D64545`** – × votes, destructive actions only.

Do not introduce new hues. Tints of the six palette colors are allowed.

## Typography

Geist Sans with Hiragino fallback. Display 26/800 for screen titles, Title
20/700 for card headers, Body 15/400, Caption 13/500 for secondary info, Micro
11/600 for badges. Japanese text gets `letter-spacing: -0.01em`.

## Layout

Mobile-first, 390px baseline. Screen padding 20px. Section gap 24px. Bottom
CTAs are sticky with a cream gradient fade. One primary action per screen.

## Elevation & Depth

Two levels only: flat (page) and card. Card shadow is warm-tinted
(`rgba(74,53,42,…)`), never grey-black. No stacked modals; use bottom sheets.

## Shapes

Buttons and chips: full round (100px). Cards: 20px. Inputs: 16px. Avatars:
circles. The vote buttons (○/×) are perfect circles, 64px.

## Components

- **button-primary**: orange, full-width, 52px. One per screen.
- **chip**: white with warm border; selected = orange fill, white text (was
  navy - migrate).
- **restaurant card**: photo area (honey-tinted placeholder with genre emoji if
  no photo), name (Title), area + genre + price (Caption), reason tags as
  micro-chips, trust badges top-left (★お気に入り = orange, 🏅おすすめ = honey).
- **vote controls**: × (white circle, danger border) left, ○ (sage fill) right.
- **progress ring**: waiting room count uses primary orange ring on cream.

## Do's and Don'ts

- Do keep one CTA per screen; secondary actions are text links or ghosts.
- Do use sage only for positive/completed semantics, never decoration.
- Don't use navy `#1A1A2E` or terracotta `#C26A4A` anywhere (legacy palette).
- Don't put white text on Honey or Sage tints; use Espresso.
- Don't use pure black shadows; warm them with Espresso alpha.
- Don't exceed two font weights per screen beyond the display title.
