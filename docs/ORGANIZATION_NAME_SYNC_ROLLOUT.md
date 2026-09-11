# Organization Name Synchronization

## Deployment status: 2026-09-11

The deployment and conflict-free name repairs were completed on this host. Both
`user-management-service` and `form-builder-service` were restarted in that order.
The deployed Sify Forms JavaScript already matched the validated staged build, so
no compiled JavaScript replacement was needed. UMS retains its existing
PM2-managed source/nodemon launch configuration; this deployment did not migrate
its process model or deploy unrelated working-tree changes.

`UMS_ORG_NAME_SYNC_ENABLED=true` and `UMS_OUTBOX_ENABLED=true` are active on the
Sify Forms process. The worker delivered seven `ORG_NAME_SYNC` jobs successfully;
the post-deployment check found no pending or dead name-sync jobs.

Verified synchronized names:

- Sify Digital Services
- Sify Technologies
- Sify Infinit Spaces
- Sunitha&Company
- Usecase Inc
- Sify
- Dikson Samuel

The three organizations named `Prithvi P K` remain unchanged and blocked for
owner-approved distinct display names. Do not run a bulk repair until these
conflicts are resolved.

Verification covered both services' health endpoints, authenticated UMS access,
and member listing for all ten active organizations (HTTP 200). Local membership
assignments, role definitions, form/team IDs, UMS member IDs, and all non-name
Keycloak representation fields matched the saved baseline. No unrelated PM2
process had a PID, status or restart-count change. The 26 focused tests passed
again before deployment. End-user browser login and live membership addition or
removal were not exercised against business accounts during this deployment.

Protected before-state reports, deployed artifact snapshots and the final
integrity result are stored under:

```text
/data/form-builder/name-sync-deploy-DHN9Bl/
```

`names-before.json` and the per-organization reports contain previous display
names and identifiers; `keycloak-before.json` contains pre-change representations;
`references-before.json` and `post-deploy-check.json` record the integrity checks.
Process snapshots contain sensitive environment values and must remain private.

## Scope and invariants

Sify Forms `Organization.name` is the source of truth for its organization display names. UMS `org_config.orgId`, Sify Forms organization IDs, Keycloak aliases, and Keycloak internal IDs remain unchanged. Existing organizations are updated in place; they are never deleted and recreated to repair a name.

No schema migration is required. No credentials or PM2 configuration were changed by this implementation.

The rollout is opt-in: `UMS_ORG_NAME_SYNC_ENABLED` defaults to `false` in source. This is a deployment ordering guard; the deployed process now explicitly enables it as recorded above.

## Implementation

- UMS resolves organization identity by exact alias using paginated Keycloak reads, independently of display-name search. Legacy records without an alias can still match their ID-based name. Its general `getOrganizations(search)` API is unchanged.
- UMS rename checks application ownership and existing duplicate-name restrictions. It repairs Keycloak even if the registry already has the desired name, fails visibly when Keycloak is missing, and preserves the fetched Keycloak representation except for `name`.
- Successful UMS rename responses add `nameSynced: true`. Sify Forms requires this acknowledgement; an older UMS response cannot mark a job complete.
- With name sync enabled, Sify Forms creates Keycloak organizations with a readable name and unchanged ID-based alias/domain. A 409 is accepted only when the expected alias really exists.
- A local rename and an `ORG_NAME_SYNC` outbox job are saved in the same MySQL transaction. Failure to enqueue rolls back the rename. Other organization edits do not create name jobs.
- The worker reads the current name, not an old name embedded in a job. A row lock serializes name synchronization and local renames for that organization, including across multiple backend processes. Remote requests occur while that lock is held; a concurrent rename may wait or time out and need retrying. The sync transaction has a 60-second limit.
- Failures follow the existing outbox backoff and eventually become visible `DEAD` jobs. Acknowledgement is not a substitute for the read-only post-migration verification command.
- Other outbox kinds, role permissions, memberships, user credentials and application identifiers are not migrated by this feature. This change does not claim to repair unrelated outbox delivery guarantees.

## Deployment order

1. Release the narrowly scoped UMS changes first: the Keycloak provider alias resolver, its organization-service call sites and rename handling, and the additive controller acknowledgement. The UMS working tree had extensive pre-existing edits; do not deploy that entire dirty tree blindly.
2. Validate UMS in staging: existing ID-named and readable-name organizations must both support member listing, addition/removal, role access and login. General organization searches for other applications must remain unchanged. Use a test organization for mutating checks.
3. Release Sify Forms with `UMS_ORG_NAME_SYNC_ENABLED=false`. Keep existing organization IDs and aliases intact.
4. Confirm all UMS replicas run the compatible version. Configure `UMS_ORG_NAME_SYNC_ENABLED=true`, `UMS_OUTBOX_ENABLED=true`, and valid UMS service-user credentials on the Sify Forms backend/worker. Keep Keycloak admin credentials available for provisioning and maintenance verification. Apply configuration through the existing deployment/secret-management process.
5. Confirm the backend worker is running. The CLI reading a local `.env` does not prove that a PM2 process has reloaded that setting. Align CLI and deployed process configuration.
6. Repair one unblocked organization, verify names and access, then continue with reviewed organizations.

During the initial implementation no shared service was restarted and no live rename was performed. The subsequent deployment is recorded above. Both repositories passed TypeScript checking. The focused test suites passed: 14 Sify Forms database/HTTP/CLI tests and 12 UMS provider/service tests.

## Existing-data repair

Run these commands from `backend`. The default command reads Sify Forms, UMS and Keycloak and does not enqueue jobs or update names:

```sh
npm run ums:org-names
```

The report includes the previous UMS and Keycloak names, registry/internal IDs, alias, desired name, blockers, and pending/dead name-sync jobs. It excludes inactive local organizations. Missing, disabled or ambiguous remote organizations are blocked rather than created or reactivated.

Live read-only inspection on 2026-09-11 found ten active organizations whose Keycloak names were still IDs. Seven had no reported naming conflict. Three local organizations shared `Prithvi P K`; the repair command blocks these for review rather than inventing new names or merging organizations. Confirm distinct business names through the owner before changing them. New conflicts may arise after this report, so always rerun preflight.

The organization `cmtlrdb9s000hlfy0zt73betg` also had `Sify` in UMS but `Sify Digital Services` in Sify Forms. It was unblocked in that inspection.

After the compatible releases and flags are deployed, queue that single correction:

```sh
npm run ums:org-names -- --apply --org cmtlrdb9s000hlfy0zt73betg --report /tmp/sify-org-name-before.json
```

The report file must not already exist. It is written with owner-only permissions before queueing. Store it in an approved backup location for production; `/tmp` is only an example. `QUEUED` means queued, not synchronized. No memberships or role-reconciliation jobs are executed by this command.

Once the deployed worker processes the job, verify:

```sh
npm run ums:org-names -- --verify --org cmtlrdb9s000hlfy0zt73betg
```

Exit code 0 means the selected names agree and preflight has no blockers. Exit code 1 means drift, blockers, or a read failure; inspect the output. Also check member listing and normal organization access through Sify Forms and UMS before proceeding to another organization.

For all active organizations, after resolving every reported conflict:

```sh
npm run ums:org-names -- --apply --all --report /tmp/sify-all-org-names-before.json
npm run ums:org-names -- --verify
```

`--all` refuses to queue anything if preflight reports a blocker. An execution-time failure can still occur after earlier organizations have been queued; the commands are repeatable. The worker always uses the latest local name. Use a fresh report file on every apply.

## Monitoring and retry

Inspect the JSON report's `jobs` entries, or use this read-only query in the Sify Forms database:

```sql
SELECT id, orgId, status, attempts, nextAttemptAt, lastError
FROM UmsOutbox
WHERE kind = 'ORG_NAME_SYNC' AND status IN ('PENDING', 'DEAD')
ORDER BY createdAt;
```

Resolve the underlying issue first: incompatible UMS version, credentials, a name collision, or an unavailable service. Rerunning `--apply --org ... --report <new-file>` for an organization with drift requeues its dead name-sync jobs and avoids adding an extra job when one is already pending. Historical dead jobs may still appear when names already agree; review them rather than assuming current drift.

Alert on `DEAD` name-sync jobs and on a growing/aging pending backlog using the existing operational monitoring. No new monitoring infrastructure is installed by this change.

## Rollback

- Disable name sync on Sify Forms to stop new name jobs and restore ID-based naming for newly created organizations. Existing names and already queued jobs are not reverted by the flag. Pending jobs fail visibly while it is disabled; pause the worker only with awareness that it also processes membership work.
- Keep the alias-aware UMS release deployed while any Keycloak organization has a readable name. Rolling UMS back first can reintroduce failed organization/member lookup.
- To reverse a data repair, use the saved report to identify the exact UMS registry row and Keycloak internal ID. Review and restore only the intended name fields through supported APIs/admin tools, leaving aliases, IDs, domains and membership untouched. Coordinate with the source-of-truth local name and queued work so a worker does not reapply the newer name.
- Never update `orgId` to a human name or delete/recreate an organization for rollback.

## Tests

Sify Forms integration tests require `TEST_DATABASE_URL` supplied securely in the environment. They create a uniquely named disposable database, clone only the `Organization` and `UmsOutbox` table structures, use local HTTP fixtures and drop the disposable database afterward. The account needs permission to create/drop that test database; application records are never used as fixtures.

```sh
npm run test:org-names
npx tsc --noEmit
```

In the UMS repository:

```sh
npx jest src/test/keycloakOrganizations.test.ts src/test/orgNameSync.test.ts --runInBand --coverage=false
npx tsc --noEmit
```