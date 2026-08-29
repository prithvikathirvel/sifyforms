# Edit, Preview, and premium published-form product guide
## Recommended experience for exam registration and other high-trust workflows

**Review date:** 2026-08-28 (UTC)
**Audience:** product, design, frontend, backend, security, accessibility, and exam operations teams.

This guide turns the security review into a product plan. The goal is a powerful editor and a polished respondent experience without allowing the browser, a form author, or a high-traffic deadline to become a security or reliability boundary.

## 1. Product principles

1. **Author once, publish an immutable contract.** Draft changes are safe to experiment with; a published revision is the exact contract used to validate, score, charge, and display a submission.
2. **The browser is an assistant, not an authority.** It can offer instant feedback and offline convenience. The server decides authorization, eligibility, accepted values, payment, identity, files, scoring, and result visibility.
3. **Complexity should be visible.** An editor should understand whether a field is public, sensitive, calculated, externally validated, paid, or used in assessment. Hidden dependencies must not surprise the author or respondent.
4. **Trust is part of the interface.** Tell a respondent who operates the form, why data is collected, how long it is retained, what documents are required, and what will happen after payment.
5. **High-stakes forms optimize for recovery.** Network failures, expired sessions, a replaced document, a wrong answer, or a payment retry should be recoverable without duplicate registration or lost data.
6. **Accessible by construction.** Keyboard, touch, screen readers, zoom, low bandwidth, localization, and assistive technology are primary modes, not an audit at the end.

## 2. Information architecture for the Edit page

### Workspace layout

Use a responsive three-pane workspace:

- **Left: Form outline and palette** — sections/steps, searchable field palette, reusable blocks, field status badges, and a filter for errors/warnings.
- **Center: Canvas** — the current page/step rendered close to respondent appearance, with a device preview switcher and insertion markers.
- **Right: Inspector** — content, validation, logic, data/privacy, appearance, and advanced integration tabs for the selected field.
- **Top bar:** form name, organization/team, draft/published status, revision number, last saved by/time, Undo/Redo, Preview draft, Validate, Save, Publish, and a guarded More menu.

The top bar must show the server's authoritative state. A button being hidden because a role lacks permission is helpful UX; it is not the backend control. On every request, the API must re-check the capability against the form's current team, share, policy, and revision.

### Form outline

The outline should show:

- section/step names and stable order;
- field label plus stable short ID on hover;
- required, sensitive, calculated, externally validated, file, payment, and error badges;
- unresolved references, duplicate IDs, cycles, and unreachable conditions;
- drag handles with keyboard move controls;
- search by label, ID, type, or dependency;
- collapse/expand and “focus canvas” behavior;
- a confirmation when deleting a field that is referenced by rules, calculations, exports, payment, or scoring.

Do not use array index as field identity. Generate an opaque stable ID server-side or through a collision-safe client library, validate uniqueness, and retain an ID migration map when a field type changes.

## 3. Editor workflows

### Create and configure

1. Pick a template or start blank.
2. Select the target organization/team and show the effective role before creation.
3. Set title, purpose, language, respondent audience, deadline/timezone, and data classification.
4. Add sections and fields from the palette.
5. Configure content and validation with examples.
6. Configure logic/calculations through a safe visual builder.
7. Run security/privacy/accessibility preflight.
8. Preview a draft with mock integrations.
9. Submit for review/approval if the organization requires it.
10. Publish an immutable revision and show the resulting public URL/version.

### Save, collaborate, and publish

- Use revision numbers or ETags on every save. If another editor changed the draft, present a three-way conflict view rather than silently overwriting it.
- Autosave after an explicit edit debounce, with “Saved”, “Saving”, “Offline”, “Conflict”, and “Needs attention” states. Queue safe retries with an idempotency key.
- Keep the draft and published revision visually comparable. Show additions, removals, changed validation, changed payment, changed privacy, changed answer keys, and changed external integrations.
- Publish should call a server preflight and atomically promote a complete revision. It must not be equivalent to setting `isPublished` in a generic update request.
- Support rollback to a prior immutable revision while preserving already-submitted records' original revision binding.
- Require an explicit confirmation for changes to required fields, identity/privacy policy, payment amount, answer keys, eligibility, retention, and public result visibility.
- Maintain an audit timeline: who changed what, when, from which revision, who published/approved it, and when a sensitive setting was accessed.

## 4. Inspector design

### Content tab

- Label, short label, help text, placeholder, description, accessible name, and error message.
- Character counter and rendered-length preview with server-enforced limits.
- Localization tabs that show fallback behavior and missing translations.
- Option editor with stable option IDs, label/value separation, deduplication, bulk import preview, and search.
- Do not allow raw HTML by default. For instructions, use safe Markdown or a server-sanitized rich-text subset with a preview and blocked tags/attributes list.

### Validation tab

Show a structured rule builder rather than a code text box:

- required/optional and conditional required;
- text length and Unicode normalization;
- number type, finite value, range, precision, and unit;
- date/time format, timezone, min/max, blackout days;
- email/phone policy and normalization;
- choice membership, cardinality, mutually exclusive options;
- file count, actual content type, maximum bytes, extension policy, and scan status;
- uniqueness scope and normalization rule;
- a live test case editor with expected accepted/rejected result.

Each rule gets a stable ID, a clear order, an explanation, and a server error path. Reject conflicting rules and detect dangerous regular expressions before save.

### Logic and calculations tab

Use a visual dependency graph:

- condition: `field` / `operator` / `value` or another field;
- action: show, hide, require, disable, set default, filter options;
- calculation: approved arithmetic/date/aggregate nodes;
- preview/test with named sample data and step-by-step explanation;
- warnings for circular references, hidden required fields, conflicting actions, type mismatch, and formulas that use a value not available at submit time.

Do not expose JavaScript `functionBody`, `new Function`, `eval`, constructors, global objects, or arbitrary member access. If a special operation is needed, add and review a named server-side function with typed inputs, bounded runtime, and tests.

### Data and privacy tab

Every field should show:

- data category: public, operational, personal, sensitive personal, financial, identity, document, or assessment secret;
- why it is collected and respondent-facing description;
- retention and deletion behavior;
- who may see it: no one/aggregate/redacted/full/export;
- whether it is used for eligibility, uniqueness, payment, notifications, analytics, or scoring;
- whether it is identifying even if the label looks generic;
- consent/legal basis and versioned notice.

A form author must not weaken an organization-level anonymity promise just by setting `isIdentifying: false`. Escalate policy exceptions to an authorized privacy role.

### Files tab

Configure through an administrator-controlled policy:

- allowed content signatures/MIME classes;
- per-file, per-field, per-submission, per-form, and per-tenant byte limits;
- number of files and replacement behavior;
- encryption, retention, scan/quarantine state, and download audience;
- direct upload session status;
- filename normalization and respondent-visible download name.

The editor should explain that browser MIME and extension are hints only. The server/DMS performs the authoritative signature and malware checks.

### Integrations and payment tab

- Show a connector name and health, not raw URL/password/token fields.
- Store credentials in a secret manager; let the editor select an approved connector and allowed operation.
- Display egress/data residency, request timeout, response mapping, quota, and failure behavior.
- Provide a mock/test connector with synthetic data and a redacted request preview.
- For payment, configure product/fee rules that resolve on the server, currency, refund policy, receipt, webhook state, and reconciliation owner. Never expose merchant secrets or trust a client amount.

## 5. Preview page specification

### Modes

Preview should be a first-class route available for an unpublished draft through a short-lived, signed preview token. It should support:

- desktop, tablet, and mobile viewport previews;
- light/dark/contrast themes and organization branding;
- respondent as anonymous, verified, returning draft owner, ineligible, eligible, and accessibility-device user;
- language and right-to-left direction;
- empty, partially complete, boundary, invalid, and maximum-length sample datasets;
- each conditional branch, dynamic option path, file error, payment path, and result policy;
- slow network/offline/reconnect simulation;
- final review, success, failure, expired deadline, and queue-pending states.

The preview header must clearly state **Draft preview**, revision/hash, environment, and whether an integration is mocked. It should never be mistaken for the live public form.

### Side-effect isolation

By default, Preview must not:

- send a real OTP, email, SMS, notification, or webhook;
- call an arbitrary external validation URL;
- create a real payment order or tell the user payment succeeded;
- persist a real submission or count a vote;
- store a permanent document or send a document to a production DMS;
- expose answer keys in a public preview token.

Use isolated mock connectors and a preview database. If an owner explicitly tests a sandbox payment/upload, show the environment and expire the token quickly.

### Preview checks

A “Run preflight” panel should report:

- missing/duplicate/dangling IDs and circular dependencies;
- fields with no accessible label/name, poor contrast, invalid keyboard order, or unclear errors;
- oversized manifest/bundle, slow images, unsupported browsers, and missing loading/error states;
- privacy classification/notice/retention gaps;
- file policy and DMS scan configuration;
- unsafe or unapproved URLs/connectors;
- payment amount consistency and refund/currency configuration;
- result visibility/answer-key leakage;
- server validation differences from client rules;
- localization gaps and long-label overflow;
- revision changes that require approval.

Provide “copy test case” and “open issue” actions. A warning should link directly to the relevant inspector property.

## 6. Premium published exam-registration experience

### Landing and trust panel

The first screen should answer “What is this, who operates it, and what do I need?”

- verified organization mark and exam/session name;
- registration open/close date with timezone and current status;
- expected completion time and document/payment checklist;
- support phone/email and accessibility assistance;
- privacy notice, terms, refund policy, and data retention summary;
- language selector and a link to save/resume instructions.

Use a calm visual hierarchy: one primary action, restrained color, generous spacing, and no distracting cross-sells or trackers.

### Step structure

A recommended sequence:

1. **Welcome and eligibility notice** — prerequisites, deadline, consent to continue.
2. **Identity and contact** — server-verified respondent identity and normalized contact information.
3. **Personal details** — name, date of birth, category, address, and accessibility needs with clear sensitivity notices.
4. **Academic/qualification details** — accessible repeatable rows, board/institution search, year/grade policy, and conversion help.
5. **Exam preferences** — subject, center, language, accommodations, and capacity-aware availability.
6. **Documents** — required document cards, direct upload, progress, scan status, replace/remove, and clear permitted formats.
7. **Declaration and consent** — versioned declaration, terms copy, privacy purpose, and required acknowledgements.
8. **Review** — grouped summary, edit links, missing/error list, masked PII, revision/terms version, and final confirmation.
9. **Payment** — server-sourced line items, currency, fees, refund rules, verified gateway status, and safe retry.
10. **Receipt** — immutable non-sensitive application reference, verified status, PDF/download, email delivery option, and support instructions.

The user should always know which step is complete, which has errors, and what happens if they leave.

### Responsive interaction details

- Keep a compact sticky progress bar on mobile and a full step rail on desktop.
- On validation failure, move focus to a summary and link each error to its field; do not rely on red borders alone.
- Preserve scroll position and entered values after an upload, validation response, or payment redirect.
- Disable only the final action while an idempotent request is in flight; show a request reference and a safe retry path.
- Show server-owned countdowns/deadlines, not only the device clock. Handle an expired form gracefully with a read-only explanation.
- Lazy-load document previews and nonessential illustrations; keep the critical form shell and accessibility code in the initial bundle.
- Avoid rendering sensitive values into analytics events, URL parameters, browser titles, or third-party scripts.

### Completion and follow-up

After a successful server-confirmed registration:

- show “Submitted/Payment verified” with the reference and exact timestamp/timezone;
- offer a receipt download from an authorized, expiring URL;
- provide an optional email/SMS confirmation without putting full PII or secrets in the message;
- explain how to correct information, request deletion, or contact support;
- if processing is asynchronous, show “Received—processing” with a safe status token, not a fake completed score;
- if payment is pending, distinguish it from successful submission and explain reconciliation.

## 7. Accessibility and localization acceptance criteria

- WCAG 2.2 AA target for the published page, including focus visibility, contrast, reflow/zoom, keyboard operations, pointer cancellation, status messages, and error identification.
- Every control has a programmatic label and an associated help/error description.
- Error summary receives focus, links to fields, and remains understandable when steps change.
- Screen-reader users can identify step, required state, upload progress, scan state, payment status, and success/failure without visual context.
- Touch targets and keyboard drag alternatives are provided; no essential gesture-only interaction.
- Text expansion testing covers at least 200% size and the longest supported translations.
- Locale-aware date/number/currency formatting is server-consistent; timezone and calendar are explicit.
- Right-to-left layouts, mixed-script names, Unicode normalization, and transliteration policy are tested without changing stable IDs.
- Automated axe/pa11y checks supplement manual keyboard and screen-reader runs; neither replaces real assistive-technology testing.

## 8. Frontend performance and reliability budget

Set explicit budgets for the public page:

- keep the critical published-form JavaScript split from builder/admin/AI code;
- use CDN immutable assets and a small sanitized manifest;
- target a fast first render on a low-end mobile device and 4G/slow-3G profile;
- lazy-load optional field controls, PDF/document preview, charts, and payment SDKs;
- compress images and reject oversized author assets during preflight;
- avoid rerendering the whole form on every keystroke; memoize field/step boundaries and virtualize very large option lists;
- cap local draft size and never store tokens, payment secrets, or full sensitive documents in local/session storage;
- use abortable fetches, bounded retries, backoff/jitter, and an offline-safe queue for drafts only;
- collect real-user metrics with sensitive fields excluded: LCP/INP/CLS, form step latency, upload time, submission acceptance time, and error rate.

## 9. Release checklist

### Editor

- [ ] All editor reads/mutations pass server-side action and form/team/share authorization.
- [ ] Draft/public revisions are separate, immutable after publish, and conflict protected.
- [ ] Preflight detects unsafe URLs, secrets, code, references, rules, privacy, accessibility, and performance issues.
- [ ] Formulas use a safe typed expression language; no `new Function`/`eval` path remains.
- [ ] Private answer keys, payment credentials, external auth, and notification settings never enter the public DTO.
- [ ] Save, publish, duplicate, move, share, delete, AI, CSV, file, and export actions are audited and quota-controlled.

### Preview

- [ ] Draft preview is signed, short-lived, clearly labeled, and side-effect isolated.
- [ ] All branches, validation boundaries, locales, viewports, failures, files, payment states, and accessibility paths are testable.
- [ ] Preview never calls production payment/OTP/email/webhooks or stores permanent files by accident.

### Published respondent page

- [ ] Public DTO contains only respondent-safe fields and revision metadata.
- [ ] Server verifies respondent session/OTP where configured, CAPTCHA token, upload ownership, payment/webhook state, and idempotency.
- [ ] Hidden/disabled/choice/file values are canonicalized and validated against the published revision.
- [ ] Result/aggregate visibility, correct-answer release, privacy policy, and retention are enforced server-side.
- [ ] Errors are accessible, generic where enumeration is a risk, and do not echo secrets or internal connector responses.
- [ ] CDN/cache keys, CSP, CORS, referrer policy, external navigation, and remote content are reviewed.

## 10. Recommended implementation order

1. Remove unsafe code execution and public secret/answer-key exposure.
2. Centralize server authorization and build the public/editor/result DTO split.
3. Implement immutable revisions, canonical validation, server authentication/session, idempotency, upload sessions, and payment state.
4. Build safe Draft Preview and preflight; use it to prevent unsafe configurations before publish.
5. Redesign the respondent flow around steps, review, recovery, accessibility, and verified receipt.
6. Add queue/cache/CDN/observability and run the production scale plan in `docs/PRODUCTION_READINESS_AND_SCALE.md`.
