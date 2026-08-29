# SifyForms production readiness and scale plan
## Target: approximately 10 lakh members and 3 lakh concurrent users/submissions

**Review date:** 2026-08-28 (UTC)
**Scope:** deployment architecture, capacity, reliability, abuse resistance, database design, caching, queues, observability, and load-test acceptance criteria for the Form Builder and published public forms.

> **Decision:** The current single Express/Prisma process with synchronous JSON work, process-local permission cache, `setImmediate` processing, global 50 MB request bodies, browser polling, and public client-controlled integrations is not a production architecture for the stated target. Scale must be demonstrated with measured tests; instance counts below are sizing methods and illustrative calculations, not a capacity guarantee.

## 1. Assumptions and traffic model

“10 lakh” is treated as approximately **1,000,000 registered members**. “3 lakh concurrent” is treated as up to **300,000 active browsers and/or submission attempts**, not merely 300,000 dormant TCP connections. The actual launch profile must be agreed with product and exam operations; capacity must cover both normal traffic and hostile automation.

### Baseline scenarios

| Scenario | Active users | Burst window | Initial planning rate | Notes |
| --- | ---: | ---: | ---: | --- |
| Ordinary browsing | 1,000,000 registered / small active fraction | 15 min | Measure from analytics | CDN should serve most published form GETs. |
| Registration peak | 300,000 active | 10 min | 500 final submits/s if evenly distributed | Real deadlines are usually spikier than this. |
| Hard burst | 300,000 active | 60 s | 5,000 final submits/s | Use for edge/API/queue fail-safe tests. |
| Extreme click/retry burst | 300,000 active | 30 s | 10,000 final submits/s | Include duplicate clicks, timeouts, bot traffic, and reconnects. |
| Result/status polling as currently implemented | 300,000 browsers | every 1.5 s | **200,000 requests/s** | `300,000 / 1.5`; redesign before load testing. |
| Public form cache miss | 300,000 browsers | 60 s | 5,000 manifest GET/s | A CDN hit ratio of 99% reduces origin load to roughly 50/s at this rate, but invalidation and attack traffic still matter. |
| Upload storm | Define per-file profile | 10 min | Calculate from bytes/s | Example: 100 KB average × 500 submissions/s = 50 MB/s ingress before retries; documents can be much larger. |

These are planning envelopes. Establish a traffic budget for each tenant/form, because one very popular examination must not exhaust capacity for all organizations.

### Capacity formulas

Use measured service-level throughput rather than guessing pod counts:

```text
required_stateless_instances =
  peak_requests_per_second × p95_cpu_or_latency_headroom
  / sustained_requests_per_instance
```

For example, if an isolated API pod sustains 200 requests/s at the chosen p95/p99 target and the design target is 10,000 requests/s with a 1.5 safety factor, the illustrative requirement is `10,000 × 1.5 / 200 = 75` pods. This is not a recommendation until measured with production-like payloads, database latency, TLS, logging, and failure injection.

For database connections:

```text
sum(max_connections_per_instance across API/workers) <=
  database connection budget, with a reserved failover margin
```

Use a pooler/proxy and small per-process pools. Do not multiply the database's maximum connection setting by the maximum autoscaled pod count.

For queue workers:

```text
workers >= peak_job_rate × average_job_seconds × safety_factor
```

Then cap concurrency per tenant and per integration so a slow external validator cannot consume the entire worker fleet.

## 2. Target architecture

```text
                         ┌─────────────────────────────┐
                         │ DNS / CDN / WAF / bot layer  │
                         │ TLS, rate limits, DDoS       │
                         └──────────────┬──────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │ Regional load balancer       │
                         │ trusted proxy headers        │
                         └──────┬─────────────────┬─────┘
                                │                 │
                 ┌──────────────▼─────┐ ┌───────▼──────────────────┐
                 │ Stateless public API│ │ Auth/editor API           │
                 │ form manifest,      │ │ RBAC, revisions, admin    │
                 │ submit, status      │ │ low, separately limited   │
                 └──────┬─────────────┘ └───────┬──────────────────┘
                        │                         │
          ┌─────────────▼─────────────┐ ┌───────▼─────────┐
          │ Redis cluster              │ │ MySQL primary   │
          │ rate/idempotency/session,  │ │ transactional   │
          │ hot manifests, short locks │ │ writes          │
          └─────────────┬─────────────┘ └───────┬─────────┘
                        │                       │
                 ┌──────▼─────────┐   ┌────────▼─────────┐
                 │ Durable queue  │   │ Read replicas /  │
                 │/outbox         │   │ analytics sink   │
                 └──┬─────────────┘   └──────────────────┘
                    │
   ┌────────────────▼────────────────────────────────────────┐
   │ Workers: validation connectors, scoring, votes, exports, │
   │ emails, DMS scan/finalize, payment reconciliation        │
   └──────────────┬──────────────────────┬───────────────────┘
                  │                      │
        ┌─────────▼─────────┐  ┌─────────▼──────────────────┐
        │ Object storage/DMS │  │ Payment/OTP/connectors      │
        │ quarantine + scan  │  │ egress proxy + webhooks     │
        └────────────────────┘  └────────────────────────────┘
```

### Required properties

- **Stateless API processes:** no request-critical state in process memory. The current RBAC cache is local to one process and can be stale or inconsistent after horizontal scaling; move it to Redis or use short-lived versioned cache entries with reliable invalidation.
- **Separate public and control planes:** published manifest, submission acceptance, status, and public aggregate endpoints have distinct routes, quotas, data stores/caches, and autoscaling signals from builder/admin/AI/export traffic.
- **Immutable published artifact:** render a sanitized, versioned respondent manifest from a private draft. CDN and browser cache only that artifact; never cache a full editor form or secret-bearing settings object.
- **Durable asynchronous work:** submission acceptance should commit a small transaction and enqueue jobs through an outbox or a durable broker. `setImmediate` is not a queue and loses work on restart.
- **Dedicated egress:** external validation and payment calls go through connector workers/proxies with DNS/IP policy, secrets injection, timeouts, circuit breakers, and per-tenant concurrency.
- **Object storage for files and exports:** API nodes should not receive base64 files or hold large export buffers. Use direct, single-purpose signed URLs and quarantine/scan pipelines.
- **Measured data locality:** select a primary region and disaster-recovery region; define whether respondent PII and payment data may leave the required jurisdiction.

## 3. Edge, CDN, and network controls

### CDN strategy

Cache only public, sanitized, revisioned resources:

- published form manifest keyed by `orgSlug/formSlug/revisionHash`;
- immutable static JavaScript/CSS/images with content hashes;
- safe public support documents with short TTLs if intended.

Do not cache:

- authenticated editor responses;
- drafts, result tokens, submissions, payment status, DMS private documents, or response exports;
- a URL whose authorization is represented only by a query string unless the token is short-lived, scoped, and cache behavior is explicitly safe.

Use `ETag`, `Cache-Control: public, max-age=...`, `stale-while-revalidate` only for artifacts that are safe to share. Publish should atomically promote the revision and purge/invalidate the old manifest. Avoid a cache key based only on a mutable slug if a user can swap the slug's organization/form target.

### WAF and edge limits

At the trusted edge:

- terminate TLS and enable managed DDoS controls;
- enforce body-size, header-size, connection, request-rate, and concurrency budgets before traffic reaches Node;
- use bot/challenge controls for public submit/OTP/upload routes, with privacy-appropriate exemptions;
- limit methods and content types by endpoint;
- reject malformed/chunked abuse and slow-client connections;
- use an explicit trusted-proxy configuration so the application, not the caller, determines the client IP from a verified proxy header;
- apply per-IP, per-ASN, per-form, per-respondent session, and per-account limits, with a safe fallback when Redis is unavailable.

CORS should allow only the exact application origins required for browser APIs. Do not use permissive origin reflection. Add HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, clickjacking protection (`frame-ancestors`), and a tested CSP that does not require `unsafe-eval`.

## 4. API and rate-limit design

### Endpoint classes

| Class | Examples | Edge limit | App limit/behavior |
| --- | --- | --- | --- |
| Public manifest | Published form GET | CDN + per-IP miss limit | Serve sanitized immutable revision; no database hit on CDN hit. |
| Submit/unique | Create submission, idempotency, uniqueness | Strict body/concurrency/IP/form limits | Require revision/session where configured; idempotent; enqueue work. |
| OTP/auth | Send/verify | Very strict identity/IP/device quotas | Hash challenge, expiry/attempt cap, provider audit. |
| Upload | Initiate/confirm | Byte/session/rate limits | Signed upload session, scan/quarantine, DMS ownership checks. |
| Public result | Result/status | Token/IP/form quotas | Verify signed audience-bound token; short response; no polling storm. |
| Public aggregate | Poll results | CDN/Redis cache + query budget | Enforce setting and k-threshold; precomputed counters. |
| Editor CRUD | Save/publish/share | Account/org/team quotas | Action RBAC, revision conflict detection, audit. |
| AI/CSV/export | AI generate, parse, export | Very strict cost/size/concurrency quotas | Async jobs, per-org budgets, bounded parser, progress status. |
| Integrations | External validation/payment | Connector concurrency/egress policy | Worker circuit breaker, no arbitrary URL/secret from public content. |

### Idempotency and retries

For final submission, payment order, upload confirm, OTP verification, and any state transition:

1. Require an opaque `Idempotency-Key` or server-issued operation token.
2. Store `{tenantId, operation, key, requestHash, status, response/reference, expiresAt}` with a unique constraint.
3. Return the original result for a byte-equivalent retry; reject a changed payload under the same key.
4. Make queue jobs and provider webhooks idempotent. Store provider event IDs and signatures.
5. Use exponential backoff with jitter and a bounded retry count; show a recoverable status instead of duplicating a registration.

### Public request shape

The public client should send a small `{formId/revisionId, respondentSession, idempotencyKey, values, uploadTokens, consentVersion}` envelope. The server should derive the canonical schema, payment amount, scoring policy, and visibility rules. Do not accept client `isPublished`, answer keys, payment tenant/gateway secrets, arbitrary `formId`/field reference combinations, or a client assertion of “verified”.

## 5. Database and persistence design

### Recommended entities

Add or model these separately rather than overloading mutable JSON:

- `Organization`, `User`, `Team`, and membership/role tables with tenant-scoped unique keys.
- `Form` as stable identity and `FormRevision` as immutable draft/published versions: `id`, `orgId`, `teamId`, `revisionNumber`, `status`, `schemaHash`, sanitized public manifest, private authoring data, `createdBy`, `publishedAt`, `publishedBy`.
- `Submission`: `id`, `orgId`, `formId`, `revisionId`, `respondentSessionHash`, `status`, `idempotencyKey`, `createdAt`, `acceptedAt`, `paymentState`, `processingVersion`; keep raw PII separately encrypted or in a value table according to retention needs.
- `SubmissionValue` for indexed values used by uniqueness/reporting, with field ID, normalized value hash, encrypted display value where needed.
- `UniqueValueClaim`: unique `(formId, revision/field policy, normalizedValueHash)` where the business rule requires it. Handle release/update semantics explicitly.
- `UploadSession`, `Document`, `DocumentScan`, and `SubmissionDocument`: form/field/session ownership and state are first-class relations.
- `PaymentOrder`, `PaymentEvent`, and `WebhookReceipt`: server amount/currency, provider order ID, state machine, signature/event uniqueness.
- `ProcessingJob`, `OutboxEvent`, `AssessmentResult`, `VoteClaim`, and immutable audit events. Define unique keys for job type/submission/revision and vote identity.
- `AggregateCounter` keyed by form/revision/option or a stream-derived read model; never calculate the full total from every submission on every poll.

### Tenant and index rules

Every tenant-owned row and DAO query should carry `orgId`/tenant context. Add compound indexes based on real query plans, for example:

- `(orgId, slug)` and `(orgId, formId)`;
- `(formId, status, createdAt, id)` for submission queues/keyset pagination;
- `(formId, revisionId, createdAt)` for processing/reporting;
- `(formId, idempotencyKey)` unique;
- `(formId, normalizedIdentityHash)` unique if one-vote policy applies;
- `(formId, fieldId, normalizedValueHash)` for uniqueness claims;
- `(documentId, formId, fieldId, sessionId)` for ownership checks.

Use `EXPLAIN`, production-like cardinality, and online index migration. Do not assume an index on `formId` makes `JSON.parse` of every row fast; extract/query only the values needed for an operation.

### Partitioning, retention, and backups

- Partition or archive submissions, audit events, and job history by tenant/time once measured row volume warrants it. Avoid one unbounded JSON table as the reporting database.
- Put long-lived exports and large documents in encrypted object storage with lifecycle rules. Store metadata and an expiring pointer in MySQL.
- Define retention by data category: drafts, rejected uploads, raw submissions, processing results, audit events, payment records, and support documents may have different legal requirements.
- Run encrypted daily full plus point-in-time recovery backups; test restore in a separate account/region. Define RPO/RTO with the business (a reasonable starting target is RPO ≤5 minutes and RTO ≤30 minutes, subject to approval).
- Use replica lag monitoring and failover runbooks. Do not send a just-submitted read to a stale replica when the user needs an authoritative receipt.

## 6. Queue and processing design

### Submission state machine

```text
RECEIVED → VALIDATING →
  REJECTED
  ACCEPTED → PAYMENT_PENDING → PAID → PROCESSING → COMPLETE
                         ↘ PAYMENT_FAILED
                   PROCESSING → RETRYING → DEAD_LETTER
```

The exact states depend on whether unpaid submissions are retained. Every transition must be authorized, idempotent, auditable, and bound to `formId`/`revisionId`.

### Work queues

Use separate queues and worker pools for:

- canonical validation/external connector calls;
- assessment scoring/ranking;
- poll/aggregate read-model updates;
- email/SMS/OTP delivery;
- DMS finalization and malware scan;
- PDF/receipt/export generation;
- payment reconciliation and webhook processing;
- AI generation/editing.

A slow external validator, AI call, PDF job, or virus scanner must not block the public submission acceptance path. Use queue visibility timeouts, retry backoff, dead-letter queues, poison-message detection, maximum execution time, and tenant fairness.

### Scoring and ranking

Score against the immutable revision recorded on the submission. Compute a result once, store the score/result version, and update a leaderboard read model incrementally. If ranking ties or late submissions matter, define a deterministic ordering key (score, acceptedAt, submission ID or an approved business rule). Do not scan and sort every prior result for each new submission.

## 7. Caching and consistency

- Redis is appropriate for short-lived OTP/challenge state, rate limits, idempotency records, distributed locks, permission-version cache, form manifest cache, and job progress. Do not use it as the only durable source of submissions.
- Cache keys must include organization/form/revision and never allow an attacker to swap tenant context. Cache response policy and visibility together with the data or re-check policy before serving.
- Invalidate or version form manifest caches on publish. Immutable revision hashes reduce invalidation races.
- Use read-through/precomputed counters for public aggregates and add a query budget per form/session to prevent differencing.
- Avoid caching PII/result responses in shared browser/CDN caches. Send `Cache-Control: private, no-store` for sensitive results and submissions.
- If a user needs read-after-write, use the primary or a session consistency token until the replica catches up.

## 8. Observability and operations

### Metrics

At minimum, emit low-cardinality metrics for:

- request count, rate, p50/p95/p99 latency, status by route class and tenant tier;
- 4xx/5xx, validation rejection, authentication failure, rate-limit challenge, idempotency replay/conflict;
- DB query latency, pool wait, lock/deadlock, slow-query count, replica lag, CPU/memory/disk/connection use;
- queue depth, age of oldest job, processing latency, retries, dead-letter count, per-tenant fairness;
- DMS upload bytes, scan duration/failures/quarantine, external connector latency/errors/circuit state;
- payment order state/reconciliation lag/webhook failures (without card/payment secrets);
- cache hit/miss and invalidation lag;
- public form conversion, abandonments, duplicate-click rate, and error step (aggregated and privacy-safe).

### Logs/traces

Use structured JSON logs with a request/correlation ID, tenant ID where allowed, form/revision ID, route class, status, latency, and safe error code. Redact authorization headers, OTPs, payment tokens, external connector headers, full URLs with secrets, full respondent data, files, and formula text. The current validation logging of headers/payloads/response data must be removed or aggressively redacted.

Distributed traces should cover edge → API → DB/cache/queue → worker → connector, with sampling and PII scrubbing. Never put email, phone, access token, answer text, or document URL in a trace span attribute.

### SLOs and alerts

Agree on targets, then alert on burn rate rather than noisy individual errors. A reasonable starting proposal:

- public published-manifest cache hit p95 ≤300 ms at the edge;
- submission acceptance p95 ≤1 s and p99 ≤3 s excluding asynchronous scoring/provider latency;
- verified final receipt/result availability p95 ≤10 s after accepted input, subject to queue load;
- 99.9% monthly public API availability initially, with an approved higher target for exam windows;
- queue oldest-job age, payment reconciliation lag, DMS scan lag, replica lag, error budget, and rate-limit/abuse anomalies.

Page on queue age, database saturation, error-budget burn, payment mismatch, DMS quarantine spikes, secret-access anomalies, and cross-tenant authorization test failures.

## 9. Security and failure behavior at scale

- Use a trusted WAF/load balancer and set Express `trust proxy` only for known proxy hops. Never use the first untrusted `X-Forwarded-For` value as identity/rate key.
- Deploy with least-privilege service accounts: API cannot read arbitrary cloud metadata or unrelated buckets; workers have only their connector permissions.
- Add circuit breakers and bounded fallbacks. If external validation is down, fail closed for eligibility-critical checks or explicitly queue/review; do not silently accept when policy requires validation.
- Backpressure early: return a retryable `202/429` with a safe operation reference when queues or per-form limits are full. Do not let Node accept unlimited bodies/connections while downstream is saturated.
- Gracefully drain workers/API on deploy; let in-flight idempotent jobs finish or requeue.
- Maintain a public-form kill switch, per-tenant freeze, payment disable switch, connector disable switch, and emergency read-only mode. These must be server-side controls.
- Run independent backups, disaster recovery, secret rotation, incident response, abuse handling, and data deletion exercises.

## 10. Load, resilience, and security test plan

### Test environment

Use production-like API builds, database engine/version, indexes, Redis/queue topology, object storage behavior, TLS/ingress, logging, WAF rules, and representative payloads. Use generated synthetic PII only. Do not point scanners or formula/SSRF proofs at production.

Seed at least:

- 1,000,000 users/members across many organizations;
- 100,000+ forms with uneven popularity and several very large forms;
- 300,000 active respondent sessions;
- realistic submissions with short, long, multi-select, table, and document-token values;
- assessment results, vote counters, drafts, shares, revisions, and audit records;
- external providers that simulate latency, timeout, error, redirect, and oversized response behavior.

### Test stages

1. **Contract/functional:** all DTOs, state transitions, idempotency, revision binding, payment webhooks, upload sessions, and RBAC matrix.
2. **Baseline:** establish per-instance throughput and p50/p95/p99 for manifest GET, form submit, status, editor save, login/OTP, upload initiate, and public aggregate.
3. **Load:** ramp to 5,000 submits/s and 300,000 active connections; separately test 10,000/s for 30 seconds. Include realistic cache hit/miss ratios.
4. **Poll redesign comparison:** prove that the redesigned result channel does not produce 200,000 requests/s. Test backoff/jitter, push, and cache behavior with reconnect storms.
5. **Soak:** 6–24 hours at sustained expected peak with autoscaling, queue processing, cache expiry, replica lag, log rotation, and memory leak checks.
6. **Spike/failover:** sudden 10× traffic, kill API/worker pods, fail Redis node, delay replicas, restart queue consumers, make DMS/payment/external validation unavailable, and verify no lost or duplicate submissions.
7. **Abuse/security:** Burp automation for body/depth/regex/CSV/fake IDs, parallel idempotency/unique/vote requests, invalid tokens, cross-tenant IDs, SSRF URL matrix, DMS replay, payment amount/callback tampering, and secret-response contract scans.
8. **Recovery:** restore database backup, replay outbox, reprocess dead letters, reconcile payment events, and verify audit/retention behavior.

### Acceptance gates

Do not launch until all are true:

- no Critical/High authorization, code execution, secret exposure, SSRF, payment integrity, upload ownership, public result, or data-integrity finding remains open without an explicitly approved compensating control;
- all public/editor DTO deny-list and cross-tenant tests pass;
- no duplicate accepted submission/order/vote under concurrent retries for the same idempotency/identity policy;
- queue jobs survive process/worker/region failure and are observable/replayable;
- p99 and error/queue/replica budgets remain within approved SLO at the hard-burst profile, with headroom;
- database CPU/IO/locks/connections, Redis memory, queue age, object-storage ingress, and egress costs remain within a documented budget;
- autoscaling, rate-limit, circuit-breaker, kill-switch, rollback, restore, and incident runbooks are exercised by named owners;
- all secrets are rotated and absent from repository history/config artifacts used for production.

## 11. Migration sequence

### Phase 0 — block unsafe launch

Fix F-01 through F-10 in `docs/FORM_BUILDER_PUBLIC_FORM_SECURITY_REVIEW.md`; remove dynamic code execution, public secrets, client-only payment/auth gates, arbitrary SSRF, unbound DMS/result access, and tracked credentials. Add negative authorization/DTO tests before exposing a new route.

### Phase 1 — establish safe correctness

Introduce immutable revisions, canonical server validation, submission idempotency, database uniqueness/vote claims, payment order/webhook state, upload sessions, safe result tokens, strict body/file limits, trusted proxy/CORS/security headers, and structured redacted logging.

### Phase 2 — decouple work and reads

Add outbox/queue/workers, Redis rate/idempotency/cache, precomputed aggregates/leaderboards, object storage/export jobs, connector egress, and database indexes/read models. Make the API horizontally stateless.

### Phase 3 — edge and resilience

Deploy CDN/WAF/load balancer, public/control-plane isolation, autoscaling, multi-zone database/Redis/queue, backups/DR, dashboards/alerts, kill switches, and tested failover.

### Phase 4 — capacity proof

Run the staged load/abuse/failure plan, tune based on actual p95/p99 and cost, publish a capacity envelope per form/tenant, and repeat before each major exam or registration event.

## 12. Current verification limitations

**Verification update: 2026-08-29.** The frontend build passes after the canvas-editor and client-only Preview changes. The local Preview does not exercise backend traffic, so the security and scale gates below remain required.

- The root frontend build passes but emits a large JavaScript chunk warning; bundle splitting is needed for the public page and builder.
- Root lint is not currently a clean release gate: the existing run reports 1,039 problems, including a parsing error in `src/pages/fix.js`, explicit `any`, unused variables, hook issues, and backend files included in the root scope.
- Backend dependency installation is blocked in this environment by `better-sqlite3` native setup and Node 22/network certificate/header-download issues. `npm ci --ignore-scripts` is diagnostic only and skips native/Prisma generation.
- Backend build fails at `src/scripts/seedTemplates.ts` because Prisma client generation was skipped; Prisma engine download also failed due to the environment's TLS connection failure.
- No application test suite was discovered or executed, and no live exploit or load test was performed.

These limitations do not reduce the severity of the static findings. They mean the next engineering step is to make the security and capacity tests runnable in CI and an isolated production-like environment.
