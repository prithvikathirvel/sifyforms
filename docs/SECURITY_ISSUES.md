# Security Issues Analysis

This review covers the SifyForms frontend and backend as of 2026-08-26. Issues are ordered by severity. Each item describes the current risk, how it can be exploited, the recommended fix, and the impact if it is left unfixed.

---

## Critical

### 1. Public form schema leaks assessment answers

**Where:** `GET /api/forms/public/:orgSlug/:formSlug` (`form.service.ts` → `getPublicForm`)

**Issue:** The published form payload includes the full field schema, including `correctAnswer` and `points`. Anyone who opens the form can read the answer key from the network response and score 100% without knowing the material.

**Fix:** Strip scoring fields (`correctAnswer`, `points`, and any other assessment-only metadata) from the public form response. Keep them only on authenticated builder/admin endpoints.

**Impact if unfixed:** Assessments are trivially cheated. Rankings, pass/fail, and any downstream HR or exam decision based on the score become untrustworthy.

---

### 2. Hardcoded OTP (`1234`) on public forms

**Where:** `src/pages/PublicFormPage.tsx` (`verifyOtp`)

**Issue:** Form authentication is presented as email/phone OTP, but the code always accepts `1234`. There is no SMS/email send. Anyone who knows the gate exists can pass it.

**Fix:** Integrate a real OTP service. Generate a random code server-side, store a hash with a short TTL, send it to the claimed identity, and verify against the hash. Never accept a client-supplied or hardcoded code.

**Impact if unfixed:** Identity gating, unique-vote-by-email, and “save & resume” are bypassable. Attackers can impersonate any email/phone.

---

### 3. Server-side request forgery (SSRF) via External Validation

**Where:** `backend/src/lib/validation.ts`, `backend/src/service/submission.service.ts` (`checkExternalValidation`)

**Issue:** Form builders can set an arbitrary URL, method, headers, and body. The **server** then requests that URL. There is no allow-list, no block of link-local/private IPs, and no protocol restriction beyond whatever axios accepts.

**Fix:**
- Allow only `https:` URLs.
- Resolve DNS and reject private/link-local/metadata ranges (`127.0.0.0/8`, `10.0.0.0/8`, `169.254.169.254`, IPv6 equivalents).
- Optional: restrict hosts to an org-level allow-list.
- Do not forward builder-supplied `Authorization` headers to internal services.

**Impact if unfixed:** An org member who can edit a form can scan the internal network, hit cloud metadata endpoints, or use the app as an open proxy. This is a common cloud-compromise path.

---

### 4. Arbitrary code execution via `new Function` (calculation engine)

**Where:**
- `src/lib/calculationEngine.ts` (formulas and custom `functionBody`)
- `backend/src/lib/calculationEngine.ts`
- `src/components/ui/SubmissionViewer.tsx` (table formulas)

**Issue:** User-authored expressions are interpolated into `new Function(...)` and executed. Identifier sanitization is incomplete (it does not prevent access to function constructors, prototype chains, or unexpected globals once values are objects). Custom function bodies on the frontend run with the full browser capability of the page.

**Fix:** Replace `new Function` with a real expression interpreter (e.g. a tightly scoped math parser). Ban `mode: 'function'` bodies or run them in a sandbox with no DOM/`fetch` access. Never evaluate builder formulas in the submission viewer with `new Function`.

**Impact if unfixed:** A malicious form builder can run JavaScript in every respondent’s browser (token theft from `localStorage`, keylogging, crypto-mining). On the server, a crafted formula may escape the intended math sandbox.

---

## High

### 5. Auth tokens stored in `localStorage`

**Where:** `src/lib/api.ts`, `src/store/authSlice.ts`

**Issue:** Access and refresh tokens live in `localStorage`. Any XSS (see items 4, 14, 15) can read them and call the API as the user.

**Fix:** Prefer httpOnly, Secure, SameSite cookies set by the backend. If tokens must stay in JS (Keycloak SPA), keep the refresh token in a Secure cookie and shorten access-token TTL. Add a strict Content-Security-Policy.

**Impact if unfixed:** One XSS bug equals full account takeover for every signed-in user on that origin.

---

### 6. DMS download IDOR (cross-organization)

**Where:** `POST /api/dms/download/:documentId` (now partially mitigated)

**Issue (original):** Any authenticated org member could request a signed URL for **any** document ID. Guessing or leaking a UUID was enough to read another tenant’s files.

**What we changed:** Authenticated download now loads the DMS document and, when `metadata.orgId` is present, rejects mismatches with the caller’s org. Public download is a separate endpoint that only allows support docs and branding logos attached to a **published** form.

**Remaining work:**
- Persist `orgId` / `formId` metadata on every DMS object (already sent on initiate).
- If `GET /documents/:id` is unavailable, keep a local document registry.
- Confirm-upload on the public route still does not prove the caller initiated that document.

**Impact if unfixed:** Cross-tenant document disclosure; privacy and compliance failure for uploaded IDs, signatures, and support files.

---

### 7. Public DMS confirm is unauthenticated

**Where:** `POST /api/dms/upload/public-confirm/:documentId`

**Issue:** Knowing a `documentId` is enough to confirm an upload. Combined with a leaked initiate response, an attacker can finalize someone else’s incomplete upload or confirm a planted object.

**Fix:** Bind confirm to the initiate session (one-time token, short TTL, same IP/formId). Reject confirm if the document was not created via `public-initiate` for that form.

**Impact if unfixed:** Incomplete isolation of respondent uploads; possible object-status tampering.

---

### 8. Drafts are world-readable by identity string

**Where:** `GET/POST/DELETE /api/drafts` — no authentication

**Issue:** Drafts are keyed by `formId` + `identity` (email/phone). Anyone who knows or guesses that pair can read or overwrite another person’s in-progress answers.

**Fix:** Issue a server-side draft session after OTP verification. Require that session on draft CRUD. Rate-limit lookups. Do not accept a raw email/phone as the only secret.

**Impact if unfixed:** PII leakage from “save & resume” forms; attackers can inject answers into someone else’s draft.

---

### 9. Payment gateway secrets stored in form settings

**Where:** `FormSettings.payment` (Razorpay/Paytm/PayU keys), persisted in the form JSON and returned to any editor of the form.

**Issue:** Secret keys are saved in the same blob as public settings. They travel to the browser whenever the builder loads the form.

**Fix:** Store secrets only on the payment tenant/onboarding service. Persist `tenantId` in the form. Never echo secrets back to the client after onboarding.

**Impact if unfixed:** Anyone with form-edit access (or a stolen builder token) can drain or impersonate the merchant account.

---

### 10. Client-generated math captcha

**Where:** `PublicFormPage` generates `n1 ± n2`; `submission.service.ts` re-parses the same string.

**Issue:** The challenge and the answer both originate on the client. A bot can skip the UI and POST a consistent `captchaProblem` / `captchaAnswer` pair.

**Fix:** Generate the challenge server-side, store a signed token or server-side hash, and verify that token. Or use a real CAPTCHA (hCaptcha/Turnstile).

**Impact if unfixed:** The captcha does not slow automated submissions.

---

## Medium

### 11. Weak / default JWT secret

**Where:** `backend/src/utils/jwt.ts` — `process.env.JWT_SECRET || 'your-secret-key'`

**Issue:** If `JWT_SECRET` is unset, tokens are signed with a public default. The file is only used for the legacy HS256 path, but a misconfiguration is silent.

**Fix:** Fail startup when `JWT_SECRET` is missing or shorter than 32 bytes. Rotate any environment that used the default.

**Impact if unfixed:** Forged sessions if this signer is ever used.

---

### 12. 50 MB JSON body limit

**Where:** `backend/src/index.ts` — `express.json({ limit: '50mb' })`

**Issue:** Needed for inline base64 files, but a single unauthenticated `POST /api/submissions` can send 50 MB. Combined with weak captcha this is an easy memory DoS.

**Fix:** Keep a small JSON limit (e.g. 1 MB) now that DMS holds files. Rate-limit public routes globally, not only `/api/submissions`.

**Impact if unfixed:** Process OOM / event-loop stall under cheap traffic.

---

### 13. Open redirect via `settings.redirectUrl`

**Where:** `submission.service.ts` requires `https?://` but does not pin the host.

**Issue:** A published form can send respondents to any http(s) origin after submit. Combined with a lookalike domain this is a phishing vector.

**Fix:** Allow-list hosts per org, or only allow same-site paths.

**Impact if unfixed:** Credential harvesting after a legitimate-looking form submit.

---

### 14. `document.write` of third-party HTML (Paytm)

**Where:** `PublicFormPage` — `document.open(); document.write(html)` from the payment service.

**Issue:** The entire page is replaced with HTML from `apidev.sifymodernization.digital`. A compromise of that host becomes a full XSS on the form origin.

**Fix:** Redirect to a payment URL, or render the gateway in a sandboxed iframe. Do not `document.write` remote HTML.

**Impact if unfixed:** Stored/reflected XSS with the user’s form-origin privileges.

---

### 15. Unsanitized `document.write` of base64 images

**Where:** `SubmissionViewer` — `newWindow.document.write(\`<img src="${fileInfo.base64}" />\`)`

**Issue:** If `base64` is not a strict data-URL, the string is interpolated into HTML.

**Fix:** Assign `img.src = fileInfo.base64` on a created element, or use `URL.createObjectURL`. Never concatenate into HTML.

**Impact if unfixed:** XSS in the submissions admin view (high value: the reviewer is authenticated).

---

### 16. CORS / origin configuration

**Where:** `backend/src/index.ts` — `origin: process.env.FRONTEND_URL || 'http://localhost:12000'`

**Issue:** A single origin is fine, but a wildcard or reflected origin in production would expose cookie/credentialed APIs.

**Fix:** Keep an explicit allow-list. Never use `origin: true` with `credentials: true`.

**Impact if unfixed:** Cross-site API abuse from a malicious page.

---

### 17. Public processing endpoints

**Where:** `GET /api/processing/submissions/:submissionId/result/public`, `GET /api/processing/forms/:formId/poll-results`

**Issue:** Anyone who learns a `submissionId` (UUID) can poll the assessment result. Poll results are public even when `showResultsPublic` is false, unless the service checks it.

**Fix:** Gate public scorecards on a one-time submit token. Enforce `showResultsPublic` / `showResultsAfterVoting` on the server.

**Impact if unfixed:** Leakage of individual scores; early reveal of live vote totals.

---

### 18. Uniqueness check is unauthenticated and enumerates values

**Where:** `POST /api/submissions/check-unique`

**Issue:** Anyone can test whether a value (email, phone, employee ID) was already submitted.

**Fix:** Rate-limit tightly, require the form to be published, and only allow fields marked `unique`. Consider returning a generic message.

**Impact if unfixed:** User enumeration / PII confirmation.

---

### 19. DMS API key and tenant ID in environment with empty defaults

**Where:** `backend/src/config/dms.config.ts`

**Issue:** Empty `DMS_API_KEY` / `DMS_TENANT_ID` fail closed only when `DMS_ENABLED` is false. A production deploy with `DMS_ENABLED=true` and missing secrets will send unauthenticated calls to the shared DMS host.

**Fix:** If `DMS_ENABLED`, refuse to boot without a non-empty API key and tenant ID.

**Impact if unfixed:** Failed uploads or, worse, traffic hitting a shared/dev tenant.

---

### 20. Support documents previously failed to persist (availability / integrity)

**Where:** `FormFieldSchema.supportDocuments` required `url: z.string()`

**Issue:** DMS support docs have `documentId` and often no URL. Saving the form failed validation, or the document id never reached the public form. Respondents then could not download the intended file.

**What we changed:** The schema now accepts `mode`, `documentId`, `fileName`, `fileType`, and optional `url`/`fileData`. Public preview downloads go through `/api/dms/download/public/:documentId` and only succeed if that id is attached to the published form.

**Impact if unfixed:** Broken legal/help documents on live forms; builders think a file is attached when it is not.

---

## Low

### 21. Console logging of auth/org data

**Where:** `auth.middleware.ts` logs `orgUser`; public form logs support documents; external validation logs full request/response bodies (including bearer tokens).

**Fix:** Remove PII and secrets from logs. Use structured logs with redaction.

**Impact if unfixed:** Log aggregators become a second copy of secrets.

---

### 22. No CSRF tokens

**Issue:** Cookie-authenticated browsers are CSRF-prone. This app primarily uses `Authorization: Bearer`, which browsers do not attach automatically, so CSRF risk is low **unless** cookies are also accepted (`req.cookies?.token`).

**Fix:** If cookie auth stays, set `SameSite=Strict` and require a CSRF header.

**Impact if unfixed:** Cross-site actions as the logged-in user when cookie fallback is used.

---

### 23. Rate limiting is incomplete

**Where:** Global limiter is only on `/api/submissions`. Public DMS has its own limiter. Auth, drafts, uniqueness, and public form GET are unlimited.

**Fix:** Apply a global IP limiter plus stricter limits on auth and OTP.

**Impact if unfixed:** Credential stuffing and draft/OTP spam.

---

### 24. Inline base64 files in submissions

**Issue:** When DMS is off, files are stored as data URLs in the submissions table. Exports and list APIs then ship megabytes of PII to the browser.

**Fix:** Prefer DMS. If inline mode remains, cap file size (already 5 MB in the UI) and never include base64 in list endpoints — only in the single-submission view.

**Impact if unfixed:** Slow admin UI; larger breach blast radius.

---

### 25. Signature folder-map key mismatch

**Where:** Default was `signature`; configured maps use `signatures`.

**What we changed:** Default is now `signatures` to match `signatures/{orgId}/{formId}`. Override with `DMS_FOLDER_MAP_SIGNATURE` if a tenant still uses the singular key.

**Impact if unfixed:** Signature uploads land in the wrong folder or fail folder-map resolution.

---

## Recommended hardening (not bugs today)

| Item | Why |
| --- | --- |
| Content-Security-Policy (`default-src 'self'`, no `unsafe-eval`) | Blocks most XSS and `new Function` abuse |
| Helmet, HSTS, `X-Content-Type-Options` | Missing standard headers |
| Virus scan on DMS uploads | Respondents can upload malware that admins then download |
| Object-level ACL in DMS | Defense in depth beyond this API |
| Audit log for document download | Needed for compliance investigations |
| Disable `eval`/dynamic function in production builds | Vite can flag this |

---

## How these issues interact

The highest practical risk is the **combination** of:

1. Tokens in `localStorage`
2. `new Function` / custom function bodies in forms
3. Public form schema under the attacker’s control (they can be a builder in a trial org)

That chain is a self-XSS that steals every subsequent visitor’s session if a malicious form is published on a shared origin.

SSRF (external validation) and leaked payment secrets are the highest **infrastructure** risks and do not need XSS.

---

## Fixes delivered with the DMS work

These were corrected in the same change set because they directly broke the DMS flow or were cheap, high-value hardening next to it:

- Deferred respondent file/signature uploads until **Submit** (no orphaned DMS objects from abandoned forms).
- Deferred builder support-doc uploads until **Save Documents**.
- Public download endpoint restricted to support docs and branding logos on the published form.
- Authenticated download checks `metadata.orgId` when the DMS document exposes it.
- Form schema now persists `documentId` / `mode` on support documents and `logoDocumentId` on branding.
- Signature folder map default set to `signatures`.
- File-size checks treat builder `fileConfig.maxSize` as bytes (not accidentally as millions of MB).
- Authenticated initiate now uses the caller’s org and verifies the form belongs to that org.

Remaining items in this document are **not** all fixed. Treat Critical and High as a follow-up security sprint.
