# Fixed — 30 August 2026

External Validation: control when the check runs. Backward compatible — no
impact on existing forms.

## 1. External validation now runs only after the field's own rules pass

**What was wrong:** the third-party API was called the moment the respondent
left the field, even if the value was already invalid (e.g. a malformed email).
This wasted API calls and could send invalid input to the third party.

**After:** in the default ("auto") mode, the field's required/format/length rules
are checked first, and the external API is only called when they pass.

## 2. New "Verify" button mode (optional)

Form authors can now choose **"Manually with a Verify button"** for a field. In
this mode the respondent sees a **Verify** button (with a shield icon) and the
check only runs when they click it. The button stays disabled until the field's
own rules pass.

Existing forms keep the old behaviour (auto on blur) — no change unless the
author opts in.

## 3. Stale "✓ verified" is cleared when the value changes

If the respondent edits a field after it was verified, the old result is cleared
so a stale success/error is never shown.

## 4. Out-of-order responses are ignored

If the respondent triggers several checks quickly, an older, slower response can
no longer overwrite a newer one.

---

**Impact:** none for existing forms or respondents. Backend endpoints and
submission validation are unchanged.
