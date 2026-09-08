# Form kind (UX onboarding plan)

**Status: plan only — nothing below is implemented yet.**

## The problem

Today the form's kind ("What kind of form is this?") can be flipped at any time
from the left panel, and each flip silently re-contextualizes the whole form:

1. Choose *Collect answers*, add a text field.
2. Switch to *Survey*, add an NPS question.
3. Switch to *Poll*, add a checkbox, mark it as the counted question.
4. Publish → the form is a poll. The text field and the NPS question ride
   along, unexplained. Nothing ever told the user what the form *is*.

The user's mental model ("I'm making a survey") and the product's model
("this is a poll now") diverge with no warning, no explanation, and no
moment where the decision is consciously made.

## Principle

> The kind of form is the **first** decision, not a setting.
> It decides what the builder emphasizes, what it hides, and what publishing
> checks — so it must be chosen deliberately, shown permanently, and changed
> only with consequences spelled out.

## 1. Ask once, at creation

The "New form" flow (CreateFormModal) gains a first step: four intent cards,
before the name is even typed.

```
What do you want to make?

[ Collect answers ]   [ Run a poll or vote ]   [ Quiz or assessment ]   [ Survey ]
  An ordinary form      Count answers to        Score answers, set       NPS, CSAT,
                         one question            a pass mark              Likert, ranking
```

- The card choice seeds `settings.formType` exactly as the left panel does
  today (including the default voting/assessment/survey settings blocks).
- A "start blank" escape hatch keeps the current zero-friction path.
- The name/description step comes after, already knowing the intent.

Why: at creation there is no content to contradict. Asking here costs one
click and removes the biggest source of confusion later.

## 2. The kind is always visible

- A small **kind badge** beside the form name in the builder header
  (e.g. `Poll`), clicking it reopens the chooser dialog (see §3).
- The left panel keeps the chooser, but as *display + edit* of a decision
  already made — not a casual radio group. Sub-line: "Chosen when the form
  was created."

## 3. Switching is explicit and explained

Switching kind opens a short confirmation that states, in this form's own
terms, what changes:

```
Switch this form to a poll?

What stays:   all 12 questions, settings, theme
What's new:   you'll pick the one question the poll counts
What hides:   NPS/CSAT scoring stays saved but is no longer used

[ Keep as survey ]   [ Switch to poll ]
```

- Never destructive: poll marks, correct answers and survey configs stay in
  the schema, hidden but intact, so switching back restores them.
- If the target kind has a blocking requirement (a poll needs a counted
  question; a quiz needs at least one scored question), the switch lands
  directly in the place that satisfies it — the poll picker opens
  immediately after the switch.

## 4. Each kind provides and hides its own tools

One matrix, driven by `settings.formType` everywhere:

| Capability | Collect | Poll / vote | Quiz / assessment | Survey |
| --- | --- | --- | --- | --- |
| Basic + choice questions | ✓ | ✓ (choice first) | ✓ | ✓ |
| Survey questions (NPS, CSAT, CES, Likert, Ranking) | buried under "More" | buried | buried | **promoted to top** |
| "Count this in the poll" (⋮ / Advanced) | — | ✓ | — | — |
| "Score this question" (⋮ / Advanced) | — | — | ✓ | — |
| Settings section: Voting (duplicate prevention, results) | — | ✓ | — | — |
| Settings section: Assessment (pass mark, reveal answers) | — | — | ✓ | — |
| Settings section: Survey (identity, numbering, progress) | — | — | — | ✓ |
| Identity/upload restrictions | — | — | — | strict anonymous: no file/phone/signature |
| Preflight blocking checks | standard | counted question set | ≥1 scored question | strict-anonymous constraints |

Rules:

- Menus never show options that do nothing for the current kind.
- The question-type dropdown's **order** follows the kind (survey types lead
  for surveys; choice types lead for polls).
- What's hidden is dormant, not deleted — switching kind back restores
  everything (poll marks, scores, survey configs).

## 5. Publishing reflects the kind

- Preflight checks are kind-aware (already true) and its dialog states the
  outcome in the form's own words: "Responses will be counted as poll votes
  on *Which plan do you prefer?*".
- The publish button's confirmation copy names the kind once, so the last
  thing the user reads matches what they think they built.

## 6. The same session, under this plan

1. "New form" → picks **Collect answers** → adds the text field.
2. Realizes they want a survey → clicks the kind badge → the switch dialog
   says what a survey adds and asks to confirm → survey types promote in the
   type dropdown → adds NPS.
3. Wants to count votes → switches to **Poll** via the badge → dialog
   explains the counted question → the poll picker opens immediately →
   marks the checkbox.
4. Publish → preflight: "Poll · counting *Which plan do you prefer?*" —
   nothing surprising, because every transition was explained and every
   tool shown was relevant.

## Implementation notes (when this is built)

- The chooser's `setFormKind` logic already exists in `FormSetupPanel`; the
  creation modal and the switch dialog reuse it.
- The capability matrix belongs in `formSetup.ts` next to
  `fieldEditorTabs()` / `RULES_BY_TYPE`, so menus, settings sections and
  preflight all read one source of truth.
- Hidden-but-saved behaviour is already how the schema works
  (`isPollQuestion`, `correctAnswer`, `surveyConfig` are optional keys).
