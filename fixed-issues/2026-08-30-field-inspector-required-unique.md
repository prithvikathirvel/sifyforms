# Fixed — 30 August 2026

Builder-side fixes only. No change to stored data, no impact on existing forms
or respondents.

## 1. "Required" and "Unique" are now independent

**What was wrong:** Unchecking "Required" automatically cleared "Unique" without
warning, and "Unique" could only be used on required fields. This made it
impossible to create an optional field that is unique when filled in.

**After:**
- Unchecking "Required" no longer clears "Unique".
- "Unique" can now be used on optional fields. When a field is optional and
  unique, a note explains: "uniqueness is only checked when a value is entered."

## 2. Conflict warning when two places set the same limit

**What was wrong:** A field could have a minimum/maximum set in both
"Constraints & Defaults" and "Input Validation" with no warning, producing two
different error messages for the same input.

**After:** When both are set, a note appears in "Constraints & Defaults":
"Both are enforced — the stricter of the two applies."

---

**Impact:** none for end users or existing forms. These affect only new edits in
the form builder.
