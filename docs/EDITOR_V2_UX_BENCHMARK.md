# Editor V2 — final prototype decisions

Research date: 2026-09-08. Scope: public product documentation and current search results, not authenticated hands-on testing. Documentation may describe established patterns rather than changes introduced in 2026. The HTML is the intended interaction design for the core form-building workflow, not a production implementation of every SifyForms capability.

## Benchmark

| Product | Evidence / observed pattern | Decision for SifyForms |
|---|---|---|
| Typeform | Click blocks to configure; rearrange questions; explicit publish transfers edits to the live version. [3](https://www.typeform.com/forms), [2](https://help.typeform.com/hc/en-us/articles/360029423551-FAQ) | Clear selected state and deliberate publishing; do not import AI creation or conversational navigation. |
| Jotform | Top-level Settings and Publish; columns are nested in Advanced Designer. Draft/publish separation is explicitly supported for Enterprise. [4](https://www.jotform.com/help/1205-how-to-change-the-access-settings-of-a-form/), [5](https://www.jotform.com/help/423-setting-up-form-columns/), [2](https://www.jotform.com/blog/announcing-draft-and-publish-for-jotform-enterprise/) | Keep prominent global actions; make layout shallower rather than copying advanced nesting. |
| Tally | Document-style insertion via slash menu and search; keyboard commands for input and layout blocks. [3](https://tally.so/help/keyboard-shortcuts) | Searchable on-demand picker, no permanently occupied palette. Visible Add field avoids requiring shortcut knowledge. |
| Google Forms | Top-level Settings with grouped responses/presentation; separate theme side panel; preview from upper toolbar. [4](https://support.google.com/a/users/answer/13138098?hl=en), [1](https://support.google.com/docs/answer/145737?hl=en), [2](https://support.google.com/a/users/answer/9303071?hl=en) | Familiar top toolbar; improve discoverability by grouping appearance and behavior under a labeled Form settings entry. |
| Fillout | Click or drag fields from palette; contextual right panel; compatible type changes; advanced styling disclosed under Theme. [5](https://www.fillout.com/help/question-types), [2](https://www.fillout.com/help/advanced-designer) | Contextual field configuration, duplication, immediate feedback. Palette is not necessary for our compact core catalog. |
| forms.app | Design groups themes and Layout, with list/step views. [2](https://forms.app/en/help-center/how-to-customize-your-form-design) | Group layout and appearance in one global settings destination. Only expose implemented layouts. |
| Paperform | Slash menu supports searching and keyboard selection; clicking a question opens configuration on the right. [5](https://paperform.co/help/articles/slash-commands-overview/), [3](https://paperform.co/help/articles/price-field/) | Combine low-clutter insertion with contextual configuration; avoid hidden-only commands. |
| Zoho Forms | Clicking field opens Properties; common labels and mandatory settings precede advanced properties. Theme customization groups general/header/fields/container/buttons. [2](https://help.zoho.com/portal/en/kb/forms/field-types/field-properties/articles/field-properties), [1](https://help.zoho.com/portal/en/kb/forms/themes/standard-forms-theme-builder/articles/customizing-your-new-standard-form) | Distinct field and form scope, simple default properties, progressive disclosure. Do not reproduce enterprise configuration density. |

2026 comparison cross-check: [4](https://www.formgrid.com/blog/tally-vs-google-forms) describes the distinction between document-first and traditional builders. Vendor documentation above is the primary evidence; comparison rankings and marketing claims are not treated as usability test results.

## Critical review of previous mockup

The previous 2,233-line reference retained a persistent field palette alongside insertion mechanisms, multiple settings sub-navigation levels, AI-related controls, annotation UI, and advanced features whose buttons frequently only raised a toast. Its setup/form/layout division obscured the scope of controls. Keeping this structure would preserve the problem rather than solve it.

## Final information architecture

- Header: form identity, honest session-only status, Form settings, Preview, Publish.
- Canvas toolbar: searchable Jump to field (temporary, not a sidebar), Add field, undo/redo.
- Canvas: numbered selectable fields; selected field exposes move up/down, duplicate, delete. Drag handle provides pointer reordering; move buttons provide a keyboard/touch equivalent.
- Field settings: type, label, help, placeholder where relevant, options for choice types, required; collapsed validation and visibility rule. Conditions reference earlier fields only, preventing cycles. Reordering/deletion clears invalid rules with an announcement.
- Form settings: dedicated modal drawer with General (title/description), Layout (columns/width/spacing), Appearance (accent/font/corners), Submission (button/confirmation/repeat response). Live application, no redundant Save; Done closes. Contextual field panel remains underneath, not repurposed for global settings.
- Preview: desktop/mobile viewport simulation, actual native inputs, matching validation/visibility/layout/theme, local confirmation state. No responses transmitted or retained.
- Publish: local snapshot and explicit simulation status; later edits marked unpublished. No pretend public URL or fake copy-link action.

## Scope boundaries

No AI, APIs, auth, database, localStorage, tracking, external assets, integrations or real submissions. Notifications, payments, external validation, assessment scoring and other server-dependent features are deliberately not exposed as dead controls. Core field types: short/long text, email, number, phone, date, dropdown, single/multiple choice and file. File selection is local only. General title and all visible configuration have observable effects. Empty forms and missing labels/options block publishing with actionable errors.

## Validation approach

Browser checks cover insertion/search/no results, selection, label/options edits, reorder/duplicate/delete and undo, all settings categories, preview required/type/length validation and conditions, local publish/update states, mobile overflow, Escape/focus return, and keyboard dialog containment. Automated results and limitations are recorded in the accompanying test notes. First-time comprehension still warrants moderated user testing; benchmark-informed design is not a substitute for that.
