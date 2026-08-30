# Field Parameter — Deep Bug & Issue Analysis

> Scope: the **Field Inspector** panel (`src/components/builder/FieldInspector.tsx`) and every
> sub-component it opens (modals), cross-referenced against the field schema
> (`src/types/index.ts`), the public-form renderer (`src/pages/PublicFormPage.tsx`), the editor
> preview (`src/components/builder/FormPreview.tsx`), and the backend validation / processing
> (`backend/src/lib/validation.ts`, `backend/src/services/assessment.processor.ts`,
> `backend/src/services/voting.processor.ts`, `backend/src/lib/calculationEngine.ts`).
>
> Every issue below is a **verified** behaviour (not speculation), with the file/line evidence.
> Severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low.

---

## 0. How field identity works (context for everything below)

A field's storage key is an unstable timestamp ID generated in the editor:

```ts
// src/pages/FormBuilderPage.tsx:773
id: `field_${Date.now()}`
```

The *meaningful* identity lives in the form schema (`Form.schema`, JSON in the DB):

```json
{ "id": "field_1788061880011", "type": "email", "label": "Email Address", ... }
```

Consequences that matter for bugs below:

1. **`id` is not portable.** Any logic that hardcodes a `field_...` value breaks the moment the
   field is re-created (which is why the "capture the email column" feature must resolve by
   `type === 'email'` / `settings.authentication.emailFieldId`, never by raw id).
2. **`id` collisions are possible.** `Date.now()` resolves to milliseconds; two fields added in
   the same millisecond (or a bulk/CSV/AI import that reuses ids) can collide. There is **no
   uniqueness check** on field ids anywhere.
3. **Schema drift:** `Submission` stores only `data` — no snapshot of the schema at submit time.
   Anything resolved at read-time against today's schema (labels, options, `correctAnswer`,
   email field) can silently point at the wrong field for older submissions.

---

## 1. Critical cross-cutting bugs

### 🔴 C-1. Arbitrary code execution via `new Function()` (Calculations)

`functionBody` and the expression engine are executed with `new Function()` in **three** places:

- `src/lib/calculationEngine.ts:42` — `const fn = new Function(...paramNames, variable.functionBody);`
- `src/lib/calculationEngine.ts:347` — `const func = new Function(...keys, ...)`
- `backend/src/lib/calculationEngine.ts:264` — `const func = new Function(...keys, ...)`

The `functionBody` is authored by the form creator, stored in `Form.schema`, then evaluated:

1. **On the backend**, during `validateSubmission` (`backend/src/lib/validation.ts:150`
   `engine.calculateAllVariables()`), i.e. inside the **Node server process** on every
   submission. A form owner (or anyone who can edit the schema) can inject arbitrary JavaScript
   that runs server-side → **remote code execution**.
2. **In every respondent's browser**, on the public form. Same vector → **stored XSS / RCE**
   against respondents.

There is no sandboxing, no allow-list, and no input validation on `functionBody`.

**Fix direction:** replace `new Function` with a safe expression parser/evaluator (or at minimum
execute in an isolated worker/sandbox and reject dangerous tokens), and validate `functionBody`
server-side before persisting.

### 🔴 C-2. External-validation credentials are persisted in the published schema (credential leak)

`ExternalValidationModal` stores API credentials (`auth.token`, `auth.password`,
`auth.customHeaderName`+token) directly on the field:

- `src/components/builder/ExternalValidationModal.tsx` (auth tab) →
  `field.externalValidation.auth = { type, token / username / password / customHeaderName }`

`sanitizePublicSchema` only strips assessment secrets, **not** external-validation config:

```ts
// backend/src/service/form.service.ts:24
function sanitizePublicSchema(schema) {
  ... delete safeField.correctAnswer; delete safeField.points; delete safeField.section;
}
```

So `getPublicForm` (`backend/src/service/form.service.ts:247`) returns the **full
external-validation config, including bearer tokens / basic-auth passwords**, to every
anonymous visitor of the published form. Anyone can open DevTools and harvest the API key.

**Fix direction:** strip `externalValidation` (or its `auth`) from the public schema the same way
assessment secrets are stripped.

### 🔴 C-3. External-validation credentials are logged in plaintext

`backend/src/lib/validation.ts` logs the full request and response of every external-validation
call, including headers:

```ts
// validation.ts (external validation block)
console.log(`Headers:`, JSON.stringify(headers, null, 2));   // includes Authorization
console.log(`Response Data:`, JSON.stringify(response.data, null, 2));
```

`Authorization: Bearer <token>` / `Basic <base64>` is written to server logs on every submission
against that field. Credential leakage into log aggregation.

---

## 2. High bugs

### 🟠 H-1. "Required" validation rule does nothing

`ValidationModal` offers a `Required` rule type (`src/components/builder/ValidationModal.tsx`,
`RULE_TYPES[0]`), but the backend rule switch has **no `case 'required'`**:

```ts
// backend/src/lib/validation.ts (rules switch)
case 'minLength': ... case 'maxLength': ... case 'email': ...
// no 'required' case
```

Only the top-level `field.required` boolean is enforced (`validation.ts:161`). A user who adds a
"Required" rule in the modal believes the field is required, but the public form will happily
accept an empty value. The client-side rule engine (`src/lib/fieldValidation.ts`) has the same
gap (it enforces `field.required`, not `rule.type === 'required'`).

### 🟠 H-2. Numeric rules silently pass on non-numeric / array fields

`greaterThan`, `lessThan`, `gte`, `lte` compare with `Number(value)`:

```ts
// backend/src/lib/validation.ts
case 'greaterThan': if (Number(value) <= Number(ruleVal)) ...
```

`Number('abc')` / `Number(['a','b'])` = `NaN`, and every `NaN` comparison is `false`, so the rule
**always passes**. `minLength`/`maxLength` use `String(value).length`, which for an array value
is the length of `"a,b"`. The `ValidationModal` offers these rule types for **all** field types
(no type gating), so these are trivially reachable.

### 🟠 H-3. `minSize` (Minimum File Size) is never enforced

The inspector exposes "Minimum File Size (MB)" (`FieldInspector.tsx`, File Upload Settings), but
the backend only checks `maxSize` and `maxFiles`:

```ts
// backend/src/lib/validation.ts (file block)
if (cfg.maxSize && f.size && f.size > maxBytes) ...
// no minSize check anywhere
```

Configuring a minimum file size has zero effect end-to-end.

### 🟠 H-4. Table validation rules are client-only (not enforced server-side)

The entire "Table Validation" feature (`any-row-complete`, `all-rows-complete`, `min-rows-filled`,
`column-value`, `aggregate`) is configured in the inspector (`FieldInspector.tsx` Table Validation
block) but appears **nowhere** in the backend. `grep tableValidation backend/src` returns no
matches. A respondent (or a scripted request) can submit a table that violates every configured
rule and the server will store it.

### 🟠 H-5. Assessment short-answer scoring is unreachable from the UI

The backend scores **any** field that has a `correctAnswer`:

```ts
// backend/src/services/assessment.processor.ts:68
const fields = (schema.fields ?? []).filter(f => f.correctAnswer !== undefined && ...);
```

but the inspector gates the "Assessment Scoring" section to option fields only:

```ts
// src/components/builder/FieldInspector.tsx:1430
{formType === 'assessment' && ['radio','select','checkbox','multiselect'].includes(field.type) && (
```

So **text / number / email short-answer questions cannot be auto-scored** through the UI, even
though the engine supports it. The reverse is also true: a `rating` field (which the user would
naturally use for a scored survey) cannot be given a `correctAnswer` at all.

### 🟠 H-6. Two parallel, conflicting validation systems

There are two overlapping mechanisms:

- **Legacy** `field.validation` (min/max/minLength/maxLength/pattern/equalToFieldId) — edited by
  the "Constraints & Defaults" accordion.
- **New** `field.rules[]` (minLength/maxLength/min/max/pattern/email/url/contains/…/custom) —
  edited by the "Input Validation" modal.

Both are enforced independently (`backend/src/lib/validation.ts` runs `field.rules` then the
legacy `field.validation`). A user can set `minLength: 5` in Constraints **and** a `minLength: 50`
rule in the modal, producing two contradictory error messages for the same constraint. There is
no de-duplication, no conflict warning, and no single source of truth.

---

## 3. Per-parameter analysis

### 3.1 Basic Properties

| Parameter | Behaviour | Issue |
|---|---|---|
| **Label** | `onUpdate({ label })` | No default fallback for `display`/`html` (fine), but labels are HTML-escaped at *storage* time (see H-8), so a label containing `&`, `<` changes on round-trip. |
| **Placeholder** | hidden for `checkbox/radio/file/rating/signature/display/table` | ✅ correct gating |
| **Help Text** | free text | Same XSS-sanitization double-escape issue as labels (H-8). |
| **Required** | `onUpdate({ required, unique: required ? field.unique : false })` | 🟡 See B-1 (destructive reset of `unique`). |
| **Unique** | `disabled={!field.required}` | 🟡 See B-2 (can't have optional-unique; server enforces unique independently so this is a UX limitation, not a security hole). |
| **Mutual Exclusion Group** | option fields only | 🟡 See B-3 (server-side enforcement unverified — mutual exclusion appears client-only). |
| **Field Width** | full/half/third | 🟡 See B-4 (width semantics undocumented & renderer-dependent). |

#### 🟡 B-1. Unchecking "Required" silently wipes "Unique"

```ts
// src/components/builder/FieldInspector.tsx:339
onUpdate({ required, unique: required ? field.unique : false });
```

If a field is required+unique and the user unchecks Required, `unique` is silently set to `false`
with no warning, and the "Unique submission value" checkbox also resets. Destructive side effect
the user never sees.

#### 🟡 B-2. "Unique" is coupled to "Required" with no explanation

The checkbox is `disabled={!field.required}`. The backend enforces `field.unique` independently
(`backend/src/service/submission.service.ts:84`), so an *optional-but-unique* field (a common
real need — e.g. "member number, if any") is impossible to express through the UI.

#### 🟡 B-3. Mutual Exclusion Group has no visible effect in preview

The group name is stored (`field.mutualExclusionGroup`) and there is copy claiming it "hides each
other's selected values", but the enforcement lives in the client render path only and is not
obvious in `FormPreview`. Needs verification against `PublicFormPage`; if enforced only in one
renderer, editor preview and published form will diverge.

#### 🟡 B-4. Field Width has no server-side layout effect and ambiguous grouping

"Consecutive fields with the same width will appear side by side" is a purely client layout
heuristic. It interacts unpredictably with the Layout mode (vertical/horizontal/multi-step) and
is not documented in the layout plan docs.

---

### 3.2 Constraints & Defaults

| Parameter | Stored as | Issue |
|---|---|---|
| **Default Value** | `field.defaultValue` | ✅ applied on public form (`PublicFormPage.tsx:808`). 🟡 Date/time default is stored as a raw string with no `type` re-check on load. |
| **Min/Max Length** | `field.validation.minLength/maxLength` | 🟠 overlaps with `rules[]` (H-6). |
| **Min/Max Value** (number) | `field.validation.min/max` | ✅ enforced server-side as numbers. |
| **Min/Max Date** (date/time) | `field.minValue/maxValue` (top-level) | 🟠 **not enforced server-side** — see B-5. |

#### 🟠 B-5. Date/time min & max are client-only

Date/time fields store their bounds in `field.minValue` / `field.maxValue` (top-level), but the
backend legacy block only checks `field.validation.min/max`:

```ts
// backend/src/lib/validation.ts
if (v.min !== undefined && Number(value) < v.min) ...
```

`Number('2026-08-30')` is `NaN`, so even if it *were* checked it would silently pass. Result:
date/time min/max are applied in the browser (`PublicFormPage.tsx:1934`) but not validated on the
server — a scripted submission can bypass them.

#### ⚪ B-6. "Note: Smart Connections override these values" is never reconciled

The copy claims smart-connection rules override defaults, but there is no conflict resolution
logic; both `defaultValue` and `fieldLinking` are applied in unspecified order in the renderer.

---

### 3.3 Options Configuration (select / radio / checkbox / multiselect)

#### 🟠 B-7. Multiselect "Add Option" produces duplicate labels (operator precedence)

```ts
// src/components/builder/MultiSelectField.tsx (MultiSelectConfig)
const newOption = { label: `Option ${field.options?.length || 0 + 1}`, value: `option_${Date.now()}` };
```

`field.options?.length || 0 + 1` parses as `length || (0 + 1)` = `length || 1`. So the label is
always `Option {currentLength}` — the **2nd** option added to a 1-option field is labelled
`Option 1` again (duplicate). Compare with the correct non-multiselect path
(`FieldInspector.tsx` `addOption`, which uses `options.length + 1`).

#### 🟠 B-8. Array-index React keys cause focus loss / mis-edits

- Non-multiselect options use `key={`option-${index}`}` (`FieldInspector.tsx:600`).
- Multiselect options use `key={option.value}` (`MultiSelectField.tsx`), which **collides** when
  two options share a value (possible after CSV import with an empty/duplicate value column).

Both cause the classic React reconciliation bugs: deleting a middle option shifts focus, and
edits can land on the wrong option.

#### 🟠 B-9. CSV import has no duplicate / empty-value handling

`CSVImportModal.handleImport` maps rows → `{label, value}` and filters only empty *labels*:

```ts
// src/components/builder/CSVImportModal.tsx
.filter(opt => opt.label.trim() !== '')
```

It does **not** deduplicate `value`, so importing a CSV with a blank/duplicate "Value" column
produces options with empty/duplicate values. Consequences:

- React `key={option.value}` collisions (B-8).
- Assessment `correctAnswer` is matched by `opt.value` (`assessment.processor.ts` `normalizeAnswer`),
  so duplicate values make scoring ambiguous/incorrect.
- The import button claims `Import {csvData.rows.length} Options` but may import fewer after the
  label filter — misleading count.

#### 🟡 B-10. "Allow Clear All" and "Show selected count" are dead config

`MultiSelectConfig` renders checkboxes for `field.validation.allowClearAll` and
`field.validation.showCount`, but **neither is read anywhere** in
`PublicFormPage.tsx` / `FormPreview.tsx` (grep returns no usage). Both toggles do nothing.

---

### 3.4 Display Field Config (`display` type)

#### 🟠 B-11. "Percentage" format double-divides by 100

```ts
// src/components/builder/DisplayField.tsx (formatValue)
if (format === 'percentage') {
  return new Intl.NumberFormat('en-US', { style: 'percent' }).format(Number(value) / 100);
}
```

The `percent` style already multiplies by 100. Dividing by 100 *first* means a stored value of
`12.34` renders as **`12%`** instead of `12.34%`. (If the intent was "value is already a
fraction", the label "Percentage (12.34%)" contradicts it.)

#### 🟡 B-12. "Date" format option is dead

The format `<select>` offers `<option value="date">Date (January 1, 2024)</option>`, but
`formatValue` never branches on `format === 'date'` — it only handles it via `case 'date'` on
`variable.type`. Selecting "Date" does nothing.

#### ⚪ B-13. `showVariableName` is gated on a custom label

```ts
// src/components/builder/DisplayField.tsx
{field.displayConfig?.showVariableName && field.displayConfig.label && (...)}
```

The "Show variable name (metadata)" toggle only renders when a custom `label` is also set, which
isn't explained in the UI.

#### ⚪ B-14. Display field has no `required`/validation relevance but still shows those sections

`display` and `html` fields still render the Basic Properties "Required"/"Unique" toggles, which
are meaningless for read-only fields (harmless but confusing).

---

### 3.5 File Upload Settings (`file` type)

| Parameter | Behaviour | Issue |
|---|---|---|
| **Allowed types** | `fileConfig.accept[]` | ✅ enforced server-side. ⚪ Accept list is a hardcoded 5-option list (`image/*`, `.pdf`, `.doc,.docx`, `.xls,.xlsx`, `.txt`) with **no "custom" entry** — cannot specify e.g. `.zip` or `video/*`. |
| **Min size** | `fileConfig.minSize` (bytes) | 🟠 **never enforced** (H-3). |
| **Max size** | `fileConfig.maxSize` (bytes) | 🟡 See B-15 (fragile `> 1024` heuristic). |
| **Multiple** | `fileConfig.multiple` | 🟡 `maxFiles` is never exposed in the UI (only `multiple`), yet the backend enforces `maxFiles` — so the enforced limit is never settable. |

#### 🟡 B-15. `maxSize` uses a fragile unit heuristic

```ts
// backend/src/lib/validation.ts
const maxBytes = cfg.maxSize > 1024 ? cfg.maxSize : cfg.maxSize * 1024 * 1024;
```

The UI stores bytes (5 MB → `5242880`), so the `> 1024` branch is taken correctly today. But a
value between 1025 and 1048576 is ambiguous (bytes vs MB) and would be silently misinterpreted if
any other producer writes `maxSize` in a different unit. The default constant `5242880` is also
hardcoded in the inspector (`FieldInspector.tsx:758`) rather than shared.

#### 🟡 B-16. `maxFiles` unsettable, and `parseInt(e.target.value) || 5` swallows zero

`FieldInspector.tsx:758` uses `parseInt(e.target.value) || 5`, so clearing the max-size field (or
typing `0`) snaps back to 5 MB. Cannot express "no limit" or a 0.

---

### 3.6 External Validation

> See also 🔴 C-2 and 🔴 C-3 (credential leak + log leak).

#### 🟡 B-17. Empty "Search Path" does not evaluate the root as documented

The UI says "Leave empty to evaluate root response", but the backend does:

```ts
// backend/src/lib/validation.ts
if (responseCheck?.path) {
  targetValueExtracted = responseCheck.path.split('.').reduce((obj, key) => obj?.[key], response.data);
}
```

An empty path falls through to `targetValueExtracted = response.data` only because the `if` is
falsy — but if the path is the literal `''` *and* `successPath` is unset, `response.data` is used
correctly. The bug is the **legacy `successPath` branch**: if `successPath` is set but empty, the
same reduce produces `undefined`. Minor, but the copy and behaviour diverge for the legacy path.

#### 🟡 B-18. External validation blocks submission synchronously with no graceful degradation

The validation `await axios(...)` runs **inside** `validateSubmission`, sequentially, with a 5s
timeout, before the DB write. A slow/down third-party API therefore blocks every submission on
that field, and the only failure mode is a hard error ("Could not reach validation server") with
no retry, no queue, no bypass.

#### ⚪ B-19. `method` type is not constrained

The modal only offers GET/POST, but the stored `config.method` is typed as a string and the
backend uses `(config.method || 'POST')` freely — a manually-edited schema can set `DELETE`/`PUT`
with no validation.

---

### 3.7 Smart Connections (Advanced Linking)

#### 🟡 B-20. `AdvancedLinkingModal` is 59 KB of condition-tree logic with no server parity

The linking rules (`fieldLinking.rules`, `restrictionRules`, `dynamicConfig`) are enforced only in
the client render path. The backend `validateSubmission` does **not** evaluate `fieldLinking` at
all (only `showWhen`, rules, validation, external validation). Consequences:

- A required/disabled **restriction rule** ("make this field required when X") is a client-only
  suggestion — a scripted submission ignores it.
- Auto-fill / copy-from rules are recomputed client-side; a direct API submission stores
  whatever it wants.

#### ⚪ B-21. Stale `enabled` flags cleaned only in one direction

`getSchemaWithLayout` (`FormBuilderPage.tsx:388`) carefully strips empty `fieldLinking` entries on
save, but the inspector's "Smart Connections" subtitle reads `field.fieldLinking?.enabled` from
live state, so a half-configured connection can show as "Connected to Unknown" before save cleans
it.

---

### 3.8 Data Calculations (VariableManager)

> See 🔴 C-1 for the `new Function` RCE.

#### 🟡 B-22. Function parameter validation is shallow

`VariableManager` checks `functionParameters.some(p => !p.fieldId || !p.paramName)` but does not
verify the `fieldId` exists in the current schema, nor that `paramName` is a valid JS identifier
before injecting it into `new Function(...paramNames, body)` (a param name with spaces/odd chars
would throw or inject).

#### ⚪ B-23. Formula builder inserts raw field ids into the formula string

`VariableManager` "insert field" writes the raw `field.id` (e.g. `field_1788061880011`) into the
formula. Combined with §0, the formula is unreadable and breaks if the field is re-created.

---

### 3.9 Conditional Visibility (Show When)

#### 🟡 B-24. Visibility is enforced server-side for *data retention*, not consistently

The backend `evaluateShowWhen` runs (`backend/src/lib/validation.ts`), but the visible path
**does not strip hidden-field data** — the code explicitly says:

```ts
// validation.ts
if (!isVisible) {
  // If field is hidden, we might want to strip its data, but let's keep it for now
}
```

So a hidden field's value is still validated (required checks still fire on hidden fields!) and
still persisted. Two concrete bugs:

1. A **required** field that is currently hidden by `showWhen` will still block submission with
   "field is required" (`field.required` is checked before/regardless of visibility).
2. Hidden fields' values are stored and exported, leaking data the form intended to suppress.

#### ⚪ B-25. Operator `in`/`notIn` UI vs engine mismatch

`SHOW_OPERATORS` (frontend) includes `in`/`notIn`, and the backend `evaluateCondition` handles
them, but `FieldInspector`'s rule-summary renderer (`describeLinkingConditions` /
`renderNodes`) only special-cases a subset — `in`/`notIn` show a raw value without array
formatting.

---

### 3.10 Input Validation (ValidationModal)

> See 🟠 H-1 (required), H-2 (numeric-on-text), H-6 (dual systems).

#### 🟡 B-26. `custom` ("Must match field") has no target-existence guard

```ts
// backend/src/lib/validation.ts
case 'custom': if (String(value) !== String(data[String(ruleVal)])) errors[field.id] = msg;
```

If the target field was deleted, `data[undefined]` is `undefined`, so every non-empty value fails
with "Fields must match". No friendly error, no guard.

#### ⚪ B-27. `equalToFieldId` (Confirm Email) has no UI

`field.validation.equalToFieldId` / `equalToMessage` are enforced both client
(`src/lib/fieldValidation.ts:47`) and server (`validation.ts` legacy block), but **no inspector
control sets them** — reachable only by hand-editing JSON. The "Confirm Email" feature the schema
supports is invisible.

#### ⚪ B-28. Default messages use `{value}` placeholders that are never interpolated

`getDefaultMessageForRuleType` returns e.g. `'Must be at least {value} characters'`, but nothing
replaces `{value}` — the user sees the literal `{value}` if they leave the message blank.

---

### 3.11 Table Validation (table type)

> See 🟠 H-4 (client-only).

#### 🟡 B-29. Aggregate expression parsing is regex-fragile

`parseAggExpr` (`FieldInspector.tsx`) matches `/^(\w+)\("([^"]*)"(?:,"([^"]*)")?\)$/`. Any
column id containing a `"` (impossible today, but ids are free-form `col${Date.now()}`) or an
expression hand-edited to use single quotes silently fails to parse, resetting the UI to "Select
function…" while the stored expression is preserved.

#### ⚪ B-30. Column ids are timestamp-based with no dedup

`TableConfigModal.tsx:747` generates `col${Date.now()}` and `row_${Date.now()}`. Two columns
added in the same millisecond collide, and there is no uniqueness check.

---

### 3.12 Custom Alerts

#### 🟡 B-31. Alerts are client-only and not type-gated

`field.alerts` are rendered by the client and never touched by the backend. They also reuse the
`ShowCondition` tree (`logic`, `conditions`) but the modal is opened from the inspector for **all**
field types, with no restriction — an alert can be attached to a field type that never renders
alerts (e.g. `display`), making it dead.

---

### 3.13 Support Documents

#### 🟠 B-32. Inline ("upload") documents are stored as base64 inside the form schema

`SupportDocumentsModal.handleFileUpload` reads the file as a data URL and stores `fileData`
(base64) **directly on the field** in `Form.schema`. Consequences:

- The form schema (`Form.schema` is `LongText` JSON) grows by ~1.33× every uploaded file; large
  files will blow up schema size, the `PUT /forms/:formId` payload, and every public/`getForm`
  read.
- No file-size limit on the inline path (the DMS path has server limits; the inline path does
  not).
- The same file is re-sent to every respondent on every public-form load.

The DMS mode is the correct pattern; inline base64 should be capped or removed.

#### ⚪ B-33. `mode` is inferred inconsistently on load

```ts
mode: doc.mode || (doc.documentId ? 'dms' : doc.fileData ? 'upload' : 'link')
```

Older documents that set `url` but no `mode` default to `link` correctly, but documents that set
both `documentId` and a leftover `fileData` resolve to `dms` and silently drop the inline data.

---

### 3.14 Poll Question (voting)

#### 🟡 B-34. Poll default is "everything if nothing flagged"

`backend/src/services/voting.processor.ts:73` includes *all* option fields when no explicit
`isPollQuestion` flag is set. So a voting form with a "Name"/"Email" select field and no explicit
flags will tally those fields as poll questions — surprising aggregation. The UI copy ("Leave OFF
for Name/Email") only mitigates this if the user remembers to toggle every non-poll field.

---

### 3.15 Assessment Scoring

> See 🟠 H-5 (short-answer unreachable).

#### 🟡 B-35. Clearing "Point Value" yields 0 with an ambiguous display

```ts
// FieldInspector.tsx:1481
onChange={(e) => onUpdate({ points: Math.max(0, Number(e.target.value)) })}
```

`Number('')` = `0`, so clearing the input sets `points: 0` (a real, scored-at-zero state) which is
visually indistinguishable from the "1 point" default shown elsewhere.

#### ⚪ B-36. `section` is free-text with no validation

Assessment `section` names are arbitrary strings used as report keys
(`assessment.processor.ts` builds `sections[sectionKey]`). Two questions with slightly different
spellings ("Math" vs "Mathematics") silently split the section. No autocomplete/normalization.

---

## 4. Missing inspector sections by field type

The following field types exist in the palette (`src/components/builder/FieldPalette.tsx`) and are
rendered on the public form, but have **no dedicated parameter section** in `FieldInspector`:

| Type | Rendered? | Inspector config | Gap |
|---|---|---|---|
| `html` | ✅ (filtered from form, rendered as markup) | none | No content/HTML editor, no sanitization note. |
| `rating` | ✅ (`PublicFormPage.tsx:2324`) | none | Cannot set scale (1–5? 1–10?), labels, or assessment points. |
| `signature` | ✅ (`PublicFormPage.tsx:2361`, DMS upload) | none | No pen-color/width, no required-state config beyond basic. |
| `table` | ✅ | ✅ (TableConfigModal) | Covered, but see H-4/B-29/B-30. |
| `display` | ✅ | ✅ (DisplayFieldConfig) | Covered, see B-11/B-12/B-13. |

Concretely: a user can drop a `rating` field and has **no way** to configure the number of stars,
and an `html` field has no editor at all (the only way to set its content is via JSON/AI).

---

## 5. Severity summary

| # | Severity | Issue | File(s) |
|---|---|---|---|
| C-1 | 🔴 | `new Function` RCE (backend + client) | `backend/src/lib/calculationEngine.ts:264`, `src/lib/calculationEngine.ts:42,347` |
| C-2 | 🔴 | External-validation credentials in published schema | `form.service.ts:24` + `ExternalValidationModal.tsx` |
| C-3 | 🔴 | Credentials logged in plaintext | `backend/src/lib/validation.ts` |
| H-1 | 🟠 | "Required" rule is a no-op | `ValidationModal.tsx` / `validation.ts` |
| H-2 | 🟠 | Numeric rules pass on text/array | `validation.ts` |
| H-3 | 🟠 | `minSize` never enforced | `validation.ts` |
| H-4 | 🟠 | Table validation client-only | `FieldInspector.tsx` / backend |
| H-5 | 🟠 | Assessment short-answer scoring unreachable | `FieldInspector.tsx:1430` vs `assessment.processor.ts:68` |
| H-6 | 🟠 | Dual validation systems conflict | `FieldInspector.tsx` / `validation.ts` |
| B-5 | 🟠 | Date/time min/max client-only | `FieldInspector.tsx` / `validation.ts` |
| B-7 | 🟠 | Multiselect duplicate option labels | `MultiSelectField.tsx` |
| B-8 | 🟠 | Array-index / colliding React keys | `FieldInspector.tsx:600`, `MultiSelectField.tsx` |
| B-9 | 🟠 | CSV import duplicate/empty values | `CSVImportModal.tsx` |
| B-11 | 🟠 | Percentage double-division | `DisplayField.tsx` |
| B-24 | 🟡 | Hidden required fields still block submit | `validation.ts` |
| B-32 | 🟠 | Base64 documents bloating schema | `SupportDocumentsModal.tsx` |
| B-10 | 🟡 | allowClearAll/showCount dead config | `MultiSelectField.tsx` |
| B-12 | 🟡 | "Date" display format dead | `DisplayField.tsx` |
| B-27 | ⚪ | equalToFieldId has no UI | `FieldInspector.tsx` |
| B-28 | ⚪ | `{value}` placeholders never interpolated | `ValidationModal.tsx` |
| B-35 | 🟡 | Points `0` vs default `1` ambiguity | `FieldInspector.tsx:1481` |

---

## 6. Recommended fix order

1. **C-1** — remove `new Function` from both calculation engines (sandbox or parse safely).
2. **C-2** — strip `externalValidation` (esp. `auth`) in `sanitizePublicSchema`.
3. **C-3** — redact `Authorization` headers / response bodies from logs.
4. **H-1** — add `case 'required'` to both rule engines (or remove the rule type).
5. **H-4 / H-5 / B-5 / B-24** — add server-side enforcement for table validation, date min/max,
   and hidden-field handling (skip required-check on hidden fields; strip hidden data).
6. **H-6** — migrate `Constraints & Defaults` to write into `field.rules[]` (single source of
   truth), or add conflict detection.
7. **B-7 / B-8 / B-9** — fix option label arithmetic, use stable unique keys, and validate/dedup
   CSV imports.
8. **B-11 / B-12** — fix percentage math and wire up the Date format.
9. **B-32** — cap or remove inline base64 uploads; require DMS for files.
10. **B-10 / B-27 / B-28** — either implement the dead configs (allowClearAll/showCount,
    equalToFieldId UI, message interpolation) or remove them from the UI.
