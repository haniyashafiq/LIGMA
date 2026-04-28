# LIGMA — Design System Log

## Obsidian Flow Design System

**Version:** 1.0.0  
**Last Updated:** 2026-04-28  
**Inspired by:** Linear.app — Sleek, high-contrast, focused on clarity

---

## Philosophy

The "Obsidian Flow" system uses a near-black charcoal base (not pure black, which feels harsh) with carefully layered surfaces. Elements feel elevated through subtle lightness steps rather than shadows or glass blur. Borders are whisper-thin. Typography is razor-sharp.

> **Core principle:** Contrast comes from lightness, not color. Accent color is reserved for meaning (primary action, roles, status) — not decoration.

---

## Color Palette

### Primitive Colors (never use directly in components)

| Token | Hex | Usage |
|---|---|---|
| `--primitive-obsidian-950` | `#0e0e0e` | Deepest background (container lowest) |
| `--primitive-obsidian-900` | `#141313` | Main canvas/page surface |
| `--primitive-obsidian-800` | `#1c1b1b` | Sidebar & secondary panel |
| `--primitive-obsidian-700` | `#252323` | Elevated cards |
| `--primitive-obsidian-600` | `#3a3939` | Hover states, bright highlights |
| `--primitive-obsidian-500` | `#4a4848` | Disabled backgrounds |
| `--primitive-border-100` | `#26292E` | Subtle 1px borders |
| `--primitive-border-200` | `#3d4147` | Strong/focused borders |
| `--primitive-white-100` | `#FFFFFF` | Primary text |
| `--primitive-white-60` | `rgba(255,255,255,0.6)` | Secondary text (#A1A1AA equivalent) |
| `--primitive-white-30` | `rgba(255,255,255,0.3)` | Subtle/placeholder text |
| `--primitive-white-10` | `rgba(255,255,255,0.1)` | Hover tints |
| `--primitive-white-05` | `rgba(255,255,255,0.05)` | Active tints |
| `--primitive-teal-500` | `#0EA5E9` | Brand primary (updated to linear-inspired blue) |
| `--primitive-teal-400` | `#38BDF8` | Primary hover |
| `--primitive-gold-400` | `#F59E0B` | Lead role accent / highlights |
| `--primitive-gold-300` | `#FCD34D` | Lead role light |
| `--primitive-blue-400` | `#3B82F6` | Contributor role accent |
| `--primitive-blue-300` | `#60A5FA` | Contributor light |
| `--primitive-green-400` | `#22C55E` | Success / Available |
| `--primitive-red-400` | `#EF4444` | Urgent / Critical / Danger |
| `--primitive-orange-400` | `#F97316` | At Risk / Warning |
| `--primitive-purple-400` | `#8B5CF6` | AI / Info |

---

## Semantic Token Map

### Backgrounds
```
--color-bg             → obsidian-900   (#141313) — page background
--color-bg-deep        → obsidian-950   (#0e0e0e) — deepest areas
--color-bg-raised      → obsidian-800   (#1c1b1b) — sidebar, secondary panels
--color-bg-elevated    → obsidian-700   (#252323) — cards, inputs
--color-bg-highlight   → obsidian-600   (#3a3939) — hover state surfaces
```

### Surfaces (glass removed — this system uses solid layering)
```
--color-surface         → obsidian-700  (#252323)
--color-surface-hover   → obsidian-600  (#3a3939)
--color-surface-active  → obsidian-500  (#4a4848)
```

### Borders
```
--color-border          → border-100    (#26292E)
--color-border-strong   → border-200    (#3d4147)
--color-border-focus    → teal-500      (#0EA5E9)
```

### Text
```
--color-text            → white-100     (#FFFFFF)
--color-text-muted      → #A1A1AA       (zinc-400 equivalent)
--color-text-subtle     → white-30      
--color-text-inverse    → obsidian-950  
```

### Brand & Role Colors
```
--color-primary         → teal-500      (#0EA5E9)    main actions, active nav
--color-role-lead       → gold-400      (#F59E0B)    Lead badges, lock icons
--color-role-contributor → blue-400    (#3B82F6)    Contributor badges, cursors
--color-status-success  → green-400     (#22C55E)
--color-status-danger   → red-400       (#EF4444)
--color-status-warning  → orange-400    (#F97316)
--color-info            → purple-400    (#8B5CF6)    AI features
```

---

## Typography

| Token | Value | Usage |
|---|---|---|
| `--font-sans` | `'Inter', system-ui` | All UI text |
| `--font-mono` | `'JetBrains Mono'` | Code, IDs, badges |
| `--text-xs` → `--text-5xl` | 12px → 48px | Scale |
| `--font-normal` → `--font-bold` | 400 → 700 | Weights |

**Rules:**
- Headers: `--color-text` (`#FFFFFF`), `--font-bold`, tight tracking
- Body: `--color-text-muted` (`#A1A1AA`), `--font-normal`
- Labels / nav: `--color-text-muted`, `--font-semibold`, wide tracking, ALL CAPS
- Monospace: badges, IDs, sequence numbers

---

## Icons

**Library:** `react-icons` (Lucide subset `ri/*` from Remix Icons, or `lu/*` Lucide)

**Rules:**
- All icons are `react-icons` components — no emoji, no Unicode fallbacks
- Navigation: Lucide (`lu`) set for clean linear style
- Status: Use `FiCheckCircle`, `FiAlertCircle`, `FiClock`, etc.
- Size: `16px` in nav/toolbars, `18px` inline in content, `24px` for empty states

---

## Spacing

Scale uses `0.25rem` (4px) base unit:
`--space-1: 4px` → `--space-10: 64px`

**Rules:**
- Panel internal padding: `--space-5` (24px)
- Between sibling cards: `--space-4` (16px)
- Nav item internal: `--space-2 --space-3` (8px 12px)
- Icon-to-label gap: `--space-3` (12px)

---

## Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `4px` | Inline badges, chips |
| `--radius-md` | `8px` | Cards, inputs, buttons |
| `--radius-lg` | `12px` | Panels, modals |
| `--radius-xl` | `16px` | Large feature cards |
| `--radius-full` | `9999px` | Avatars, pips |

> **Change from previous:** Reduced radii to match Linear's sharper aesthetic. Prev: 14/22px, Now: 8/12px.

---

## Animation

| Token | Value | Usage |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.16,1,0.3,1)` | Elements entering |
| `--ease-spring` | `cubic-bezier(0.34,1.56,0.64,1)` | Hover lift effects |
| `--duration-fast` | `120ms` | Hover state changes |
| `--duration-normal` | `220ms` | Modal appear |
| `--duration-slow` | `350ms` | Page transitions |

---

## Component Decisions

### Sidebar
- **Background:** `--color-bg-raised` (`#1c1b1b`) — one step lighter than page
- **Width:** `220px` fixed
- **Nav items:** solid `--radius-sm` active pill, NO glass blur
- **Active color:** `--color-primary` tint background + primary text

### Cards (Canvas list items, workspace cards)
- **Background:** `--color-bg-elevated` (`#252323`)
- **Hover:** `--color-bg-highlight` (`#3a3939`) + `translateX(3px)`
- **Border:** `--color-border` (`#26292E`)
- NO backdrop-filter blur on cards (performance + clarity)

### Buttons
- **Primary:** Solid `--color-primary` (`#0EA5E9`), dark text, no gradient
- **Ghost:** `transparent` bg, `--color-border` border, muted text
- **Radius:** `--radius-md` (8px) — not the previous 12px

### Modals
- **Backdrop:** `rgba(0,0,0,0.8)` — opaque, no blur
- **Modal bg:** `--color-bg-raised` (`#1c1b1b`)
- **Border:** `--color-border-strong`

---

## Legacy Aliases (backward compat)

Old tokens (`--bg-0`, `--surface`, `--accent`, etc.) are remapped to new tokens so no existing CSS breaks until it is migrated.
