# LIGMA — Design System Log

## Figma Dark Design System

**Version:** 2.0.0  
**Last Updated:** 2026-04-28  
**Inspired by:** Figma — Professional, creative, focused on the canvas experience.

---

## Philosophy

The "Figma Dark" system focuses on a neutral, deep-grey workspace (#1E1E1E) that allows creative work to stand out. It uses clearly defined panel layers (#2C2C2C) and sharp blue accents (#0D99FF) to signal interactivity.

> **Core principle:** The UI is a frame for the canvas. It should be stable, professional, and familiar to designers. Creativity is invited through subtle mesh gradients and interactive glows.

---

## Color Palette

### Primitive Colors (never use directly in components)

| Token | Hex | Usage |
|---|---|---|
| `--primitive-figma-950` | `#121212` | Deepest background (container lowest) |
| `--primitive-figma-900` | `#1E1E1E` | Main canvas/page surface |
| `--primitive-figma-800` | `#2C2C2C` | Panels, Sidebar, Header |
| `--primitive-figma-700` | `#383838` | Borders & Dividers |
| `--primitive-figma-600` | `#444444` | Hover states |
| `--primitive-figma-500` | `#555555` | Secondary highlights |
| `--primitive-blue-500` | `#0D99FF` | Brand Primary (Figma Blue) |
| `--primitive-blue-400` | `#33A9FF` | Primary light |
| `--primitive-blue-600` | `#0087E5` | Primary dark |
| `--primitive-purple-500` | `#A259FF` | Selection / Lead Role (Figma Purple) |
| `--primitive-purple-400` | `#B782FF` | Selection light |
| `--primitive-white-100` | `#FFFFFF` | Heading text |
| `--primitive-white-90` | `#E6E6E6` | Standard body text |
| `--primitive-white-60` | `#B3B3B3` | Muted/Secondary text |
| `--primitive-white-30` | `#808080` | Subtle/Placeholder text |
| `--primitive-green-400` | `#0FA958` | Success / Online |
| `--primitive-red-400` | `#F24822` | Danger / Alert |

---

## Semantic Token Map

### Backgrounds
```
--color-bg             → figma-900   (#1E1E1E) — main workspace
--color-bg-deep        → figma-950   (#121212) — deeper inset areas
--color-bg-raised      → figma-800   (#2C2C2C) — sidebars, headers
--color-bg-elevated    → figma-700   (#383838) — dropdowns, tool panels
--color-bg-highlight   → figma-600   (#444444) — hover highlights
```

### Surfaces
```
--color-surface         → figma-800  (#2C2C2C)
--color-surface-hover   → figma-700  (#383838)
--color-surface-active  → figma-600  (#444444)
```

### Borders
```
--color-border          → figma-700  (#383838)
--color-border-strong   → figma-600  (#444444)
--color-border-focus    → blue-500   (#0D99FF)
```

### Text
```
--color-text            → white-100  (#FFFFFF)
--color-text-muted      → white-60   (#B3B3B3)
--color-text-subtle     → white-30   (#808080)
--color-text-inverse    → white-100
```

### Brand & Role Colors
```
--color-primary         → blue-500   (#0D99FF)
--color-role-lead       → purple-500 (#A259FF)    Figma-style selection
--color-role-contributor → blue-500  (#0D99FF)    Cursor / member accents
--color-status-success  → green-400  (#0FA958)
--color-status-danger   → red-400    (#F24822)
--color-info            → blue-500   (#0D99FF)
```

---

## Component Layout: Workspace Page

The Workspace is divided into 5 clear regions:

1. **Top Bar (48px)**: Global navigation, tabs (Workspace, Assets, etc.), and collaboration status.
2. **Left Tool Panel**: Floating vertical bar containing standard tldraw tools + custom extensions.
3. **Main Canvas**: The infinite tldraw stage.
4. **Bottom Bar**: Contextual controls for zoom, undo/redo, and history.
5. **Execution Panel (320px)**: Right-hand sidebar for Activity Logs and Task Management.

---

## Typography

- **UI Font**: `Inter`, system-ui
- **Sizes**: Standard scale from 11px (labels) to 32px (page titles).
- **Style**: Professional, standard casing (not all-caps by default, except small labels).

---

## Creative Flourishes

To balance professional rigidity with creativity:
- **Mesh Gradients**: Fixed radial gradients in the background to avoid a "flat" feel.
- **Interactive Glows**: Elements like "New Canvas" emit a subtle aura on hover.
- **Glassmorphism**: Sidebars use `backdrop-filter: blur(12px)` for a premium feel.

---

## Component Decisions (Workspace)

- **Tools Panel**: Floating `radius-lg` (12px) with 1px border.
- **Execution Panel**: Solid background, separated by 1px divider.
- **Tabs**: Bottom-aligned active border matching Figma's tab style.
- **Icons**: Lucide (`Fi`) used for all UI elements for consistency.
