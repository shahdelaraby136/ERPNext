# Custom ERP — Healthcare Design System

A clean, calm, blue-medical visual language for ERPNext, optimised for fast scanning by doctors, reception, accounting, HR, and inventory users.

- **Source of truth:** `custom_erp/public/css/custom_theme.css`
- **Loaded by:** `custom_erp/hooks.py` → `app_include_css`
- **Scope:** Desk (logged-in app). Login page uses `login.css`. Dashboard uses `selling_dashboard.css`.

## Quick rules

| Use… | Don't… |
|------|--------|
| CSS variables (`var(--primary)`, `var(--sp-2)`) | Hardcode hex (`#2563EB`) or magic px (`16px` for spacing) |
| Semantic status colors (`--success`, `--error`) | Use red/green decoratively |
| Class hooks (`.btn-primary`, `.is-clickable`) | Inline styles in JS pages |
| 8px grid for layout, 4px for tight elements | Random gutters like `13px`, `19px` |

## 1. Color tokens

Defined in `custom_theme.css` under **`:root`**.

### Brand
| Token | Hex | Use |
|-------|-----|-----|
| `--primary` | `#2563EB` | Primary CTAs, active sidebar, links |
| `--primary-hover` | `#1D4ED8` | Hover/pressed primary buttons |
| `--primary-light` | `#DBEAFE` | Active row bg, ghost-hover, badges |
| `--primary-50` | `#EFF6FF` | Hero gradient tint |
| `--accent-teal` | `#14B8A6` | Secondary highlights, charts, tags |

### Surfaces & borders
| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#F8FAFC` | Page background |
| `--surface` | `#FFFFFF` | Cards, modals, navbar, inputs |
| `--surface-2` | `#F1F5F9` | Table head, row hover, disabled inputs |
| `--surface-3` | `#E2E8F0` | Skeleton highlight |
| `--border` | `#E2E8F0` | Default borders/dividers |
| `--border-strong` | `#CBD5E1` | Hovered input borders, scrollbar |

### Text
| Token | Hex | Use |
|-------|-----|-----|
| `--text-primary` | `#0F172A` | Body, headings |
| `--text-secondary` | `#64748B` | Captions, helper text, labels |
| `--text-muted` | `#94A3B8` | Placeholders only |

### Status (semantic — never decorative)
| Token | Hex | Companion fill |
|-------|-----|----------------|
| `--success` | `#16A34A` | `--success-soft` |
| `--warning` | `#F59E0B` | `--warning-soft` |
| `--error`   | `#DC2626` | `--error-soft` |
| `--info`    | `#0EA5E9` | `--info-soft` |

> **`--danger` / `--danger-soft` aliases** still resolve to `--error` / `--error-soft` for backward compatibility with older selectors. Prefer `--error` in new code.

**Rule:** never communicate state with color alone. Pair with an icon, label, or text indicator.

## 2. Spacing — 8px grid

| Token | Value | Use |
|-------|-------|-----|
| `--sp-xs` | 4px | Icon/text gaps inside a chip, line-height fine-tuning |
| `--sp-1`  | 8px | Tight component internals |
| `--sp-2`  | 16px | Default card padding, section internal spacing |
| `--sp-3`  | 24px | Card-to-card gaps, page padding |
| `--sp-4`  | 32px | Section vertical rhythm |
| `--sp-5`  | 40px | Component height anchor (button, input) |
| `--sp-6`  | 48px | Large section spacing, hero block padding |

**Rule:** every gap, padding, and margin should snap to a token. Reject `padding: 13px`.

## 3. Typography

Two font stacks; the right one is auto-selected from `<html dir>` / `lang`.

```css
--font-stack-latin:  "Inter", "Segoe UI", -apple-system, …
--font-stack-arabic: "IBM Plex Sans Arabic", "Inter", -apple-system, …
```

Both are loaded via `@import` from Google Fonts at the top of `custom_theme.css`. RTL is handled by `[dir="rtl"]` selectors.

| Role | Token | Weight |
|------|-------|--------|
| H1 | `--text-h1` (32px) | 700 |
| H2 / page title | `--text-h2` (24px) | 600 |
| H3 / modal title | `--text-h3` (20px) | 500 |
| Body | `--text-body` (16px) | 400 |
| Dense rows / form controls | `--text-sm` (14px) | 400–500 |
| Labels, eyebrow, helper | `--text-xs` (12px) | 500–600 |

Line heights: `--lh-tight` (1.2) for headings, `--lh-base` (1.5) for body, `--lh-loose` (1.65) for long-form copy.

## 4. Radius & shadows

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | 6px | Pills, kbd, dropdown items |
| `--radius`    | 8px | Buttons, inputs, chips |
| `--radius-lg` | 12px | Cards, modals, panels |

| Token | Use |
|-------|-----|
| `--shadow-sm`    | Navbar, page-head |
| `--shadow-card`  | Default card resting state |
| `--shadow-hover` | Card hover, clickable lift |
| `--shadow-modal` | Modals, dropdowns, popovers |
| `--focus-ring`   | `:focus-visible` ring (3px primary-soft) |

## 5. Buttons

- **Height:** 40px (`min-height: 40px`, `padding: 10px 16px`).
- **Radius:** 8px.
- **Variants:** `.btn-primary`, `.btn-secondary` / `.btn-default`, `.btn-ghost` / `.btn-link`, `.btn-danger`, `.btn-success`, `.btn-warning`.
- **Sizes:** `.btn-sm` (32px), default (40px), `.btn-lg` (48px).
- **States:**
  - Hover: deeper bg + slight shadow.
  - Active: `transform: scale(0.98)`.
  - Disabled: `opacity: 0.6`, `cursor: not-allowed`, no transform.
  - Focus-visible: 3px primary-soft ring (keyboard only).
- **Transitions:** `var(--t-fast)` (120ms) on color/border/shadow/transform.

```html
<button class="btn btn-primary">Save</button>
<button class="btn btn-secondary">Cancel</button>
<button class="btn btn-ghost">Edit</button>
<button class="btn btn-danger">Delete</button>
```

## 6. Cards

- White surface, 12px radius, 16px padding (24px on widescreen sections).
- `border: 1px solid var(--border)`, `box-shadow: var(--shadow-card)`.
- **Hover (display only):** stronger border, `--shadow-hover`. No transform.
- **Hover (clickable):** add `class="is-clickable"` (or wrap in `<a>`). Adds `translateY(-2px)` lift + hover shadow.

```html
<div class="widget">…</div>                              <!-- static card  -->
<a   class="widget is-clickable" href="…">…</a>          <!-- clickable    -->
```

## 7. Inputs & forms

- Height 40px to align with buttons.
- Border `--border`, hover border `--border-strong`, focus border `--primary` + 3px `--primary-soft` ring.
- Labels: `--text-xs`, `--text-secondary`, `font-weight: 500`, 4px gap to control.
- Helper text: `--text-xs`, `--text-secondary`, sits below the control.
- Error: wrap in `.has-error` or set `aria-invalid="true"` on the control — switches border to `--error` and ring to `--error-soft`.
- Required: surface marker (Frappe asterisk) — never rely on color alone.

## 8. Tables / List views

- Header bg `--surface-2`, `--text-secondary`, `--text-xs`, weight 500.
- Row min-height 40px (`.list-row-container`, `.table tbody td`).
- Hover row bg `--surface-2`.
- Selected / checked row bg `--primary-light`.
- Dividers only — no heavy borders.
- Action links inside cells: `--primary`, hover `--primary-hover`.
- Status pills: `.indicator-pill.{green|red|orange|yellow|blue|gray}` use the soft + dark-text pairs.

## 9. Sidebar / Navbar

- **Sidebar:** `--surface` background, item radius 8px, 4px outer / 8px inner margin.
  - Hover: bg `--surface-2`.
  - **Active:** bg `--primary-light`, text `--primary`, **3px primary inset on the leading edge** (auto-flips for RTL).
- **Navbar:** `--surface` bg, 56px tall, soft bottom border. Hover items get `--primary-light` bg + `--primary` text. Search bar has soft `--border-strong` border that highlights to `--primary` on hover.

## 10. Modals / dropdowns

- Modal: white surface, 12px radius, `--shadow-modal`. Header/footer separated by `--border`. 16px padding.
- Modal action area: primary (right) + secondary/ghost (left of primary). Cancel never carries `.btn-danger`.
- Dropdowns: 8px radius, `--shadow-modal`, items with `--radius-sm` and `--primary-light` hover bg.
- Tooltips: dark background (`--text-primary`), white text, 8px radius — high contrast on any surface.

## 11. Dashboards / KPI cards

- Use `.ce-stat` (icon + label + value) and `.ce-quick` (icon + label) building blocks. Both respect tokens.
- Tones: `.ce-stat-indigo|teal|violet|amber|rose|slate|green` (teal/rose/amber map to status; indigo is brand).
- KPI label: uppercase, tracked, `--text-xs`, `--text-secondary`. Value: 24px, weight 700.
- Loading: use `.ce-stat-skeleton` or `.ce-skeleton` (shimmer is reduced-motion aware via the global guard).

## 12. Motion

| Token | Duration | When |
|-------|----------|------|
| `--t-fast` | 120ms | Color/border swaps, button presses, hover bg |
| `--t-base` | 160ms | Card shadows, lifts |
| `--t-slow` | 220ms | Modal/dropdown reveal |
| `--ease`   | `cubic-bezier(0.4, 0, 0.2, 1)` | Default ease for all UI motion |

**Rules:**
- Animate `transform`, `opacity`, `background-color`, `border-color`, `box-shadow` only.
- No animations longer than 250ms inside the desk.
- Never animate `width`/`height`/`top`/`left` for hover effects.
- The `@media (prefers-reduced-motion: reduce)` block at the end of `custom_theme.css` collapses everything to ~0ms and removes hover transforms — every new animation must remain functional under that override.

## 13. Accessibility checklist

- Body text contrast: `--text-primary` on `--surface` ≈ **15:1**, on `--bg` ≈ **14.7:1** — well above WCAG AA.
- Secondary text: `--text-secondary` on `--surface` ≈ **5:1** — AA pass.
- Focus is **always visible** for keyboard via `:focus-visible` rules at the bottom of the file. Do not remove the outline without providing the ring.
- Status colors are paired with iconography or text in components — never rely on color alone.
- Reduced-motion is honoured globally.
- RTL is supported via `[dir="rtl"]` selectors that swap font stack and mirror sidebar active indicator.

## 14. How to add new components

1. **Reach for tokens first.** If you find yourself typing a hex or px-number, stop — there's almost certainly a variable.
2. **Compose existing primitives.** A new "appointment card" is `.widget` + `.is-clickable` + a tone class — not a new shadow scale.
3. **Place new rules in the right section** of `custom_theme.css`. Token additions go in the top block; component rules in their numbered section; cross-cutting concerns (focus, motion, RTL) in section 17 at the bottom.
4. **Bump the cache-buster** in `hooks.py` (`?v=NN` → `?v=NN+1`) so users get fresh CSS.
5. **Test both light + RTL.** Toggle Frappe's language to Arabic and visually scan the new component.
6. **Test reduced-motion.** macOS: System Settings → Accessibility → Display → Reduce motion. Confirm transitions still convey state changes.

## 15. What NOT to do

- Don't edit `apps/erpnext/**` or any core file — every override lives in `custom_erp`.
- Don't import additional fonts; expand `--font-stack-*` instead.
- Don't add `!important` unless overriding a Frappe selector. Inside our own selectors it's noise.
- Don't introduce a new status color outside `success / warning / error / info / accent-teal`.
- Don't put dashboard- or page-specific rules inside `custom_theme.css`. Make a new file in `public/css/` and add it to `app_include_css`.
