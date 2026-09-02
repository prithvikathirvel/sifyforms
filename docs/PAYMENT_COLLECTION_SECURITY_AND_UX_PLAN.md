# Sify Forms — Payment Collection Security and UX Plan

**Status:** Security remediation and redesign proposal  
**Priority:** Critical before production payment use  
**Last updated:** 2 September 2026

## 1. Executive assessment

The current flow is not suitable as the final production payment architecture. It gives a useful prototype experience, but important trust decisions are currently made in the respondent’s browser:

- the browser derives the amount;
- the browser creates an order ID;
- the browser calls the Payment Orchestration Service (POS) directly;
- a form submission is stored before payment begins;
- the result page can receive transaction data through URL parameters;
- merchant onboarding credentials are entered in the frontend and remain part of form settings;
- payment success is not authoritatively bound to the saved submission by the Sify Forms backend.

A user can alter browser code and requests. Therefore the amount, order, customer identity, return URL, and payment result must all be treated as untrusted until independently created or verified by a backend.

As an immediate defense, public settings must never expose merchant secrets. This implementation now redacts Razorpay secrets/webhook secrets, Paytm merchant keys, PayU salts, and other onboarding-only settings from the public form API. The larger workflow below is still required.

## 2. Target properties

The production flow must guarantee:

1. A respondent cannot reduce or replace the payable amount.
2. A transaction belongs to exactly one organization, form, form version, submission, and payment attempt.
3. A redirect/query string can never mark a payment successful.
4. Merchant credentials never enter public form JSON, application logs, analytics, or browser storage.
5. Duplicate gateway callbacks are safe and do not duplicate fulfillment.
6. A paid response cannot be silently edited into a different order.
7. Authors and support staff can reconcile every state transition.
8. Respondents can safely retry interrupted payments without submitting the form again.
9. Card/bank credentials are collected only in the gateway-hosted checkout; Sify Forms never handles card data.

## 3. Proposed architecture

### 3.1 Server-owned payment intent

Add a Sify Forms backend payment service. The browser calls only Sify Forms:

```text
Browser → Sify Forms API → POS/gateway
Gateway/POS webhook → Sify Forms API
Browser → Sify Forms API (read status)
```

The backend loads the published form and recalculates the amount from canonical submitted answers and server-calculated variables. It creates an unpredictable payment attempt ID and sends the amount to POS over an authenticated server-to-server connection.

### 3.2 Data model

Create `PaymentAttempt` (or equivalent DAO representation):

- `id` — UUID/ULID generated server-side;
- `orgId`, `formId`, `submissionId`, `formVersionId`;
- `gateway`, `tenantId`/credential reference;
- `merchantOrderId` with a unique constraint;
- amount in **minor units as an integer** (`amountMinor`), currency;
- `status`: CREATED, PENDING, AUTHORIZED, PAID, FAILED, CANCELLED, EXPIRED, REFUNDED, PARTIALLY_REFUNDED;
- gateway order/payment references;
- idempotency key;
- timestamps and expiry;
- sanitized failure code/message;
- webhook verification/audit metadata;
- immutable amount calculation snapshot.

Never use JavaScript floating-point values as the payment source of truth. INR 500.10 is stored as `50010` paise.

### 3.3 Credential storage

- Onboarding credentials are submitted to an authenticated Sify backend endpoint, never directly from the browser to POS.
- Prefer POS-managed credentials and retain only an opaque tenant/credential reference.
- If Sify must retain a secret, encrypt it with a managed KMS and envelope encryption; restrict decrypt permission to the payment service identity.
- Return only masked credential metadata (`configured`, last four, environment, updatedAt) to the builder.
- Separate sandbox and production credentials.
- Add rotation, revocation, and a “test connection” operation.
- Scrub secrets from existing persisted form settings and rotate any credentials that may already have been returned by the public API.

## 4. Correct transaction sequence

### Step A — validate response

The browser submits answers to Sify Forms. The backend:

1. validates bot protection;
2. loads the published schema/version;
3. rejects unknown fields and enforces all field/cross-field rules;
4. recalculates variables;
5. determines the payable amount;
6. validates currency, minimum/maximum, and customer mappings.

### Step B — create pending submission and payment attempt atomically

Within a database transaction:

- create the submission with `paymentStatus = PENDING` (or create a draft response inaccessible to normal result processing);
- create a PaymentAttempt bound to it;
- persist an immutable amount snapshot.

Post-submission actions, notifications, assessment completion, webhooks, and “submission received” UI must not run until payment reaches PAID unless the form explicitly supports pay-later behavior.

### Step C — create gateway order server-side

The backend calls POS with:

- server-generated merchant order ID;
- integer amount and fixed currency;
- allowlisted callback/return URLs from environment configuration, never from request input;
- customer fields selected from validated canonical data;
- an idempotency key based on PaymentAttempt ID.

Return only checkout-safe information to the browser: attempt ID, gateway order token/reference, publishable gateway key if required, expiry, amount, and currency.

### Step D — hosted checkout

Use the gateway’s hosted modal or redirect. Sify Forms must not render inputs for card number, CVV, UPI PIN, or banking password. Apply a strict Content Security Policy allowing only approved payment origins/scripts/frames.

### Step E — authoritative verification

The gateway/POS webhook is authoritative. The backend:

- reads the raw request body where required;
- verifies HMAC/signature and timestamp;
- validates gateway account/tenant, order reference, currency, and exact amount;
- protects against replay;
- records the event idempotently;
- optionally queries POS/gateway server-to-server before finalizing;
- transitions the attempt and submission in a transaction.

A success redirect only tells the UI to poll `GET /public/payment-attempts/:attemptId/status`. Query parameters such as `txnId=...` never prove payment.

### Step F — fulfillment

Only the PAID transition triggers final form processing. Use an outbox/job pattern so notifications and downstream webhooks are retried without charging again. Emit an auditable receipt/reference.

## 5. API proposal

- `POST /api/forms/:formId/payment-configuration/onboard` — authenticated author/admin endpoint; server forwards credentials securely.
- `GET /api/forms/:formId/payment-configuration` — masked configuration and readiness only.
- `POST /api/public/forms/:formId/payment-attempts` — validated answers + Turnstile token; creates pending response and attempt.
- `GET /api/public/payment-attempts/:attemptId/status` — minimal status, amount, currency, receipt reference; use a scoped high-entropy access token.
- `POST /api/payments/webhooks/:gateway` — signature-verified raw webhook endpoint.
- `POST /api/forms/:formId/payment-attempts/:id/refund` — permission-protected, step-up authenticated admin action.
- `GET /api/forms/:formId/payments` — reconciliation list with scoped permissions.

Apply rate limits, request-size limits, structured validation, tenant scoping, and audit logging. Do not put email, phone, secrets, gateway payloads, or access tokens in URL query strings.

## 6. Amount policy

Support these modes safely:

### Fixed amount

Configured by an authorized author and loaded from the server. Validate positive amount and organization-defined min/max.

### Answer-derived amount

Use a number field only after server validation. Authors must configure min/max and whether respondent entry is permitted. Never trust a hidden/read-only DOM input.

### Variable/formula amount

Recalculate with the backend calculation engine from canonical answers. Store formula version and input snapshot with the attempt. Reject non-finite, negative, zero (unless explicitly permitted), excessive precision, or out-of-range totals.

Show the exact amount before the respondent confirms, but treat that UI as explanatory—not authoritative.

## 7. Respondent UX

### 7.1 Before payment

Add a dedicated review panel rather than a generic confirmation modal:

- form/merchant name and verified organization identity;
- description of what is being purchased/paid for;
- amount with currency and itemized breakdown when possible;
- customer email/mobile receiving the receipt;
- payment provider name;
- cancellation/refund/support links;
- “Secure payment handled by {gateway}” message;
- clearly distinct **Pay ₹X securely** primary action and **Back to edit** secondary action.

Never display or request gateway merchant secrets.

### 7.2 During payment

- Disable duplicate launches while an attempt is active.
- Preserve attempt state across refresh/session recovery.
- For redirects, show “Redirecting to secure payment…” and the verified destination domain.
- For popup/modal failure, retain the pending attempt and offer retry.
- Do not say the form was submitted successfully yet.

### 7.3 Result states

Use explicit, non-destructive pages:

- **Payment confirmed** — receipt/order reference and final submission confirmation.
- **Verifying payment** — poll with bounded backoff; safe refresh.
- **Payment not completed** — retry same attempt or return to form as policy permits.
- **Payment failed** — sanitized reason and support reference.
- **Payment expired** — create a new attempt after server re-evaluates amount.

“Form Not Found” must be reserved for a failed initial form load. Submission or payment errors stay inside the valid form page.

### 7.4 Accessibility and mobile

- Dialog focus trap, Escape behavior, labelled title/description, and return focus.
- Status changes announced using `aria-live` without repeated announcements.
- 44 px touch targets and gateway handoff tested in in-app browsers.
- Never rely on color alone for status.
- Avoid opening unannounced tabs; when unavoidable, clearly tell the respondent.

## 8. Author UX

Replace the current long credential form with a setup stepper:

1. **Choose provider and environment**
2. **Connect merchant account** (prefer provider OAuth/hosted onboarding)
3. **Set amount rule** with live examples and bounds
4. **Map receipt contact fields**
5. **Policies** — refund text, support contact, expiry
6. **Test payment** in sandbox
7. **Readiness review and enable**

Show status cards: Not connected, Sandbox ready, Live ready, Needs attention. Secret fields are write-only and become masked configuration status after save. Changing gateway, amount source, or credentials must disable collection until readiness checks pass.

Add a payment dashboard with attempts, paid total, pending/failed counts, reconciliation mismatch indicator, filters, receipt reference, and permitted refund action. Keep payment status separate from form response read/unread status.

## 9. Security controls checklist

- Server-side amount calculation and submission validation.
- Webhook HMAC/signature and timestamp verification against raw body.
- Idempotency on create, callback, finalization, and refund.
- Unique order and gateway transaction constraints.
- Constant-time signature comparison.
- Strict state-transition machine; PAID cannot move back to PENDING.
- KMS-managed secrets and least-privilege service identity.
- Public API allowlist/redaction and automated secret-scanning tests.
- CSP, `frame-ancestors`, `connect-src`, `script-src`, HTTPS/HSTS.
- CSRF protection for authenticated configuration/refund operations.
- Turnstile and rate limiting for public attempt creation/status reads.
- SSRF prevention: gateway/POS base URLs come only from trusted configuration.
- No `document.write` of a remote HTML response; use a validated redirect or provider SDK.
- Safe logging: IDs/status/timing only, with PII and credentials redacted.
- Audit trail for configuration changes, retries, manual reconciliation, and refunds.
- Dependency and SDK integrity review.
- PCI scope reviewed with a qualified security/compliance owner; target hosted checkout/SAQ A where applicable.

## 10. Failure and reconciliation behavior

- POS timeout after request: query by idempotency/order ID before creating another order.
- Webhook arrives before browser response: state transition still succeeds.
- Browser closes: webhook finalizes; status is recoverable from attempt token.
- Duplicate callbacks: return success without duplicate processing.
- Amount mismatch: quarantine as `REVIEW_REQUIRED`; never auto-fulfill.
- Submission save succeeds but POS creation fails: mark attempt FAILED/RETRYABLE, retain pending response for bounded time.
- Database unavailable during webhook: return retryable error and rely on gateway retries plus reconciliation job.
- Scheduled reconciliation compares pending attempts with POS and raises aged-payment alerts.

## 11. Migration and remediation

### Immediate (P0)

- Redact all merchant secrets from public settings responses.
- Rotate credentials that may have been exposed by previously published forms.
- Stop logging full payment/customer payloads.
- Add a product warning/feature flag for production payment enablement until server verification exists.
- Fix recoverable errors so they do not show “Form Not Found.”

### Foundation (P1)

- Add PaymentAttempt and submission payment status migrations.
- Build server-owned create/status/webhook flow.
- Move onboarding behind authenticated backend APIs and KMS/POS references.
- Block post-processing until PAID.

### UX and operations (P2)

- New respondent review/status pages.
- Author setup wizard, readiness test, and masked credentials.
- Payment dashboard, reconciliation, receipt and support references.

### Hardening (P3)

- Refund flow, outbox, reconciliation jobs, alerting.
- Threat model, penetration test, gateway certification, disaster recovery exercise.
- Remove legacy direct-POS browser calls and old stored secret fields after migration.

## 12. Test and release gates

### Automated

- Modify browser amount, field amount, variable output, tenant ID, order ID, currency, callback URL, and customer ID: server rejects or ignores each change.
- Mismatched email confirmation and every enabled/legacy validation rule: submission returns 400 and no row is stored.
- Forged success URL/query parameter: status remains non-paid.
- Invalid/replayed webhook signature and amount mismatch: no fulfillment.
- Duplicate attempt/callback/refund requests: exactly-once business outcome.
- Public form/settings snapshots contain no keys matching secret/token/salt/merchant-key patterns.
- Payment failure retains form and entered values.
- Refresh during each payment state resumes correctly.

### Operational

- Sandbox end-to-end runs for Razorpay, Paytm, and PayU.
- Finance/support reconciliation sign-off.
- Security threat-model and penetration-test sign-off.
- Accessibility and mobile-browser sign-off.
- Monitoring dashboards and alerts tested before staged rollout.

## 13. Recommended release decision

Do not describe a browser redirect as a successful payment and do not enable general production payment collection until the backend verifies the payment and binds it to the submission. The safest first production vertical slice is:

**Razorpay hosted checkout + fixed INR amount + server-created PaymentAttempt + verified webhook + paid submission finalization + respondent receipt status.**

After that path is proven, add formula amounts and the remaining gateways using the same state machine and security contract.
