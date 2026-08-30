# Smart Connections — bug fixes + UI refresh (2026-08-30)

## Scope
Fixes + UI polish for the Smart Connections feature (field linking). No backend
changes, no schema/data migration, no published-form behavior change. Existing
forms are unaffected (all evaluation changes are behavior-preserving except the
deliberate blank-condition bug fix below).

## Bug fixes

### SC-2 — migration moved out of render
`AdvancedLinkingModal.tsx`: the "move restriction rules from `rules` into
`restrictionRules`" migration previously dispatched `onUpdate()` (Redux) during
render. Moved into a mount-only `useEffect` guarded by a `useRef`, so the store
is no longer updated while React renders.

### SC-3 — removed 12 debug logs
Removed all `console.log` / `console.warn` from `AdvancedLinkingModal.tsx`.

### SC-5 — Global Defaults date range now displays current value
The "Min Default" / "Max Default" `DateConstraintPicker`s previously passed
`constraint={undefined}`, so an existing default never showed. Now pass
`constraint={defaultDateRange.min}` / `.max`.

### SC-6 — NaN guard on numeric operators
`ruleEngine.ts` `evaluateLinkingCondition`: `greaterThan` / `lessThan` now
return `false` when either operand is non-numeric (was `NaN` comparison, which
silently never matched).

### SC-7 — blank condition value never matches
`ruleEngine.ts`: a condition with an empty/blank `value` (`''`/`undefined`/`null`)
is now treated as incomplete and never matches. This prevents an accidentally
left-blank condition from triggering auto-fill or restriction rules. The previous
"empty source equals empty target → true" behavior is removed; an unanswered
source field still satisfies `notEquals`/`notContains` and fails
`equals`/`contains` (unchanged).

### SC-11 — dedupe render block
`PublicFormPage.tsx`: removed a duplicate "5. Apply manual defaults and
constraints" block (two identical `if (!linking?.enabled)` sections).

## UI refresh (understandability + de-"toy"ing)
- Operator dropdown now uses words ("equals", "not equals", "contains",
  "does not contain", "greater than", "less than") instead of symbols
  (`==`, `!=`, `~`, `!~`, `>`, `<`). Values unchanged — no data impact.
- Condition "Field..." → "Select field..." and shows `(type)`.
- Replaced all tiny `font-black uppercase tracking-widest` micro-labels with
  readable `text-xs font-semibold` labels.
- Replaced cryptic empty states ("No Custom Rules Active") with clear text
  ("No auto-fill rules added yet").
- Header explanation rewritten to a single clear sentence describing the
  three tabs.
