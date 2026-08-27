# SifyForms security update — 27 August 2026

Hi team, today we completed two security improvements around public assessments and form submissions.

## Security fix 1 — Assessment answers exposed in the public form schema

### What was the issue?

The public form API was returning the complete assessment field configuration. This included internal values such as:

- `correctAnswer`
- `points`
- assessment `section`

Anyone could open the browser network tab, read the public form response, and find the answer key before submitting the assessment.

### What could happen in a real scenario?

A candidate could inspect the API response and submit every correct answer without knowing the subject. The score, pass/fail result, ranking, and any hiring or training decision based on that result would no longer be trustworthy.

### What did we change?

- The public form API now removes `correctAnswer`, `points`, and assessment section metadata before returning a published form.
- The authenticated builder and administrator APIs still receive the full schema.
- Assessment scoring still happens on the backend using the original private schema.
- The public score-result API now checks the form's visibility settings on the server.
- When **Show score after submission** is disabled, the public score endpoint rejects the request.
- When **Show correct answers** is disabled, the public API removes the complete per-question review. We remove the full review because even a simple correct/incorrect value could be repeatedly tested to discover the answer.
- When both options are enabled, the respondent continues to receive the configured scorecard and correct-answer review after submission.

### Database impact

No database migration was required. The private assessment configuration remains stored as it is today; only the public response is sanitized.

---

## Security fix 2 — Direct public submissions using Postman

### What was the issue?

The ITEST team was able to create a submission by calling the public submission API directly from Postman without opening the form page.

Public forms cannot use normal user JWT authentication because anonymous respondents must be able to open and submit them. Also, CORS cannot block Postman because CORS is enforced by browsers, not by API clients.

The actual missing control was a server-verifiable proof that the request passed bot protection.

### What could happen in a real scenario?

An automated script could send fake registrations, survey responses, votes, or assessment attempts. This could pollute reports, increase storage and processing usage, trigger integrations, and reduce trust in the collected data.

### Solution implemented

We integrated **Cloudflare Turnstile** as mandatory bot protection for public submissions.

The flow is now:

1. The public form loads Cloudflare Turnstile in interaction-only mode.
2. Cloudflare issues a short-lived, single-use token after verification.
3. The frontend sends that token with the form submission.
4. The SifyForms backend sends the token directly to Cloudflare's Siteverify API.
5. The backend creates the submission only when Cloudflare confirms the token.
6. Missing, invalid, expired, mismatched, and replayed tokens are rejected.

The token is also bound to the `form_submission` action and the form ID when Cloudflare returns those values. Production deployments can additionally restrict accepted hostnames.

### Why a normal Postman request now fails

Postman can copy the request format, but it cannot invent a valid Cloudflare-signed token. A missing or random token is rejected, and a previously used token cannot be replayed.

This does not mean all automation becomes impossible. Sophisticated attackers can still use real browsers or challenge-solving services. Turnstile is therefore one industry-standard security layer and should be used together with rate limiting and monitoring.

### Follow-up: why the same token appeared reusable

Cloudflare's production tokens are already single-use and expire after five minutes. When Siteverify receives a token for the second time, it returns `success: false` with `timeout-or-duplicate`. No SifyForms replay table is needed.

The repeated success was consistent with using Cloudflare's **always-pass test secret**, which is intentionally designed to return successful test validations. It should not be used to judge production replay behavior. Cloudflare also provides a dedicated test secret that returns the token-already-spent response.

We kept the solution simple and provider-standard:

- Every submission calls Siteverify exactly once.
- The backend rejects every response where `success` is not `true`.
- `timeout-or-duplicate` now returns a clear `409` response and the frontend refreshes the widget.
- The backend strictly checks the expected `form_submission` action and matching form ID.
- Cloudflare test secrets are rejected unless the environment explicitly enables test-key use.
- Rejected Siteverify responses log only safe metadata (`error-codes`, action, hostname, and whether the form ID matched), never the token or secret.
- Express now trusts only the local reverse proxy by default, fixing client-IP resolution for submission rate limiting without trusting arbitrary internet-supplied forwarding headers.
- No extra database model, token table, cleanup job, or migration is required.

Reference: <https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>

### Additional cleanup

- The old client-generated math CAPTCHA is no longer trusted or displayed.
- The builder now shows bot protection as **Turnstile always on**, rather than offering the old visual CAPTCHA toggle.
- Submission request validation now runs inside the shared backend service, so Express, Google Cloud Functions, and AWS Lambda entry points receive the same token requirement.
- Failed submission attempts request a fresh token before retrying.
- The frontend shows a clear error and prevents submission when Turnstile is unavailable or not configured.

### Required environment configuration

Frontend:

```env
VITE_TURNSTILE_SITE_KEY=<Cloudflare public site key>
```

Backend:

```env
TURNSTILE_SECRET_KEY=<Cloudflare secret key>
TURNSTILE_EXPECTED_HOSTNAMES=forms.example.com,www.forms.example.com
```

The hostname list is optional for local testing but recommended in production. The secret key must never use a `VITE_` prefix or be sent to the browser.

Cloudflare's official test keys are documented in `.env.example` for local and automated testing. Production must use keys created for the real production hostnames.

### Database impact

No database migration was required for Turnstile. Verification happens before the existing submission write.

### Deployment note

The frontend site key and backend secret must be deployed together. If the backend secret is missing, the API intentionally fails closed and returns that security verification is not configured.

---

## Validation completed

- Public schemas no longer expose assessment answer fields.
- Public score results follow both assessment visibility settings on the server.
- The public form sends a Turnstile token.
- The shared submission service rejects requests without a valid token.
- Express, GCP, and Lambda submission handlers use the protected shared service.
- Existing builder/admin assessment data remains available.
- No database migration was needed for these two fixes.

## Recommended next security work

Turnstile addresses automated submission abuse, but it does not replace the remaining planned controls. The next recommended work is server-side respondent authentication/OTP, payment-state verification, distributed rate limiting, strict field allow-listing, idempotency, and DMS reference binding. These are covered in `docs/PUBLIC_SUBMISSION_API_SECURITY_ANALYSIS.md`.
