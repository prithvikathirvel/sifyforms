# Web onboarding plan

**Status: plan only — not implemented.**

Goal: a first-time user reaches a *working understanding* in under a minute,
and leaves onboarding having contributed (optionally) the profile facts we
cannot guess. Nothing here blocks the way in.

## The three steps

### 1. What SifyForms is (one screen, 10 seconds)

A single card, no interaction required:

> Build forms, collect answers, see results. Pick a type, add questions, publish.

Three mini-illustrations (Form → Responses → Results), one **Start** button,
one **Skip the tour** link. Auto-advance is deliberately absent — the user
sets the pace.

### 2. Create your first form (the real onboarding)

Onboarding *is* the product: after step 1 we open the existing
Create-form modal directly (kinds: Collect / Poll / Quiz / Survey), because
a user with a draft owns the app; a user with an empty dashboard does not.
A dismissible one-line coach sits above the canvas:
*"Click **Add** to place your first question."* — it disappears after the
first question exists.

If the user skips here, we drop them on the dashboard with a single
"Create a form" primary card — the current empty state, no nagging.

### 3. About you (optional, skippable, pre-filled)

Shown **after** the first form is saved — never before any value is
delivered. Collects exactly what the product cannot infer and uses:

| Field | Why | If skipped |
| --- | --- | --- |
| Phone | account recovery alerts | works without |
| Gender | salutation in shared responses | neutral defaults |
| Address | regional formatting (dates, numbers) | browser locale |

Every field is blank-able; a persistent **Skip for now** on the footer
(right of Save) records `onboarding.profileSkippedAt`, and the card never
re-appears in the way — it becomes a quiet suggestion on the Profile page
("Add your details").

## Rules the flow obeys

- **Skippable end-to-end.** Every step has an exit that still lands the user
  in a useful place. Onboarding state (`onboarding.step`) lives in
  localStorage per browser, not on the account — a colleague's tour never
  hijacks an established user.
- **No walls.** The dashboard is reachable at any point via "Skip".
- **Value before questions.** The only data we ask for (step 3) comes after
  the user has created something they care about.
- **One screen, one decision.** No multi-field forms until step 3, and that
  one is optional.
- **Returns users never see it.** `hadSession()` (already in the session
  machinery) gates the whole flow: onboarding is for first-time visitors only.

## What success looks like

- Time-to-first-question: under 60 seconds for a new user.
- Step-3 completion: expected ≥ 60 % precisely because it is skippable and
  arrives after first value.
- Support questions of the form "where do I start": gone.

## Implementation notes (when built)

- A small `OnboardingGate` in `App.tsx` beside `SessionBootstrap` decides
  whether to route `/` → onboarding.
- Steps 1 and 3 are two small components; step 2 is the existing
  Create-form modal plus the existing canvas coach line.
- Profile step posts through the existing `updateProfile` API — no new
  endpoints, no schema changes.
