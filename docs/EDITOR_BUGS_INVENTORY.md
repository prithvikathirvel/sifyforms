# Editor — Validation & Static Bug Inventory

**Scope:** Form builder editor page (`FormBuilderPage`, `FieldInspector`, `FieldPalette`,
`SortableField`) plus the client-side validation helpers they drive.
These are bugs **and** UX/robustness gaps that are safe to fix without touching business logic.
Severity = impact × likelihood of a real user hitting it.

---

## High

### H1. Client and server disagree on a rule's `enabled` flag → "Confirm Email" can be bypassed
- **Where:** `src/lib/fieldValidation.ts` (client) vs `backend/src/lib/validation.ts` (server).
- **What:** The client applies every `field.rules` entry regardless of `enabled`.
  The server does `if (!rule.enabled) return;` — so a rule whose `enabled` is `undefined`
  (common when authored without the flag) is **enforced on the client but skipped on the server**.
- **Impact:** A form that relies on a Confirm-Email equality rule can accept a tampered,
  mismatched confirm email when submitted directly to the API. See the dedicated security doc.
- **Fix:** Default rules to enabled; on the server change to `if (rule.enabled === false) return;`.
  (Owned by the security sprint.)

### H2. `enabled` flag is invisible in the editor UI
- **Where:** `FieldInspector` "Input Validation" summary and `ValidationModal`.
- **What:** Rules can be toggled off but the summary only counts `field.rules.length`, so a
  disabled rule still reads as "N validation rules active". Users believe protection exists.
- **Fix:** Count only `enabled !== false` rules in summaries; visually mark disabled rules.

### H3. Two parallel equality systems render as one
- **Where:** `FieldInspector`, `fieldValidation.ts`, `validation.ts`.
- **What:** A "match another field" check can be authored either as legacy
  `validation.equalToFieldId` or as a `rules` entry of type `custom`. The inspector's
  "Input Validation" section only summarizes `field.rules`, so a form relying on the legacy
  field appears to have **no** validation, and the check is easy to drop silently.
- **Fix:** Surface both representations in the inspector summary and in the save-time schema health check.

---

## Medium

### M1. Duplicate option `value`s allowed
- **Where:** Options Configuration in `FieldInspector`.
- **What:** Two options can share the same `value`; selection, submission, scoring, and
  mutual-exclusion can misbehave.
- **Fix:** Detect duplicate/empty `value`s and show an inline warning (optionally auto-generate).

### M2. Whitespace-only field label passes save validation
- **Where:** `FormBuilderPage.getSchemaWithLayout` → `if (!field.label)`.
- **What:** `"   "` is truthy, so a blank-looking label is accepted.
- **Fix:** Trim before checking; treat whitespace-only as missing.

### M3. Blocking `alert()` on every save/publish validation failure
- **Where:** `FormBuilderPage.handleSave` / `handlePublish`.
- **What:** Schema problems surface as browser `alert()` dialogs — modal, interruptive, no
  persistent record, hard to read in enterprise browsers.
- **Fix:** Replace with a non-blocking inline banner/status bar + field-level markers.

### M4. Required + conditionally-hidden field blocks submission
- **Where:** `backend/src/lib/validation.ts` (`evaluateShowWhen` result is unused) and the
  client `fieldValidation.ts`.
- **What:** A field hidden by Conditional Visibility but marked required still fails the
  required check on submit, so the form cannot be completed.
- **Fix:** Server should skip required/validation for fields whose `showWhen` evaluates false.

### M5. No "duplicate field" affordance
- **Where:** `SortableField` / `FormBuilderPage`.
- **What:** Builders frequently copy a field (e.g. two address lines); today they must rebuild.
- **Fix:** Add duplicate action using existing `addField` + `selectField` reducers (pure UI).

### M6. Hardcoded header height (`h-[calc(100vh-57px)]`)
- **Where:** `FormBuilderPage` layout.
- **What:** Canvas height is coupled to a magic 57px; any header change breaks the scroll area.
- **Fix:** Use flex column shell with `flex-1 min-h-0` so the canvas owns remaining space.

---

## Low

### L1. Inconsistent raw `<select>` styling
- **Where:** `DateConstraintPicker`, table validation selects, `FieldInspector`.
- **What:** Mix of `h-8 text-xs` native selects and the design-system `Select`; inconsistent
  heights and focus states.
- **Fix:** Consolidate on a shared dense `Select`/control style in the inspector.

### L2. Accordion `defaultOpen` evaluated once
- **Where:** `FieldInspector` (Accordion).
- **What:** Sections open/close based on mount-time state; adding a config to a closed section
  does not auto-reveal it.
- **Fix:** Derive open state from live field config or watch config changes.

### L3. Empty-canvas guidance
- **Where:** `FormBuilderPage` empty state.
- **What:** The dashed empty card gives a hint but clicking it does nothing and the palette
  isn't surfaced as the next step.
- **Fix:** Add a clear CTA that scrolls/focuses the palette and lists clickable field shortcuts.

### L4. `unique` checkbox disabled without explanation
- **Where:** `FieldInspector` Basic Properties.
- **What:** `unique` is greyed out when not required, but the reason isn't explained.
- **Fix:** Show helper text ("Only required fields can be unique").

### L5. Third-width layout edge cases
- **Where:** `FieldsByWidth`.
- **What:** A single `third` field renders in a 3-col grid and looks tiny; grouping logic is
  by consecutive same-width only.
- **Fix:** Document the behavior; consider centering a lone partial-width field.

---

## How to use this list

- H1–H3 and M4 are correctness/security adjacent — coordinate with the security sprint.
- M1–M6 and L1–L5 are safe UI/robustness improvements that can land with the redesign.
- All fixes above keep reducers, API calls, and the public renderer unchanged.
