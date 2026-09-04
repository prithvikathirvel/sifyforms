# SifyForms — UX Review and Remediation Plan

**Date:** 4 September 2026
**Scope:** every screen in the product — landing, sign-up, dashboard, forms list, form editor, response pages, teams, members, roles, organization settings, and the public form itself.
**Audience:** product, design, and engineering.

---

## Why this document exists

The manager's review said the Form Editor has a long learning curve and is too hard for a non-technical business user. The example given was building a poll:

> Settings → Form settings → Voting → Enable voting.
> Then, separately: Field Inspector → scroll to the bottom → enable polling on the field.

Two screens, two panels, no connection drawn between them, and nothing anywhere that says the second step exists. A person who does the first step and stops has built a poll that counts nothing.

That example is not an outlier. It is one instance of a pattern that repeats across the product, and the pattern — not the individual screen — is what makes the learning curve long. This document names the pattern, catalogues where it appears, and proposes a fix for each occurrence.

---

## The six patterns behind almost every complaint

Every specific problem in this document is an instance of one of these. Fixing the pattern is cheaper than fixing forty screens one at a time.

### P1. A single intention split across two places, with no link between them

Turning something on requires an action in one panel and a second, unmentioned action in another. Neither place mentions the other. The feature appears to be on and silently does nothing.

*Poll mode is the reported case. Assessment scoring, conditional visibility, payment fields, and survey questions all work the same way.*

### P2. Configuration organised by the code's structure, not the user's task

Settings are grouped by which part of the system owns them — "Access and security", "Authentication", "General" — rather than by what the person is trying to achieve. A user who wants "stop people voting twice" has to already know that voting is a *form type*, that form types live in Settings, and that the vote limit is a sub-option of the form type.

### P3. Vocabulary from the implementation

"DMS File Storage", "Field Inspector", "Turnstile", "Duplicate Prevention", "Processing status", "Aggregate", "Redacted", "Blind review", "Smart Connections", "External Validation". Some of these are precise and worth keeping; most are internal names that leaked into the interface.

### P4. Configuration presented as a flat list instead of a decision

The Field Inspector is a stack of twenty-one collapsible sections shown in a fixed order regardless of the field, the form type, or what the person has done so far. Finding the one relevant section means reading all of them.

### P5. Nothing tells you the state of your work

Nothing says a poll has no poll question, a payment form has no amount, an assessment has no correct answers, or a form has been published with a required field nobody can see. The first sign of trouble is a wrong result in the response page, days later.

### P6. Density tuned for a dashboard, not for reading

Nine- and ten-pixel type, uppercase micro-labels, and low-contrast greys throughout. It photographs well. It is tiring to work in for an hour, and it is inaccessible below about 20/25 vision.

---

## Part 1 — The Form Editor

This is where the learning curve is, and it is where most of the value of fixing anything lies.

### 1.1 Poll mode is two disconnected steps *(P1, P5)* — **the reported issue**

**What happens now**

| Step | Where | What you see |
|---|---|---|
| 1 | Editor → Settings → Voting | "Enable Voting / Poll Mode" checkbox, plus duplicate-vote options |
| 2 | Editor → Canvas → click a field → Field Inspector → scroll past 20 sections | "Poll Question" → "Count votes on this field" |

Step 2 only appears once step 1 is done, which is correct. But nothing in step 1 says step 2 exists, and step 2 is the twenty-first section in a long scrolling panel. A poll with no field marked produces an empty results chart with no explanation.

**Proposed fix**

1. **Do step 2 automatically.** When voting is switched on, mark every existing choice field (radio, select, checkbox, multi-select) as a poll question by default. Someone building a poll almost always wants the choice questions counted. The per-field toggle stays, for turning a field *off*.
2. **Follow through in the same place.** Directly under the "Enable Voting" checkbox, list the questions that will be counted, with a checkbox each:
   > **Questions counted in the results**
   > ☑ Which venue do you prefer?
   > ☐ Your name *(short text — cannot be counted)*
   >
   > *No choice questions yet — add one to the form and it will appear here.*

   The person configures the whole poll without leaving the panel they are already in. The field-level toggle remains as a second route to the same setting, not the only route.
3. **Say when it is wrong.** If voting is on and no question is counted, show an inline warning in Settings and block publish with: *"This poll has no question to count votes on. Pick at least one."*

**Applies identically to:** assessment scoring (Settings → Assessment, then per-field correct answers) and survey questions (Settings → Survey, then per-field scale configuration). Same fix, same three parts.

---

### 1.2 The Field Inspector is twenty-one sections in a fixed order *(P4, P3)*

**What happens now**

Selecting a field opens a panel containing, in this order: Survey Question, Basic Properties, Constraints & Defaults, Options Configuration, Display Configuration, Table Configuration, File Upload Settings, External Validation, Smart Connections, Data Calculations, Conditional Visibility, Input Validation, Table Validation, Custom Alerts, Support Documents, Poll Question, Assessment Scoring.

Most are hidden for most field types, but the ones that remain are still a long scroll, and the order is arbitrary from the user's point of view. "Smart Connections", "Data Calculations" and "External Validation" are three different advanced features whose names do not distinguish them.

**Proposed fix**

1. **Two tiers, not one list.** A short **Basics** section always open at the top — label, help text, placeholder, required — covering what nine out of ten edits need. Everything else moves behind a single **Advanced** disclosure, collapsed by default.
2. **Group the advanced items into four named groups** with plain names:
   - **Answers** — options, defaults, min/max, validation rules
   - **When to show this** — conditional visibility
   - **Check the answer** — input validation, external lookups (currently "External Validation"), custom alerts
   - **Use the answer elsewhere** — calculations, field linking (currently "Smart Connections")
3. **Rank by relevance.** Sections the field already uses sort above ones it does not, with a small dot marking configured sections so a person can see at a glance what has been set on this field.
4. **Rename**: "Field Inspector" → **"Question settings"**. "Smart Connections" → **"Copy answers between questions"**. "External Validation" → **"Check against another system"**.

---

### 1.3 "Canvas / Preview / Settings" is a hidden mode switch *(P2)*

**What happens now**

The three modes live in a small segmented control centred in the top bar, absolutely positioned between the form name and the action buttons. On a narrow window it collides with both. "Settings" gives no clue that form type, payments, authentication, branding, and file uploads all live behind it.

**Proposed fix**

- Move the switch to the left, immediately after the form name, where the eye lands first.
- Rename **Settings** → **Form setup** and give it a badge with the number of features currently switched on, so it reads as somewhere with contents rather than a dead end.
- Add a **What's set up** summary as the first thing inside Form setup: a short list of everything currently enabled (Poll · One vote per email · Payment £25 · Email verification), each a link to the section that controls it. This is the missing map of the editor.

---

### 1.4 Settings has ten tabs with no hierarchy *(P2)*

**What happens now**

General, After submit, Access, Team, Appearance, Authentication, Payment, Assessment, Voting, Survey — all equal weight, all always visible. Assessment, Voting and Survey are mutually exclusive form *types*, but they sit as peers alongside Appearance, which is not.

**Proposed fix**

1. **Ask the form type once, at the top, as a choice** rather than as three checkboxes in three tabs:
   > **What kind of form is this?**
   > ( ) Collect answers ( ) Poll or vote ( ) Quiz or assessment ( ) Survey
2. **Show only the matching tab.** Choosing "Poll or vote" reveals a Voting tab and hides Assessment and Survey. Three mutually exclusive checkboxes in three separate tabs is a state machine drawn as a form.
3. **Group the remaining tabs** into *Form* (general, type, appearance, after submit) and *Who can use it* (access, authentication, payment, team).

---

### 1.5 Publishing has no pre-flight check *(P5)*

**What happens now**

Publish saves and publishes. There is no check for: a poll with no counted question, an assessment with no correct answers, a payment form with no amount, a required field hidden by a conditional rule, an email-limited poll with no email field, or a form with no fields at all.

**Proposed fix**

A **pre-publish check** that runs on click and shows a short list before the form goes live:

> **Ready to publish — 1 thing to look at**
> ⚠ This poll doesn't count any questions yet. *Fix this*
> ✓ 6 questions, 2 required
> ✓ Responses go to the Marketing team
>
> [Back to editing] [Publish anyway]

Blocking only for errors that guarantee a broken form; warnings otherwise. The point is that the person finds out now rather than from an empty chart next week.

---

### 1.6 Save and Publish are indistinguishable *(P5)*

**What happens now**

Two adjacent buttons of near-identical size. A published form that has been edited but not re-published shows "Published", which is true of the live version and false of what is on screen.

**Proposed fix**

- One state line in the header: **"Draft"**, **"Published"**, or **"Published · 3 unpublished changes"**.
- Autosave the draft and replace the Save button with a quiet "Saved 2 minutes ago". Publish becomes the only button, which is the only decision that has consequences.

---

## Part 2 — Response pages

### 2.1 The Submissions tab *(fixed — described here for completeness)*

**What it was:** a narrow left column of cards each showing "Response #12", two arbitrary field values, and a date at nine and ten pixels; pagination wedged into the bottom of that column; a detail pane that opened with submission ID, IP address and user-agent string.

**What it is now:** a table whose columns are the questions people were asked, with a picker for choosing which. Three numbers above it (total, unread, most recent). A full-width footer that reads "Showing 21–40 of 143 responses" with a page size. Opening a response slides in plain question-and-answer pairs, with submission ID, IP address and browser collapsed behind "Technical details".

### 2.2 Tab names describe the machine *(P3)*

"Results", "Poll results", "Analytics", "Leaderboard" and "Audit log" appear or vanish depending on form type, with overlapping meanings — a voting form shows both "Results" and "Poll results".

**Proposed fix:** name tabs after the question they answer. **Responses** (individual answers), **Summary** (charts and totals), **Who voted** (the audit log, for voting forms only). Never show two tabs whose names a user cannot tell apart.

### 2.3 Access levels are stated in role vocabulary *(P3)*

The header can show "Aggregate only", "Responses, identifying fields hidden", or "Full responses and export" — accurate, and meaningless without the RBAC documentation open.

**Proposed fix:** say what the person can and cannot do. *"You can see totals and charts for this form, but not individual answers."* Keep the short label as a tooltip for people who know the model.

### 2.4 Search silently covers one page only *(P5)*

Searching filters the responses currently loaded, not the form's responses. On a form with 500 responses and 50 per page, a search for a customer's name finds nothing 90% of the time and says "No matching responses".

**Proposed fix:** short term — the empty state now says search covers this page only. Proper fix — move search to the server so it covers everything, and show "Searching all 500 responses".

---

## Part 3 — Dashboard, forms, and navigation

### 3.1 The dashboard reports, but does not suggest *(P5)*

Four counters, a recent-forms list, and a team breakdown. Accurate, and it never says what to do next: no "3 forms have responses you haven't read", no "This form has had no responses in 30 days — is the link still shared?".

**Proposed fix:** one "Needs your attention" strip above the counters, populated only when there is something to say. Unread responses, a draft untouched for two weeks, a published form with zero responses. Empty when everything is fine, and therefore trustworthy when it is not.

### 3.2 The forms list does not show what a form *is* *(P5)*

Each card shows a name, a published/draft badge, a team, and a date. Not shown: whether it is a poll, quiz or survey; how many responses it has; whether anyone has read them; whether it has been edited since publishing.

**Proposed fix:** add a type chip and a response count to each card, and make the response count the primary click target — for a published form, seeing responses is a more common intention than editing questions.

### 3.3 Empty states describe, rather than help *(P5)*

"No teams yet." "No submissions yet." Full stop, no next step.

**Proposed fix:** every empty state gets one sentence of orientation and one button. *"Teams decide who can see which forms. Everyone starts in the General team."* → **[Create a team]**

### 3.4 The organization switcher gives no warning *(P2)*

Switching organizations changes what every subsequent screen means, with no confirmation and no persistent indicator beyond the switcher itself. A person who switches, gets distracted, and comes back has no obvious cue that they are now looking at a different workspace.

**Proposed fix:** keep the current organization name visible in the page header, not only in the sidebar switcher. On switch, show a brief toast: *"Now viewing Acme Marketing."*

---

## Part 4 — Teams, members, roles

### 4.1 Three screens for one mental model *(P2)*

Teams, Members and Roles are separate pages, and understanding access means holding all three in your head at once: a person has an organization role, may belong to teams, and teams own forms. Nowhere is that sentence written down in the product.

**Proposed fix:**

1. **One explanatory paragraph** at the top of each of the three pages, saying how that page relates to the other two. Three sentences, written once.
2. **A "Who can see this form?" answer in the form itself.** From the editor, Team and sharing should show the resolved list of people, not the rule that produces it: *"7 people can see responses to this form: the 5 members of Marketing, plus Anita and Ravi who were shared directly."*

### 4.2 Role names are not self-explanatory *(P3)*

Owner, Admin, Creator, Analyst, Viewer. "Creator" and "Analyst" are guesses without the hint text. The hints exist in the code (`roleHint`) but are not shown at every point of choice.

**Proposed fix:** never show a role name without its one-line consequence, in every dropdown and every table cell. *"Analyst — reads and exports responses; cannot change the questions."*

### 4.3 Custom roles are a permission checklist *(P4)*

Creating a role means ticking boxes from a flat list of action names (`VIEW_AGGREGATE`, `EXPORT_RESPONSES`, `MOVE_FORM`). These are API action constants shown to a business user.

**Proposed fix:** group permissions under plain headings (**Forms**, **Responses**, **People**, **Organization**), label each in human terms ("Download responses as a spreadsheet"), and offer three starting points — *Like Analyst*, *Like Creator*, *Start empty* — so a new role begins from something recognisable.

---

## Part 5 — The public form

This is the screen most people see, and most of them will only ever see it once.

### 5.1 Errors appear at the top, away from the problem *(P5)*

A failed submission shows a banner above the form. On a long form the banner is off-screen and the invalid field is not scrolled to.

**Proposed fix:** scroll to and focus the first invalid field, and summarise in the banner as a list of links: *"3 answers need attention: Email address, Phone number, Date of birth."*

### 5.2 Required fields are marked, optional ones are not *(P6)*

On a form where most fields are required, the asterisks become noise and the few optional fields are indistinguishable.

**Proposed fix:** when more than half the fields are required, invert it — mark the optional ones "(optional)" and drop the asterisks.

### 5.3 Multi-step forms do not say how long they are *(P5)*

The stepper shows the current step. It does not say how many remain or roughly how long the whole thing takes, which is the number that decides whether someone starts at all.

**Proposed fix:** "Step 2 of 4 · about 3 minutes left", with the estimate derived from the number and type of remaining fields.

### 5.4 File upload limits are discovered by failing *(P3, P5)* — **partly fixed**

Limits were previously enforced after the file was chosen, and the form-level limits were not applied in the browser at all, so a person could pick a file, wait, and be refused by the server.

**Now:** the browser applies the same limits the API does, from a shared policy module, and the file picker filters to accepted types.

**Still to do:** state the limit *before* the person opens the picker — "PDF or Word, up to 10 MB" under the upload button, not only in the error.

---

## Part 6 — Sign-up and first run

### 6.1 The first thing a new user must do is name something *(P2)*

After signing up, the person lands on organization setup and is asked for a workspace name and URL slug before seeing the product. They have no basis for either decision yet.

**Proposed fix:** default the organization to the person's name ("Priya's workspace"), pre-fill the slug, and let them proceed with one click. Renaming later is one field in settings; being blocked on the doorstep is not recoverable.

### 6.2 There is no first form *(P5)*

A new, empty organization offers "Create form" and a blank canvas.

**Proposed fix:** offer three starting points on the empty dashboard — **Contact form**, **Event RSVP**, **Quick poll** — each a working form in two clicks. A poll built from a template also demonstrates the two-step configuration from §1.1, which teaches the model far better than documentation would.

---

## Part 7 — Cross-cutting: language and legibility

### 7.1 Terms to rename *(P3)*

| Currently | Proposed | Why |
|---|---|---|
| DMS File Storage | File uploads | Nobody outside the company knows what DMS is |
| Field Inspector | Question settings | "Inspector" is a developer tool |
| Bot protection: Turnstile | Bot protection | The vendor is an implementation detail |
| Duplicate Prevention | One vote per person | Says the outcome, not the mechanism |
| Smart Connections | Copy answers between questions | Current name says nothing |
| External Validation | Check against another system | As above |
| Processing status | (hide it) | Internal queue state, now behind "Technical details" |
| Aggregate / Redacted / Blind review | Sentences, not labels | See §2.3 |

### 7.2 Type is too small *(P6)*

Nine- and ten-pixel text is used for content, not just for labels: response previews, metadata, help text, empty-state copy. Combined with `text-muted-foreground` on a light background this falls below WCAG AA contrast in several places.

**Proposed fix:** a floor of 12px for anything a person reads, 14px for content, and reserve 10–11px for uppercase labels only. The redesigned Submissions tab is built to this rule and can serve as the reference.

### 7.3 Help text explains the control, not the consequence *(P3)*

Most hint text restates the label. *"Enable DMS File Storage — Store uploaded files in the Document Management System instead of inline."*

**Proposed fix:** every hint answers "what changes for the people filling in my form?" *"People can attach images and PDFs up to 10 MB. Larger files are refused before they upload."*

---

## Suggested order of work

Ranked by how much learning curve each removes per unit of effort.

### Now — the reported problem and its siblings
1. Poll questions selectable from the Voting panel, with sensible defaults (§1.1)
2. The same treatment for assessment scoring and survey questions (§1.1)
3. Pre-publish check (§1.5)
4. "What's set up" summary at the top of Form setup (§1.3)

### Next — the editor's shape
5. Field Inspector: Basics / Advanced, four groups, plain names (§1.2)
6. Form type as one question; hide the tabs that do not apply (§1.4)
7. Autosave; one clear published state (§1.6)

### Then — everything else
8. Rename the terms in §7.1 (one pass, low risk, high effect)
9. Type-size floor and contrast pass (§7.2)
10. Empty states and the "Needs your attention" strip (§3.1, §3.3)
11. Role hints everywhere; permission grouping (§4.2, §4.3)
12. Public form: error focus, length estimates, upload limits stated up front (Part 5)
13. Server-side response search (§2.4)
14. Onboarding templates (§6.2)

---

## What has already been done

Delivered in this branch, and referenced above where relevant:

- **Submissions tab rebuilt** as a readable table with proper pagination and a plain-language detail panel (§2.1)
- **File upload limits** now enforced identically in the browser and the API, from a shared policy module (§5.4)
- **"DMS File Storage" enable toggle removed** — uploads always go to DMS, so the setting only asks what it needs to: size and file kinds (§7.1)
- **Bot protection is a real setting** with a plain-language warning when it is switched off, instead of an unexplained "Always on" badge
- **Organization switching no longer hangs** — the spinner that never resolved after switching between three organizations, and the "canceled" error banners that came with it
