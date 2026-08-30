# Fixed — 30 August 2026

## 1. API credentials were visible in the public form data

**What was wrong:** When a form used "External Validation" (a field checked against a
third-party API), the API key / token / password was included in the published form data that
the browser receives. Anyone could open the page, view the network request, and copy the key.

**Example — before:**

```json
"externalValidation": {
  "enabled": true,
  "auth": { "type": "bearer", "token": "sk_live_9f8e7d6c5b4a3210" }
}
```

**After — the secret no longer leaves the server:**

```json
"externalValidation": { "enabled": true }
```

**What changed:** The published form now sends only the pieces the page needs (the `enabled`
flag and messages). Validation still works exactly the same, because the real credentials are
read securely from the database on the server at the moment of validation.

**Impact:** None for end users or existing forms. No data or migration changes.

---

## 2. API credentials were written to the server logs

**What was wrong:** Every external-validation call logged its full request headers, including
the `Authorization: Bearer <token>` line, plus the third party's full response. Secrets ended up
in the log system.

**Example — before:**

```
Headers: { "Authorization": "Bearer sk_live_9f8e7d6c5b4a3210" }
Response Data: { "data": { "isValid": true, "customerId": "cust_8821" } }
```

**After — secrets and response bodies are masked:**

```
Headers: { "Authorization": "[REDACTED]" }
Response Data: [redacted]
```

**What changed:** Sensitive header values (Authorization, API keys, tokens, cookies) are masked
before logging, and third-party response bodies are no longer written to logs.

**Impact:** None for end users or existing forms. Logging behaviour only.
