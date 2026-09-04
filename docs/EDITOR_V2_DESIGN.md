# Editor v2 — Making a New Form as Easy as Google Forms

**Status:** design proposal
**Scope:** the form editor only — creating and editing a form. Response pages, teams and the public form are covered in `UX_REVIEW_AND_REMEDIATION_PLAN.md`, and this document assumes and extends that one rather than repeating it.
**Audience:** the person who has to build this, and the person who has to approve it.

---

## The question this answers

> What changes would make creating a new form as easy as Google Forms for a non-technical user?

Not "how do we look like Google Forms". SifyForms does things Google Forms cannot — assessments with scoring, polls with vote de-duplication, payments, conditional logic, external validation, document-management-backed uploads — and throwing those away would be a bad trade. The question is why a product with *more* capability is *harder to start*, and what has to change so that having those features costs a beginner nothing.

---

## 1. Why Google Forms feels easy

It is worth being precise about this, because the usual answer — "it's simpler" — is wrong and leads to the wrong fixes. Google Forms is not simpler in any absolute sense. It has sections, branching, validation, quizzes, response limits, and file uploads. What it does differently is five specific things.

**1. There is no empty state.** A new form already contains one question. The first thing you see is a thing you can edit, not a thing you must decide.

**2. There is one place to look.** The question you are editing expands in place, on the canvas, at the size it will be. There is no second panel holding the settings for the thing you selected in the first panel.

**3. The question type is a consequence, not a prerequisite.** You type the question first. The type is a dropdown *inside* the question, changeable at any time, and it guesses: type "What is your email address?" and it offers short answer with email validation.

**4. Everything advanced is behind one dot.** Every question has a `⋮` menu. Description, validation, "go to section based on answer" — all of it lives there, on the question, and none of it is visible until asked for.

**5. Nothing is a mode.** Preview is a separate tab in the browser. Settings is a gear. You never leave the thing you are making.

The common thread: **at every moment there is exactly one obvious next action, and it is on the thing you are looking at.**

---

## 2. Why SifyForms is harder

Measured against those five, here is what a beginner meets. Every claim below is a fact about the current code, not an impression.

### 2.1 The form starts empty and the first decision is a taxonomy question

A new form is a blank canvas beside a palette of **17 field types** (`FieldPalette.tsx`), or **22** if the form is a survey. They are labelled by input mechanism: *Text Input, Long Text, Dropdown, Radio Buttons, Checkboxes, Multi-Select, Display Value, Custom HTML, Table Grid*.

A beginner does not think "I need a radio button". They think "I want to ask which department they're in". To act, they must first translate an intention into a widget name, and then distinguish:

- **Radio Buttons** vs **Dropdown** vs **Multi-Select** vs **Checkboxes** — four controls, two actual questions (one answer or several? long list or short?)
- **Text Input** vs **Long Text** — a length decision made before the question exists
- **Display Value** vs **Custom HTML** — both mean "not a question"

That is the first screen. Nothing has been asked yet.

### 2.2 Editing a question happens somewhere other than the question

Selecting a field opens the **Field Inspector**, a right-hand panel with up to twenty-one accordion sections in a fixed order:

> Survey Question · Basic Properties · Constraints & Defaults · Options Configuration · Display Configuration · Table Configuration · File Upload Settings · External Validation · Smart Connections · Data Calculations · Conditional Visibility · Input Validation · Table Validation · Custom Alerts · Support Documents · Poll Question · Assessment Scoring

Most are hidden for most types, but the consequences hold regardless:

- **The label is not edited where the label appears.** The canvas shows the question; the panel changes it. The eye moves between two places for a one-word edit.
- **The order is the code's, not the user's.** "Basic Properties" — which is the label, the placeholder and the help text, i.e. the thing everybody needs — is second, under a survey-only section.
- **Three advanced features are named so as not to distinguish them**: *External Validation*, *Smart Connections*, *Data Calculations*. Nothing in those names says which one copies an answer from another question.
- **"Field Inspector" is a developer-tools name.** Nobody arrives wanting to inspect a field.

### 2.3 The form's *kind* is decided in three separate places, as three checkboxes

Assessment, Voting and Survey are mutually exclusive form types. They appear as three peer tabs among ten in Form Settings — *General, Access, Team, Appearance, Authentication, Payment, Assessment, Voting, Survey* — each containing its own enable checkbox, sitting alongside Appearance, which is not a form type at all.

A state machine has been drawn as a settings form. Turning a form into a poll means knowing that "poll" is called "Voting", that it lives in Settings, and then separately marking a question as the counted one back in the Field Inspector, with no link between the two steps (`UX_REVIEW_AND_REMEDIATION_PLAN.md` §1.1).

### 2.4 Canvas, Preview and Settings are modes

Three exclusive modes in a segmented control. Checking what a question looks like means leaving the editor. The preview also validates differently from the published form, so what it teaches is not entirely true — a discrepancy now partly closed, but the shape of the problem is the mode switch itself.

### 2.5 Nothing tells you where you are

There is no autosave indicator that reads as a sentence, no pre-publish check, and Save and Publish are two adjacent buttons of near-identical weight. A published form with unsaved edits says "Published", which is true of the live copy and false of what is on screen.

---

## 3. What v2 should be

One principle, from which everything below follows:

> **Editing happens on the question. The panel is for the form, not for the field.**

Six changes deliver it. They are ordered so that each one is shippable alone and each one is worth doing even if the next never happens.

---

### 3.1 Start with a question already on the canvas

**Change.** A new form contains one empty short-answer question, focused, cursor in the label. Not a placeholder — a real question, already saved with the draft.

**Why.** It converts the first interaction from *decide* to *type*. It also demonstrates the interaction model — this is a question, you edit it here — before any explanation is needed.

**Cost.** Small. One default field in the new-form action.

---

### 3.2 Ask by intention, not by widget

**Change.** Replace the palette of 17 mechanisms with **eight intentions**, each of which resolves to a field type. Keep the mechanism list, but behind "More question types".

| What you want to ask | Becomes |
|---|---|
| A short answer | `text` |
| A long answer | `textarea` |
| One choice from a list | `radio`, or `select` when there are more than six options |
| Several choices from a list | `checkbox`, or `multiselect` above six options |
| A number | `number` |
| A date or time | `date` / `time` |
| A file | `file` |
| A rating or score | `rating` |

**The "more than six options" rule matters.** Radio versus dropdown is not a question a person should be asked; it is a consequence of how many options there are, and the editor knows how many options there are. Switch the presentation automatically and say so quietly — *"Shown as a dropdown because there are 9 options"* — with a link to override. Same for text versus long text: pick by the answer length you set, offer the override.

**Guess from the label.** When somebody types a question containing "email", "phone", "how many", "when", or "upload", offer the matching type as a single dismissible chip under the field: *"Make this an email question?"*. Offer, never apply — a guess that acts on its own is worse than no guess.

**Cost.** Medium. A mapping table, an options-count watcher, and a small keyword matcher. No change to the field model.

---

### 3.3 Move editing onto the canvas; keep the panel for the form

This is the largest change and the one that matters most.

**Change.** A question on the canvas has two states:

- **Collapsed** — the question as a respondent sees it. Click anywhere to expand.
- **Expanded** — the same question, in place, plus:
  - the label as an editable heading, in the form's own type
  - a "Add a description" affordance that becomes the help text
  - the answer control, live and interactive, at its real size
  - a footer strip: **question type** (dropdown) · **Required** (toggle) · **⋮ More**

**⋮ More** is one menu, in plain language, showing only what applies to this type:

> Duplicate · Delete
> ─────
> Limit the answer… *(validation)*
> Only show this sometimes… *(conditional visibility)*
> Fill from another question… *(smart connections)*
> Check with another system… *(external validation)*
> Calculate from other answers… *(data calculations)*
> Show a message when… *(custom alerts)*
> Attach a document…
> Count this in the poll / Score this question *(when the form is that type)*

Each opens the existing modal. **This is the cheapest part of the change**: `ConditionalVisibilityModal`, `ValidationModal`, `ExternalValidationModal`, `AdvancedLinkingModal`, `CustomAlertModal`, `SupportDocumentsModal` and `TableConfigModal` already exist as standalone dialogs. The Field Inspector is largely a launcher for them wearing an accordion. Re-pointing those launchers at a `⋮` menu on the question deletes a panel without rewriting a feature.

**A dot marks configured items.** A question with a visibility rule shows a small marker on `⋮` and a one-line summary under the footer — *"Only shown when Department is Sales"*. Configuration you cannot see is configuration you will forget, and this is the single highest-value line in the whole proposal for anyone maintaining a form they wrote three months ago.

**The right panel becomes "Form setup"** and holds only things that are true of the whole form: type, appearance, access, after-submit, payment. It stops changing when the selection changes, which is what makes it possible to stop thinking about it.

**Cost.** Large — this is the v2 in "editor v2". Mitigated by the modals already existing, and by the fact that it can ship type by type: start with text, choice and number, leave `table`, `likert` and `html` on the old inspector until last.

---

### 3.4 Ask the form's kind once, as one question

**Change.** At the top of Form setup, one question, four answers:

> **What kind of form is this?**
> ○ Collect answers  ○ Poll or vote  ○ Quiz or assessment  ○ Survey

Choosing reveals exactly one type-specific section and hides the other two. Choosing "Poll or vote" also does the second half of the job the user actually wanted, which today they must discover separately: it prompts, inline, *"Which question are people voting on?"* with a list of the form's choice questions.

**Below it, a "What's set up" summary** — every feature currently switched on, each a link to the control that switched it on:

> Poll · One vote per email · Payment ₹500 · Email verification · Bot protection on

This is the map of the editor that currently does not exist anywhere. Someone opening a form they did not build has no way to find out what is switched on except to open all ten tabs.

**Cost.** Small-to-medium. The settings all exist; this is one radio group, conditional rendering of three existing tabs, and a derived list.

---

### 3.5 Preview beside the form, not instead of it

**Change.** Replace the Canvas/Preview/Settings mode switch with a persistent editor and a **Preview** toggle that opens a device-framed pane on the right (or full-screen on narrow windows). Editing continues underneath; the preview updates as you type.

If a side-by-side pane is too much for a first pass, the smaller version captures most of the value: **Preview opens the real public form in a new tab.** It is one line of code, it is what Google Forms does, and it has the significant advantage of being the actual page rather than a second renderer that validates differently.

**Cost.** Small for the new-tab version. Medium for the pane.

---

### 3.6 Say what state the form is in, in words

**Change.**

- Autosave the draft. Replace the Save button with a quiet, honest line: **"All changes saved"** / **"Saving…"** / **"Couldn't save — retrying"**.
- One state line in the header: **Draft** · **Published** · **Published · 3 unpublished changes**.
- **Publish becomes the only button**, because it is the only action with consequences.
- Publishing runs a **pre-flight check** and shows what it found before going live:

  > **Ready to publish — 1 thing to look at**
  > ⚠ This poll doesn't count any questions yet. *Fix this*
  > ✓ 6 questions, 2 required
  > ✓ Responses go to the Marketing team
  >
  > [Back to editing] [Publish anyway]

  Blocking only for errors that guarantee a broken form — a poll with no counted question, a payment form with no amount, a form with no fields, a required field permanently hidden by a conditional rule. Everything else is a warning. The value is finding out now rather than from an empty chart next week.

**Cost.** Medium. Autosave needs a debounced thunk and a conflict story; the pre-flight check is a pure function over the schema and is worth building first because it can ship independently.

---

## 4. What must not be lost

A simplification that removes capability is a rewrite, not an improvement. Explicitly preserved:

- **Every field type stays**, including `table`, `likert`, `nps`, `ces`, `signature` and `html`. They move behind "More question types"; they are not removed.
- **Every advanced feature stays.** Conditional visibility, external validation, calculations, field linking, custom alerts, support documents, table validation — all reachable in **one click** from `⋮`, which is fewer clicks than scrolling to the right accordion section today.
- **The power user gets faster, not slower.** Editing on the canvas removes a panel round-trip from the most common operation of all: changing a label.
- **Drag-and-drop reordering and multi-step layout are unchanged.**
- **Keyboard access improves.** Editing in place means tab order follows reading order, which a two-panel layout can never quite manage.

---

## 5. Order of work

Sequenced by value per unit of risk. Each step is independently shippable.

| # | Change | Size | Why here |
|---|---|---|---|
| 1 | New forms start with one question (§3.1) | XS | Removes the empty state for the cost of one default. Do it today. |
| 2 | Pre-flight check on publish (§3.6, partial) | S | Pure function over the schema; no UI restructuring; prevents the most expensive class of mistake. |
| 3 | Intention-based question picker (§3.2) | M | Fixes the first screen a beginner meets, with no change to the field model. |
| 4 | "What kind of form is this?" + What's set up (§3.4) | M | Fixes the poll/assessment discoverability problem and gives the editor a map. |
| 5 | Preview in a new tab (§3.5, minimal) | XS | One line. Removes a mode and shows the truth instead of a second renderer. |
| 6 | Autosave + one state line (§3.6, rest) | M | Depends on nothing above; deliverable in parallel. |
| 7 | **Canvas editing + `⋮` menu** (§3.3) | L | The real v2. Ship per field type, starting with text, choice and number. |
| 8 | Retire the Field Inspector | S | Only once step 7 covers every type. |

Steps 1, 2 and 5 together are roughly a day's work and remove the empty state, the silent-broken-form problem and one of the three modes.

---

## 6. How we would know it worked

Guessing at UX is how the current editor happened. Four measurements, all obtainable from data the product can already record:

1. **Time from "New form" to first saved question.** The single best proxy for the empty-state problem. Should fall sharply after step 1 and again after step 3.
2. **Proportion of new forms published with zero responses after 30 days.** A form built and abandoned is a form whose editor lost the argument.
3. **Proportion of polls published with no counted question.** Should reach zero after steps 2 and 4. It is not zero today.
4. **Field Inspector opens per question edited.** Should fall towards zero as step 7 lands. If it does not, the `⋮` menu is missing something and we should find out which thing.

---

## 7. Relationship to the existing plan

This document is the detailed version of Part 1 of `UX_REVIEW_AND_REMEDIATION_PLAN.md`, and it supersedes §1.2 in one respect. That section proposed reorganising the Field Inspector into a "Basics" tier plus four named advanced groups. That is a real improvement and would be worth doing — but it improves a panel this document proposes to remove.

**The recommendation is to skip it.** Reorganising twenty-one accordion sections is most of the work of moving them onto the question, and only the second one addresses the actual complaint, which is not that the sections are badly ordered. It is that editing a question happens somewhere other than the question.

The renaming in §1.2 stands and should be applied to the `⋮` menu instead:

| Now | In v2 |
|---|---|
| Field Inspector | *(removed — editing is on the question)* |
| Smart Connections | Fill from another question |
| External Validation | Check with another system |
| Data Calculations | Calculate from other answers |
| Conditional Visibility | Only show this sometimes |
| Input Validation | Limit the answer |
| Constraints & Defaults | *(merged into "Limit the answer")* |
