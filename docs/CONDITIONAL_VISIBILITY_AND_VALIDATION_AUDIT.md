# Conditional Visibility and Validation Audit

## Scope

This audit follows a reported failure where field B was required and conditionally displayed from field A. After field B became hidden, browser submission still failed because B was treated as required. The review covers public rendering, preview behavior, final server validation, multi-step navigation, uniqueness/external checks, table rules, partial survey persistence, and dynamic options.

## Findings and resolution

| Area | Finding | Risk | Resolution |
|---|---|---:|---|
| Browser required validation | React Hook Form retained a required field registration after the conditional field unmounted. | High: a respondent could not continue or submit even though the field was not visible. | Hidden conditional fields are now unregistered globally, their browser errors are cleared, and they register again if their condition becomes true. |
| Stale hidden answers | A respondent could answer B and then change A so B became hidden; the old B answer could remain in client state. | High: irrelevant answers could be submitted or affect another condition. | Unregistering B removes its value. The server independently removes answers for hidden fields. |
| Server required validation | Required validation must never run before visibility validation. | High if ordered incorrectly. | Confirmed and retained: the server evaluates `showWhen` first, removes hidden answers, and only then checks `required` and required rules. |
| Multi-step validation | Final `trigger()`/`handleSubmit()` can validate controls registered on prior pages. | High with a hidden registered branch. | Global hidden-field unregistration applies across all pages while preserving answers for fields whose conditions are still true. |
| Uniqueness state | A uniqueness error from B could remain after B became hidden and block submission. | Medium/high. | Hidden field IDs are removed from uniqueness error and success state. Server uniqueness uses visibility-filtered canonical data. |
| External validation | External-validation state could survive after its field became hidden. | Medium. | Hidden field IDs are removed from external error, success, and loading state. Only currently visible external checks can block progression. |
| Table validation | Client table rules iterated every table, including a conditionally hidden table. | High for required row/table rules. | Client table validation now skips tables whose `showWhen` condition is false. |
| Incomplete survey sessions | Partial autosave previously filtered unknown IDs but did not remove a formerly visible branch. | Privacy/data-quality risk. | The server now evaluates visibility before persisting each partial session and deletes hidden branch values. |
| Dynamic options | Server validation accepted the union of options from every conditional branch. | Security/data-integrity risk: a modified request could submit an option not displayed for the current parent answer. | Server validation now resolves the current basic or advanced branch and accepts only its effective options. |
| Multi-select parent options | Builder preview merged dynamic options for an array parent, while the public page converted the whole array to one string. | Preview/public parity issue. | Public rendering now merges and deduplicates mappings for every selected parent value, matching preview behavior. |
| Nested AND/OR conditions | Nested condition groups could diverge between browser and server. | Security risk if behavior differs. | Reviewed: both implementations recurse through nested groups and use the same operators and empty-value semantics. |
| Preview behavior | Preview performs its own validation over `visibleFields`. | Low. | Confirmed: hidden fields are excluded from preview step validation. Shared public/server defenses remain authoritative. |

## Required behavior after the fix

Given:

- A is required.
- B is required.
- B has `showWhen: A equals "yes"`.

Expected behavior:

| A | B visible | B answer | Result |
|---|---:|---|---|
| Empty | No | Empty | A required error only |
| `no` | No | Empty | Valid with respect to B |
| `yes` | Yes | Empty | B required error |
| `yes` | Yes | Filled | Valid |
| `yes`, B filled, then A changed to `no` | No | Cleared automatically | Valid; B is absent from stored data |

The server remains the final authority. A caller cannot bypass the rule by posting B directly while B's condition is false; the answer is removed before storage.

## Condition semantics to remember

- `equals`, `contains`, numeric comparisons, and `in` are false when the source is absent.
- `notContains` and `notIn` are true when the source is absent.
- `isEmpty` is true when the value is absent, an empty string, or an empty array.
- Text `contains`/`notContains` matching is case-insensitive.
- Array equality checks whether any selected item equals the configured value.

The negative-operator behavior is intentional, but authors should usually combine a negative condition with `isNotEmpty` when a follow-up must not appear before the respondent answers.

## Remaining authoring risks

These are configuration risks rather than known submission defects:

1. **Circular dependencies:** A condition chain such as A depending on B while B depends on A can leave both questions hidden. Avoid condition cycles.
2. **Deleted source fields:** Review conditions after deleting or replacing their source field. A missing source can make negative/empty operators evaluate true.
3. **Ambiguous text matching:** A keyword condition such as `contains "support"` also matches longer text containing that sequence. Use choice fields when exact segmentation is important.
4. **Branch changes after completion:** Allowing back navigation means a respondent can revise an earlier answer and intentionally clear a later branch. This is correct behavior but should be considered when designing locked steps.
5. **External service availability:** A visible field configured for external validation can still be blocked if the configured validation service is unavailable. This is separate from conditional visibility.

## Regression checklist

Test each release with:

1. Required B starts hidden and does not block submit.
2. A reveals B; empty B blocks progression.
3. Fill B, then change A to hide B; submit succeeds and B is absent from stored data.
4. Repeat across different pages with back navigation.
5. Repeat when B has uniqueness validation.
6. Repeat when B has manual and blur-triggered external validation.
7. Repeat with a conditionally hidden table carrying required-row rules.
8. Forge a request containing hidden B; verify the server discards it.
9. Autosave a visible B, then hide B; verify the incomplete session no longer contains B.
10. Attempt a dynamic option belonging to a different parent branch; verify the server rejects it.
