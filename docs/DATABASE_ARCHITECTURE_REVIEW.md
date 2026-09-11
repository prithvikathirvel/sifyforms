# Sify Forms Database Architecture Review

Review date: 2026-09-09. Scope: checked-in Prisma schema, all 11 SQL migrations, MySQL DAOs, owning services, and relevant HTTP routes/controllers.

**This is a report, not an applied migration. No database or application changes were made.**

## 1. Executive Summary

**Verdict: usable relational foundation; important security, transactional integrity, versioning, and query-scaling gaps prevent a production-readiness sign-off.**

- The actual provider is **MySQL**, not PostgreSQL. There are **19 application tables**, excluding Prisma's migration-history table. There are no native JSON/JSONB columns in the Prisma schema.
- Preserve the existing model. **Add one essential table: `form_versions`.** Do not automatically add fields, options, settings, publications, answers, integrations, payment, or file tables.
- Fix cross-tenant result/template reads and response-redaction bypasses first.
- Make submission + unique claims + vote claim atomic. Existing unique constraints are valuable, but compensating deletes do not replace a transaction.
- Snapshot published form definitions. Today, editing a published form changes the definition used to accept, score, redact, and export responses.
- Bound lists, exports, analytics, and processing. Several paths load all responses; voting performs repeated full-form scans.
- Keep MySQL unless PostgreSQL adoption is a separate, justified project. PostgreSQL would not fix the application authorization or transaction bugs automatically.

### Evidence and Limits

| Evidence | What was checked |
| --- | --- |
| [Prisma schema](../backend/prisma/schema.prisma) | All 19 models, columns, nullability, defaults, explicit indexes, uniqueness, and declared relations |
| [Initial migration](../backend/prisma/migrations/20260406100838_init/migration.sql) and subsequent migrations | Physical SQL types, collations, cascades, backfills, and destructive operations |
| [MySQL DAOs](../backend/src/dao/mysql) | CRUD, filters, ordering, joins, pagination, and selected payloads |
| [Services](../backend/src/service), [processors](../backend/src/services), [routes](../backend/src/routes) | Business rules, ownership, public/private access, concurrency, external services |
| Isolated execution | Actual result/template services executed with synthetic DAO stubs; reproduced missing ownership checks without a database connection |
| Not inspected live | Database contents, applied migration history, server version, deployed build, actual row counts, query plans, slow-query logs, backups, replication, credentials, or DB grants |

“Confirmed” below means source-confirmed, with isolated reproduction where stated. It does not mean production exploitation was demonstrated. Usage/growth estimates are inferred from code; no table can be declared rarely used or an index unused without telemetry. The SQL backup in the workspace was not treated as current production truth or opened for respondent data.

## 2. Current Architecture

```text
External UMS / Keycloak
    -> User projection
    -> Organization -> OrgUser / OrgInvite
                    -> Team -> TeamMember
                    -> Form -> FormShare
                            -> Submission -> ProcessingResult
                                          -> AuditLog (vote claims)
                                          -> SubmissionUniqueValue
                            -> PublicFormSession -> Draft
                            -> SurveyResponseSession

Template: global or organization-owned; organization link is not an FK
RoleDefinitionCache: external role-definition snapshot
UmsOutbox: external synchronization work
PublicRateCounter: shared fixed-window budgets
DMS: external files; POS: external payments
```

### Responsibility and Growth Inventory

| Current table | Single responsibility / actual use | Growth and decision |
| --- | --- | --- |
| `Organization` | Tenant identity, owner, provisioning lifecycle | One per tenant; keep |
| `OrgUser` | Organization membership and assigned role | Membership edges; keep |
| `OrgInvite` | Current invitation state per organization/email | Bounded by invitees unless retained indefinitely; keep |
| `RoleDefinitionCache` | Last-known external permissions definition | Roughly one per app/organization; keep as cache, not source of truth |
| `UmsOutbox` | Retryable UMS synchronization | Every mirrored change; unbounded without cleanup; repair delivery semantics |
| `Team` | Flat form grouping and share target | Teams per tenant; keep; do not restore hierarchy without need |
| `TeamMember` | Team membership | Membership edges; keep |
| `User` | Local identity/profile projection from UMS | Users across tenants; keep, minimize duplicated PII |
| `Form` | Form identity, editable definition, configuration, publication flag, privacy policy | Forms; draft and published lifecycle are incorrectly conflated |
| `FormShare` | Per-form access exception | Grants per form; keep one table |
| `Submission` | Accepted response and review/processing metadata | Dominant long-lived growth; keep JSON answers |
| `SubmissionUniqueValue` | Uniqueness reservation for configured answer fields | Responses times unique fields; necessary constrained projection |
| `PublicFormSession` | Server-issued respondent capability and budgets | Visits; 12-hour expiry with opportunistic cleanup |
| `PublicRateCounter` | Shared scope/window request budget | Active scopes times windows; keep |
| `SurveyResponseSession` | Incomplete survey payload and completion tracking | Survey starts, including abandonment; no expiry column |
| `ProcessingResult` | One derived assessment/voting result per submission | Assessment/voting responses; retain, extract queried scalars |
| `AuditLog` | One duplicate-prevention identity claim per vote | Identified votes; not a general or immutable audit log |
| `Draft` | Respondent's saved partial answers | Active drafts plus inaccessible legacy rows; not a builder draft |
| `Template` | Reusable global/tenant form blueprint | Templates; intentional copies, but credentials must not be copied |

### Physical Baseline

- Tables are singular PascalCase; columns are camelCase. No Prisma `@map`/`@@map` naming layer is present.
- Ordinary `String` maps to `VARCHAR(191)`; marked documents use `LONGTEXT`; form descriptions and outbox errors use `TEXT`.
- Timestamps use MySQL `DATETIME(3)`. `createdAt` generally defaults to `CURRENT_TIMESTAMP(3)`; Prisma `@updatedAt` is application-managed, not a database trigger.
- Most model IDs default to CUID in Prisma. `User.id` is supplied by UMS. Draft and unique-claim DAOs explicitly generate UUIDv4; migration backfills also generate prefixed IDs. **Existing IDs are mixed strings.**
- `PublicRateCounter` is the exception: composite primary key `(scope, windowStart)`.
- No declared PostgreSQL/MySQL enums or business CHECK constraints. Statuses are strings validated unevenly in application code.
- No `deletedAt` fields. Existing deletes are hard deletes.
- The initial SQL uses `utf8mb4_unicode_ci`, affecting equality and uniqueness through case/accent-insensitive comparison. Confirm actual deployed collations.
- DAO factories advertise MySQL/Firestore/MongoDB, but services use Prisma directly and unique-field enforcement explicitly requires MySQL. This is not a validated multi-database portability layer.

## 3. Critical Problems

### C1. ProcessingResult: Authorized Form Is Not Bound to Returned Result

- Location: [getSubmissionResult](../backend/src/service/processing.service.ts#L68), [result DAO](../backend/src/dao/mysql/processing.dao.ts#L8), [route](../backend/src/routes/processing.routes.ts).
- Example: authorize `form-A` in `org-A`; supply `submission-B` from another tenant. The next lookup is only `where: { submissionId }` and returns B's result.
- Impact: cross-form/cross-tenant result disclosure when a foreign submission ID is known. Non-sequential IDs are not authorization.
- Fix: query through `submission -> form -> orgId` with both supplied IDs, then apply result visibility. Do not trust the redundant result `formId` alone until its consistency is constrained.
- Check: A user authorized for A must receive 404 for B. **Reproduced with isolated service execution.**

### C2. Template: Private Detail Lookup Ignores Tenant

- Location: [getTemplate](../backend/src/service/template.service.ts#L22), [controller](../backend/src/controllers/express/template.controller.ts#L28), [routes](../backend/src/routes/template.routes.ts).
- Example: member of organization A requests a known template ID belonging to B. Middleware checks membership in A, but the service receives no organization ID.
- Impact: private schema/settings disclosure. [createTemplateFromForm](../backend/src/service/template.service.ts#L30) copies complete configuration, potentially including integration/payment secrets.
- Fix: detail predicate must be `id AND (isStatic OR orgId = callerOrg)`; explicitly project safe fields and strip credentials when creating/copying templates. Template creation also needs source-form read/edit permission, not only tenant membership.
- Check: foreign private template denied; approved global template remains readable. **Missing predicate reproduced in isolated execution.**

### C3. Submission / ProcessingResult: Redaction Does Not Cover Every Read

- Location: [updateSubmission](../backend/src/service/submission.service.ts#L461), [result and leaderboard services](../backend/src/service/processing.service.ts#L68).
- Example: a `REDACTED` viewer updates only `isRead` or `tags`. The service permits it, then returns `{ ...updated, data: JSON.parse(updated.data) }`, including raw answers, IP, and user agent.
- Results and leaderboard also return result JSON containing `submittedAnswer`/`correctAnswer` without the standard submission response shaping.
- Fix: apply a common permission-aware output projection to mutations, results, and leaderboards. Metadata-only updates can return an acknowledgment instead of a response body containing answers.
- Check: insert synthetic identifying fields; assert they never appear in any response to REDACTED or BLIND_REVIEW viewers.

### C4. Submission + Claims: Separate Commits Leave Invalid Accepted Rows

- Location: [createSubmission](../backend/src/service/submission.service.ts#L72), [claim DAO](../backend/src/dao/mysql/submissionUniqueValue.dao.ts), [claimVote](../backend/src/services/voting.processor.ts).
- Sequence: insert submission -> insert each unique claim -> insert vote claim -> update survey session -> lock response policy.
- Example: process dies after submission insert but before the claim. Another request can claim the same value; both response rows remain. Cleanup failures are explicitly swallowed.
- Fix: short database transaction for submission, all claims, session completion, and privacy lock. Let constraint errors roll back the transaction. Perform remote validation before entering it; recheck authoritative publication/privacy state inside it.
- Existing UNIQUE constraints are correct. **Keep them.** This is an atomicity gap, not a missing uniqueness-index diagnosis.

### C5. Submission Updates Bypass the Original Invariants

- Location: [updateSubmission](../backend/src/service/submission.service.ts#L461).
- Example: change unique email `a@example.test` to `b@example.test`. Claim remains for A, B is not claimed, and assessment results remain based on old answers.
- Updates also bypass field/file validation and can persist unknown/hidden fields.
- Fix: validate against the submission's version; replace claims atomically; invalidate/recompute derived results. For votes, explicitly decide whether answer/identity edits are permitted. Temporary safe restriction: disable content edits, retain metadata edits with safe output.
- Editing a form to add `unique` also needs an explicit existing-data scan/backfill before publication. Running a backfill only during deployment does not cover this workflow.

### C6. Form: Mutable Published Definition and Privacy Race

- Location: [update/publish services](../backend/src/service/form.service.ts), [assessment processor](../backend/src/services/assessment.processor.ts), [response shaping](../backend/src/service/responseView.service.ts).
- Example: respondent opens schema V1; editor changes a required field or correct answer; submission/processing uses the current form row, not V1.
- Historical redaction uses current field definitions. Removing or retyping an identifying field can change how an old answer is exposed.
- Privacy race: policy setter reads an unlocked form; first submission is inserted/locked; setter subsequently writes the new policy without a conditional update or shared lock.
- Fix: immutable versions plus optimistic draft revision; serialize first-response policy locking with policy changes. Keep privacy classification versioned and enforce any stricter current policy too.

### C7. Historical Role Migration Can Promote Across Organizations

- Location: [team-role flattening migration](../backend/prisma/migrations/20260831120000_flatten_teams_and_roles/migration.sql#L13).
- The backfill joins `TeamMember` to `OrgUser` using only `userId`, with no team-to-organization equality.
- Example: user is TEAM_LEAD in A and VIEWER in B; B's role may become CREATOR.
- Fix: audit affected historical users against pre-migration evidence. Correct only verified erroneous grants; do not demote legitimate current creators blindly.
- For fresh replay, use an approved corrected migration/baseline procedure. Do not casually edit checksums of migrations already applied in production.

### Additional High-Priority Findings

| Table / boundary | Evidence and example | Required response |
| --- | --- | --- |
| `UmsOutbox`, `OrgUser`, `OrgInvite` | [org service](../backend/src/service/org.service.ts) / [outbox](../backend/src/service/ums.outbox.ts): `enqueueQuietly` is separate and often fire-and-forget; worker's `draining` flag is process-local | Transactional enqueue; leased claims across replicas; idempotent ordered synchronization |
| `OrgInvite` | [accept/revoke](../backend/src/service/invite.service.ts#L271): separate read, membership insert, status update | Lock or CAS the pending invitation and commit membership/status/outbox together; concurrent revoke must not be overwritten |
| `Organization`, `Form` | Direct hard deletes cascade through responses and vote claims | Archive/soft-delete entry points, retention approval, bounded purge |
| Public voting results | [getPollResults](../backend/src/service/processing.service.ts#L379) checks publication but not voting type or `showResultsPublic` | Enforce settings and privacy policy before reading/aggregating answers |
| Vote audit endpoint | [getAuditLog](../backend/src/service/processing.service.ts#L387) has tenant check but no user-level response permission | Require explicit audit/response authorization; masked identifiers can still disclose participation |
| DMS | [file validation](../backend/src/lib/fileAnswer.ts#L186) and [download](../backend/src/controllers/express/dms.controller.ts#L216) reject mismatches only when ownership metadata exists | Missing ownership must fail closed; apply form-level response permission to downloads; bind public confirm to upload capability |
| Production deployment | [db-migrate](../backend/scripts/db-migrate.mjs#L43): data-loss fallback, unconditional ALTERs, full backfill on deploy | Fail closed; reviewed migrations and separate resumable data jobs |
| Persisted role cache | [loadPersisted](../backend/src/service/rbac.client.ts#L104) does not enforce fetched-age limit | Define bounded staleness, especially for destructive actions; do not grant revoked permissions indefinitely during outage |

## 4. Table Naming Review

**Standard for new physical names:** lowercase `snake_case`, plural tables, `_id` foreign keys, `_at` event timestamps. Keep existing physical names initially; names alone are not a reason for a risky migration.

| Current | Recommended logical name | Reason / urgency |
| --- | --- | --- |
| `Organization` | `organizations` | Already clear; convention only, low |
| `OrgUser` | `organization_members` | It owns membership and role, not a separate kind of user |
| `OrgInvite` | `organization_invites` | Spell out ownership; otherwise already clear |
| `RoleDefinitionCache` | `role_definition_cache` | Cache is a collective noun; explicitly not authoritative roles |
| `UmsOutbox` | `ums_outbox` | Established technical term; retain UMS because destination matters |
| `Team` | `teams` | Already clear; convention only |
| `TeamMember` | `team_members` | Already clear; convention only |
| `User` | `users` | Shared local identity projection; no business rename needed |
| `Form` | `forms` | Already clear; convention only |
| `FormShare` | `form_shares` | Explicit grant/exception; keep concept |
| `Submission` | `form_submissions` | Makes owning domain explicit in SQL/operations |
| `SubmissionUniqueValue` | `submission_unique_values` | Accurately describes a constrained uniqueness projection |
| `PublicFormSession` | `public_form_sessions` | Clear existing purpose |
| `PublicRateCounter` | `public_rate_counters` | Counter, not request history |
| `SurveyResponseSession` | `survey_response_sessions` | Survey-progress record, distinct from a capability session |
| `ProcessingResult` | `submission_processing_results` | Per-submission output, not form-level aggregate |
| `AuditLog` | `vote_identity_claims` | Current name is misleading: deduplication claim, mutable/deletable, not general audit |
| `Draft` | `submission_drafts` | Avoid confusion with editable form-builder drafts |
| `Template` | `form_templates` | Blueprint for forms, not a generic template engine |
| New | `form_versions` | Immutable published definition snapshots |

Column recommendations:

| Current | Recommended | Reason |
| --- | --- | --- |
| `orgId` | `organization_id` | Tenant key clarity |
| `createdBy`, `invitedBy`, `addedBy` | `created_by_user_id`, `invited_by_user_id`, `added_by_user_id` | Explicit actor references |
| `OrgUser.role`, `OrgInvite.role` | `role_name` | External role name, not a local enum |
| `roleId` | `external_role_id` | Cannot enforce a local FK to an external service |
| `Form.schema` | `draft_definition` | Mutable builder definition, not a database schema |
| `Form.settings` | `draft_settings` | Distinguishes draft from published configuration |
| `Submission.data`, `Draft.data`, survey session `data` | `answers` | Answers rather than generic data |
| `Submission.createdAt` | `submitted_at` | Acceptance timestamp; migrate naming only with API compatibility |
| `Template.schema` | `definition` | Blueprint document |
| `ProcessingResult.result` | `result_payload` | Detailed derived output; scalar reporting columns remain separate |
| `AuditLog.identifier` | `identity_digest` after hashing migration | Do not rename plaintext to a name implying encryption/hash |
| `User.additionalDetails` | `profile_attributes` | Optional structured profile attributes |
| `OrgInvite.createdAt` | retain + `last_invited_at` | Current upsert rewrites creation time; preserve original creation |

Use Prisma `@map`/`@@map` only when mappings reflect the actual physical database. Adding a map alone does not rename a table. Existing APIs and raw SQL scripts need compatibility testing. Broad naming conversion can wait.

## 5. Schema Improvements

### Required Changes Without Table Proliferation

| Change | Real problem solved | Scope |
| --- | --- | --- |
| Add `form_versions`; references on responses/partial sessions | Historical schema correctness and draft/published isolation | One new table |
| Add draft revision to `Form` | Concurrent editors overwrite each other's JSON | One integer and conditional update |
| Add same-parent composite FKs | Redundant IDs can disagree | Existing tables |
| Replace polymorphic share ID with nullable typed user/team IDs | No FK or tenant consistency possible for `principalId` | Keep one share table |
| Improve lengths, JSON validity, state constraints | Runtime failures and invalid persisted states | Existing columns via safe transition |
| Add processing lease/retry metadata to `Submission` | `setImmediate` work disappears on restart | Reuse existing table; no generic job framework needed |
| Add outbox lease/completion fields | Multi-replica duplicate work, missed synchronization, unbounded history | Reuse outbox |
| Add expiry to survey partials; scheduled bounded cleanup | Abandoned responses accumulate indefinitely | Existing table |
| Introduce tenant/form archive/deletion lifecycle | Accidental or oversized cascades | Existing tables |

### Primary Keys

| Entity class | Recommendation | Trade-off |
| --- | --- | --- |
| Existing forms, tenants, memberships, shares, submissions, results | Preserve current string IDs | Mixed CUID/UUID/prefixed IDs cannot safely be cast wholesale to PostgreSQL `uuid` |
| `User` | Preserve external subject string | Rekeying breaks identity joins; qualify by issuer if multiple realms are supported later |
| New `form_versions` | Current app-generated ID convention | Small volume relative to answers; consistency outweighs marginal index benefit |
| Join tables | Keep surrogate PK plus business UNIQUE today | Composite PK saves one index but may widen child FKs and change public/API identifiers |
| `PublicRateCounter` | Keep composite PK | `(scope, window)` is the identity; no surrogate needed |
| Future billion-row derived facts | Benchmark BIGINT identity first | 8-byte keys reduce index/FK size; public IDs remain separate if externally exposed |
| PostgreSQL greenfield public IDs | UUIDv7 is an option, not a requirement | Native UUID is 16 bytes; v7 improves locality over v4 but exposes approximate creation time and requires supported generation tooling |

Do not claim `VARCHAR(191)` always occupies 191 characters of storage: actual lengths matter. Nevertheless, text IDs and collation-aware comparisons widen indexes compared with BIGINT/native UUID. InnoDB secondary indexes also carry the clustered primary key. Tightening ID lengths needs a data census because current IDs have several formats.

### Concrete Type/Length Mismatches

| Current | Evidence / failure example | Recommendation |
| --- | --- | --- |
| `Form.name VARCHAR(191)` | [input schema](../backend/src/schemas/form.schema.ts) accepts 200 characters | Align at 200 or intentionally reduce validation; include template-name copies |
| `Template.description VARCHAR(191)` | Copies `Form.description TEXT`, accepted up to 16,000 characters | Match form description capacity |
| `Submission.userAgent VARCHAR(191)` | Header is stored directly; legitimate or attacker-supplied longer value can fail insert | Bounded text, e.g. truncate to an explicitly documented 2,048-character limit; use TEXT |
| `Submission.tags VARCHAR(191)` | Unbounded array of strings serialized into a short column | Native JSON or validated TEXT with item/count/byte limits |
| `User.email`, `OrgInvite.email VARCHAR(191)` | Bulk invite accepts up to 320 characters | Choose one supported email policy across UMS/API/DB; widen to 320 if retaining current API behavior |
| `AuditLog.identifier VARCHAR(255)` | `email:` plus an allowed long address can exceed 255 | Versioned keyed digest; align transitional plaintext length if required |
| `SurveyResponseSession.tokenHash VARCHAR(191)` | Code emits SHA-256 hex | 64 ASCII characters after verification; no token-generation rewrite needed for this sizing fix |
| `Organization.logo`, profile address | Generic 191-character defaults may not fit URLs/addresses | Define whether logo is a URL or DMS ID; measure and align API limits before widening |

### Every Current Nullable Column

`?` means NULL is currently allowed. None of these should be made NOT NULL without the listed condition/backfill.

| Table | Nullable columns | Decision |
| --- | --- | --- |
| `Organization` | `logo`, `industry`, `umsSyncedAt` | Genuine absence / not yet synced; retain |
| `OrgUser` | `roleId`, `invitedBy` | External role may be unresolved; owner/self provisioning has no inviter; retain |
| `OrgInvite` | `roleId`, `respondedAt` | Legacy/unresolved external role; pending invite has no response time; retain with state consistency |
| `RoleDefinitionCache` | none | No change required |
| `UmsOutbox` | `lastError` | No failure yet; retain |
| `Team` | `description` | Optional; retain |
| `TeamMember` | `addedBy` | Imported/system membership; retain |
| `User` | `firstName`, `lastName`, `username`, `phone`, `gender`, `address`, `additionalDetails` | Optional projection/PII; retain NULL and avoid mandatory invented values |
| `Form` | `description`, `teamId`, `responsePolicyLockedAt` | Description optional; team legacy/SetNull behavior is real; privacy lock absent before first response |
| `FormShare` | `expiresAt` | Indefinite grant; retain |
| `Submission` | `ip`, `userAgent` | Deliberately absent for anonymous surveys; never make required |
| `SubmissionUniqueValue` | none | No change required |
| `PublicFormSession` | `verifiedIdentity`, `verifiedAt` | No verified identity today; retain and require both NULL or both non-NULL |
| `PublicRateCounter` | none | No change required |
| `SurveyResponseSession` | `completedAt` | Incomplete is a real state; retain |
| `ProcessingResult` | none | No change required for existing columns; new typed result scalars are conditional by type |
| `AuditLog` | none | No change required |
| `Draft` | `identity`, `sessionId` | Identity remains optional; session NULL is legacy-only. Quarantine/purge legacy rows before requiring session |
| `Template` | `description`, `orgId`, `createdBy` | Global templates have no organization and may be system-created; constrain combinations rather than forbid NULL |

Normalize omitted optional text to NULL, intentional empty answer strings according to field semantics, and booleans to booleans. Do not conflate “unknown”, “false”, and “not applicable”. Defaults belong to documented product behavior, not automatic `{}` replacements for corrupt required documents.

### Timestamps and Audit

- Retain existing creation/update timestamps where mutations are real. `TeamMember.updatedAt` is mostly unused with its current upsert; leave it rather than churn the schema.
- Add `Submission.updatedAt` because response content/review metadata is mutable; add processor attempt times only for recovery semantics.
- Add version `published_at`, form `archived_at`/`deleted_at`, tenant `deleted_at`, outbox `completed_at`, and survey-session `expires_at` for explicit events.
- Preserve creator fields. [Share upsert](../backend/src/dao/mysql/formShare.dao.ts) currently overwrites `createdBy`; add `updated_by_user_id` instead.
- No blanket `updated_at` on immutable versions, vote claims, or immutable unique claims; no blanket `deleted_at` on cache/counter/join tables.
- MySQL: standardize driver/session/server handling to UTC for `DATETIME(3)`; the type itself carries no timezone. PostgreSQL: use `timestamptz(3)` for instants. Retain a separate IANA timezone only where a business schedule needs one.
- Raw SQL writers must explicitly maintain update timestamps. Converting old timestamps requires identifying their source timezone; appending `Z` does not fix unknown historical timezone semantics.
- Vote claims are not security audit history. Use an existing protected central audit sink for grants, exports, content edits, and deletion. A dedicated local audit table is conditional on retention/compliance requirements, not part of the mandatory expansion.

## 6. Relationship Improvements

The following covers all current declared FK edges and important implicit links. Current declared FKs use update cascade in generated SQL; identifiers should nevertheless be treated as immutable.

| Relationship | Cardinality / current delete | Assessment / target behavior |
| --- | --- | --- |
| `Organization.ownerId -> User.id` | Many organizations to one user; RESTRICT | Correct retention safeguard; ownership transfer must also reconcile owner membership |
| `OrgUser.orgId -> Organization.id` | One organization to many memberships; CASCADE | Appropriate at approved final tenant purge |
| `OrgUser.userId -> User.id` | One user to many memberships; CASCADE | Keep; user deletion must explicitly handle owned organizations and tenant access |
| `OrgInvite.orgId -> Organization.id` | 1:N; CASCADE | Correct disposable tenant invitation lifecycle |
| `Team.orgId -> Organization.id` | 1:N; CASCADE | Correct after forms are rehomed/purged |
| `TeamMember.teamId -> Team.id` | 1:N; CASCADE | Correct junction cleanup |
| `TeamMember.userId -> User.id` | 1:N; CASCADE | Valid user existence, but not organization membership |
| `Form.orgId -> Organization.id` | 1:N; CASCADE | Change to RESTRICT for durable form retention; explicit purge deletes forms first |
| `Form.teamId -> Team.id` | Optional N:1; SET NULL | Team deletion must not delete forms. Add same-organization enforcement; rehome under transaction |
| `FormShare.formId -> Form.id` | 1:N; CASCADE | Correct when form is finally purged |
| `Submission.formId -> Form.id` | 1:N; CASCADE | Prefer RESTRICT; purge responses in bounded batches before form |
| `SubmissionUniqueValue.formId -> Form.id` | 1:N; CASCADE | Redundant with submission path; replace with consistent composite parent reference where possible |
| `SubmissionUniqueValue.submissionId -> Submission.id` | 1:N; CASCADE | Correct derived claim cleanup; constrain `(submissionId, formId)` together |
| `PublicFormSession.formId -> Form.id` | 1:N; CASCADE | Correct ephemeral cleanup |
| `SurveyResponseSession.formId -> Form.id` | 1:N; CASCADE | Correct with explicit survey-payload retention policy |
| `ProcessingResult.submissionId -> Submission.id` | 0..1 per submission; CASCADE | Correct; add composite `(submissionId, formId)` FK |
| `AuditLog.submissionId -> Submission.id` | 0..1 per submission; CASCADE | Correct only if response deletion intentionally releases vote eligibility; document this product rule |
| `Draft.formId -> Form.id` | 1:N; CASCADE | Correct partial-answer cleanup |
| `Draft.sessionId -> PublicFormSession.id` | Nullable N:1; CASCADE | Current pair UNIQUE gives at most one draft/form/session; enforce matching form with composite FK |
| `Template.orgId` | Implicit nullable N:1; no FK | Add organization FK; CASCADE at approved purge is reasonable for blueprints |
| `RoleDefinitionCache.orgId` | Implicit N:1; no FK | Add FK/CASCADE if cache is strictly local-tenant scoped; delete stale cache on tenant purge |
| `UmsOutbox.orgId` | Historical external target; no FK | **No change required:** ORG_DELETE work must survive local tenant deletion |
| `ProcessingResult.formId`, `AuditLog.formId` | Denormalized lookup keys; no direct FK | Do not merely add independent Form FKs; same-submission composite FK prevents disagreement |
| `FormShare.principalId` | Polymorphic user/team; no FK | Replace with typed nullable user/team columns and exactly-one CHECK in the same table |
| Actor IDs | Several strings without FKs | Add user FKs where a retained local user exists; use nullable SET NULL or documented pseudonymous actor retention, never CASCADE business data on actor deletion |
| `roleId`, `appId`, DMS/POS IDs | External references | No cross-service SQL FK; validate contract, ownership, reconciliation |

Recommended consistency keys:

- `UNIQUE Submission(id, formId)` supports child `FOREIGN KEY (submissionId, formId)`; redundant for uniqueness, useful as an explicit referenced key.
- `UNIQUE Team(id, orgId)` supports same-tenant form/team relationships.
- `UNIQUE PublicFormSession(id, formId)` supports a draft's session/form equality.
- Add `orgId` to `TeamMember` with FKs to `(teamId, orgId)` and existing `OrgUser(orgId, userId)`. This small redundancy buys enforceable tenant membership; remove the redundant direct user FK if the membership FK fully replaces it.
- Add `orgId` plus typed `userId`/`teamId` to `FormShare`; reference `(formId, orgId)`, `(orgId, userId)` membership, and `(teamId, orgId)` team. Keep one share table, two nullable-key unique indexes, and exactly one target.
- For a composite Form/Team FK, prefer RESTRICT and rehome first. A blanket composite SET NULL could null `orgId` too, which is wrong. Preserve the previous end-user behavior in the service, not through an invalid FK action.

## 7. Indexing Strategy

### Current Explicit Keys and Indexes

`PK` on `id` exists on every table except the counter. `U` denotes UNIQUE; `I` denotes non-unique. MySQL may create additional indexes to support FKs; live `SHOW INDEX` is required before dropping anything.

| Table | Current explicit secondary keys |
| --- | --- |
| `Organization` | U(slug) |
| `OrgUser` | U(orgId,userId); I(userId) |
| `OrgInvite` | U(orgId,email); I(email,inviteStatus); I(orgId,inviteStatus) |
| `RoleDefinitionCache` | U(appId,orgId) |
| `UmsOutbox` | I(status,nextAttemptAt); I(orgId) |
| `Team` | U(orgId,slug); I(orgId) |
| `TeamMember` | U(teamId,userId); I(userId) |
| `User` | U(email); U(username), multiple NULL usernames allowed |
| `Form` | U(orgId,slug); I(orgId); I(teamId) |
| `FormShare` | U(formId,principalType,principalId); I(principalType,principalId); I(formId) |
| `Submission` | I(formId); I(createdAt); I(formId,createdAt) |
| `SubmissionUniqueValue` | U(formId,fieldId,valueHash); I(submissionId) |
| `PublicFormSession` | U(tokenHash); I(formId); I(expiresAt) |
| `PublicRateCounter` | PK(scope,windowStart); I(windowStart) |
| `SurveyResponseSession` | U(formId,tokenHash); I(formId,completedAt) |
| `ProcessingResult` | U(submissionId); I(formId) |
| `AuditLog` | U(submissionId); U(formId,identifier); I(formId) |
| `Draft` | U(formId,sessionId); I(formId) |
| `Template` | I(orgId) |

### Targeted Candidates, Not a Bulk CREATE INDEX Script

Implement only with the corresponding query change. Names below are logical target names; translate to current physical names if no rename is performed.

| Table / index | Columns | Query improved / why | Expected benefit | Write/storage cost |
| --- | --- | --- | --- | --- |
| `Form`: `ix_forms_org_updated` | `(orgId, updatedAt, id)` | Tenant list ordered newest, with keyset pagination and metadata-only SELECT | Bounded index walk instead of sorting/loading every form | One entry per form; rewritten on edits |
| `Form`: optional `ix_forms_org_team_updated` | `(orgId, teamId, updatedAt, id)` | Single-team lists; multi-team `IN` may still require merge/sort | Helps large team-scoped lists, not guaranteed sort elimination across teams | Extra index per form; add only with measured need |
| `Submission`: evolve list index | `(formId, createdAt, id)` | Newest/oldest keyset pages, deterministic tie-break | Avoid deep OFFSET scans; current `(formId,createdAt)` already helps | Prefer replacement, not duplicate; InnoDB already appends PK, so explicit `id` may be unnecessary physically |
| `Submission`: optional unread index | `(formId, isRead, createdAt, id)` | Frequent read/unread filtered list | Narrows candidates before ordered page | Maintained on each read-state update; avoid if few unread-filter requests |
| `Submission`: processing recovery | `(processingStatus, nextAttemptAt, id)` | Due-work lease acquisition after recovery fields exist | Small due-work scan | Status/attempt updates rewrite entry; PostgreSQL can use partial pending index |
| `ProcessingResult`: reporting scalars | `(formId, type, totalScore, submissionId)` | Version-aware leaderboard/top scores once score is typed and ORDER BY uses it | Index-backed top-N rather than parsing all result documents | One entry per scored response, score updates rewrite it; include version in scope when ranking by version |
| `AuditLog`: optional history list | `(formId, createdAt, id)` | Paginated vote-claim history | Avoid sort over all vote claims | One entry per identified vote; add only after permission/pagination fix |
| `SurveyResponseSession`: expiry | `(expiresAt, id)` | Scheduled bounded deletion of expired partials | Range scan instead of full scan | One entry/session; expiry extension updates it |
| `UmsOutbox`: due-order alignment | `(status, nextAttemptAt, id)` | Change due work ordering to `nextAttemptAt,id`; current query sorts by createdAt | Reuses existing useful prefix and avoids unrelated due-row sort | Small extension/replacement, not another duplicate index |
| `UmsOutbox`: cleanup | `(status, completedAt, id)` | Purge retained DONE work in batches | Bounded historical cleanup | Extra write on completion; add with retention worker |
| `form_versions`: business UNIQUE | `(form_id, version_number)` | Publication numbering and latest history | Prevents duplicate revision numbers | One entry/publication; required integrity cost |

Necessary composite FK-supporting UNIQUE keys from section 6 are integrity indexes, not speculative performance indexes. Include their cost in migration estimates.

### Candidates for Consolidation

- `Form(orgId)`, `Team(orgId)`, `FormShare(formId)`, `AuditLog(formId)`, `Draft(formId)` overlap leading columns of composite unique keys.
- `Submission(formId)` overlaps `(formId,createdAt)`.
- These are **potentially redundant, not proven useless**. Smaller indexes can still be selected for counts; InnoDB FK requirements also matter. Compare plans, size, and usage before removal.
- `Submission(createdAt)` is not redundant with `(formId,createdAt)` for global age-based retention. No current global retention query was found; keep until the operational policy is settled.
- Do not add a B-tree on `data` for `LIKE '%term%'`; it cannot solve arbitrary substring scans. Do not index entire LONGTEXT/JSON documents as covering payloads.
- Current token/claim/membership business keys and expiry/window indexes are appropriate. **No change required** unless a query or integrity transition changes their shape.

### PostgreSQL-Specific Options

- Partial unread index: `(form_id, submitted_at DESC, id DESC) WHERE is_read = false`; useful only for the unread workflow, not all read-state queries.
- Partial default-team uniqueness: `UNIQUE (organization_id) WHERE is_default`; MySQL needs a nullable generated key or a transactional invariant instead.
- Covering metadata index with `INCLUDE (is_read, processing_status)` only after measuring index-only scans and visibility-map effectiveness. High mutation reduces its benefit.
- Targeted JSONB expression index or GIN only for actual containment/path predicates; GIN does not automatically optimize the current serialized substring search and has substantial write cost.
- Use `EXPLAIN` first. `EXPLAIN ANALYZE` executes the query; run expensive candidates on representative staging/replica data, not casually on production.

## 8. Data Integrity Improvements

### Concurrency and Business Rules

| Invariant | Current guarantee | Change / discriminating test |
| --- | --- | --- |
| Unique slug/email/membership | DB UNIQUE already present | Keep; translate uniqueness errors to conflict/retry. Two concurrent creates must not return generic 500s |
| Unique answer per form/field | Unique digest claim | Atomic insert/update of answer and claim; kill process between steps in integration test |
| One vote per configured identity | Unique vote claim | Same transaction as accepted submission; two concurrent votes produce one response and one claim |
| Idempotent ordinary submission retry | None | Optional request-idempotency key + request hash on Submission, unique within form; not one-submission-per-session unless product requires it |
| First-response privacy lock | Separate reads/writes | Lock same Form row for submission acceptance and policy mutation; recheck locked state |
| Published snapshot sequence | None | Lock/CAS draft revision; unique `(formId,versionNumber)`; publish pointer update in same transaction |
| Invitation accept/revoke | Status read then independent writes | Conditional PENDING transition and membership/outbox transaction |
| Default team | Lookup + create; unique slug only | Enforce at most one default; transaction ensures one exists. `UNIQUE(orgId,isDefault)` is wrong because it allows only one non-default team |
| Last administrator | Application scan | Serialize membership/admin-role changes per organization where rule applies; coordinate external role-definition changes too |
| Team membership after org removal | Separate cleanup/delete | FK to organization membership, plus atomic cleanup of shares/memberships |
| Outbox consistency | Separate best-effort enqueue | Local mutation + enqueue in one commit; replay must be idempotent |
| Canonical identity equality | Mixed lowercasing and DB collation | Define canonical email/slug/unique-answer policy; test Unicode, whitespace, arrays, NULL, case, and collation changes |

Unique claims enforce a nonempty canonical answer, not requiredness. Blank optional unique fields should create no claim. Keep uniqueness scoped to `(formId,fieldId)` across versions unless product explicitly promises uniqueness only within a version.

### CHECK / NOT NULL / FK Rules

- Stable states: organization provisioning; invite status; response policy; response access level; processing status/type; outbox status/kind. Enforce `VARCHAR + CHECK` on supported MySQL 8.0.16+ or PostgreSQL.
- **Do not enum organization role names.** Roles are user-managed external data. `roleId` references UMS, not a local lookup table.
- Outbox kind values must match actual code: `ORG_PROVISION`, `MEMBER_SYNC`, `MEMBER_REMOVE`, `ORG_DELETE`. Prisma comments list older values and should not be used to generate a constraint.
- Counts/steps/attempts: nonnegative; survey step upper bound consistent with API; assessment scores nonnegative, `totalScore <= maxScore`, percentages within 0..100, with explicit handling for zero maximum.
- JSON roots: definition/settings/answers/result objects; tags/role-definition payload arrays; outbox payload shape depends on kind. JSON validity alone does not validate the field graph.
- Template scope: global implies no tenant; organization template requires tenant. Do not turn an orphaned private template into global by setting `orgId` NULL.
- Share target: exactly one of user/team; matching tenant composite FKs; business uniqueness on `(formId,userId)` and `(formId,teamId)`.
- Session verification: identity/timestamp both present or both absent; expiration after creation. Invite PENDING implies no response timestamp.
- Required parent FKs remain NOT NULL. New version references become mandatory for new submissions; legacy unknown-version rows need explicit provenance rather than fabricated certainty.
- Definition validation must enforce unique field/option IDs, existing condition/layout/variable references, compatible field types, and acyclic calculation dependencies. These are document-level application checks, not a reason to create six child tables.

## 9. Multi-Tenant Improvements

| Data | Tenant ID decision | Enforcement |
| --- | --- | --- |
| Forms, teams, invites, memberships, private templates | Direct tenant ownership required | Existing org IDs retained; add missing template FK |
| Submission / version | Tenant derived from Form is adequate now | Mandatory scoped service/DAO predicates through Form; no need to duplicate orgId across all rows today |
| Answers embedded in Submission | No independent tenant ID | Inherit response ownership; versioned field interpretation |
| Processing/vote/unique projections | Tenant derived through Submission | Composite same-form FKs plus scoped queries |
| Team membership / form shares | Add orgId specifically to enforce cross-parent equality | Composite membership/team/form FKs, not unverified duplicated tenant strings |
| Public/draft/survey sessions | Tenant derived from Form | Form-bound capability and version; no free-standing organization selected by browser |
| DMS files | External org/form/field ownership | Require metadata, validate form access, deny missing ownership; no fake cross-service FK |
| Integration configuration | Currently embedded in form/template JSON | Tenant-aware secret references; do not return credentials with labels/settings |
| Aggregates | Form/version ownership | Use source form privacy policy and suppression rules; adding an aggregate does not remove authorization |
| Outbox | orgId is durable target label | Intentionally survives tenant deletion; keep payload access internal |

Application boundary improvements:

- Pass trusted organization context into every private DAO/service operation. `x-org-id` alone is untrusted until middleware verifies membership.
- Require `submissionId + formId + orgId` consistently; reject mismatched identifiers before revealing payloads.
- Fix detail reads, mutation responses, result endpoints, template operations, and file download routes, not only list queries.
- Remove stale direct form shares on membership removal; otherwise leaving/rejoining can revive historical access unintentionally.
- [Shared-form lookup](../backend/src/dao/mysql/formShare.dao.ts) lacks a tenant predicate on direct user shares; constrain it before exposing its result as an organization-scoped list. A live caller/exploit was not established for this helper.
- [Dashboard stats](../backend/src/service/form.service.ts) counts recent submissions organization-wide while the displayed form set can be team-scoped. Align the metric scope; whether it violates permissions depends on the intended org-role visibility contract.
- Public paths currently bypass `orgMiddleware`; archive/provisioning/deletion state must be checked through the public form resolution too.

**PostgreSQL RLS:** useful defense in depth if PostgreSQL is adopted, not an immediate MySQL feature. Use transaction-local tenant context, non-owner/non-BYPASSRLS application roles, `FORCE ROW LEVEL SECURITY` where appropriate, and pool-isolation tests. Public submission/session paths need narrowly defined policies or a dedicated limited role, not unrestricted bypass. Only denormalize tenant IDs onto high-volume children for RLS/performance when composite FKs keep them consistent.

## 10. Form Versioning Architecture

### Minimal Model

- Keep mutable builder `schema/settings` on Form, logically named draft definition/settings.
- Add immutable `form_versions` containing published name/description, definition, non-secret settings, privacy snapshot, version number, publisher, and publication time.
- Add nullable `Form.publishedVersionId`, plus `draftRevision` for optimistic locking. Derive publication from the pointer; keep `isPublished` only during compatibility migration.
- Add `Submission.formVersionId`, and version references to partial-answer/session records so resume/validation uses the definition the respondent saw.
- No separate `form_fields`, `form_field_options`, `form_settings`, or `form_publications` table is necessary for the current whole-document editing workflow.

```text
Form draft revision 1
    -> publish transaction -> immutable version 1 + published pointer
    -> edit draft revision 2 (version 1 remains live)
    -> publish transaction -> immutable version 2 + pointer switch

Submission A -> version 1 forever
Submission B -> version 2 forever
```

### Publication / Submission Rules

1. Validate the complete draft and all field-reference invariants before publishing; remove inline credentials from snapshots.
2. In a short transaction, check expected draft revision, allocate next version number, insert snapshot, and switch published pointer.
3. Public reads return the snapshot and its version ID. Existing public schema/settings sanitizers still apply.
4. Bind respondent session to that version. On submission, verify version belongs to this form and is acceptable under the publication policy.
5. Choose an explicit policy for an old open tab: accept its retained version for a bounded grace period, or return “form updated” and require reload. Never silently reinterpret answers as the latest version.
6. Score, validate, export, redact, and aggregate by submission version. Cross-version metrics require compatible stable field IDs; changed meaning gets a new field ID.
7. Fix the privacy promise at first response under a shared lock. Do not permit draft edits to weaken stored identifying-field classification for old responses.
8. Unpublish by clearing the pointer; archive independently. Versions with accepted responses cannot be removed by ordinary editor actions.

**Historical limitation:** old responses have no schema snapshot. Backfilling today's schema does not recover the schema originally used. Mark legacy association as `legacy_unknown`; optionally retain a labeled inferred baseline for rendering, but never call it verified history. Do not regrade historical assessments from an inferred definition without approval.

## 11. Submission Architecture

### Recommended: JSON Canonical Answers + Small Relational Projections

| Approach | Fit for current Sify Forms |
| --- | --- |
| JSON-only responses | Good for dynamic fields and complete response reads, weak for global answer search and constraints |
| One row per answer | Better typed field-level querying; potentially billions of rows, difficult repeating-grid/multi-select semantics, high write/index amplification |
| **Hybrid** | Keep answer document; preserve unique claims, vote claims, and results; extract only frequently queried scores/metrics |

Why hybrid matches actual requirements:

- Builder fields include nested table grids, Likert rows, rankings, conditions, validation rules, and variables. Splitting every value is not automatically simpler.
- Current reads primarily fetch whole responses, export forms, compute survey summaries, or rank assessments.
- Existing `SubmissionUniqueValue` already demonstrates a useful minimal relational projection for one enforceable invariant.
- Extract score/max score/percentage/passed into `ProcessingResult`; keep detailed sections/question results as JSON. Stop persisting dynamic rank/participant count as authoritative values because they become stale when later responses arrive.
- Make processing recoverable using Submission state/lease fields. Commit result and `done` status together; use a processor revision to identify outputs requiring rebuild.
- Ordinary registration/application submissions currently remain `pending` because no processor runs. Set `not_required` for these, and `pending` only for real work before adding a recovery worker.

Optional future `submission_answer_facts` is justified only for measured arbitrary field reporting/search. Project selected reportable fields, handle array/grid coordinates explicitly, and rebuild from canonical documents. Do not dual-own truth or create a billion answer rows preemptively.

Idempotency: a retry key can live on Submission with `(formId,idempotencyKey)` uniqueness and a request digest. Same key/different body must conflict. Retain intentional repeat responses; a session token is not automatically a uniqueness rule.

## 12. JSONB Review

**Today these are serialized JSON strings, not JSONB.** MySQL native JSON and PostgreSQL JSONB are engine-specific targets, not interchangeable migration syntax.

| Current document column | Actual purpose | Keep document or normalize? |
| --- | --- | --- |
| `Form.schema` | Fields, options, ordering/layout, conditions, validation, calculations, assessment keys, external checks | Keep document; add immutable version snapshot and graph validation; separate secret values from definitions |
| `Form.settings` | Presentation, lifecycle flags, survey/assessment/voting configuration, payment/DMS configuration | Keep most configuration; move published pointer/archive state into columns; version the respondent-facing behavior |
| `Submission.data` | Dynamic submitted answers | Keep canonical document; targeted projections for constraints/reporting |
| `Submission.tags` | Tag array, not LONGTEXT currently | JSON/TEXT array with size constraints; normalize only if tag filtering becomes a real indexed query |
| `Draft.data` | Saved partial answers | Keep; tie to session/version and expiry |
| `SurveyResponseSession.data` | Incomplete survey answers | Keep; minimize/delete after completion and retention period |
| `ProcessingResult.result` | Assessment detail or per-vote processing receipt | Keep detail JSON; typed score columns for sorting/reporting; remove redundant sensitive identity copy |
| `Template.schema` | Reusable definition | Keep; copied blueprint is intentional, credentials are not |
| `Template.settings` | Reusable configuration | Keep non-secret configuration; require credential rebinding after duplication |
| `User.additionalDetails` | Optional profile attributes mirrored to/from UMS | Keep only needed attributes as validated object; avoid redundant sensitive profile storage |
| `RoleDefinitionCache.payload` | External role-definition array | Keep document; shape validation and staleness policy |
| `UmsOutbox.payload` | Small external-operation envelope | Keep document with kind-specific schema; never embed bearer tokens/passwords |

No relational workflow/webhook delivery model was found in the reviewed write paths. Configuration labels alone do not justify workflow/integration tables. POS owns payments and DMS owns files; do not create local payment ledgers or file-content tables without a concrete reconciliation/ownership requirement.

Native JSON transition: add shadow column -> validate/backfill in chunks -> dual-write -> verify parity -> switch reads. Existing DAOs/interfaces expect strings, so changing Prisma to `Json` requires removing coordinated parse/stringify assumptions. Do not simply change the provider/type and deploy.

## 13. Scalability Review

### Actual Expensive Paths

| Path | Current work | Improvement |
| --- | --- | --- |
| [Form list](../backend/src/dao/mysql/form.dao.ts#L37) | All forms, full schema/settings, response counts; then parse JSON | Metadata-only projection, bounded keyset list; fetch definition only when opened |
| [Dashboard](../backend/src/service/form.service.ts) | All visible forms and counts, sort in Node to return four | Bounded top/recent queries, scalar counts; add rollups only if counts become costly |
| [Submission list](../backend/src/dao/mysql/submission.dao.ts#L55) | OFFSET + exact COUNT; order only by timestamp | Validated limit cap (e.g. 100), keyset `(createdAt,id)`, optional/deferred total |
| [Search](../backend/src/service/submission.service.ts) | LONGTEXT substring scan; redacted search loads all rows and filters in Node | First bound date/filter scope and batch; later privacy-safe searchable projection. Never push search over hidden PII to SQL |
| [Exports/aggregate](../backend/src/service/submission.service.ts) | Load all answers, parse, build complete JSON/CSV in memory | Cursor batches and streamed CSV/JSON; export boundary/high-water mark for consistency |
| [Vote processor](../backend/src/services/voting.processor.ts) | Every vote rescans all active answers and computes an aggregate not persisted/returned | Remove unused recomputation; store only receipt; bounded/cacheable GET aggregation |
| [Poll results](../backend/src/service/processing.service.ts#L379) | Every poll GET scans all active answers | Permission-first cache with invalidation; rollup only when measured traffic warrants |
| [Assessment processor](../backend/src/services/assessment.processor.ts) | Reads all results to compute stored rank | Typed scores; compute rank/top-N when requested, with clear tie/version rules |
| [Leaderboard/analytics](../backend/src/service/processing.service.ts#L115) | Load all results; JSON parsing and sorting; DAO also fetches unused raw submission data | SQL aggregates over typed metrics; bounded top-N; remove unused payload projection |
| [UMS outbox](../backend/src/service/ums.outbox.ts#L110) | Small batch, but multiple replicas can execute same rows; createdAt order mismatches due index | Transactional lease, due-time order, backoff/jitter and per-entity ordering |
| [Session cleanup](../backend/src/service/publicSession.service.ts) | Probabilistic unbounded deleteMany and lastSeen write on every resolve | Scheduled capped sweeps; throttle liveness writes if not operationally useful |
| [Unique backfill](../backend/scripts/backfill-unique-values.mjs) | All forms, then all responses per unique form, insert per claim; repeats on deploy | Keyset checkpoints, incremental catch-up, bounded errors, separate deployment gate |
| [Bulk invitations](../backend/src/service/invite.service.ts) | Several sequential queries per invite | Bounded batch and prefetch where useful; current bounded serial behavior can be acceptable |

N+1 distinction: unique checks/claims and bulk invites genuinely loop over DB calls. Prisma `include/_count` is not automatically an N+1 query; inspect emitted SQL before claiming that. DMS file verification is one external call per distinct document with request-local caching, not a SQL N+1.

### Scale Milestones

| Scale | Likely pressure | Required response |
| --- | --- | --- |
| 10,000 organizations / 1,000,000 forms | Full-form list payloads, dashboard counts, edit contention | Tenant-keyed bounded lists, metadata projections, query telemetry; one relational primary can remain appropriate |
| 100,000,000 submissions | Answer bytes, WAL/binlog, secondary indexes, purge/backup times, exports | Retention and archive policy, keyset/streaming, restore drills, bounded workers; read replicas when reads justify them |
| 1,000,000,000+ answer values | Row/index amplification if all answers normalized; unbounded analytic scans | Keep canonical documents; selective facts/rollups; evaluate separate analytics store only after OLTP workload separation is justified |

Illustration, not sizing evidence: 100M responses averaging 10 KB answers is about 1 TB of answer payload alone, before indexes, row/LOB overhead, replication logs, backups, and replicas. Measure actual compressed/on-disk payload distribution and tenant skew.

### Required Now / Soon / Large Scale Only

- **Now:** authorization, atomic writes, versioning, input/page limits, no full rescans per vote, safe migrations, recoverable processing, retention decisions.
- **Soon:** cursor exports, typed score metrics, deterministic cleanup, query/lock/pool telemetry, privacy-safe cached aggregates.
- **Large scale only:** rollups/materialized views, replicas, archive tier, selected analytical fact projections; separate analytics infrastructure if latency/resource isolation requires it.
- **Not now:** sharding, microservices, Kafka, per-tenant databases, partitioning every table.

### Partitioning and Operational Caveats

- MySQL InnoDB user partitioning has foreign-key restrictions; current Submission relations are not a drop-in partitioning candidate.
- PostgreSQL partitioned UNIQUE/PK constraints must include partition keys. Date-partitioning submissions changes how globally unique IDs and child FKs are enforced. Global vote/answer uniqueness must not accidentally become per-month uniqueness.
- Prefer archive/retention plus indexes first. Evaluate partitions only against a concrete pruning/purge requirement and migration design.
- A hot form's first-response lock should be brief and only needed for policy initialization; do not serialize every response on a form counter indefinitely.
- Shared budget counters intentionally concentrate writes per scope/window. Retain until measured lock wait requires another atomic shared-budget implementation.
- Exact rollup counters can create hot rows; coalesce asynchronous updates only when an aggregation requirement exists. Never relax duplicate-vote constraints to reduce contention.
- Replicas cannot serve stale authorization/unique-claim decisions. Define read-after-write behavior for response confirmation and results.
- Observe p95/p99 query time, rows examined, connection pool wait, lock wait/deadlocks, outbox lag, stuck processing, replica lag, backup restore time, and per-tenant skew.

## 14. Security Review

### Data Never Returned as Generic Database Rows

- External-validation credentials/headers, payment merchant secrets, outbox payload/error internals, cached role definitions, token hashes, and answer-uniqueness digests.
- Assessment answer keys or identifying answers outside their explicit respondent/reviewer policy.
- IP/user agent, vote identifiers, and unredacted files for aggregate/redacted viewers.
- Full form configuration on a list/detail endpoint used only for response labels. [getForm/listForms](../backend/src/service/form.service.ts) return parsed configuration; use editor-specific versus reader-safe DTOs.

Existing strengths: server-issued random public session tokens stored only as hashes, form-bound session lookup, atomic conditional session budgets, indexed uniqueness checks, public schema/payment sanitization, anonymous-survey transport-metadata suppression, and centralized response shaping. **Keep these controls; extend them to the uncovered paths.**

Further decisions:

- SHA-256 of form/field/canonical answer is deterministic and unkeyed. A database reader can dictionary-guess low-entropy emails/identifiers; hashing is not anonymization. Prefer versioned HMAC with a key outside the database for sensitive equality indexes. Rotation must preserve lookup/uniqueness across old/new digests during backfill.
- Vote identifiers are plaintext and also copied into voting result JSON. Remove duplication; retain only what the vote-integrity/retention policy requires. IP-based prevention is not proof of a unique human; shared NAT and changing IPs are product limitations.
- Public assessment results use `submissionId` as a bearer capability. Bind result access to a respondent session or a separate random expiring receipt token. Merely converting IDs to UUID does not solve authorization.
- Survey partial tokens are browser-supplied and separate from server-issued public sessions. Require adequate entropy and form/version binding, prevent completed partial overwrites, and give them a clear TTL. Do not assume partial completion makes final submission idempotent.
- DMS owns bytes, but missing metadata must not authorize attachment/download. Local form/submission policy must be enforced before obtaining signed URLs. If DMS cannot reliably support ownership/retention queries, then a minimal local file-reference registry becomes justified, not before.
- Payment endpoints here return 410 and delegate to POS. No durable server-side proof linking a successful payment to acceptance was found in the reviewed submission path. If payment is mandatory, verify POS server-side and bind its receipt idempotently; do not trust browser answer JSON. A local ledger is not automatically required.
- UMS is identity truth; local profile writes can lag/fail. Reconciliation is necessary, and stale local emails must not silently define invitation ownership after upstream email changes.
- External validation configuration makes server-side HTTP calls; enforce destination/redirect/network restrictions independently of storage encryption.
- Use least-privilege runtime DB account, separate migration credentials, encrypted transport/storage/backups, restricted backup access, retention/erasure procedures, and restore drills. These operational controls were not verified live.
- A database backup exists in the repository workspace. Verify tracking, access, encryption, and retention without assuming it is public or disclosing its contents.

## 15. Migration Plan

### Phase 0: Evidence and Recovery Gates

1. Capture live engine version, `lower_case_table_names`, charset/collation, timezone, SQL mode, table definitions, FK/index inventory, and Prisma applied-history status with a read-only account.
2. Compare live DDL to migrations and Prisma; do not assume generated SQL equals deployed state.
3. Capture row counts, lengths, invalid JSON, orphan links, mismatched parent IDs, duplicate canonical values, and data distribution using bounded/off-peak queries.
4. Verify backup + restore and recovery objectives. Test clean migration replay and upgrade from a representative sanitized copy.
5. Identify privacy/retention and old-version submission policy; approve gates before irreversible changes.

### Phase 1: Application Safety First

- Fix scoped result/template reads, redaction on mutation/results, poll visibility, audit permissions, and file ownership checks.
- Introduce transaction-aware DAOs; commit local writes and outbox records together.
- Disable or validate/transactionalize answer edits; cap page/input sizes; stop unused per-vote rescans.
- Replace unsafe deployment fallback and unconditional DDL with reviewed versioned operations. Do not run `db push --accept-data-loss` in production.

### Phase 2: Add Structures, Without Dropping Old Ones

- Create `form_versions`; add nullable version pointers/references, draft revision, provenance flag, lifecycle fields, and processing/outbox lease fields.
- Add nullable typed share targets/tenant columns, score columns, and optional native JSON shadow columns.
- Add candidate indexes only for deployed query changes. Keep old indexes/columns while old application instances still depend on them.
- Add FK/check constraints after data preflight. PostgreSQL supports `NOT VALID` then `VALIDATE CONSTRAINT` for suitable FK/CHECK changes; unique constraints need their own index build strategy. MySQL is version/operation dependent.

### Phase 3: Backfill in Resumable Batches

- Use keyset checkpoints/high-water marks, bounded transactions, rate limits, retry logs, and per-table parity metrics.
- Create a labeled initial snapshot for each relevant form. Mark historical submission provenance as unknown/inferred, never known-original.
- Backfill tenant consistency/typed targets from parent rows; quarantine mismatches rather than guessing ownership.
- Parse JSON/scalars, report invalid rows, and preserve originals until reviewed.
- Reconcile unique claims. Distinguish “same claim already exists for this submission” from “different submission owns this value”. Current `INSERT IGNORE` reports both as collisions and can suppress other warnings.
- Backfill with concurrent-write catch-up, or pause acceptance for the affected form. An empty new uniqueness projection must not temporarily permit duplicates of historical answers.
- The historical vote migration removes duplicate claim rows but leaves submissions. Current poll counting reads submissions, so historical duplicate votes can still be counted. Decide exclusion/correction explicitly; never silently delete respondent records.

### Phase 4: Coordinated Application Cutover

- Deploy dual-write support before backfill catch-up where required; use transactional writes for local old/new representations.
- Switch public reads/validation/scoring/export/redaction to versions. Roll out browser version/session fields compatibly.
- Switch share queries to typed targets and enforce same-tenant constraints.
- Switch JSON readers only after DAO/interface conversion; switch score queries only after parity checks.
- Start leased recovery workers; coordinate multiple replicas and external idempotency keys. A local lease does not guarantee exactly-once remote execution after timeout.

### Phase 5: Validate Before Enforcing/Removing

| Gate | Expected result |
| --- | --- |
| Two tenants with swapped form/submission/template IDs | No foreign row content returned |
| REDACTED/BLIND_REVIEW mutation/result/export/file checks | No forbidden identifying values |
| Concurrent identical unique/vote submissions | Exactly one accepted response and claim; no orphan responses |
| Process crash at each write boundary | Atomic rollback or safely recoverable committed state |
| Concurrent invitation accept/revoke; role removal | One valid final state, consistent membership/outbox |
| Concurrent publish/edit/first response/policy change | No overwritten draft, schema mismatch, or widened historical privacy |
| Answer edit after uniqueness/scoring | Claims/results match new canonical answer or edit is rejected |
| DDL/JSON/parent/version parity | Zero unexplained mismatches; explicit legacy provenance exceptions |
| Query benchmark on skewed realistic data | Bounded memory, rows examined, lock time; measured improvement |
| Restore and migration replay | Recoverable, deterministic deployment on target Linux configuration |

Backend package scripts do not define a standard automated test command. Temporary tests exist, but comprehensive database concurrency and authorization regression suites were not found in the reviewed inventory. Add real-MySQL integration tests before shipping these changes; mocks cannot validate FK, isolation, collation, or crash behavior.

### Phase 6: Contract and Cleanup

- Make version references mandatory for new verified-version responses and session IDs mandatory for active drafts; preserve an explicit legacy exception where history is unknowable.
- Remove old share columns/isPublished only after all readers, workers, raw SQL, scripts, and exports have switched.
- Retire redundant indexes only after plan/usage comparison. Purge retained legacy columns after rollback window.
- Physical renames are last and optional. Preserve compatibility for Prisma, raw SQL, exports, backup scripts, and all transports.

### Online vs Maintenance-Window Work

| Change | Deployment impact |
| --- | --- |
| New empty table | Usually short metadata operation; still monitor lock acquisition |
| Nullable column/default addition | May be instant/in-place on supported MySQL; inspect exact engine/version and operation |
| Native JSON conversion, string narrowing, PK rewrite, collation change | Can rebuild/scan large tables; shadow-column/table strategy or planned maintenance required |
| Index build | PostgreSQL `CREATE INDEX CONCURRENTLY` outside transaction, with failed-index cleanup; MySQL online behavior depends on operation/version, with metadata locks still possible |
| FK/check validation | Full data checks can be expensive; PostgreSQL staged validation helps, MySQL lacks equivalent general NOT VALID flow |
| Rename/drop old column | Metadata may be fast but application compatibility can require a coordinated cutover |
| Large tenant deletion | Never one giant cascade during a request; batched purge with checkpoint/retry |

No universal zero-downtime guarantee is possible without actual engine version, table size, replication topology, and lock measurements. Keep external HTTP requests outside DB transactions. Avoid automatic rollback that discards newly accepted responses; prefer forward repair and compatible readers.

**PostgreSQL migration, only if separately approved:** create a PostgreSQL baseline preserving text IDs, transform LONGTEXT documents to validated JSONB, normalize timestamp/collation semantics, test case-insensitive uniqueness, port raw SQL/scripts, validate counts/checksums/FKs, rehearse delta capture and final write pause. Do not replay MySQL migrations against PostgreSQL or change `provider` as if it were a schema upgrade.

## 16. Recommended Final Schema

**Core target: 20 tables, the current 19 plus `form_versions`.** Logical snake_case names below do not authorize immediate physical renaming. Optional analytics/file/audit tables are deliberately excluded.

```text
users
  +-- organizations (owner)
  +-- organization_members -- organizations
  +-- team_members -- teams -- organizations

organizations
  +-- organization_invites
  +-- role_definition_cache
  +-- form_templates (also approved global templates)
  +-- forms
        +-- form_shares -> organization member OR team
        +-- form_versions
        +-- form_submissions -> form_versions
        |     +-- submission_processing_results
        |     +-- submission_unique_values
        |     +-- vote_identity_claims
        +-- public_form_sessions -> form_versions
        |     +-- submission_drafts -> form_versions
        +-- survey_response_sessions -> form_versions

ums_outbox (survives tenant deletion)
public_rate_counters (scope/window budgets)
DMS / UMS / POS remain external systems of record
```

### Specification Conventions

- `ID`: preserve current string IDs; MySQL compatible varchar initially, PostgreSQL text if adopted. `JSON`: validated document, initially LONGTEXT if needed, native MySQL JSON/PG JSONB after coordinated migration. `TS`: UTC DATETIME(3)/PG timestamptz(3).
- `?` marks NULL; otherwise NOT NULL. `= value` marks default. IDs retain existing application generation, except externally supplied User IDs and the composite counter key.
- Mutable entities retain `created_at=now`, application-managed `updated_at`; immutable append records have creation/event time only. Existing nullable audit actors remain nullable; formerly mandatory actors can become nullable only for an approved erasure policy.
- Existing business unique keys remain unless an explicit replacement is listed. Performance indexes are section 7 candidates, not an instruction to create all of them.
- Foreign-key delete behavior below is the target. Ordinary “delete” of organizations/forms marks lifecycle state; hard-delete refers only to approved final purge.

### 16.1 organizations

- **Purpose / columns:** tenant identity: `id ID`, `slug varchar`, `name varchar`, `logo? text`, `industry? varchar`, `owner_user_id ID`, `provisioning_status varchar=ACTIVE`, `ums_synced_at? TS`, `created_at TS`, `updated_at TS`, `deleted_at? TS`.
- **PK / FK / UNIQUE:** PK(id); owner -> users RESTRICT; U(slug). Owner also has organization membership, maintained transactionally without introducing a circular mandatory insert dependency.
- **Indexes / checks:** slug key plus owner lookup FK support where required; provisioning state allow-list; nonempty slug/name.
- **Delete / soft delete / growth:** soft-delete pending purge; forms RESTRICT final deletion until purged; roughly 10K at stated target. No separate organization-settings table needed.

### 16.2 organization_members

- **Purpose / columns:** membership/role: `id ID`, `organization_id ID`, `user_id ID`, `external_role_id? varchar`, `role_name varchar=VIEWER`, `invited_by_user_id? ID`, `joined_at TS=now`.
- **PK / FK / UNIQUE:** PK(id); org/user CASCADE at approved deletion; inviter SET NULL if FK added; U(organization_id,user_id).
- **Indexes / checks:** I(user_id); role nonempty, external role validated by UMS rather than a fixed enum.
- **Delete / soft delete / growth:** hard-delete revoked membership with dependent team membership/shares; no soft delete; proportional to user-organization edges. Transactional audit/outbox for role changes.

### 16.3 organization_invites

- **Purpose / columns:** current invitation: `id ID`, `email varchar(320)` under aligned policy, `organization_id ID`, `external_role_id? varchar`, `role_name varchar=CREATOR`, `invite_status varchar=PENDING`, `invited_by_user_id ID`, `created_at TS`, `last_invited_at TS`, `responded_at? TS`.
- **PK / FK / UNIQUE:** PK(id); org CASCADE; inviter retained user RESTRICT or nullable SET NULL under explicit policy; U(organization_id,email).
- **Indexes / checks:** I(email,invite_status), I(organization_id,invite_status); allowed status and response-time consistency.
- **Delete / soft delete / growth:** hard-delete by retention; no soft delete; one reusable row/org/email. Separate historical event table is not required merely to retain reinvite time.

### 16.4 role_definition_cache

- **Purpose / columns:** last-known UMS roles: `id ID`, `app_id varchar`, `organization_id ID`, `payload JSON`, `fetched_at TS=now`.
- **PK / FK / UNIQUE:** PK(id); organization CASCADE if strictly local scoped; U(app_id,organization_id).
- **Indexes / checks:** unique lookup, necessary org FK support; payload array; freshness enforced using fetched_at and configured maximum stale age.
- **Delete / soft delete / growth:** hard-delete/rebuild; no soft delete; roughly apps times tenants. Do not normalize external role payloads into competing authoritative role tables.

### 16.5 ums_outbox

- **Purpose / columns:** durable external work: `id ID`, `kind varchar`, `organization_id ID` as historical target, `payload JSON`, `status varchar=PENDING`, `attempts int=0`, `next_attempt_at TS=now`, `last_error? text`, `created_at TS`, `updated_at TS`, `lease_token? varchar`, `lease_expires_at? TS`, `completed_at? TS`.
- **PK / FK / UNIQUE:** PK(id); intentionally no organization FK; use event ID as remote idempotency key when supported.
- **Indexes / checks:** due index, I(organization_id), cleanup candidate; known kinds/statuses, nonnegative attempts, lease fields consistent.
- **Delete / soft delete / growth:** bounded DONE retention and explicit DEAD handling; no soft delete; every mirrored change. Per-entity ordering/latest-state reconciliation prevents an old sync from re-adding a removed member.

### 16.6 teams

- **Purpose / columns:** flat grouping: `id ID`, `organization_id ID`, `name varchar`, `slug varchar`, `description? text`, `created_by_user_id ID`, `is_default boolean=false`, `created_at TS`, `updated_at TS`.
- **PK / FK / UNIQUE:** PK(id); org CASCADE; actor retained/RESTRICT; U(org,slug), U(id,org) for composite references; at-most-one-default constraint with engine-appropriate implementation.
- **Indexes / checks:** retain useful slug/default lookup coverage; no duplicate org index without plan evidence; name/slug nonempty.
- **Delete / soft delete / growth:** rehome forms then hard-delete; default team cannot be ordinarily deleted; no soft delete; low per tenant.

### 16.7 team_members

- **Purpose / columns:** team assignment: `id ID`, `organization_id ID` (new consistency key), `team_id ID`, `user_id ID`, `added_by_user_id? ID`, `created_at TS`, `updated_at TS`.
- **PK / FK / UNIQUE:** PK(id); `(team_id,org)` -> teams CASCADE; `(org,user_id)` -> organization_members CASCADE; actor SET NULL; U(team_id,user_id).
- **Indexes / checks:** I(user_id) or measured tenant/user replacement; composite FK support; no role column.
- **Delete / soft delete / growth:** hard-delete join; no soft delete; membership edges. Added org key exists for enforced equality, not generic denormalization.

### 16.8 users

- **Purpose / columns:** identity projection: `id ID` from UMS, `email varchar(320)` under aligned policy, `first_name? varchar`, `last_name? varchar`, `username? varchar`, `phone? varchar`, `gender? varchar`, `address? text`, `profile_attributes? JSON`, `created_at TS`, `updated_at TS`.
- **PK / FK / UNIQUE:** PK(id); U(canonical email), U(username) with deliberate collation policy; no cross-service FK.
- **Indexes / checks:** existing unique lookups; optional profile object; avoid gender enum for evolving external profile data.
- **Delete / soft delete / growth:** anonymize/minimize PII or hard-delete after owner/actor obligations resolved; no automatic new soft-delete flag; global user count. Credentials stay in UMS/Keycloak.

### 16.9 forms

- **Purpose / columns:** identity + editable draft: `id ID`, `organization_id ID`, `name varchar(200)`, `slug varchar`, `description? text`, `team_id? ID`, `draft_definition JSON`, `draft_settings JSON`, `draft_revision int=0`, `published_version_id? ID`, `response_policy varchar=STANDARD`, `response_policy_locked_at? TS`, `created_by_user_id ID`, `created_at TS`, `updated_at TS`, `archived_at? TS`, `deleted_at? TS`.
- **PK / FK / UNIQUE:** PK(id); org RESTRICT; `(team_id,org)` -> teams RESTRICT; `(published_version_id,id)` -> versions `(id,form_id)` RESTRICT; actor retained/RESTRICT; U(org,slug), U(id,org).
- **Indexes / checks:** tenant ordered-list candidates; policy allow-list; draft revision nonnegative; JSON objects. Clear published pointer before purging referenced versions.
- **Delete / soft delete / growth:** archive/unpublish/soft delete, then bounded approved purge; 1M forms at stated target. `isPublished` removed only after pointer-based cutover. No separate form-settings/publication table.

### 16.10 form_shares

- **Purpose / columns:** typed access exception: `id ID`, `organization_id ID`, `form_id ID`, `user_id? ID`, `team_id? ID`, `level varchar=AGGREGATE`, `can_edit boolean=false`, `expires_at? TS`, `created_by_user_id ID`, `updated_by_user_id? ID`, `created_at TS`, `updated_at TS`.
- **PK / FK / UNIQUE:** PK(id); `(form_id,org)` -> forms CASCADE; `(org,user_id)` -> organization_members CASCADE; `(team_id,org)` -> teams CASCADE; actors retained/SET NULL as applicable; U(form_id,user_id), U(form_id,team_id).
- **Indexes / checks:** target lookup indexes only as needed; exactly one target non-NULL, valid response level.
- **Delete / soft delete / growth:** hard revoke; expiry queried on access; no soft delete; grants/form. Keep one table; retire principalType/principalId after compatibility window.

### 16.11 form_versions

- **Purpose / columns:** immutable publication: `id ID`, `form_id ID`, `version_number int`, `name varchar(200)`, `description? text`, `definition JSON`, `settings JSON`, `response_policy varchar`, `published_by_user_id? ID`, `published_at TS`, `provenance varchar=published`.
- **PK / FK / UNIQUE:** PK(id); form RESTRICT; publisher nullable SET NULL; U(form_id,version_number), U(id,form_id) for matching-parent references.
- **Indexes / checks:** business unique keys suffice initially; version > 0; object roots; allowed provenance distinguishes real publish from legacy baseline.
- **Delete / soft delete / growth:** immutable, no updated_at/deleted_at; retain while responses/session records refer to it; forms times publications. Native JSON is not proof the snapshot is immutable: enforce restricted write paths/DB role permissions.

### 16.12 form_submissions

- **Purpose / columns:** accepted response: `id ID`, `form_id ID`, `form_version_id? ID` for legacy only, `version_provenance varchar`, `answers JSON`, `ip? varchar(45)`, `user_agent? text`, `is_read boolean=false`, `tags JSON=[]`, `processing_status varchar`, `submitted_at TS=now`, `updated_at TS`, `processing_attempts int=0`, `next_attempt_at? TS`, `processing_lease_token? varchar`, `processing_lease_expires_at? TS`, optional `idempotency_key? varchar`, `request_hash? varchar(64)`.
- **PK / FK / UNIQUE:** PK(id); form RESTRICT; `(version_id,form_id)` -> versions RESTRICT; U(id,form_id); optional U(form_id,idempotency_key).
- **Indexes / checks:** section 7 list/recovery candidates; object answers/array tags; valid processing state including not_required; known-version provenance requires version ID; bounded metadata.
- **Delete / soft delete / growth:** no blanket soft delete; controlled retention/erasure purge and immutable external audit event; 100M target rows. Parent form archive does not itself erase responses. Decide whether vote/unique claims release on purge.

### 16.13 submission_unique_values

- **Purpose / columns:** enforce answer uniqueness: `id ID`, `form_id ID`, `field_id varchar(191)`, `value_hash varchar(64)` initially, `submission_id ID`, `created_at TS`; introduce versioned digest metadata only with an HMAC migration.
- **PK / FK / UNIQUE:** PK(id); `(submission_id,form_id)` -> submissions CASCADE; U(form_id,field_id,value_hash).
- **Indexes / checks:** submission FK support; nonempty field ID; validated digest format. No separate field table FK while fields are versioned JSON.
- **Delete / soft delete / growth:** replace transactionally on answer edit; cascade on approved response purge; no soft delete; roughly submissions times populated unique fields. HMAC rotation cannot include key version in uniqueness and assume cross-key duplicates are prevented automatically.

### 16.14 public_form_sessions

- **Purpose / columns:** respondent capability: `id ID`, `form_id ID`, `form_version_id ID` for new sessions, `token_hash varchar(64)`, `verified_identity? varchar(320)`, `verified_at? TS`, `unique_checks int=0`, `external_checks int=0`, `created_at TS`, `last_seen_at TS`, `expires_at TS`.
- **PK / FK / UNIQUE:** PK(id); form CASCADE; `(version_id,form_id)` -> versions RESTRICT; U(token_hash), U(id,form_id).
- **Indexes / checks:** expiry index and FK support; paired verification fields, nonnegative budgets, expiry > creation.
- **Delete / soft delete / growth:** TTL hard-delete cascades drafts; no soft delete; bounded live visits plus cleanup backlog. No raw token in database.

### 16.15 public_rate_counters

- **Purpose / columns:** shared budget: `scope varchar(191)`, `window_start TS`, `count int=0`.
- **PK / FK / UNIQUE:** PK(scope,window_start); no FKs because scope is a namespaced rate-limit target, not necessarily a tenant ID.
- **Indexes / checks:** I(window_start); count >= 0; permitted scope formats validated by trusted callers.
- **Delete / soft delete / growth:** TTL hard-delete; no soft delete; active scopes/windows. **No change required** to the core key model.

### 16.16 survey_response_sessions

- **Purpose / columns:** survey progress: `id ID`, `form_id ID`, `form_version_id ID` for new partials, `token_hash varchar(64)`, `answers JSON`, `step_index int=0`, `completed_at? TS`, `created_at TS`, `updated_at TS`, `expires_at TS`.
- **PK / FK / UNIQUE:** PK(id); form CASCADE; `(version_id,form_id)` -> versions RESTRICT; U(form_id,token_hash).
- **Indexes / checks:** I(form_id,completed_at), expiry candidate; object answers, valid step/expiry. Completed rows must not be mutated by ordinary partial-save upsert.
- **Delete / soft delete / growth:** bounded partial-payload retention; no soft delete; survey starts. Keep distinct from security sessions; merge with submission_drafts only after anonymous analytics/resume semantics converge. Do not retain duplicate completed answer payloads indefinitely.

### 16.17 submission_processing_results

- **Purpose / columns:** derived response output: `id ID`, `submission_id ID`, `form_id ID`, `type varchar`, `result_payload JSON`, `processed_at TS=now`, `processor_revision varchar`, `total_score? numeric`, `max_score? numeric`, `percentage? numeric`, `passed? boolean`.
- **PK / FK / UNIQUE:** PK(id); `(submission_id,form_id)` -> submissions CASCADE; U(submission_id), preserving one result per submission.
- **Indexes / checks:** form/score index when query changed; allowed type; assessment scalar consistency; voting scalars NULL. Choose numeric precision from supported fractional points and historical values, not arbitrary floating-point equality.
- **Delete / soft delete / growth:** rebuildable, cascade with response; no soft delete; one row per processed response. Rank is computed, not a permanent attribute. No aggregate sentinel submission IDs.

### 16.18 vote_identity_claims

- **Purpose / columns:** duplicate-prevention record: `id ID`, `form_id ID`, `submission_id ID`, `identity_digest varchar(64)` after approved HMAC transition, `digest_key_version varchar`, `created_at TS=now`; legacy plaintext `identifier` retained only during migration.
- **PK / FK / UNIQUE:** PK(id); `(submission_id,form_id)` -> submissions CASCADE under existing revote-on-delete semantics; U(submission_id), U(form_id,identity_digest).
- **Indexes / checks:** form/time history only with pagination; digest/version validity. Rotation needs cross-version matching and staged backfill before switching uniqueness keys.
- **Delete / soft delete / growth:** no soft delete; votes using duplicate prevention. If voting eligibility must survive respondent erasure, change retention/link design explicitly; do not label this an immutable audit table.

### 16.19 submission_drafts

- **Purpose / columns:** resumable partial answers: `id ID`, `form_id ID`, `form_version_id ID` for active drafts, `identity? varchar(320)`, `session_id ID` after legacy cleanup, `answers JSON`, `step_index int=0`, `created_at TS`, `updated_at TS`.
- **PK / FK / UNIQUE:** PK(id); form CASCADE; `(session_id,form_id)` -> public sessions CASCADE; `(version_id,form_id)` -> versions RESTRICT; U(form_id,session_id).
- **Indexes / checks:** existing session/form lookup coverage; object answers, step >= 0; session/version agreement checked in transaction or stronger composite session key when needed.
- **Delete / soft delete / growth:** TTL inherited from session; hard-delete only, no new expiry column required; active drafts plus explicitly quarantined legacy rows. Identity is not an authorization key.

### 16.20 form_templates

- **Purpose / columns:** reusable blueprint: `id ID`, `name varchar(200)`, `description? text`, `category varchar`, `definition JSON`, `settings JSON`, `is_static boolean=false`, `organization_id? ID`, `created_by_user_id? ID`, `created_at TS`, `updated_at TS`.
- **PK / FK / UNIQUE:** PK(id); optional organization CASCADE at approved purge; optional creator SET NULL; no speculative unique name constraint.
- **Indexes / checks:** I(organization_id); global/private scope consistency; object documents; no embedded credentials.
- **Delete / soft delete / growth:** hard-delete blueprint without deleting forms copied from it; no soft delete by default; low compared with forms. **No separate template-version table required by current behavior.**

## 17. Priority Matrix

| Priority | Problem | Table | Recommendation | Impact |
| --- | --- | --- | --- | --- |
| Critical | Cross-tenant result lookup | ProcessingResult / Submission | Bind result to authorized form/tenant | Prevents foreign response disclosure |
| Critical | Private template detail ignores org | Template | Scoped lookup and safe copy/read projection | Prevents private config/credential disclosure |
| Critical | Mutation/result redaction bypass | Submission / ProcessingResult | Policy-aware outputs on every path | Preserves respondent privacy |
| Critical | Cross-org historical promotion | OrgUser / TeamMember | Evidence-based migration audit/repair | Corrects potential excess privileges |
| Critical | Non-atomic acceptance and claims | Submission / unique/vote claims | One DB transaction | Prevents duplicate/partially accepted responses |
| Critical | Answer edits invalidate constraints | Submission / claims / results | Validate, transact, reprocess or restrict edits | Prevents inconsistent accepted answers |
| Critical | Missing published version/privacy race | Form / Submission | Immutable versions, revision/policy synchronization | Preserves historical correctness/privacy |
| High | Public poll/audit/file permission gaps | Results / vote claims / external DMS | Enforce ownership/settings/response level | Closes alternate data-access paths |
| High | Lost/out-of-order mirrored changes | UmsOutbox / OrgUser / OrgInvite | Transactional enqueue and leased idempotent worker | Reliable access synchronization |
| High | Process-local background work | Submission / ProcessingResult | Recovery fields and leased worker | No permanently stuck accepted responses |
| High | Destructive deploy fallback/case mismatch | Migrations / deployment | Fail closed, replay test, controlled baseline | Prevents failed or data-losing deployment |
| High | Unbounded lists/scans and repeated ranks/tallies | Form / Submission / ProcessingResult | Bounded queries, streaming, typed scores | Controls latency, memory, DB load |
| High | Cascading response deletion | Organization / Form / Submission | Archive/soft delete entry point, explicit purge | Retention and operational safety |
| High | Inconsistent parent/tenant references | TeamMember / FormShare / projections / Draft | Composite FKs and typed share targets | Prevents invalid cross-parent data |
| High | Length mismatch and unbounded payloads | Form / Template / User / Submission | Align types and validation limits | Avoids valid-request failures and storage abuse |
| Medium | Stale cache/identity projection | RoleDefinitionCache / User | Freshness and reconciliation policy | Safer degraded operation |
| Medium | Plaintext/dictionary-guessable PII indexes | Vote claims / unique claims | Versioned HMAC and retention plan | Reduces backup/DB-reader disclosure risk |
| Medium | Legacy/abandoned partial payloads | Draft / SurveyResponseSession | Explicit TTL and cleanup gates | Limits duplicate PII and storage growth |
| Medium | Generic string documents | Document columns | Validated native JSON transition when ready | Better validity and targeted query support |
| Low | Naming convention differences | All | Document mappings; rename only in coordinated project | Better SQL readability without unnecessary churn |
| Low / scale-triggered | Replica/rollup/analytics pressure | High-volume responses/results | Measure, then add only needed infrastructure | Sustains growth without premature distribution |

## 18. Final Verdict

### Already Good

- Shared relational tenant model, explicit memberships, flat teams, form-scoped response storage.
- Business UNIQUE constraints for memberships, slugs, vote identities, and unique answers.
- JSON-based dynamic form definitions and answers are appropriate for the current editor and response workflows.
- Separate respondent capabilities, uniqueness projections, role cache, and external synchronization outbox have legitimate responsibilities.
- External UMS/DMS/POS ownership avoids unnecessary local duplication. No need to recreate their complete schemas.

### MUST Change

- Scoped authorization and response shaping on the identified read/mutation paths.
- Atomic acceptance/claim writes and invariant-preserving content updates.
- Immutable publication/version association and race-free privacy locking.
- Historical cross-tenant role-backfill audit and production deployment safeguards.

### SHOULD Change

- Durable leased processing/outbox delivery, conditional invite transitions, composite parent consistency, bounded query/export paths, typed assessment metrics, aligned lengths, and deliberate retention.

### Can Wait

- Physical renaming, broad native-JSON conversion, PK rekeying, partitioning, replicas, general answer facts, and separate analytics infrastructure until the operational benefit is demonstrated.

### Should NOT Be Changed Blindly

- Do not normalize every field/option/answer, add soft-delete timestamps everywhere, add every conceivable FK index, replace external role definitions with fixed enums, or migrate to PostgreSQL simply because the review requested PostgreSQL expertise.
- **Recommended direction: 19 existing tables + 1 version table, stronger constraints and transactions, safer access, and bounded queries. Reliability first; more tables only when a verified requirement earns them.**