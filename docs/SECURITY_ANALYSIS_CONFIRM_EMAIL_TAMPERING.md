# Security Analysis — Confirm-Email Validation Tampering

**Reported:** A public form's **Email** and **Confirm Email** fields were submitted successfully
even though the Confirm Email value was changed/tampered to a different address than the Email
field. (Confirms the risk noted in H1/H2 of `EDITOR_BUGS_INVENTORY.md`.)

---

## 1. The trust boundary (the real problem)

Validation for a "Confirm Email" field runs in **two places**:

| Layer | File | Behavior |
| --- | --- | --- |
| Client (UX only) | `src/lib/fieldValidation.ts` | Builds react-hook-form rules from the schema **shipped to the browser**. Applied in the UI. |
| Server (the gate) | `backend/src/lib/validation.ts` → `validateSubmission` | Re-validates submitted data against the **schema stored in the DB** before persisting. |

**Client-side validation is never a security boundary.** The schema — including which rules a
field has — is sent to the respondent's browser. Anyone can open DevTools, read the schema,
and POST directly to the submission API with arbitrary values. Therefore the ONLY thing that
protects this form is the **server-side** `validateSubmission`.

The vulnerability is that the server-side check can be **absent or skipped** for the equality
rule. When it is, a tampered Confirm Email is accepted.

---

## 2. Root-cause candidates (most likely first)

### 2a. `enabled` semantics differ between client and server  ← primary
In `backend/src/lib/validation.ts` the rules loop starts with:

```ts
if (!rule.enabled) return;   // skips the rule when enabled is undefined OR false
```

`undefined` is falsy, so **any equality rule that does not carry an explicit `enabled: true`
is silently skipped on the server**. Meanwhile the client (`fieldValidation.ts`) applies every
rule regardless of `enabled`. The result:

- The respondent sees the Confirm-Email mismatch blocked in the UI (client enforces it).
- But a direct API call / tampered payload with a **mismatched** Confirm Email passes the
  server, because the server skipped the rule.

This is exactly "the form allows to tamper the validations."

### 2b. Equality rule silently dropped from the stored schema
A "match another field" check can be authored as legacy `validation.equalToFieldId` **or** as a
`rules` entry of type `custom`. If the saved schema only has the legacy form, the inspector's
rules-based summary shows "no rules", and a later edit can drop the equality entirely. The
server then has nothing to enforce.

### 2c. Both fields tampered consistently (lower risk, not the reported case)
If the attacker rewrites both Email and Confirm Email to the *same* new value, equality passes.
That is inherent to a "must match" rule — the real mitigation is rate limiting, Turnstile, and
treating the value as user-typed data, not a tamper-proof identity.

---

## 3. Impact

- **Data integrity:** submissions with a Confirmed-Email ≠ Email are accepted; downstream
  identity, dedupe (voting), notifications, and reports can be polluted.
- **Compliance:** for registration/application forms the "confirm" is a conscious user intent
  signal; bypassing it undermines that intent and the data quality guarantees.
- **Automation:** combined with weak anti-bot, a script can submit arbitrary values.

No persistence-layer injection is introduced by this specific bug (data is still sanitized by
`normalizeValue`), so it is a **data-integrity** issue, not a takeover one — but it must be fixed
because the form's data is the product.

---

## 4. Recommended fixes (defense in depth, ordered)

### Fix 1 — Make rules default to enabled on the server (critical, minimal)
`backend/src/lib/validation.ts`:
```ts
// change:
if (!rule.enabled) return;
// to:
if (rule.enabled === false) return;   // absent flag == enabled
```
Also apply the same rule for legacy checks and for every other rules consumer so behavior is
consistent. Add a regression test: a Confirm-Email equality rule (no `enabled` field) must
**reject** a mismatched payload with HTTP 400.

### Fix 2 — Server is the only source of truth; never trust the client
- Keep shipping rules to the browser for UX, but **always** re-validate server-side against the
  **stored** schema. Never read rules from the request body.
- Add a schema **version/hash** so a tampered client can't redefine rules for a stored form.

### Fix 3 — Enforce equality on the server for all submitted fields
Already present (`case 'custom'` and `validation.equalToFieldId`), but make it robust:
- Compare **normalized** values (trimmed, stringified) so `a@x.com` vs `a@x.com ` doesn't slip.
- If the equality target field id is missing from the schema or the submitted data, **fail
  closed** (treat as invalid) rather than comparing against `undefined`.
- Evaluate equality before the "empty" short-circuit only when the rule applies — i.e. do not
  `continue` past the required check without still checking cross-field rules when values exist.

### Fix 4 — Reject unknown/injected fields
Whitelist submitted keys to the stored schema's field ids so extra attacker-supplied fields
can't shadow or carry a spoofed target.

### Fix 5 — Consolidate the two equality representations
Unify legacy `validation.equalToFieldId` and `rules` type `custom` into one server-enforced path,
and reflect both in the inspector summary (see H3 in the bug list) so the check can't silently
disappear.

### Fix 6 — Harden the whole submission surface
- Mandatory **Turnstile/bot protection** (already integrated) — do not allow submit without it.
- **Rate-limit** `/api/submissions` and public endpoints.
- Log & alert on repeated validation-failure bursts (likely tampering attempts).

### Fix 7 — Frontend resilience
Even though the server gates correctness, harden the UI too:
- `src/lib/fieldValidation.ts`: honor `enabled !== false` (not just truthy) and evaluate equality
  rules exactly like the server (normalized comparison), so the UX never promises a check the
  server won't run.

---

## 5. Suggested verification checklist

- [ ] Server returns **400** for Email `a@x.com` / Confirm `b@x.com` (rule without `enabled`).
- [ ] Server returns **400** for Confirm field targeting a missing/nonexistent field id.
- [ ] Server returns **400** when Confirm is skipped/empty but required.
- [ ] Server rejects payloads containing extra, non-schema field ids.
- [ ] Client and server summaries agree on which rules are active.
- [ ] Submission is rejected when the Turnstile token is absent/expired.
- [ ] `GET /api/submissions/check-unique` and submission endpoints are rate-limited.

---

## 6. Owner

Tracked for the **next security sprint** (the user fixes these in the following change set, in the
`fixes/` folder). This document and `EDITOR_BUGS_INVENTORY.md` are the reference.
