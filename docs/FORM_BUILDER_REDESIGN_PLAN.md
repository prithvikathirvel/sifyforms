# Form Builder — Enterprise Redesign Plan (2026)

**Status:** Proposal · **Scope:** Editor page (`/forms/:formId/edit`) only
**Goal:** A world-class, enterprise-grade SaaS form-builder editor with a full-canvas,
"WYSIWYG = the real published form" experience, without touching any frontend or backend
business logic.

> Guardrail (hard constraint): every existing reducer, save/publish handler, modal,
> DnD contract and API call stays identical. We are changing **presentation and layout
> only**. All business logic is untouched.

---

## 1. Design principles (2026 enterprise SaaS)

| Principle | What it means in the editor |
| --- | --- |
| **Full-canvas focus** | Header is a slim chrome; the three columns (palette · canvas · inspector) own the full viewport height. No wasted gutter. |
| **Canvas = published form** | What you build on the canvas is pixel-close to what a respondent sees. Fields render as real controls, not labelled cards. |
| **Calm, neutral surfaces** | `background`/`workspace`/`card` tokens with a single brand accent (`--primary`, plum scale). No gradients, no glare. |
| **Low-contrast borders, mild shadows** | `--border` at ~90% lightness; shadows only to lift the selected field and floating toolbars. |
| **Clear visual hierarchy** | Palette < canvas (dominant) < inspector. Z-depth via surface + border, never color noise. |
| **Compact responsive spacing** | `8px` base grid, dense 32px rows for toolbars, comfortable 20px for form controls. |
| **Accessibility (WCAG AA)** | Visible focus rings, 4.5:1 text contrast, labelled inputs, `aria-*` on icons, keyboard reachable controls, reduced-motion support. |
| **No toy aesthetic** | Restrained radius (`--radius`), no oversized buttons, no emoji, consistent icon system (lucide). |

---

## 2. Information architecture

```
┌────────────────────────  Editor full-canvas  ───────────────────────┐
│ Header  (breadcrumb · form name · status pills · actions) 32px       │
├──────────────┬──────────────────────────────────────┬────────────────┤
│  Field       │  Canvas (WYSIWYG preview)            │  Inspector     │
│  palette     │  · segmented Edit/Preview            │  · context      │
│  · search    │  · form title/description            │    header      │
│  · categories│  · draggable field rows              │  · accordions   │
│  · drag tiles│  · drop zones / multi-step rails     │  · action modals│
├──────────────┴──────────────────────────────────────┴────────────────┤
│  Status bar  (field count · validation summary · autosave state)      │
└──────────────────────────────────────────────────────────────────────┘
```

Priority order on screen: **Canvas (1) → Inspector (2) → Palette (3)**. The canvas is the
hero; everything else supports it.

---

## 3. Workstreams

### 3.1 Canvas — WYSIWYG form preview
- Field rows render as **actual form controls** (input, select, radio, checkbox, star rating,
  file drop, table grid, signature, display value) using the real field schema.
- Selected field: soft brand ring + a compact floating action bar (drag · duplicate · delete).
- Hover affordance on the control only; the chrome stays quiet until needed.
- Multi-step layout shows **step rails** (Step 1, Step 2 …) with drop targets between steps.
- **Preview toggle** (Edit / Preview) renders the exact final layout, read-only, for a true
  before-publish sanity check (reuses the same `FieldPreview` primitives).

### 3.2 Field palette — discoverable, organized
- Search box + grouped categories:
  - **Inputs** — text, email, phone, number, date, time, textarea
  - **Choices** — select, radio, checkbox, multi-select
  - **Advanced** — file, rating, signature, custom HTML, display value, table grid
- Each tile: icon + label + drag handle; click-to-add, drag-to-canvas.
- Dragging highlights the nearest drop zone on the canvas.

### 3.3 Inspector — structured, scannable
- Context header: field icon + type, inline label edit, required toggle, close.
- Sectioned accordion with **status-aware subtitles** (e.g. "3 rules active", "Connected to
  'Region'") and colored status dots, so a user can see state without opening the section.
- Consistent field controls (Input / Select / Switch / Segmented) and grouped spacing.
- "Has configuration" indicators on collapsed sections.

### 3.4 Status & trust
- Persistent status bar: field count, required/unique count, validation summary,
  unsaved-changes indicator, last-saved time.
- **Inline, non-blocking validation**: schema health checks (duplicate ids, broken
  equalToField references, empty labels) surface as warnings instead of `alert()`.

---

## 4. Technology decisions

| Decision | Rationale |
| --- | --- |
| **Keep** `@dnd-kit/core` + `@dnd-kit/sortable` | Already battle-tested; drag/drop contract unchanged. |
| **Keep** Tailwind + existing design tokens | Matches the current theme exactly; zero risk to theme. |
| **Add** local `FieldPreview` primitives (no new deps) | Reuse across canvas + preview mode. |
| **Defer** heavy libs (formly, dnd-multi-container) | Not needed for phase 1; keep bundle lean. |
| **Optional later** `@dnd-kit` multi-container for cross-step drops | Multi-step drag polish in a later phase. |

No new runtime dependencies are required for this phase.

---

## 5. Non-goals / explicitly out of scope

- Changing any builder **reducer** (`builderSlice`), API calls, or save/publish flow.
- Changing the **backend** submission/validation behavior.
- Changing the **public form renderer** behavior.
- Re-theming the whole product (only the editor shell is touched).
- Fixing the security issues listed in `SECURITY_ANALYSIS_CONFIRM_EMAIL_TAMPERING.md` —
  those are tracked separately and owned by the security sprint.

---

## 6. Rollout

1. **Phase A (this change):** editor shell layout, palette redesign, WYSIWYG canvas field rows,
   inspector header + accordion polish, status bar, preview toggle. Ship behind the existing
   feature flag (none needed — presentation only, low risk).
2. **Phase B:** multi-step cross-step drag visuals, keyboard reordering.
3. **Phase C:** inline schema-health warnings panel (non-blocking), keyboard shortcuts.
4. **Phase D:** the security/validation hardening in the separate security doc.

Each phase is independently shippable and does not depend on the others.
