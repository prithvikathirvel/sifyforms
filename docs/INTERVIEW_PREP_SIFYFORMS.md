# SifyForms — Resume Points & Interview Playbook

> Everything here is taken from the actual codebase. Every claim in this document
> maps to a file you can open. Do not add anything to your resume that you cannot
> point at in the repo — the multi-hop questions in Section 7 exist precisely
> because good interviewers drill until they find the bottom of a claim.

**Contents**

1. [How to use this document](#1-how-to-use-this-document)
2. [The pitch — 30 seconds, 90 seconds, 3 minutes](#2-the-pitch)
3. [Numbers you can quote](#3-numbers-you-can-quote)
4. [The whiteboard script — system design](#4-the-whiteboard-script)
5. [Resume bullet points](#5-resume-bullet-points)
6. [Feature inventory — Security · Product · Database · AI](#6-feature-inventory)
7. [Multi-hop interview chains with model answers](#7-multi-hop-interview-chains)
8. [Rapid-fire one-liners](#8-rapid-fire-one-liners)
9. [Weaknesses to own before they find them](#9-weaknesses-to-own)
10. [Phrases that signal seniority](#10-phrases-that-signal-seniority)
11. [Night-before checklist](#11-night-before-checklist)

---

## 1. How to use this document

Three rules that decide whether the interview goes well:

**Rule 1 — Lead with the problem, not the technology.** Never open with "I used
Redux Toolkit and Prisma." Open with "the hard part was that a form's author and
the person allowed to read the answers are usually different people, and role
systems can't express that." Technology is the answer to a question; state the
question first.

**Rule 2 — Every feature has a *because*.** Interviewers separate people who
built something from people who were nearby when it was built by asking "why."
Every row in Section 6 has a because-clause. Learn the clause, not the row.

**Rule 3 — Volunteer the trade-off.** When you say "I stored the form schema as
JSON in a column," immediately add "which means I cannot index inside answers,
so aggregate reads go through a precomputed table instead." Naming your own
constraint before they find it converts a weakness into evidence of judgement.

---

## 2. The pitch

### 30-second version (use when asked "tell me about a project")

> SifyForms is a multi-tenant form-builder platform — think Google Forms, but
> for an enterprise, so the interesting problems are not drag-and-drop, they're
> access control and trust boundaries. An organisation builds forms, publishes
> them to the public internet, and collects responses that may be anonymous,
> scored, paid for, or legally sensitive. I worked across the stack: a React
> builder with 22 field types and conditional logic, and an Express/MySQL
> backend where the design work went into a four-level response-access model, a
> submission pipeline that treats everything from the browser as hostile, and
> an integration layer over four external services — identity, RBAC, document
> storage, and an AI agent.

### 90-second version (add this)

> Three decisions I'd defend. First, **the response policy is a ceiling, not a
> permission.** If a survey promises anonymity, no role — not the org owner, not
> a platform admin — can see an individual response, and the policy locks the
> moment the first response arrives so it can't be widened retroactively.
> Second, **duplicate prevention is a database constraint, not application
> code.** A poll's "one vote per person" rule is a unique index on
> `(formId, identifier)`; two simultaneous votes can't both win because the
> database rejects the second insert. Third, **the server re-derives everything
> the client computed** — visibility conditions, calculated variables, which
> field IDs even exist — because a public form endpoint means anyone can POST
> whatever they like.

### 3-minute version

Add the architecture (Section 4) and one war story from Section 7 — chain B
(submission pipeline) or chain D (anonymity) land best.

---

## 3. Numbers you can quote

Concrete numbers make a project sound real. These are all verifiable in the repo.

| Metric | Value |
|---|---|
| Frontend TypeScript / TSX | ~34,800 lines, 68 components |
| Backend TypeScript | ~16,000 lines |
| REST endpoints | 90 across 10 route modules |
| Prisma models | 16 |
| Ordered migrations | 10 |
| Field types in the builder | 22 (17 core + 5 survey instruments) |
| Zod request schemas | 8 modules |
| Response-access levels | 5 (`NONE → AGGREGATE → REDACTED → FULL → EXPORT`) |
| Response policies | 4 (`STANDARD`, `ANONYMOUS`, `BLIND_REVIEW`, `RESTRICTED`) |
| Form settings sections | 10 |
| Runtime adapters | 3 (Express, GCP Cloud Functions, AWS Lambda) |
| Database backends behind the DAO | 3 (MySQL/Prisma, Firestore, MongoDB) |
| External services integrated | Keycloak, UMS/RBAC, DMS, Cloudflare Turnstile, AI agent, payment gateways |

---

## 4. The whiteboard script

This is what you draw. Draw it in this order, talking as you go — do not draw
everything and then explain it.

### 4.1 Context diagram — draw this first, always

```
                         ┌──────────────────────────┐
   Form author  ────────►│                          │
   (authenticated)       │   React SPA (Vite)       │
                         │   Redux Toolkit          │
   Respondent   ────────►│   builder + public form  │
   (anonymous)           └────────────┬─────────────┘
                                      │ HTTPS, one origin
                                      │ Bearer (memory) + refresh cookie (httpOnly)
                         ┌────────────▼─────────────┐
                         │   Express 5 API          │
                         │   ┌──────────────────┐   │
                         │   │ auth → org →     │   │  middleware chain
                         │   │ permission       │   │
                         │   ├──────────────────┤   │
                         │   │ controllers      │   │  thin, runtime-specific
                         │   ├──────────────────┤   │
                         │   │ services         │   │  ALL business rules
                         │   ├──────────────────┤   │
                         │   │ DAO interfaces   │   │  storage-agnostic
                         │   └──────────────────┘   │
                         └──┬────┬────┬────┬────┬───┘
                            │    │    │    │    │
              ┌─────────────┘    │    │    │    └──────────────┐
              ▼                  ▼    ▼    ▼                   ▼
        ┌──────────┐      ┌──────────┐  ┌─────────┐     ┌────────────┐
        │  MySQL   │      │ Keycloak │  │  DMS    │     │ AI agent   │
        │ (Prisma) │      │ + UMS/   │  │ (files) │     │ service    │
        │ 16 models│      │   RBAC   │  │         │     │            │
        └──────────┘      └──────────┘  └─────────┘     └────────────┘
                                 ▲
                          ┌──────┴───────┐
                          │ Cloudflare   │  bot verification
                          │ Turnstile    │  (public submits only)
                          └──────────────┘
```

**Say while drawing:** "Two completely different classes of user hit the same
system. An authenticated author inside an organisation, and an anonymous
respondent on the public internet. Almost every security decision in this
project comes from that split — the public surface is one endpoint, and it
assumes the caller is hostile."

### 4.2 The layer rule — the thing that makes the backend defensible

```
controllers/express/*.ts     ─┐
controllers/gcp/*.ts          ├─►  service/*.ts  ─►  dao/interfaces/*  ─►  dao/mysql | firestore | mongodb
controllers/lambda/*.ts      ─┘     (all rules)      (contract)            (chosen by DB_TYPE)
```

**Say:** "Controllers only translate protocol — they read a request and shape a
response. Every business rule lives in the service layer, which is why the same
service runs unchanged behind Express, a Cloud Function, and a Lambda. And the
service never touches Prisma directly; it goes through a DAO interface with a
factory that picks MySQL, Firestore, or Mongo from an environment variable."

> ⚠️ Expect the follow-up "was that abstraction worth it?" — see chain G. Have
> the honest answer ready; it scores better than the enthusiastic one.

### 4.3 Public submission — the sequence diagram they'll actually ask about

Draw this whenever the conversation touches security. Order matters and you
should say why at each step.

```
Respondent            API                     Cloudflare        MySQL
    │                  │                          │               │
    │ POST /api/submissions                       │               │
    ├─────────────────►│                          │               │
    │                  │ 1. zod parse (shape)     │               │
    │                  │ 2. load form ────────────┼──────────────►│
    │                  │    404 unless published  │               │
    │                  │ 3. bot check?  ──────────►│              │
    │                  │    ◄── verdict + action + cdata + host   │
    │                  │       (fail CLOSED)      │               │
    │                  │ 4. active? expired?      │               │
    │                  │ 5. validateSubmission()  │               │
    │                  │    · allow-list field ids│               │
    │                  │    · re-evaluate showWhen│               │
    │                  │    · type + length + xss │               │
    │                  │    · recompute variables │               │
    │                  │    · external API checks │               │
    │                  │ 6. cheap duplicate read ─┼──────────────►│
    │                  │ 7. INSERT submission ────┼──────────────►│
    │                  │ 8. claimVote (UNIQUE) ───┼──────────────►│
    │                  │    lost the race? DELETE ┼──────────────►│
    │                  │ 9. lock response policy  │               │
    │                  │10. setImmediate(process) │               │
    │ ◄────────────────┤                          │               │
    │  200 + thank-you │                          │               │
```

**The three sentences that make this impressive:**

- *"Bot verification is step 3, before validation, because everything after it
  is work proportional to the payload. An unverified caller must not be able to
  make me do expensive things."*
- *"Step 5 drops any key that isn't a published, enabled, non-display field ID.
  Then it re-evaluates every visibility condition server-side and deletes
  answers to fields that should have been hidden — a hidden field's answer can
  be forged independently of the condition that hides it."*
- *"Step 8 is the actual guarantee. Step 6 is politeness."*

### 4.4 Permission resolution — draw when asked about RBAC

```
  request ──► authMiddleware ──► orgMiddleware ──► requirePermission(ACTION)
                    │                  │                    │
              verify JWT          is the caller       resolve effective
              via JWKS            a member of         permissions
              (RS256, issuer      this org?           (30s cache)
               from CONFIG)       is the org ACTIVE?         │
                                                             ▼
                                        ┌────────────────────────────────┐
                                        │ role NAME  ← local OrgUser row │  (assignment: ours)
                                        │ role DEFN  ← RBAC service      │  (definition: theirs)
                                        │ fallback   ← RoleDefinitionCache│ (last known good)
                                        └────────────────────────────────┘

  then, for a specific form:

    role level ──┐
                 ├─► max() ──► POLICY CEILING ──► effective level
    share level ─┘              (form's own
                                 promise wins)
```

**Say:** "Split ownership. The RBAC service owns what a role *means*; we own who
*holds* it. That means a membership change is one local write with nothing to
keep in sync. And the last step is the one I'm proud of — the form's response
policy is applied as a ceiling *after* roles and shares resolve, so a promise
made to a respondent outranks every permission grant in the system."

### 4.5 Transactional outbox — draw when asked about distributed consistency

```
  ┌─ single MySQL transaction ─────────────────┐
  │  INSERT OrgUser (the local truth)          │
  │  INSERT UmsOutbox (the work we owe)        │
  └────────────────────────────────────────────┘
                    │
                    ▼  worker, every N ms
        SELECT ... WHERE status='PENDING' AND nextAttemptAt <= now()
                    │           ▲
             call UMS/RBAC      │ backoff, attempts++
                    │           │
             ┌──────┴──────┐    │
             │  DONE       │    │
             │  DEAD (max) │────┘   → `npm run ums:reconcile` repairs
             └─────────────┘
```

**Say:** "A membership change is a local write plus a remote one. I refused to
let the remote half either fail the user's request or be silently lost, so the
work is written into an outbox table in the same transaction as the change it
describes, and a worker drains it with backoff. Dead letters are visible and
there's a reconcile script."

---

## 5. Resume bullet points

Pick **5–6**. Don't use all of them — a wall of bullets reads as padding. Choose
by the role you're applying for; groupings are below.

### Core set (safe for any full-stack role)

- Built a **multi-tenant enterprise form-builder platform** (React 19 + TypeScript
  SPA, Express 5 + Prisma/MySQL API, ~50K LOC, 90 REST endpoints, 16 data
  models) supporting a drag-and-drop builder with **22 field types**, nested
  conditional logic, multi-step layouts, and computed variables.
- Designed a **four-plane authorization model** — organisation roles, per-form
  shares with expiry, a five-tier response-access ladder
  (`NONE → AGGREGATE → REDACTED → FULL → EXPORT`), and a form-level privacy
  policy applied as a **ceiling above all roles** — so an anonymous survey stays
  anonymous even to the organisation owner.
- Hardened the public submission pipeline against a hostile client: server-side
  re-evaluation of conditional visibility, an **allow-list of published field
  IDs** to block property injection, XSS sanitisation, type/length enforcement,
  and **Cloudflare Turnstile verification bound to form ID, action and hostname**
  with a SHA-256 replay guard and fail-closed behaviour.
- Eliminated a duplicate-vote race condition by moving the guarantee from
  application code to a **database unique constraint on `(formId, identifier)`**
  with claim-before-respond semantics and a compensating delete, replacing a
  deferred write that allowed duplicate votes within a multi-millisecond window.
- Implemented **stateless JWT auth against Keycloak via JWKS** (RS256 pinned,
  issuer resolved from configuration rather than the token, `azp` client
  binding), with the access token held **in memory only** and a rotating
  `httpOnly` refresh cookie, plus single-flight refresh to prevent rotation
  races across concurrent 401s.
- Integrated an **AI agent service for natural-language form generation and
  form-level editing**, with token caching, structured-output validation, and
  typed failure modes — AI output is re-validated through the same sanitisation
  path as human-authored schemas.

### Swap-ins for a **backend / systems** role

- Architected a **storage- and runtime-portable backend**: business rules isolated
  in a service layer behind DAO interfaces with a factory selecting
  MySQL/Firestore/MongoDB, and thin controller adapters for Express, GCP Cloud
  Functions and AWS Lambda from a single implementation.
- Implemented a **transactional outbox** to mirror membership and role changes to
  an external user-management service — enqueued in the same transaction as the
  local write, drained by a worker with exponential backoff, dead-lettering and
  a reconciliation script — so a remote outage can neither fail nor lose a
  user's request.
- Built **graceful degradation for authorization**: effective permissions cached
  per `(user, org)` with explicit invalidation on membership change, and a
  `RoleDefinitionCache` table holding last-known-good role definitions so a
  restart during an RBAC-service outage does not become a total outage.

### Swap-ins for a **frontend / product** role

- Rebuilt form validation to run **at field level rather than only on submit**,
  with errors rendered inline at the offending field, automatic scroll-and-focus
  to the first error across multi-step forms, and an error summary that appears
  only when more than one field is wrong.
- Redesigned the submissions workspace — virtualised horizontal scrolling for
  wide response tables, truncation with full-value tooltips, and a centre modal
  that renders a response in the shape of the form the respondent filled in,
  with technical metadata separated from answers.
- Authored an **editor redesign specification** (`docs/EDITOR_V2_DESIGN.md`) plus a
  fully interactive HTML prototype, replacing a 21-section field-inspector panel
  with on-canvas editing and reducing the field palette from 17 widget names to
  8 user intentions.

### Swap-ins for a **data / privacy** role

- Enforced **k-anonymity on aggregate reporting** — per-question breakdowns and
  activity trends are suppressed below a five-response threshold, so a small
  team cannot deanonymise an anonymous survey by inspecting a distribution.
- Centralised response redaction in a **single choke point** (`viewSubmission`)
  applied before any controller sees data, ensuring later code paths such as
  server-side search cannot leak unredacted values.
- Made the privacy promise immutable: a form's response policy **locks on first
  submission**, so it can never be widened after people have answered under the
  terms originally displayed.

---

## 6. Feature inventory

Each row is a *feature*, a *because*, and where it lives. In an interview,
always say the because.

### 6.1 Security

| # | Feature | Because (say this) | Where |
|---|---|---|---|
| S1 | **JWKS-based JWT verification**, RS256 pinned, issuer from config | Deriving the key URL from the token's own `iss` lets anyone who can stand up an OIDC issuer mint a token for any user — and turns every request into an outbound fetch to an attacker-chosen address | `middleware/auth.middleware.ts` |
| S2 | **`azp` (authorized party) check** | Keycloak tokens carry `aud: account`, so audience proves nothing; `azp` is the claim that says which client the token was issued to | same |
| S3 | **Access token in memory only** | The app renders form schemas written by its own users, so XSS is a realistic threat — anything in `localStorage` is one `document` read away | `src/lib/api.ts` |
| S4 | **Rotating `httpOnly` + `SameSite` refresh cookie** | The session must survive a reload without a readable token; rotation limits the blast radius of a stolen cookie | `controllers/express/auth.controller.ts` |
| S5 | **Single-flight refresh** | The server *spends* the refresh token on exchange; two overlapping refreshes means the second presents a retired token and signs the user out | `src/lib/api.ts` |
| S6 | **Bearer header only — never a cookie-borne access token** | Accepting the token from a cookie reopens CSRF on every write route | `auth.middleware.ts` |
| S7 | **Three independent permission planes** — Build, Responses, Administer | The person who builds an exit-interview form is usually not the person who should read the answers; a single viewer→admin ladder cannot express that | `config/rbac.config.ts` |
| S8 | **Five-tier response-access ladder** with `EXPORT` split from `FULL` | Downloading 4,000 responses is the moment data leaves the platform — it's the event a compliance team asks about, so it's its own grant | same |
| S9 | **Response policy as a ceiling** (`ANONYMOUS` caps everyone at `AGGREGATE`) | Roles answer "what may this person do"; they cannot answer "this survey promised anonymity." That belongs to the form and must outrank every role | `service/formAccess.service.ts` |
| S10 | **Policy locks at first submission** | People answered under the terms shown at that moment; widening the policy afterwards would retroactively break a promise | `service/submission.service.ts` |
| S11 | **k-anonymity threshold of 5** on aggregates | With three answers in a team of four, a breakdown is a guessing game — this is the difference between anonymity that holds and anonymity that holds on average | `service/responseView.service.ts` |
| S12 | **Single redaction choke point** | Shaping happens before anything else touches the row, so a later feature like search can't leak an unredacted value | same |
| S13 | **Field-ID allow-list on submit** | Stops request tampering from injecting arbitrary properties or client-computed values into storage | `lib/validation.ts` |
| S14 | **Server-side re-evaluation of `showWhen`**, hidden answers deleted | A hidden field's answer can be forged independently of the condition that hides it; leaving it would corrupt reports and downstream systems | same |
| S15 | **XSS sanitisation + type + 100 KB length caps** | Browser and `react-hook-form` checks improve UX but vanish from a forged POST — the server is the boundary | same |
| S16 | **Public schema sanitisation** — strips `correctAnswer`, `points`, external-validation endpoints/headers/credentials, payment secrets | A quiz's answer key must not ship to the browser that's taking the quiz; only Razorpay's publishable key ID crosses the boundary | `service/form.service.ts` |
| S17 | **Turnstile bound to action + `cdata=formId` + hostname allow-list**, fails closed | A token valid for *some* form on *some* site isn't proof for *this* form; and an unconfigured verifier must refuse, not wave traffic through | `service/turnstile.service.ts` |
| S18 | **SHA-256 replay guard** with bounded TTL + LRU pruning, idempotency key, token fingerprints in logs | Cloudflare is the authority, but defence in depth against duplicated requests; logging a fingerprint lets ops correlate retries without logging a replayable credential | same |
| S19 | **Duplicate votes as a DB unique constraint**, claim-before-respond, compensating delete | An index makes a lookup fast; the *constraint* makes two simultaneous votes impossible, because the DB — not application code losing a race — decides the winner | `services/voting.processor.ts` |
| S20 | **Canonical vote identity** — `::ffff:` unwrapping, lowercase email, namespaced `ip:`/`email:` prefixes, fail-closed when unidentifiable | The old code counted one person as two voters, and bucketed every unknown IP under the literal string `'unknown'` so the first such vote locked out all the rest | `services/voteIdentity.ts` |
| S21 | **Org isolation middleware** with provisioning-state gating (409/410) | A half-provisioned org has no role definitions, so every permission check resolves to nothing — say so rather than showing an empty, apparently broken workspace | `auth.middleware.ts` |
| S22 | **Rate limiting on the public submission path**, `trust proxy` scoped to loopback | Trusting arbitrary `X-Forwarded-For` lets any client spoof its own rate-limit bucket | `index.ts` |
| S23 | **No local file storage** — external DMS with initiate → signed URL → confirm, org-scoped download authorisation | Files never touch app disk, so an app server is stateless and disposable; and a document ID alone doesn't authorise a download | `service/dms.service.ts` |
| S24 | **Immutable audit row per submission** | A vote must be provable after the fact, not just prevented at the time | `AuditLog` model |
| S25 | **Vendor name hidden from respondents** — "Powered by Cloudflare" | "Turnstile verification failed" tells a respondent nothing actionable; the log line carries the detail for whoever can act on it | UI + `turnstile.service.ts` |

### 6.2 Product / feature engineering

| # | Feature | Notes worth saying |
|---|---|---|
| F1 | **Drag-and-drop builder**, 3-pane, both panes drag-resizable | `@dnd-kit`; palette / canvas / inspector with persisted widths |
| F2 | **22 field types** | 17 core (text, email, phone, number, dropdown, radio, checkbox, multi-select, date, time, long text, file, rating, signature, HTML, display value, table grid) + 5 survey instruments (NPS, CSAT, CES, Likert matrix, ranking) |
| F3 | **Conditional visibility with nested AND/OR groups**, 12 operators | Rule tree, not a flat list — renders as `A equals 1 AND (B equals 2 OR C equals 3)`; evaluated identically on client and server |
| F4 | **Computed variables** (`CalculationEngine`) | Formulas over answers, usable in display fields, conditions and payment amounts; **recomputed server-side** so a client cannot dictate a price |
| F5 | **External validation per field** | Verify an answer against a third-party API on blur or on a Verify button; endpoint and credentials never leave the server |
| F6 | **Smart connections / field linking** | One field's value derives from another's |
| F7 | **Multi-step forms** | Per-step field assignment, lock-step-after-confirm, three progress-indicator styles, back-navigation toggle |
| F8 | **Four form types** | Standard collection · Survey · Assessment (scoring, pass threshold, result visibility) · Voting (tally, duplicate prevention, result visibility) |
| F9 | **Save & resume** | Authenticated drafts keyed `(formId, identity)`; anonymous survey sessions keyed `(formId, tokenHash)` — the token is hashed so the DB never holds the resume credential |
| F10 | **Payments** | PayU / Paytm / Razorpay; amount from a static value, a field, or a computed variable — resolved server-side |
| F11 | **OTP verification** before a form opens | |
| F12 | **Submissions workspace** | Pagination, status/date filters, redaction-aware search, per-response detail, export gated behind the `EXPORT` tier |
| F13 | **Templates, duplicate form, export JSON** | |
| F14 | **Multi-organisation** with teams, invites (email-keyed so you can invite someone who hasn't signed up), roles, and per-form shares with expiry | "An access list that only grows stops reflecting reality, so shares are meant to expire" |
| F15 | **Inline, field-level validation on the public form** | Errors at the field, never a toast; auto-scroll and focus to the first error, including selecting the right step |
| F16 | **Editor v2 specification + interactive prototype** | `docs/EDITOR_V2_DESIGN.md` and `docs/editor-v2-mockup.html` |

### 6.3 Database

| # | Feature | Because |
|---|---|---|
| D1 | **MySQL + Prisma, 16 models, cuid primary keys** | cuid over auto-increment: IDs appear in URLs, and sequential IDs leak volume and permit enumeration |
| D2 | **Hybrid relational + JSON** — `Form.schema`, `Form.settings`, `Submission.data` as `LongText` JSON; everything about *access* fully relational | A form's shape is user-defined and changes per form; a table per field type would be a schema migration every time a user adds a question. Access control is fixed and must be joinable, so it's normalised |
| D3 | **Unique constraints that carry business rules** | `(orgId,userId)` one membership · `(orgId,email)` one live invite, updated in place rather than accumulating · `(orgId,slug)` form URLs · `(formId,principalType,principalId)` one share per principal · `(formId,identifier)` **the duplicate-vote guarantee** · `(formId,tokenHash)` one survey session · `(formId,identity)` one draft |
| D4 | **Composite read-path index `(formId, createdAt)`** | The submissions list is always "this form, newest first, paginated" — a composite index serves filter and sort from one structure |
| D5 | **Worker-poll index `(status, nextAttemptAt)`** on the outbox | The drain query is exactly this predicate; without it the worker table-scans on every tick |
| D6 | **Transactional outbox table** | Local write and remote mirror in one transaction — the remote half can neither fail the request nor be lost |
| D7 | **Precomputed `ProcessingResult`** (1:1 with submission) | You cannot index inside a JSON column, so scores and tallies are computed once at write time and read from a real table, instead of parsing every response on every dashboard load |
| D8 | **`RoleDefinitionCache`** — last-known-good authorization data | The in-memory cache starts empty, so a restart during an RBAC outage would be a total outage |
| D9 | **Deliberate cascade strategy** | `Cascade` down the ownership chain (org → forms → submissions → audit/processing) so deleting an org leaves no orphans; `SetNull` for `Form.teamId` because deleting a team must not delete its forms |
| D10 | **Nullable-then-backfill migrations** | `Form.teamId` is nullable so pre-existing rows survived the teams migration; new forms always land in a team |
| D11 | **10 ordered migrations, one of them data-repairing** | `20260904120000_unique_vote_identifier` had to deduplicate existing audit rows *before* the unique index could be added — you cannot add a constraint to data that already violates it |
| D12 | **DAO interfaces + factory**, MySQL / Firestore / MongoDB | Portability requirement from the platform team; discussed honestly in chain G |
| D13 | **Strict-anonymous surveys discard `ip` and `userAgent` at write time** | Redacting on read still means the data exists; a real anonymity promise means never persisting it |

### 6.4 AI

| # | Feature | Because |
|---|---|---|
| A1 | **Natural-language form generation** — "a leave request form for a 200-person company" → a full schema | The blank-canvas problem is the real barrier for non-technical authors |
| A2 | **Form-level AI editing** — "add a date of birth field," applied to an existing schema | Editing is a harder and more useful case than generation |
| A3 | **Agent invocation with cached bearer token** | The agent service uses a login-then-invoke flow; caching the token with expiry tracking removes a round trip from every request |
| A4 | **Bounded timeouts** — 10 s login, 30 s invoke | An LLM call is the slowest dependency in the system and must never hold a request open indefinitely |
| A5 | **Structured-output contract validation** | `agent_response` may arrive as a JSON string or a parsed object; both are handled, then the shape is checked (`form.fields` must be an array) before anything is used. **A model's output is untrusted input** |
| A6 | **Defaults normalisation** | Models omit optional blocks; a missing `settings` object is filled with safe defaults rather than crashing the builder |
| A7 | **Typed failure modes, no silent fallback** | 401/403 → "check credentials"; 404 → "check agent ID"; `ECONNABORTED` → "the agent timed out, try again"; `ECONNREFUSED` → "cannot reach the service." A deterministic fallback generator runs **only when the service is unconfigured**, never to paper over a real failure |
| A8 | **AI output re-enters through the same validation path** | An AI-authored schema is sanitised and validated exactly like a human-authored one — the model is not a trusted author |
| A9 | **AI suggests, never silently applies** (editor v2) | When the editor infers that "What is your email?" should be an email field, it *offers* the change with an accept/decline; an editor that quietly rewrites your work is worse than one that does nothing |

---

## 7. Multi-hop interview chains

This is the section to actually rehearse. Each chain is how a real interviewer
drills: a broad opener, then three or four narrowing follow-ups, ending in the
question designed to find out whether you understand it or memorised it.

Read the **⚑ kill shot** answers out loud until they're natural.

---

### Chain A — "How do you stop someone voting twice?"

**Hop 1 — "You have a poll. How do you prevent duplicate votes?"**

> Two mechanisms, and only the second one is a guarantee. Before doing any work
> I do a cheap read against an audit table to turn away the common case — the
> same person clicking submit twice, or coming back an hour later — with a clear
> message and no write. But that read is a fast path, not the check.

**Hop 2 — "Why isn't the read the check?"**

> Because two requests arriving in the same millisecond both see nothing and
> both pass. It's a classic check-then-act race. The real guarantee is a unique
> constraint on `(formId, identifier)` in the audit table. Both requests attempt
> the insert; the database rejects one with a duplicate-key error, and that
> request is turned away. The database decides the winner, not application code
> losing a race it can't win.

**Hop 3 — "You've already inserted the submission row by then. What happens to it?"**

> That's the part that took a second pass. I claim the vote *before* reporting
> success, and if the claim fails I delete the submission row I just wrote —
> a compensating action. So a rejected voter never leaves a row behind and the
> tally can't drift from the audit log. The earlier version wrote the audit row
> from a `setImmediate` callback *after* the response had gone out, which left a
> window of tens of milliseconds where any number of duplicate votes sailed
> through, and lost the record entirely if anything before the write threw.

**Hop 4 — "Why not wrap both writes in one transaction?"**

> I considered it and decided against it. The submission insert and the vote
> claim have different failure meanings: a failed submission is an error, a
> failed claim is a *business outcome* I need to report as "you have already
> voted." Wrapping them makes the rollback implicit and makes it harder to
> return the right message. It would also hold a transaction open across
> post-processing. Claim-then-compensate keeps each failure explicit. If this
> ran at much higher volume I'd revisit it, because the compensating delete is a
> second round trip.

**⚑ Hop 5 (kill shot) — "How do you identify a voter? Everyone in an office is behind one IP."**

> That's the honest limitation, and it's why identity is configurable per form:
> none, IP, or a verified email field. IP is the default because it needs
> nothing from the respondent, and I document that it's a deterrent, not
> a control — one corporate NAT is one voter. Email is the real control when the
> poll matters.
>
> The part I did get exactly right is *canonicalisation*. Two requests from the
> same person must produce byte-identical identifiers, and two different people
> must never collide. The old code failed both halves: `::ffff:203.0.113.9` and
> `203.0.113.9` counted as two voters, `Ada@x.com` and `ada@x.com` counted as
> two voters, and every voter with an unknown IP was bucketed under the literal
> string `'unknown'` — so the *first* such vote locked out all the rest. Now
> identifiers are namespaced (`ip:` / `email:`) so an address and an email can't
> collide, IPv4-mapped IPv6 is unwrapped, emails are lowercased and trimmed, and
> if the form limits voting but the voter can't be identified, it **fails
> closed** — because the alternative silently disables duplicate prevention for
> exactly the requests most likely to be automated.

---

### Chain B — "Walk me through a public form submission"

**Hop 1 — "Someone submits a public form. What happens?"**

Draw §4.3. Then: *"Ten steps, and the ordering is deliberate at three points."*

**Hop 2 — "Why is bot verification before validation?"**

> Everything after it is work proportional to the payload — JSON parsing, schema
> traversal, variable recomputation, and potentially outbound calls to
> third-party validation APIs. An unverified caller must not be able to make me
> do expensive things. The only thing that happens first is loading the form,
> because whether bot protection even applies is a property of that form's
> settings. The one fact an unverified caller learns is whether a form ID exists
> and is published — which the public form endpoint already tells anyone who
> asks.

**Hop 3 — "I POST a field ID that isn't in the form. What happens?"**

> Dropped. I build an allow-list from the published schema — enabled fields
> only, excluding display and HTML fields since those aren't respondent input —
> and every key not in that set is discarded before anything else runs. Without
> it you can inject arbitrary properties into a JSON blob that later gets
> rendered in a dashboard and exported to a CSV.

**Hop 4 — "I answer a field that a condition says should be hidden."**

> Also dropped. Every field's `showWhen` rule is re-evaluated on the server
> against the submitted data, and answers to fields that resolve invisible are
> deleted. This matters more than it sounds: a hidden field's answer can be
> forged completely independently of the condition that hides it, so if I only
> checked visibility in the browser, someone could submit "reason for leaving"
> on a form where they claimed they weren't leaving. That answer would then be
> in reports and in any downstream system. The same rule is applied to partial
> survey saves, so stale answers from an abandoned branch don't linger.

**⚑ Hop 5 (kill shot) — "The same validation logic exists in the browser and on the server. How do you keep them in sync, and what happens when they disagree?"**

> I treat them as having different jobs rather than as duplicates that must be
> identical. The client's job is *speed of feedback*; the server's job is *truth*.
> They share the rule vocabulary — the same operator set and the same
> `showWhen` tree shape, so `ruleEngine.ts` on the client and `validation.ts` on
> the server evaluate the same structure.
>
> When they disagree, the server wins and the disagreement must be *visible*,
> not a toast. Server errors come back keyed by field ID, and the public form
> renders them at the offending field and scrolls to the first one — including
> switching to the right step in a multi-step form. That way a client/server
> divergence looks like a normal validation error to the respondent instead of a
> mysterious failure.
>
> If I were doing it again I'd generate both from one schema definition rather
> than maintaining two evaluators. That's the real fix and I'd call the current
> state a known duplication.

---

### Chain C — "How does authentication work?"

**Hop 1 — "Describe your auth."**

> Identity is Keycloak, so I don't store passwords at all. The backend verifies
> RS256-signed JWTs against Keycloak's JWKS endpoint. Nothing is stateful on my
> side except a local `User` row mirroring the subject.

**Hop 2 — "Where do you get the public key from?"**

> From configuration — `KEYCLOAK_ISSUER`, with the JWKS URI derived from it —
> and never from the token being verified. That's the important part. If you
> take the issuer from the token's own `iss` claim, anyone who can stand up an
> OIDC issuer can mint a token for any user in your system, because you'll
> obligingly fetch their signing key and validate against it. It's also an SSRF:
> every request becomes an outbound fetch to an address the attacker chose. The
> algorithm is pinned to RS256 for the same class of reason — never trust the
> `alg` in the header. And the server refuses to start quietly if the issuer
> isn't configured; it logs that every request will be rejected.

**Hop 3 — "Where does the browser keep the token?"**

> The access token is in a module-scoped variable — memory only, never
> `localStorage`. This application renders form schemas authored by its own
> users, so XSS is a realistic threat model rather than a theoretical one, and
> anything in `localStorage` is one `document` read away. The session survives a
> reload through an `httpOnly`, `SameSite`, `Secure` refresh cookie that the page
> itself cannot read. The API also refuses to accept an access token from a
> cookie — header only — because accepting it from a cookie reopens CSRF on
> every write route.

**Hop 4 — "Five requests 401 at the same time. What happens?"**

> One refresh. There's a single-flight promise: the first 401 starts the refresh
> and every subsequent caller awaits the same promise, then all retry. That's
> not an optimisation — the server *rotates* the refresh token, so the cookie is
> spent the moment it's exchanged. Two overlapping refreshes means the second
> presents a token the server has already retired, the server correctly rejects
> it, and the user gets signed out for doing nothing wrong.

**⚑ Hop 5 (kill shot) — "The RBAC service that defines your roles goes down. What does a logged-in user experience?"**

> This one bit me, so I have a specific answer. Permissions resolve in two
> halves: *assignments* live in my database (`OrgUser.role`), *definitions* —
> what `ORG_ADMIN` is actually allowed to do — come from the RBAC service.
> During an outage the assignment is still there but the definition isn't, so
> naively every permission check resolves to an empty action set and every user
> becomes a viewer with no access.
>
> Three layers handle it. Effective permissions are cached per `(user, org)` for
> 30 seconds, so a brief blip is invisible. Definitions are also persisted to a
> `RoleDefinitionCache` table as last-known-good — because the in-memory cache
> starts empty, so a *restart* during an outage would otherwise be a total
> outage. And a genuine failure for an actual member surfaces as 503, not 403 —
> "the service is unavailable" rather than "you are not allowed," which is a
> much better error for a support ticket. A non-member never touches the remote
> service at all; they resolve to an empty action set locally.
>
> One more detail: an unknown role name contributes nothing rather than
> throwing, so one bad role definition can't lock a user out of everything else
> they hold.

---

### Chain D — "You claim anonymous surveys. Prove it."

**Hop 1 — "What does 'anonymous survey' mean in your system?"**

> It's a property of the *form*, called a response policy, with four values:
> `STANDARD`, `ANONYMOUS`, `BLIND_REVIEW`, `RESTRICTED`. And critically it's not
> a permission — it's a **ceiling**. Access resolves in three steps: the
> strongest organisation role, then any explicit share on that form, then the
> policy is applied last as a cap. Under `ANONYMOUS`, the cap is `AGGREGATE`:
> counts and distributions, no individual row.

**Hop 2 — "Can the organisation owner see one response?"**

> No. Not the owner, not a platform admin. That's the whole point of making it a
> ceiling applied after role resolution rather than a role that could be
> out-ranked. Roles answer "what is this person allowed to do." They structurally
> cannot answer "this survey promised anonymity" — that belongs to the form, and
> it has to outrank everyone.

**Hop 3 — "So the owner just switches the policy to STANDARD and reads them."**

> They can't, once responses exist. The policy locks on the first submission —
> there's a `responsePolicyLockedAt` timestamp set at that moment. People
> answered under the terms displayed on the form at that time, and widening the
> policy afterwards would retroactively break a promise that was already made.

**Hop 4 — "Four people in a team, three responded, and I can see the aggregate. That's not anonymous."**

> Correct, and that's handled. Aggregate breakdowns are suppressed below a
> five-response threshold — per-question distributions and the activity trend
> both. With three answers in a team of four, a breakdown is a guessing game.
> That threshold is the difference between an anonymity claim that holds and one
> that holds on average. Date buckets follow the same rule, because activity
> timing deanonymises a small group just as effectively as an answer
> distribution.

**⚑ Hop 5 (kill shot) — "You store IP and user agent on every submission. So it isn't anonymous, you're just not showing it."**

> Right, and that distinction is exactly why redaction on read isn't good
> enough. For strict-anonymous surveys the transport metadata is **discarded
> before persistence** — `ip` and `userAgent` are written as null, and
> identifying field types are stripped from partial saves too. The data doesn't
> exist to be subpoenaed, leaked, or exposed by a future bug in a code path I
> haven't written yet.
>
> The general principle I applied: redaction is a *view* concern and it's
> centralised in one function that every read path goes through, so a later
> feature like server-side search can't accidentally bypass it — search runs on
> the already-shaped data, not the raw rows. But for a promise as strong as
> anonymity, a view-layer control isn't sufficient; you have to not collect it.

---

### Chain E — "Why is a form response a JSON blob?"

**Hop 1 — "Why did you store submissions as JSON in a column instead of a normalised answers table?"**

> Because the shape of the data is defined by the user, not by me. A normalised
> design would be something like `submission_answers(submission_id, field_id,
> value)` — an EAV table. That works, but every read becomes an aggregation
> across N rows per response, and `value` still ends up as a string that has to
> be reinterpreted per field type, so you get the flexibility cost of JSON
> anyway without the read locality. The document is the natural unit: it's always
> written whole and almost always read whole.
>
> The important half of that decision is what I did *not* put in JSON. Anything
> that governs access — organisations, memberships, roles, teams, shares, audit
> rows — is fully relational, because that's fixed, joinable, and needs real
> constraints.

**Hop 2 — "How do you answer 'how many people picked option B'?"**

> Not by scanning JSON. That's what the `ProcessingResult` table is for — a 1:1
> companion to a submission holding computed output: assessment scores, pass/fail,
> vote tallies. It's written at submission time in a deferred post-processing step,
> so dashboards read a real table with real indexes instead of parsing every
> response on every page load. It's a precomputation trade: I pay a small write
> cost once so the read is cheap and repeatable.

**Hop 3 — "And an ad-hoc query nobody precomputed?"**

> Today that's a scan-and-parse in application code, which is honest to admit —
> it's fine at thousands of responses and wrong at millions. MySQL 8 supports
> functional indexes over JSON paths, so a specific hot query could be indexed
> without a schema change. The structural answer is that analytics doesn't belong
> in the transactional store at all: I'd stream submissions to a columnar store
> and query there.

**Hop 4 — "The form's schema changes after 10,000 responses. What breaks?"**

> This is the real cost of the design and I'd rather name it than be caught by
> it. Responses are stored keyed by field ID, and field IDs are stable across
> edits, so renaming a question's *label* is safe — old responses still resolve.
> Deleting a field leaves orphaned keys in old responses, which render as
> "unknown field" rather than disappearing. Changing a field's *type* is the
> genuinely dangerous one: a checkbox becoming a text field means old responses
> hold arrays where new code expects strings.
>
> What I'd add is schema versioning — stamp each submission with the schema
> version it was captured under, and keep old versions immutable. That's the
> correct fix and it's a real gap today.

**⚑ Hop 5 (kill shot) — "Export 50,000 responses to CSV. Walk me through it without falling over."**

> The current implementation materialises through the same read path, and at
> 50,000 rows that's a memory problem — it holds every parsed response plus the
> serialised output in the process at once.
>
> How I'd fix it, in order: stream rather than accumulate — cursor-paginate the
> submissions with keyset pagination on `(formId, createdAt, id)` rather than
> `OFFSET`, which degrades linearly, and pipe rows through a CSV transform
> straight to the response so peak memory is one page, not one export. Then move
> it off the request path entirely: an export becomes a job, the user gets an
> email with a signed link, and the file is built by a worker. That also fixes
> the timeout problem, which arrives before the memory problem does.
>
> There's a detail specific to this system: the export must run through the same
> redaction choke point as every other read, and `EXPORT` is a deliberately
> separate access tier from `FULL` — because bulk download is the moment data
> leaves the platform, and that's the event a customer's compliance team will
> ask about.

---

### Chain F — "You integrated an AI service. What could go wrong?"

**Hop 1 — "What does the AI actually do?"**

> Two things: generate a full form schema from a natural-language description,
> and apply a natural-language edit to an existing form. Generation solves the
> blank canvas; editing is the harder and more useful one.

**Hop 2 — "The model returns something that isn't valid JSON. Then what?"**

> The response is treated as untrusted input, which is the framing that matters.
> `agent_response` can arrive as a parsed object or as a JSON string depending
> on the API version, so both are handled; a parse failure raises a specific
> error rather than propagating `undefined` into the builder. Then the *shape* is
> validated before anything uses it — `form.fields` has to be an array or it's
> rejected. Missing optional blocks like `settings` are filled with safe defaults,
> because models omit optional things constantly and that shouldn't be an error.

**Hop 3 — "It returns a valid JSON form containing a field type you don't support."**

> It flows into the same sanitisation and validation path as a human-authored
> schema — the AI is not a privileged author. The public schema sanitiser strips
> anything sensitive, and an unrecognised field type doesn't render. The
> principle is that there is exactly one door into the schema, and the model uses
> the same one a user does.

**Hop 4 — "The user's prompt is passed to a model. Prompt injection?"**

> The realistic risk here isn't data exfiltration — the agent doesn't have access
> to my database, it's a text-in/JSON-out call, and I send only the user's prompt.
> The realistic risk is a *malicious schema*: a prompt that coaxes the model into
> producing a field whose label or HTML content contains a script payload, which
> then executes in the browser of whoever opens the form. That's handled by the
> same XSS sanitisation that protects against a user typing it directly, because
> both end up in the same schema field. The general rule: model output gets no
> more trust than form input.

**⚑ Hop 5 (kill shot) — "The AI service is slow or down. What does the user see, and what does it cost you?"**

> Bounded and typed. Ten-second timeout on the auth call, thirty on the
> invocation, so the request can never hang. Failures are mapped to specific
> messages instead of a generic 500 — 401/403 says the credentials are wrong,
> 404 says the agent ID is wrong, a timeout says the agent is overloaded and to
> retry, connection-refused names the unreachable host. Those are messages an
> operator can act on at 2am.
>
> The decision I'd defend hardest: **there is no silent fallback when the service
> is configured.** There *is* a deterministic template generator, but it only
> runs when AI is unconfigured — as a development affordance. Falling back to a
> generic form when a real call fails would mean the user gets something plausible
> but wrong, doesn't know AI failed, and I never see the error rate. Silent
> degradation is how you ship a broken integration for six months.
>
> On cost: the bearer token is cached with expiry tracking so I'm not paying a
> login round trip per request. Generation is an explicit user action, never
> automatic — nothing calls the model on a keystroke. If this scaled I'd add a
> per-org rate limit and cache on a hash of the prompt, since "contact form" is
> going to be asked for a thousand times.

---

### Chain G — "Three database implementations. Really?"

*This chain is a trap. The interviewer wants to see whether you can criticise
your own architecture. Do not defend it enthusiastically.*

**Hop 1 — "Why is there a DAO layer with MySQL, Firestore and Mongo implementations?"**

> It came from a platform requirement to be deployable into environments with
> different managed-database choices, alongside the same requirement for
> runtimes — the controllers exist as Express, Cloud Functions and Lambda
> adapters over one service layer. The structure is: controllers translate
> protocol, services hold every business rule, DAOs are the only thing that
> knows about storage, and a factory picks the implementation from `DB_TYPE`.

**Hop 2 — "What did that cost you?"**

> Real money, and I'd say so in a design review. Three costs. First, the DAO
> interface can only express the intersection of what all three backends do
> well, so I lose MySQL-specific things I'd otherwise want. Second, only one
> implementation is genuinely exercised — the others are correct by inspection,
> not by traffic, which is a polite way of saying partially unverified. Third,
> and worst: **transactions don't abstract.** The outbox pattern depends on
> writing two rows in one transaction, which is a Prisma/MySQL capability, so
> that code reaches past the DAO to the Prisma client directly. That's a leak in
> the abstraction, and it's in the most consistency-critical path in the system.

**Hop 3 — "So would you do it again?"**

> Not the same way. I'd keep the *layering* — services free of storage
> concerns is what makes the code testable and what let the same logic run
> behind three runtimes, and I'd defend that unconditionally. I'd drop the
> multi-backend *implementations* until there was a second real deployment
> demanding one. The interface is cheap; three implementations of it are not.
> That's speculative generality — I paid for optionality that hasn't been
> exercised.
>
> The honest version of the requirement was "don't scatter SQL through the
> business logic," and the interface alone satisfies it.

---

### Chain H — "Permission checks on every request. Isn't that slow?"

**Hop 1 — "Every endpoint resolves permissions. What's the cost?"**

> It'd be one local query plus one remote call per request if it were naive, so
> effective permissions are cached per `(user, org)` for 30 seconds. The
> expensive half — resolving role definitions from the RBAC service — is what's
> cached.

**Hop 2 — "An admin removes someone's access. They keep it for 30 seconds?"**

> No — the cache is explicitly invalidated on membership and role changes, by
> user, by org, or wholesale for a role-definition change. The TTL is a backstop
> for changes I don't originate, not the primary mechanism.

**Hop 3 — "It's an in-process Map. You run four instances behind a load balancer."**

> Then invalidation is local to one instance and the other three keep serving
> stale decisions for up to the TTL. That's a genuine limitation of the current
> design and the reason the TTL is 30 seconds rather than 30 minutes — it bounds
> the staleness window to something I can defend for an authorization change,
> while still removing the remote call from the hot path.
>
> The fix is Redis with pub/sub invalidation, which turns the four local caches
> into one shared one. I'd want that before multi-instance production. There's
> also a subtlety worth flagging: I'd cache the *definitions*, which are shared
> and change rarely, rather than the *decisions*, which are per-user and change
> often — better hit rate and a much smaller invalidation surface.

**⚑ Hop 4 (kill shot) — "Where do you NOT cache, and why?"**

> Per-form access — the `getFormAccess` resolution — is deliberately uncached. It
> depends on the form's team, its response policy, and its share list, all of
> which change independently of the role cache underneath it. Caching a value
> with three independent invalidation triggers is how you ship a permission bug.
> The expensive part of it, role resolution, is already cached one layer down, so
> the uncached part is cheap local reads. That's the general rule I applied:
> cache the expensive and stable thing, not the composed thing.

---

### Chain I — "How do file uploads work?"

**Hop 1 — "A respondent uploads a 10 MB PDF. Where does it go?"**

> Not to my server's disk, and not through my server at all if I can help it. It
> goes to an external document-management service via a three-step handshake:
> the API initiates an upload and gets back a document ID and a short-lived
> signed URL, the browser PUTs the bytes directly to that URL, then the API
> confirms with size and checksum. My app servers stay stateless and disposable
> — no volume to attach, no cleanup job, no file surviving a deploy.

**Hop 2 — "Why not just write to the local filesystem or S3 directly?"**

> Local disk fails the moment you have more than one instance — the file is on
> the box that received it. S3 directly would be fine technically; the DMS was
> the organisational answer, because it already had retention policy, versioning
> and tenant isolation that I'd otherwise be reimplementing badly. The
> architectural property I cared about is the same either way: bytes never
> transit the application process.

**Hop 3 — "I have a document ID from another organisation's form. Can I download it?"**

> No. A document ID is not an authorisation. The download path fetches the
> document's metadata, extracts the `orgId` it was stored under, and checks it
> against the caller's organisation before issuing a signed URL. Signed URLs are
> short-lived, so even a leaked one expires.

**⚑ Hop 4 (kill shot) — "How do you enforce 'PDFs only, max 5 MB' when the client can lie?"**

> Layered, and the client layer is only for the error message. There are two
> configuration levels: the form's own upload policy in Access & Security, and a
> per-question restriction — with the rule that **the question can only narrow
> the form's policy, never widen it**, so the effective rule is the intersection
> and a field can't grant itself more than the form allows. That's enforced
> server-side, not in the UI.
>
> The check that counts happens on confirm: the size and checksum reported at
> confirmation are what get validated, and an unconfirmed document is never
> attached to a submission. A MIME type sent by a browser is a claim, not
> evidence — content-based type detection would be the next hardening step, and
> I'd call that a gap today rather than pretend the extension check is
> sufficient.

---

### Chain J — "You mentioned a redesign. Sell it to me."

*Have this ready — it shows product judgement, which is rarer than technical
depth and weighs heavily for senior roles.*

**Hop 1 — "What was wrong with the editor?"**

> The specific failure: to change a question's label you clicked the question on
> the canvas, then looked at a 21-section accordion panel on the right, opened
> "Basic Properties," and typed into a field labelled "Label" — while the actual
> label sat in a different pane, in a different font size, three hundred pixels
> away. The panel's contents also swapped entirely every time you selected a
> different field, so it never became familiar. Non-technical authors didn't
> discover it.

**Hop 2 — "What did you change?"**

> One principle: **editing happens on the question; the side panel is for the
> form, not the field.** The label is edited where the label appears, in the
> form's own type, with the live answer control beneath it at real respondent
> size. Everything that was in the panel moved to a per-question `⋮` menu
> written in plain language — "Only show this sometimes" instead of "Conditional
> Visibility," "Limit the answer" instead of "Input Validation." The palette went
> from 17 widget names to 8 intentions, because nobody thinks "I need a radio
> button," they think "which department are they in."

**⚑ Hop 3 (kill shot) — "That's a rewrite. How do you ship it without a six-month project?"**

> It isn't, and that was the insight that made it viable. The field inspector was
> mostly a *launcher* — seven of its sections were a button that opened a dialog
> that already exists as a standalone component: conditional visibility,
> validation, external validation, field linking, custom alerts, support
> documents, table config. Re-pointing those same dialogs at a per-question menu
> removes the panel without rewriting a single feature.
>
> So the sequencing is: move the label and description onto the canvas first —
> that's the highest-value, lowest-risk change and it's independently shippable.
> Then re-point the dialogs. Then the palette. Each step is separately
> releasable and separately reversible. And I built a fully interactive HTML
> prototype of the end state first, so the design could be argued about before
> anyone wrote React.

---

## 8. Rapid-fire one-liners

Prepare these for the "quick questions" round.

| Question | Answer |
|---|---|
| Why Prisma? | Type-safe query results flowing into TypeScript services, and a real migration history. The escape hatch to raw SQL exists when I need it. |
| Why Redux Toolkit over Context? | The builder has deeply nested state mutated from three panes at once. Context re-renders the whole tree; RTK gives selective subscription and a serialisable state I can snapshot for undo. |
| Why cuid over UUID or auto-increment? | IDs appear in URLs. Sequential IDs leak volume and invite enumeration. cuid is collision-resistant and roughly sortable. |
| Why zod on both sides? | One schema language for request validation and form validation, with types inferred rather than declared twice. |
| Biggest bug you fixed? | A duplicate-vote race where the audit row was written after the response had been sent. Moved the guarantee into a unique constraint. |
| Hardest bug? | Switching organisations signed users out — the org-switch abort logic cancelled the in-flight `/auth/session` request, and an aborted session read looks identical to a failed one. Fixed by exempting auth paths from the org-scoped abort controller, not by patching the reducer. |
| What would you do first with another month? | Schema versioning on submissions, Redis-backed permission cache, and streaming exports as background jobs. |
| How did you test it? | Type-checking and lint as the gate, pure functions unit-tested, manual testing across the flows. Coverage on the validation and permission layers is the gap I'd close first — those are the two places a bug is a security bug. |
| Most valuable thing you learned? | That "the database enforces it" and "the code checks it" are different strength guarantees, and knowing which one a requirement needs. |

---

## 9. Weaknesses to own

Volunteer one or two of these before you're asked. It converts a weakness into
evidence of judgement — and it lets you choose which weakness gets discussed.

1. **Automated test coverage is thin.** Say it plainly: the gate was
   type-checking, lint, and manual testing, and the two places I'd write tests
   first are the submission validator and the permission resolver, because a bug
   there is a security bug rather than a broken screen.
2. **No submission schema versioning.** Responses are keyed by field ID and
   field IDs are stable, so labels can change safely — but a field *type* change
   after responses exist can leave old data in a shape new code doesn't expect.
3. **The permission cache is per-instance.** Fine for one process, wrong behind
   a load balancer. Redis with pub/sub invalidation is the fix; the 30-second TTL
   bounds the damage in the meantime.
4. **Exports are synchronous.** They should be background jobs with a signed
   download link. Memory and timeouts both bite before correctness does.
5. **Three DAO implementations, one exercised.** Speculative generality — see
   chain G.
6. **Some large components need decomposition.** The builder page and the public
   form renderer are both over a thousand lines. Not a correctness problem, but
   it slows every change and I'd split them along the seams I already know.

**How to deliver these:** *"Want me to tell you what I'd fix first if I picked it
back up?"* — then give two, with the fix, in one sentence each. Never list all
six; that reads as a lack of confidence rather than self-awareness.

---

## 10. Phrases that signal seniority

Work these in naturally. Each one signals a specific kind of thinking.

| Phrase | Signals |
|---|---|
| "That's a check-then-act race, so the guarantee has to be in the database." | You understand concurrency, not just syntax |
| "It fails closed." | You reason about failure modes as design |
| "Redaction is a view concern, but for a promise that strong you have to not collect it." | You distinguish policy from mechanism |
| "The database decides the winner, not application code losing a race it can't win." | Memorable and correct |
| "That's speculative generality — I paid for optionality I never exercised." | You can name your own anti-patterns |
| "Roles answer *what may this person do*; they structurally cannot answer *this survey promised anonymity*." | You see the limits of a model |
| "Cache the expensive and stable thing, not the composed thing." | You have a rule, not a habit |
| "Silent degradation is how you ship a broken integration for six months." | Operational maturity |
| "An index makes the lookup fast; the constraint makes the rule true." | Precision about database semantics |
| "Model output gets no more trust than form input." | Modern security instinct |

---

## 11. Night-before checklist

**Be able to draw, from memory, in under 90 seconds each:**

- [ ] The context diagram (§4.1)
- [ ] The submission sequence with its ten steps in order (§4.3)
- [ ] The permission resolution flow ending in the policy ceiling (§4.4)
- [ ] The outbox loop (§4.5)

**Be able to recite the because-clause for:**

- [ ] JWKS URI from config, not from the token
- [ ] Access token in memory, refresh token in an `httpOnly` cookie
- [ ] Unique constraint on `(formId, identifier)`
- [ ] Response policy as a ceiling, locked at first submission
- [ ] The five-response k-anonymity threshold
- [ ] Field-ID allow-list and server-side `showWhen` re-evaluation
- [ ] `ProcessingResult` as precomputation over an unindexable JSON column

**Have ready as stories, not facts:**

- [ ] The duplicate-vote race — the bug, the wrong fix, the right fix
- [ ] The org-switch sign-out — how you found it and why the obvious fix was wrong
- [ ] The editor redesign — the observation, the principle, the shipping sequence

**Rehearse out loud:**

- [ ] The 30-second pitch. Time it. It should be 30 seconds, not 70.
- [ ] Chain B end to end, including the kill shot
- [ ] Chain G — the one where you criticise your own architecture

**Finally:** if you don't know something, say "I don't know — here's how I'd find
out." Interviewers deliberately push past the edge of what you built to see what
you do when you get there. Confident ignorance is a pass; confident invention is
a fail.

---

*Generated from the SifyForms codebase. Every technical claim traces to a file in
this repository — see the "Where" column in Section 6.*
