# Support Documents, Custom Alerts & Input Validation — safe fixes (2026-08-30)

Safe-only batch. No backend enforcement changes, no schema/data migration, no
published-form behavior change. Existing forms unaffected.

## Custom Alerts (`CustomAlertModal.tsx`)
- **CA-1**: Added an AND/OR "Match" selector. The `logic` field already existed
  and is honored by `evaluateShowWhen` at runtime, but had no UI — all alerts
  were hardcoded to AND. Existing alerts stay `and`; this is purely additive.
- **CA-2**: Save now validates (a) every alert has a message and (b) every
  condition that needs a value has one (mirrors the SC-7 blank-value guard, so
  a left-blank condition can't falsely trigger on an empty field).
- **CA-4**: Replaced toy `text-[10px] font-bold uppercase` labels; footer now
  shows an inline error or a helper hint.

## Support Documents (`SupportDocumentsModal.tsx`)
- **SD-1**: Replaced native `alert()` with an inline footer error (`saveError`).
- **SD-2**: Added URL validation — invalid/unsafe URLs show an inline error and
  block save (full `http(s)` URL required; `javascript:` etc. rejected).
- **SD-4**: Fixed empty-state copy (was "PDF links" only; now covers uploads).
- **SD-5**: Cleaned toy uppercase micro-labels.

## Input Validation (`ValidationModal.tsx`)
- **IV-2**: Added inline feedback when a `pattern`/`regex` rule has an invalid
  regex (red border + "rule won't run until fixed" message), replacing the
  silent `catch {}` behavior in the editor.
- Cleaned `uppercase tracking-wider` labels.

## PublicFormPage
- **IV-6**: Removed noise `console.log`/`console.debug` (payment + support-docs
  + alerts). Kept the two legitimate `console.error`s (uniqueness check and
  external-validation failure).

## Deferred (needs sign-off)
- **IV-1**: "Required" validation rule is enforced client-side
  (`fieldValidation.ts`) but NOT server-side (`backend/validation.ts` has no
  `required` case) — adding it closes a scripted-submission bypass but is a
  backend enforcement change.
- **SD-3**: Inline upload stores full file as base64 in the field schema —
  storage/migration change.
