# Fixed — 30 August 2026

Security hardening for External Validation. No change to stored data, no
impact on existing forms or respondents.

## External-validation internals are no longer sent to the browser

**What was wrong:** The published form data sent to the respondent's browser
included the external-validation details — the third-party API URL, the response
check logic, and the success/failure messages.

**After:** The published form now contains only `externalValidation: { enabled }`.
The endpoint, credentials, and response checks are read securely from the
database on the server at the moment of validation.

**Why it still works:** the live "✓ Verified" check and the final submit both
re-read the full configuration server-side, so validation behaves exactly as
before — the browser just no longer sees the internals.

## Request values and query strings are no longer written to logs

**What was wrong:** the server logged the full request body (which contains the
respondent's value, e.g. an email) and, for GET requests, the full URL including
query parameters.

**After:** logs now record only the keys (not the values), and GET responses log
the URL path only — never the query string.

---

**Impact:** none for end users or existing forms. This changes only what a
curious user can inspect and what reaches the logs.
