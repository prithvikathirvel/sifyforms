# Form Layout Mode — Vertical & Horizontal (Design Plan)

**Status:** Implemented
**Scope:** Form Editor (`FormBuilderPage`, `LayoutConfigPanel`), Preview (`FormPreview`), and Public Form renderer (`PublicFormPage`)

---

## 1. Objective

Give form authors a first-class, per-form choice of **page width / field flow**:

- **Vertical layout** (default) — a narrow, centered card (Google Forms style).
  The page width stays small and focused, and the card is fully responsive from
  a phone up to a 23" monitor.
- **Horizontal layout** — a full-width container (with a comfortable margin) so
  many fields can sit side by side in a row. Fields flow **left to right** and
  wrap onto new rows according to each field's width (100% / 50% / 33%).

This is a page-layout concern only — **labels stay above their inputs in both
modes**. No label/control orientation change is involved.

---

## 2. Non-goals

- No new field types or schema/data changes beyond the additive optional flag.
- No change to drag-and-drop, selection, Inspector controls, validation,
  Smart Connections, submission, scoring, voting, or payment pipelines.
- No change to `singlePage` / `multiStep` flow modes — this composes on top of
  them (both flow modes support either page layout).

---

## 3. Model

### 3.1 Schema

`FormLayout` (in `src/types/index.ts`) carries a backward-compatible optional
field:

```ts
export interface FormLayout {
  mode: 'singlePage' | 'multiStep';
  steps?: FormStep[];
  allowBackNavigation?: boolean;
  /** Page width layout. 'vertical' = narrow centered card; 'horizontal' = full-width flow. */
  orientation?: 'vertical' | 'horizontal';
}
```

- **Optional + defaulted**: existing saved forms omit `orientation` and render
  exactly as today (`vertical`). No migration required.

### 3.2 Page width

| Layout | Container width | Notes |
|---|---|---|
| `vertical` | `max-w-2xl` centered | Google Forms–style narrow card; shrinks responsively on smaller screens |
| `horizontal` | `w-full max-w-[1400px]` centered | Full width with margin; expands up to a comfortable cap on huge monitors |

### 3.3 Field flow (horizontal only)

Fields are laid out on a **6-column CSS grid** (LCM of 2 and 3) so `full`,
`half`, and `third` widths tile cleanly and flow left-to-right, wrapping onto
new rows when a row is full:

| Field width | Grid span |
|---|---|
| `full` (100%) | 6 columns |
| `half` (50%) | 3 columns |
| `third` (33%) | 2 columns |

Examples of left-to-right flow:

- `half, half` → one row, two side-by-side fields.
- `third, third, third` → one row, three side-by-side fields.
- `half, third, third` → `half` + one `third` on row 1 (5/6 columns), the second
  `third` wraps to row 2. (Gaps are acceptable and standard for 50/33 mixes.)

Vertical mode keeps the existing **consecutive same-width grouping** behavior
unchanged (`full` stacks, `half` = 2-up, `third` = 3-up within the narrow card).

---

## 4. Responsive behavior

- **Vertical**: the narrow card is inherently responsive; the outer `px-4
  sm:px-6 lg:px-8` padding plus `max-w-2xl` keeps it centered and readable on
  laptop, 23" monitor, and mobile.
- **Horizontal**: below `sm` (640px) the grid collapses to a single column
  (`grid-cols-1`) and every field spans one column, so fields stack vertically
  and remain usable on phones. At `sm+` the 6-column flow activates.

Implemented with responsive utility classes (`col-span-1 sm:col-span-*` and
`grid-cols-1 sm:grid-cols-6`) in all three render sites.

---

## 5. Render sites (must stay in sync)

1. **Editor canvas** — `FieldsByWidth` in `FormBuilderPage.tsx`: the canvas card
   becomes `w-full` in horizontal mode (vs `max-w-[900px]` in vertical), and
   fields render in the 6-column flow grid via `SortableField` `className` spans.
2. **Preview** — `FormPreview.tsx`: container width switches on `orientation`,
   and fields render in the same 6-column flow grid.
3. **Public renderer** — `PublicFormPage.tsx` → `FieldsByWidth`: container
   width switches on `layout.orientation`, and fields render in the same
   6-column flow grid.

The span mapping and breakpoint are intentionally mirrored in all three places
(a small, stable mapping — not worth a shared module at this size).

---

## 6. Edge cases & rules

1. **Table fields** — always full-width (their width selector is hidden in the
   Inspector), so they span 6 columns in horizontal mode.
2. **HTML / display fields** — default to `full` → span 6 columns.
3. **Help text / errors / support documents** — render below the control,
   unchanged in both modes.
4. **Required asterisk** — adjacent to label text, unchanged.
5. **Multi-step** — each step's fields flow independently within the step.
6. **Dark mode / themes** — uses existing tokens; no new colors.

---

## 7. Definition of done

- A form can switch between Vertical and Horizontal from the Layout modal, and
  the choice persists and renders identically in Canvas, Preview, and the
  published form.
- Existing forms without `orientation` render unchanged (narrow vertical card).
- Horizontal mode is full-width (with margin) and flows fields left-to-right by
  width, wrapping correctly; mobile stacks to a single column.
- Validation, Smart Connections, conditional visibility, and submission
  behavior are untouched.
