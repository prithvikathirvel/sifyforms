# Fixed — 30 August 2026

External Validation: Verify button now works everywhere, plus a cleaner UI.

## 1. Verify button was missing on the published form — fixed

**What was wrong:** the "Verify button" mode was configured correctly, but the
published page never showed the button. The public schema stripped the
`trigger` flag, so the page always treated the field as "auto" mode.

**After:** the public schema now also sends `trigger` when set to `manual`, so
the Verify button appears on the published form exactly as configured.

## 2. Verify button now shows in the editor Preview too

**What was wrong:** the editor Preview rendered no external-validation UI, so the
Verify button (and the "validating / verified" states) were invisible in
preview.

**After:** the Preview now shows the Verify button and the validation states,
matching the published page.

## 3. Trigger setting moved out of the modal

The "Automatic vs Verify button" choice was previously buried inside the config
modal. It now lives in the field inspector's **External Validation** accordion as
a small, clear toggle — right where the other field settings are.

## 4. Config modal refreshed

The External Validation modal was restyled to be cleaner and easier to use:
tighter header, clearer enabled/disabled state, refined tabs, and the Save
button now blocks saving until a valid endpoint URL is entered.

---

**Impact:** none for existing forms or respondents. No data or migration
changes — the `trigger` flag already existed; this only fixes where it was
being dropped.
