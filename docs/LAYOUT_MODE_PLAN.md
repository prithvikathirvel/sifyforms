# Form Layout Mode — Horizontal & Vertical (Design Plan)

**Status:** Proposal (not yet implemented)
**Author:** Form Builder working group
**Scope:** Form Editor (`FormBuilderPage`, `LayoutModal`, `FieldInspector`), Public Form renderer (`PublicFormPage`), and Preview (`FormPreview`)

---

## 1. Objective

Give form authors a first-class, per-form choice between two label/field
arrangements so every form can match its content and audience:

- **Vertical layout** — label sits **above** its input. Best for long labels,
  mobile-first forms, and simple single-column flows. (This is the current
  behavior and remains the default.)
- **Horizontal layout** — label sits **inline, to the left** of its input in a
  two-column grid. Best for dense, data-entry / enterprise forms where many
  short fields need to fit on one screen.

The goal is to make the form **more customizable and visually refined** without
breaking existing forms, schemas, or the Smart Connections / validation logic.

---

## 2. Non-goals

- No new field types.
- No change to drag-and-drop, selection, or the Inspector's per-field controls.
- No change to submission, scoring, voting, or payment pipelines.
- No removal of `singlePage` / `multiStep` flow modes — this feature composes
  **on top** of them (both flow modes support either label orientation).

---

## 3. Proposed model

### 3.1 Schema

Extend `FormLayout` (in `src/types/index.ts`) with a backward-compatible,
optional field:

```ts
export interface FormLayout {
  mode: 'singlePage' | 'multiStep';
  steps?: FormStep[];
  allowBackNavigation?: boolean;
  /** NEW — label/field arrangement. Defaults to 'vertical' when absent. */
  orientation?: 'vertical' | 'horizontal';
}
```

Key properties:

- **Optional + defaulted**: existing saved forms omit `orientation` and render
  exactly as today (`vertical`). No migration is required on read.
- **Scoped to the whole form**: a single, deliberate choice rather than
  per-field toggle chaos. (Per-field override can be a later iteration — see
  §8.)

### 3.2 Label / control pairing

| Orientation | Label position | Typical row |
|---|---|---|
| `vertical` | Above the input, full width | label (block) → input (block) |
| `horizontal` | Left column, fixed/fluid width, right-aligned | label (col 1) + input (col 2) |

In horizontal mode we recommend:

- Label column: **fluid, `minmax(140px, 30%)`**, text `right`-aligned,
  `text-[13px]`, truncated with tooltip on hover when very long.
- Control column: remaining space (`1fr`).
- Required asterisk stays immediately after the label text.

---

## 4. Builder (Editor) changes

### 4.1 Layout entry point

- **Primary**: add an "Orientation" control to `LayoutModal`
  (`src/components/builder/LayoutModal.tsx`), shown for both `singlePage` and
  `multiStep`, next to the existing mode switcher.
- **Secondary (nice-to-have)**: a quick segmented toggle in the header
  ("Vertical | Horizontal") that maps to the same `updateLayout` action for
  faster access. Keep it visually consistent with the existing Canvas/Preview
  toggle.

### 4.2 Redux

- Add `orientation` to `defaultLayout` in `src/store/builderSlice.ts`
  (`'vertical'`).
- `updateLayout` already spreads partials, so `updateLayout({ orientation })`
  works with no new reducer. Add an ergonomic `setOrientation` action only if
  the UI wants a dedicated dispatch path.
- `getSchemaWithLayout()` in `FormBuilderPage` already serializes
  `builder.layout` wholesale — `orientation` flows into the saved schema with
  no extra wiring.

### 4.3 Canvas field rendering

- `FieldsByWidth` (in `FormBuilderPage.tsx`) currently only groups by
  `width`. In horizontal mode the **field block itself** must render
  label-on-the-left so the canvas stays a faithful WYSIWYG of the public form.
  - Introduce a shared `FieldRow` presentational wrapper (label + control)
    used by both the editor canvas and `FormPreview`, parameterized by
    `orientation`. This prevents the editor and preview from drifting apart.

### 4.4 Preview

- `FormPreview.tsx` renders the label/control pairing; make it honor
  `layout.orientation` via the same `FieldRow` wrapper so Preview remains an
  exact replica (a core requirement from the preview work).

---

## 5. Public form rendering

- `PublicFormPage.tsx` renders fields through `FieldsByWidth` →
  `renderFieldItem`. Update `renderFieldItem` to wrap each field in the shared
  orientation-aware layout.
- Multi-step, conditional visibility, Smart Connections, table fields, file
  uploads, and signature pads are unaffected — only the **label/control
  arrangement** changes.
- Table fields (`table`) and custom HTML/display fields always render
  **full-width** and span both columns in horizontal mode (they are
  already full-width in vertical mode).

---

## 6. Responsive behavior

- Horizontal mode degrades gracefully: below a breakpoint (e.g. `sm`,
  640px), fall back to vertical stacking (label above input) so labels never
  crush the input on narrow screens.
- Implement as a CSS media query on the shared `FieldRow` wrapper — one place,
  consistent everywhere.

---

## 7. Edge cases & rules

1. **Required asterisk** — always adjacent to label text, both orientations.
2. **Help text / errors** — always render **below the control**, full width,
   so validation messages are readable in horizontal mode.
3. **`half` / `third` field widths** — these still group side-by-side fields;
   in horizontal mode each grouped cell keeps its own inline label. Confirm the
   interaction during implementation (half-width + horizontal can get tight on
   small screens — the responsive fallback handles it).
4. **Support documents** — unchanged; render below the control.
5. **Field-level `html` / `display`** — display values stay inline; custom HTML
   spans both columns.
6. **Dark mode / themes** — use existing tokens (`--border`, `--muted-foreground`,
   `--primary`) so horizontal rows follow the active theme automatically.

---

## 8. Future iterations (explicitly deferred)

- **Per-field orientation override** (`field.orientation?: 'vertical' | 'horizontal'`)
  for mixed forms — stored on `FormField`, with the form-level value acting as
  the default.
- **Label alignment options** (left / right / top) and **label width** controls
  in the Inspector.
- **Form-level column layout** (2/3-column page grid) distinct from field width.

---

## 9. Suggested implementation order

1. Types + Redux default + serialization (schema safety).
2. Shared `FieldRow` orientation wrapper.
3. Editor canvas + Preview wiring.
4. `LayoutModal` control (+ optional header toggle).
5. Public form renderer wiring + responsive fallback.
6. QA matrix: single-page & multi-step × vertical & horizontal × half/third
   widths × table/file/signature/display fields × dark theme.

---

## 10. Risks / mitigations

| Risk | Mitigation |
|---|---|
| Breaking existing saved forms | `orientation` optional, default `vertical` |
| Preview drifting from public renderer | Shared `FieldRow` component |
| Tight half-width fields in horizontal mode | Responsive breakpoint fallback |
| Long labels overflowing the label column | Truncate + tooltip; fluid label width |

---

## 11. Definition of done

- A form can switch between Vertical and Horizontal from the Layout modal, and
  the choice persists and renders identically in Canvas, Preview, and the
  published form.
- Existing forms without `orientation` render unchanged.
- Validation, Smart Connections, conditional visibility, and submission
  behavior are untouched.
- Dark mode and responsive (narrow) layouts remain correct.
