# Form Builder editor UI redesign plan
## Enterprise SaaS workspace for 2026

**Status:** UI-only implementation plan and acceptance criteria; first editor UI pass implemented
**Scope:** `/form-builder` editor surface, field canvas, field inspector, and draft preview entry point.
**Non-goal:** No API contracts, Redux business rules, validation semantics, persistence, permissions, scoring, DMS, payment, or published-form behavior should change as part of the visual redesign.

### First pass delivered

The first UI pass now includes the enterprise workspace header/status bar, grouped and searchable field library, responsive canvas sizing controls, richer field-node previews and state badges, a contextual inspector header with quick toggles, compact accordion treatment, responsive panel toggles, and improved empty/published states. Existing Redux actions, DnD IDs, API calls, and modal callbacks remain in place. The richer side-effect-safe Preview shell remains a planned follow-up and is intentionally not coupled to backend changes.

## 1. Product direction

SifyForms should feel like a serious enterprise configuration tool rather than a toy drag-and-drop demo. The editor needs to reduce cognitive load for large forms while keeping advanced controls discoverable. The design should use the existing SifyForms theme tokens and TheSans typeface:

- neutral surfaces with subtle plum/orchid accents;
- low-contrast borders and mild shadows;
- compact but comfortable 8 px spacing rhythm;
- strong typography hierarchy and concise labels;
- no decorative gradients, oversized hero blocks, excessive color, or noisy cards;
- keyboard-first interactions and visible focus states;
- responsive behavior that remains usable on smaller laptops/tablets.

## 2. Current problems to solve

- The page is a basic three-column layout with no persistent editor context, form outline, search, or clear work status.
- The palette is a long ungrouped list of buttons; field discovery becomes slow as the catalog grows.
- The canvas cards show only a label and type, so authors cannot scan required/logic/validation/file/assessment states quickly.
- The inspector is a very long accordion list. It contains powerful controls, but the user has to scan every section and the section hierarchy is not obvious.
- Settings and layout actions are icon-only in the header, and actions are not organized by frequency or risk.
- Preview opens the live public form only when the current form is published. There is no clearly labeled draft preview flow.
- Save state, publish state, field count, and warnings do not have a dedicated status area.
- The current shell does not provide a robust small-screen fallback; side panels compete with the canvas.

## 3. Target information architecture

### Desktop

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Global breadcrumb | Form name | Draft status | Undo/Redo | Preview | Save    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Workspace tabs: Build | Logic | Data & privacy | Settings | Publish checks   │
├───────────────┬───────────────────────────────────────┬─────────────────────┤
│ Structure      │ Canvas / form document                │ Inspector            │
│ + Add field    │ toolbar: device, zoom, steps, search  │ selected node header  │
│ outline        │                                        │ quick properties      │
│ field palette  │ form identity / description            │ grouped controls     │
│                │ selected field cards                   │ sticky footer        │
└────────────────┴───────────────────────────────────────┴─────────────────────┘
```

### Responsive behavior

- **Large desktop:** three resizable logical columns; palette 248–288 px, inspector 344–400 px, canvas fluid.
- **Laptop:** compact palette and inspector, canvas remains the priority; toolbar actions collapse into labeled overflow.
- **Tablet:** canvas is full width; palette and inspector become slide-over drawers with explicit open/close buttons.
- **Mobile:** not intended for complete authoring, but allow review, field selection, basic edits, save, and preview through a single-panel stack. Never trap keyboard focus in an off-screen panel.

## 4. Top navigation and work status

### Header

- Breadcrumb: `Forms / [Form name]` with a back button.
- Editable form name with a clear edit affordance and a short description below.
- Status pill: `Draft`, `Unsaved changes`, `Published`, `Published · changes pending`.
- Last saved copy: `Saved just now`, `Saving…`, `Offline`, or `Save failed`.
- Undo/redo controls with keyboard shortcuts and disabled states.
- Primary actions ordered by frequency: `Preview`, `Save`, `Publish`.
- Secondary actions in a labeled `More` menu: duplicate, template, export, activity.
- AI remains available as an assistant action but should not visually dominate the primary save/publish workflow.

### Workspace navigation

Use compact tabs or segmented navigation for future growth:

1. **Build** — palette, outline, canvas, inspector.
2. **Logic** — field dependencies, conditional visibility, calculations, rule diagnostics.
3. **Data & privacy** — field classification, response policy, retention, exports.
4. **Settings** — form-level behavior, theme, access, integrations.
5. **Publish checks** — readiness, accessibility, mobile, privacy, payment, file and integration warnings.

The first implementation may keep existing modals for Logic/Settings/Layout and use Build as the active workspace. The navigation should be visually ready without changing business behavior.

## 5. Palette and form structure

### Palette

Replace the ungrouped list with:

- a search input with keyboard shortcut `/`;
- recent/favorite fields at the top;
- grouped categories:
  - **Essentials:** text, email, phone, number, long text;
  - **Choice:** dropdown, radio, checkbox, multi-select;
  - **Date & files:** date, time, file, signature;
  - **Advanced:** table, rating, display value, HTML/instructions;
- compact tile rows with icon, label, one-line description, and a visible add affordance on hover/focus;
- “click to add” and drag-to-place both supported;
- accessible draggable semantics with a keyboard add path; drag must never be the only way to create a field;
- an empty-search state with a clear query action.

### Structure/outline

The left panel should allow switching between `Fields` and `Steps` without losing the canvas. Show:

- sections/steps and field order;
- required and advanced state badges;
- field count and unassigned fields;
- search and focus selected field;
- duplicate/delete actions only on focus/hover, never permanently noisy;
- warnings for broken references, empty required fields, and unresolved logic.

The initial implementation can retain the existing field palette API (`onAddField`) and DnD IDs. Search, grouping, and visual state must remain UI-only.

## 6. Canvas design

### Form document

Use a quiet canvas surface around a centered form document:

- slim canvas toolbar with `Desktop / Tablet / Mobile`, zoom, fit-to-width, and `Show grid` controls;
- document header with form title, description, live/draft badge, field count, and audience hint;
- fields in a consistent 12-column grid; preserve existing `full`, `half`, and `third` width behavior;
- step sections separated by a compact numbered divider and field count;
- dashed drop zone only during drag or when empty;
- selected field uses a 1 px primary border plus a subtle surface tint, not a heavy glowing ring;
- keyboard focus and selection are distinct and both visible;
- field card hover actions: drag, duplicate, move, delete; actions are not visible as permanent clutter.

### Field card anatomy

Each node should show:

1. small drag handle and ordinal number;
2. type icon and human-readable type;
3. field label with required marker;
4. short preview of the respondent control;
5. compact state badges only when relevant: `Required`, `Unique`, `Logic`, `Validated`, `File policy`, `Score`, `Poll`;
6. a concise help/placeholder line only when it adds information;
7. a right-side overflow menu for duplicate/delete/move.

Use semantic `button` selection, `aria-label`, and `aria-pressed`/selected state. Do not use color alone to communicate state.

### Empty and warning states

- Empty canvas: explain the first action, show three recommended field shortcuts, and retain the palette drop affordance.
- Unassigned fields: show a clear warning with a `Move to step` action.
- Broken configuration: show a compact inline warning and a `Fix in inspector` action.
- Long forms: support sticky step headers and avoid a giant single card that becomes hard to navigate.

## 7. Field inspector information architecture

The inspector should open with context, then show the highest-value controls first. Avoid showing every advanced control as equal weight.

### Inspector header

- field type icon and `Field 04` ordinal;
- editable label summary;
- stable field ID in a copyable secondary line;
- `Required` and `Disabled` quick toggles where applicable;
- duplicate/delete actions in a danger-aware overflow;
- close button with accessible label;
- a compact warning strip if configuration is incomplete.

### Quick properties

Place these immediately below the header:

- label;
- required toggle;
- placeholder/help text where supported;
- width selector (`Full`, `Half`, `Third`) as visual grid buttons;
- a small live respondent preview or value summary.

This prevents common edits from being hidden inside an accordion.

### Grouped inspector sections

Use clear section labels with count/status summaries. Keep the existing component/modals and update behavior; reorganize presentation first.

1. **Content**
   - label, placeholder, help text, description, options, default value.
2. **Validation**
   - required, unique, min/max, format, custom rules, validation summary.
3. **Logic**
   - conditional visibility, smart connections, dynamic options, dependencies.
4. **Appearance**
   - width, display settings, layout, respondent-facing presentation.
5. **Files**
   - file types, size/count policy, DMS/support documents, scan state.
6. **Advanced**
   - external validation, custom alerts, table configuration, integrations.
7. **Assessment / Polling**
   - score, answer, points, poll inclusion; visually marked as private/admin configuration.

Each section should include:

- one sentence explaining what it controls;
- a count/status summary (`3 rules`, `No conditions`, `2 options`);
- a consistent collapsed/expanded affordance;
- inline empty states with one primary next action;
- no deeply nested full-width dialog unless the feature genuinely needs it.

### Inspector layout rules by field type

| Field type | First visible controls | Progressive disclosure |
| --- | --- | --- |
| Text/email/phone/textarea | Label, required, placeholder, help text | Defaults, format, length, rules, equality, external validation |
| Number | Label, required, default, min/max | Precision, calculation, variable links, rules |
| Select/radio/checkbox/multi-select | Label, required, option list, option count | Option import, dynamic options, mutual exclusion, logic |
| Date/time | Label, required, default, min/max | Date constraints, variables, locale/timezone |
| File/signature | Label, required, upload policy summary | DMS, scan state, support documents, file constraints |
| Rating | Label, required, scale preview | Range/labels, defaults, validation |
| Table | Label, row/column summary, preview | Table editor, row validation, calculations |
| Display/HTML | Label/content preview, visibility | Variable binding, safe content settings |

Do not remove any existing supported feature. Features should move behind the appropriate group, not be deleted.

## 8. Inspector visual system

- Use one compact panel background, with dividers between sections instead of a stack of visually heavy cards.
- Section headers use 12–13 px semibold text, a muted summary, and a 16 px icon.
- Controls use consistent 32–36 px heights and labels above inputs.
- Use `surface-brand` only for selected/important guidance; use semantic amber/red only for warnings/errors.
- Keep advanced/security-sensitive configuration visibly marked, but do not use alarmist color everywhere.
- Use sticky inspector header and a bottom action area only when unsaved changes or a destructive action needs context.
- Ensure 320 px minimum usable width, with a scrollable content region and no nested horizontal scrolling.

## 9. Preview redesign direction

The current public-form preview should evolve into a dedicated preview shell, separately implemented from the live respondent route:

- clear `Draft preview` or `Published preview` label;
- viewport switcher and browser chrome frame;
- sample data scenarios: empty, completed, invalid, conditional branch, mobile, accessibility;
- a right-side “Preview checks” panel for accessibility, responsive overflow, missing labels, broken logic, privacy, and file/payment placeholders;
- mocked side effects by default: no real OTP, payment, external validation, email, webhook, vote, or permanent upload;
- final review/receipt state preview;
- compare current published revision versus draft;
- shareable, expiring preview link only when the backend later supports it.

This redesign should not change live form behavior in the UI-only phase. The current Preview button can be restyled and its existing route preserved while the richer shell is phased in.

## 10. Technology recommendations

Use the existing stack first to avoid business-logic risk:

- React 19 + TypeScript + Tailwind tokens already present;
- `@dnd-kit` for keyboard-aware drag/drop and sortable nodes;
- `lucide-react` for consistent icons;
- existing shadcn-style primitives, extended with accessible popover, tooltip, tabs, command/search, resizable panels, and scroll-area patterns;
- `react-hook-form` only where it already owns form state; do not introduce a second source of truth for builder state;
- CSS `content-visibility`, memoized field cards, and virtualization only after profiling long forms.

Potential additions, evaluated separately:

- `cmdk` for a command palette and field search;
- `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-popover`, and `@radix-ui/react-scroll-area` if the project wants primitives instead of local equivalents;
- `react-resizable-panels` for desktop pane resizing;
- `dnd-kit` remains preferable to replacing the existing DnD implementation.

Do not add a large component library or animation system merely for visual novelty. Any new dependency must be audited for bundle size, accessibility, keyboard behavior, and Vite/base-path compatibility.

## 11. UI-only implementation phases

### Phase 1 — shell and visual hierarchy

- redesign the editor header and work-status row;
- add responsive pane shell and mobile drawers;
- refresh canvas document surface and empty state;
- keep every existing handler and Redux action unchanged.

### Phase 2 — field discovery and scanability

- grouped/searchable palette;
- richer sortable field cards with state badges;
- field outline/step navigation;
- keyboard and screen-reader labels.

### Phase 3 — inspector usability

- inspector context header and quick controls;
- grouped section presentation and summaries;
- field-type-oriented ordering;
- preserve all existing modals and callbacks.

### Phase 4 — preview shell

- draft/published labeling and viewport controls;
- sample-state presentation;
- side-effect-safe preview UX;
- avoid changing the public form's data/business behavior.

### Phase 5 — polish and quality

- visual regression snapshots at desktop/tablet/mobile;
- keyboard-only test, focus trap test, reduced-motion test;
- long-form performance test with 100/500 fields;
- route/base-path test under `/form-builder/`;
- root build, typecheck, and targeted lint cleanup for touched files.

## 12. Acceptance criteria

### Visual

- [ ] Editor reads as a calm enterprise SaaS workspace at first glance.
- [ ] No oversized hero, decorative gradient, excessive color, or card clutter.
- [ ] Save/Publish/Preview/status hierarchy is unambiguous.
- [ ] Selected field and inspector context are obvious without a heavy glow.
- [ ] All existing SifyForms theme modes/tokens continue to resolve correctly.

### Usability

- [ ] A new field can be found and added in under two interactions after search.
- [ ] Common field edits are available without opening a modal.
- [ ] Advanced behavior is discoverable through meaningful group names and summaries.
- [ ] A long form can be scanned by field label, type, step, and status.
- [ ] Empty, warning, loading, saving, and error states are explicit.

### Accessibility

- [ ] All icon buttons have accessible names and tooltips where needed.
- [ ] Keyboard users can add/select/reorder/delete fields and operate the inspector.
- [ ] Focus remains visible and predictable when drawers/menus/dialogs open.
- [ ] Contrast and selected states meet the product accessibility target.
- [ ] Reduced-motion users do not receive distracting transitions.

### Regression safety

- [ ] Existing Redux actions, API calls, route paths, payloads, validation, DMS, payment, and publish behavior remain unchanged.
- [ ] Every current inspector feature remains available and wired to its existing callback/modal.
- [ ] DnD IDs and field ordering behavior remain compatible with `builderSlice`.
- [ ] Public form and backend files are not changed as part of the UI-only editor phase.
- [ ] Build/typecheck succeeds after each phase.

## 13. Definition of done for the first UI pass

The first implementation is complete when the current editor has the redesigned header, responsive shell, grouped/searchable palette, improved canvas/field cards, and a contextual inspector header/quick-properties layer, while all existing editor behavior still works. The richer Preview shell and deeper inspector reorganization can then ship as separate UI-only increments under the same visual system.
