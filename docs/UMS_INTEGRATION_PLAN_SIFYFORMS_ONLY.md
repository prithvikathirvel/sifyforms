# Sify Forms ↔ UMS Integration — Plan under a "no UMS code changes" constraint

**Status:** Proposed · **Date:** 2026-09-03
**Constraint:** All code changes happen in Sify Forms only (`formbuilder` DB, backend, frontend).
UMS (`/data/services/usermanagement-service`) is **read-only to us** — only small *manual*
data/config edits are allowed there (SQL `UPDATE`s, Keycloak console clicks).
**Manager requirement:** signup, login and roles must be consumed from UMS. Anything
Sify-Forms-specific may live in `formbuilder`.

Everything below was verified on 2026-09-03 by reading both codebases and querying both
MySQL schemas. Facts that drive the design are marked ✅ **verified**.

---

## 0. Answer to "what can I actually do?"

Yes — the whole thing is achievable without touching UMS source. UMS already exposes every
endpoint we need. The work is to make Sify Forms speak UMS's dialect *exactly*, and to
absorb UMS's quirks on our side instead of fixing them there.

There are **five manual, non-code prerequisites** (§2). Everything else is Sify Forms code.

| Concern | Where it will live after this plan |
| --- | --- |
| Credentials, password reset, token issuance | Keycloak, driven **through UMS** |
| Signup, login, refresh, logout, profile | **UMS** endpoints, proxied by our backend |
| Organization registry | **UMS** `org_config` + Keycloak Organizations |
| Role *definitions* (what ADMIN may do) | **UMS** `roles` (per-org rows) |
| Role *assignments* (who is ADMIN) | Written to **UMS** `user_app_roles`; mirrored locally for read speed |
| Teams, forms, shares, submissions, invites, branding | `formbuilder` only |

---

## 1. Verified facts

### 1.1 UMS live state ✅

```
app_auth_config:
  Form-Builder | keycloak | clientId=Form-Builder | isActive=1 | usesOrgs=1
  DMS          | keycloak | ...                   | isActive=1 | usesOrgs=0

row counts: users 2 · app_users 2 · org_config 0 · roles 0 · user_app_roles 0 · features 0
```

Constraints that shape the design ✅:

```sql
roles           UNIQUE KEY uk_role_name_appId_orgId (name, appId, orgId)   -- orgId NULLable
                FK appId → app_auth_config(appId)
user_app_roles  UNIQUE KEY uk_user_app_role (userId, appId, orgId)         -- ONE role per user per org
                FK userId → users(id), FK roleId → roles(id), FK appId → app_auth_config(appId)
org_config      UNIQUE KEY unique_org_app (orgId, appId)
```

`user_app_roles` allowing exactly one role per user per org matches `OrgUser.role` exactly.
No impedance mismatch.

### 1.2 Keycloak ✅

```
GET http://1.6.37.35/keycloak/realms/Form-Builder/.well-known/openid-configuration
→ "issuer": "http://1.6.37.35/keycloak/realms/Form-Builder"
```

This is the **exact** string to pin. Note our [.env](.env) sets
`KEYCLOAK_BASE_URL=https://apidev.sifymodernization.digital`, which is the **UMS gateway,
not Keycloak**. Pinning against that value would reject every token. A separate
`KEYCLOAK_ISSUER` variable is required.

UMS drives orgs through the **Keycloak 26 Organizations API** ✅
(`/admin/realms/{realm}/organizations`, `.../organizations/{id}/members`), not groups.

### 1.3 Sify Forms live state ✅

```
formbuilder: User 2 · Organization 0 · OrgUser 0 · OrgInvite 0 · Team 0 · Form 0 · Submission 0
```

Clean slate — **no backfill, no migration window**. The two `User` tables already hold the
same two ids (the Keycloak `sub`) and the same emails, so identity is already unified. This
is the cheapest possible moment to do the work.

```
backend/.env : RBAC_SERVICE_URL=https://apidev.sifymodernization.digital/user-mgt
     .env    : RBAC_SERVICE_URL=http://localhost:3010          ← the two disagree
both         : RBAC_APP_ID=Form-Builder   RBAC_SERVICE_TOKEN=(empty)
```

`POST /api/orgs` **is** behind `authMiddleware` ✅ ([backend/src/routes/org.routes.ts](backend/src/routes/org.routes.ts#L49)) —
no anonymous org creation.

---

## 2. Manual prerequisites (the only work outside Sify Forms)

Nothing below is a code change. Do these first; the code phases assume them.

| # | Action | Why | How to verify |
| --- | --- | --- | --- |
| **M1** | Enable the `organizations` feature on Keycloak realm `Form-Builder` | UMS `createOrg` calls `POST /admin/realms/Form-Builder/organizations`. Without the feature, **every org creation 404s** | Realm Settings → toggle *Organizations* → On. Then `GET /admin/realms/Form-Builder/organizations` returns `200 []` |
| **M2** | Create Keycloak user `svc-form-builder@sify.internal` in realm `Form-Builder`, set a password, mark email verified, disable required actions | UMS `authMiddleware` has **no service-account path** — it resolves the token's `email` to a `users` row. A client-credentials token has no `email`. A real service user is the only way in without changing UMS | Password grant against the realm returns a token containing `email` |
| **M3** | Two INSERTs in the `users` schema | UMS org/feature routes run `appAuthResolver` before `authMiddleware`, so the caller must also be in `app_users` | see SQL below |
| **M4** | Rotate the Keycloak admin credential stored in `app_auth_config.config` (currently `admin` / `admin`, plaintext) | UMS uses it for every admin API call; today it is the platform's weakest link | one `UPDATE`, see below |
| **M5** | Block `POST /api/app-auth-config` at the reverse proxy / bind UMS to localhost | That route is mounted with **no auth middleware**. Anyone reachable can overwrite `clientSecret` and the Keycloak admin password for any app. We cannot fix it in code, so fix it in the network | `curl -X POST https://…/user-mgt/api/app-auth-config` → 403 from the proxy |

```sql
-- M3 (run in the `users` schema; substitute the Keycloak sub of svc-form-builder)
INSERT INTO users (id, email, username, firstName, lastName, phone, createdAt, updatedAt)
VALUES ('<keycloak-sub>', 'svc-form-builder@sify.internal', 'svc-form-builder',
        'Service', 'Account', '', NOW(), NOW());

INSERT INTO app_users (userId, appId, joinedAt)
VALUES ('<keycloak-sub>', 'Form-Builder', NOW());

-- M4
UPDATE app_auth_config
   SET config = JSON_SET(config, '$.adminUsername', '<new-user>',
                                 '$.adminPassword', '<new-password>')
 WHERE appId = 'Form-Builder';
```

### 2.1 One decision to *not* make

`usesOrgs = 1` for `Form-Builder`. A single `UPDATE … SET usesOrgs = 0` would remove the
`x-org-id` requirement and make everything simpler today. **Do not do it.**
`orgResolver` rejects `x-org-id` outright when `usesOrgs = 0`, so `req.orgId` becomes
`null` on every call, and `uk_user_app_role (userId, appId, orgId)` then permits **one role
per user across all organizations**. A user who is OWNER of org A becomes OWNER of org B.
Multi-tenancy would be structurally broken. Keep `usesOrgs = 1`.

---

## 3. The walls UMS puts up, and where Sify Forms absorbs each

This is the heart of the plan. Each row is a UMS behaviour we cannot change and the
concrete Sify Forms countermeasure.

| # | UMS behaviour (verified) | Countermeasure in Sify Forms |
| --- | --- | --- |
| **W1** | `orgResolver` returns `400 x-org-id header is required` on every `/role`, `/user-app-roles`, `/feature` call because `usesOrgs = 1`. Our client sends only `x-app-id` → **every `requirePermission()` route is currently dead** | Send `x-org-id` on all of them; register the org in `org_config` **before** any role call (§6) |
| **W2** | `roleDao.getAllRolesForApplication` appends `AND orgId = ?` — which never matches `orgId IS NULL`. App-level roles are unreachable while `usesOrgs = 1` | Materialise the 5 role definitions **per organization** (5 rows per org, one-time, on the rarest write in the product). `uk_role_name_appId_orgId` makes this legal and idempotent |
| **W3** | `authMiddleware` requires the token's `email` to resolve in `users`; no client-credentials branch | Service user M2/M3 + ROPC password grant, token cached until `exp − 30 s` (§5) |
| **W4** | `attachRoleToUser` is a bare `INSERT` → re-running the saga raises a duplicate-key 500 | Read-then-write: `GET /user-app-roles/:userId/:appId` (+`x-org-id`) → `POST` if absent, `PUT` if present. Treat duplicate-key as success |
| **W5** | `updateRoleForUserByUserIdAndAppId` is a bare `UPDATE` — returns 200 with 0 rows affected when the assignment does not exist | Same read-then-write. Never trust the 200 alone; verify with a follow-up `GET` in the reconcile job |
| **W6** | `PATCH /organisations/:id` is a **toggle**, not a setter. No rename endpoint exists | Org `name` changes stay local. `formbuilder.Organization.name` is the display name; UMS holds the name captured at creation. Record the divergence in the reconcile report |
| **W7** | `orgConfigDao` refuses to delete an org while `user_app_roles` rows exist for it | Deletion unwinds in strict order (§6.4), driven by the outbox, not inline |
| **W8** | `getAllRolesForApplication` filters `isActive = 1`. Deactivating a role silently yields **zero** permissions for everyone holding it | Never call `PATCH /role/:id` for a role that has holders — block it in `role.service.ts`. If a definition disappears anyway, return `503`, never `403` (§7.3) |
| **W9** | `POST /api/user/` Joi: `username` 3–25, `firstName` 3–25 (empty allowed), `lastName` 3–25 (empty allowed), `phone` ≤10, strict email regex | `SignUpSchema` in [backend/src/schemas](backend/src/schemas) must be tightened to **exactly** these bounds, or UMS returns 400 after the user has filled the form. Validate on our side first so the error is ours and readable |
| **W10** | UMS is `cors({ origin: '*' })` with no rate limit on `/user/login` | The browser must never call UMS directly. All auth goes through our backend proxy, which owns CORS and rate limiting (§4) |
| **W11** | UMS `authMiddleware` derives the JWKS URI from the **untrusted token's** `iss` | Not our bug to fix, but our backend has the identical flaw — fix ours (§4.1) and reduce exposure by never exposing UMS to the browser (W10) |

---

## 4. Phase 1 — Authentication (login / signup / refresh) through UMS

### 4.1 P0 — Pin the issuer (do this first)

[backend/src/middleware/auth.middleware.ts](backend/src/middleware/auth.middleware.ts)
currently builds the JWKS URI from `jwt.decode(token).iss` — the issuer named inside the
**unverified** token. An attacker stands up any OIDC issuer, signs a token with
`sub = <victim id>`, and our backend downloads the attacker's key and authenticates them as
the victim. It is also an SSRF primitive.

```ts
// backend/src/middleware/auth.middleware.ts — replacement
const ISSUER   = process.env.KEYCLOAK_ISSUER!;               // http://1.6.37.35/keycloak/realms/Form-Builder
const JWKS_URI = process.env.KEYCLOAK_JWKS_URI               // built from config, never from the token
              ?? `${ISSUER}/protocol/openid-connect/certs`;

jwt.verify(token, getKey, {
  algorithms: ['RS256'],        // never read `alg` from the header
  issuer: ISSUER,
  clockTolerance: 5,
}, cb);

// then, on the verified payload:
if (payload.azp !== process.env.KEYCLOAK_CLIENT_ID) throw createError(401, 'Invalid token');
```

Use `azp`, not `aud` — Keycloak access tokens carry `aud: "account"` by default. Decode one
live token first and confirm before committing the check.

Also drop the `req.cookies?.token` fallback on the **access** token. With §4.4 only the
refresh token lives in a cookie; accepting an access token from a cookie reintroduces CSRF
on every state-changing route.

### 4.2 P0 — JIT provisioning

Today a user who exists in Keycloak/UMS but not in `formbuilder.User` gets
`401 User not found` **forever**, with no recovery path — and cannot re-register because
UMS reports `Email already registered`. Any user created by another Sify app, or by the
current unguarded dual-write signup, lands here permanently.

Replace the 401 with a create from **verified** token claims:

```ts
user = await prisma.user.upsert({
  where:  { id: payload.sub },
  update: {},                                   // never overwrite local edits
  create: {
    id:        payload.sub,
    email:     payload.email,
    firstName: payload.given_name  ?? null,
    lastName:  payload.family_name ?? null,
    username:  payload.preferred_username ?? null,
  },
  select: { id: true, email: true, firstName: true, lastName: true, username: true },
});
```

Guard on a present `email` claim (and `email_verified === true` if the realm sets it). Safe,
because the signature has already been checked against the pinned issuer.

### 4.3 Backend auth proxy — one owner for the whole flow

New endpoints on [backend/src/routes/auth.routes.ts](backend/src/routes/auth.routes.ts),
each a thin forward to UMS with `x-app-id: Form-Builder`:

| Sify Forms | forwards to UMS | notes |
| --- | --- | --- |
| `POST /api/auth/register` | `POST /api/user/` | then local `User` insert; compensating delete on failure |
| `POST /api/auth/login` | `POST /api/user/login` | sets refresh cookie, returns access token in body |
| `POST /api/auth/refresh` | `POST /api/user/refresh-token` | reads + rotates the cookie |
| `POST /api/auth/logout` | `POST /api/user/logout` | clears the cookie |
| `POST /api/auth/forgot-password` | `POST /api/user/forgot-password` | |
| `POST /api/auth/confirm-forgot-password` | `POST /api/user/confirm-forgot-password` | |
| `PUT /api/auth/profile` | `PUT /api/user/` (`idtoken` header) | then local `User` update |
| `GET /api/auth/session` | — | unchanged, local |

Signup becomes a **saga owned by the backend**, replacing today's unguarded dual write in
[src/store/authSlice.ts](src/store/authSlice.ts#L22):

```
1. Validate against W9 bounds (our error, our message)
2. POST {UMS}/api/user   → Keycloak user + users row + app_users row; returns the sub
3. INSERT formbuilder.User { id: <sub>, … }
4. If step 3 fails → compensate: delete the Keycloak user, log it, return 500
5. Return 201 with no tokens; the client then logs in normally
```

Rate-limit `/login`, `/register`, `/forgot-password`, `/refresh` at 5 attempts / 15 min
keyed on **IP and email**. This is the compensating control for W10, and it is only
possible because the browser no longer reaches UMS.

### 4.4 Refresh token in an httpOnly cookie

`Set-Cookie: fb_rt=<token>; HttpOnly; Secure; SameSite=Lax; Domain=.sifymodernization.digital; Path=/api/auth`

Frontend (`dev.sifymodernization.digital`) and backend (`apidev.sifymodernization.digital`)
share a registrable domain, so `SameSite=Lax` is sufficient — no `SameSite=None`. The access
token stays in a module variable, never `localStorage`; this app renders user-authored form
schemas, so an XSS today exfiltrates a long-lived refresh token.

---

## 5. Phase 2 — Service identity for backend → UMS calls

Replace `RBAC_SERVICE_TOKEN` (a pasted Keycloak access token that expires in minutes — which
is why `users.roles` still has 0 rows) with a token provider in a new
`backend/src/service/ums.client.ts`:

```ts
// Direct password grant against Keycloak for the M2 service user.
// UMS has no client-credentials path (W3), so this must be a real user.
POST {KEYCLOAK_ISSUER}/protocol/openid-connect/token
  grant_type=password
  client_id={KEYCLOAK_CLIENT_ID}
  username={UMS_SERVICE_USER_EMAIL}
  password={UMS_SERVICE_USER_PASSWORD}
```

Cache until `exp − 30 s`; single-flight so concurrent callers share one refresh.

**Use the service token for every backend → UMS call.** Do not forward the caller's token
(today's `getCallerToken()` behaviour). Two reasons: a saga must not fail halfway because the
user's token expired mid-flight, and forwarding a user token to a service that performs no
authorization of its own is a confused-deputy waiting to happen.

---

## 6. Phase 3 — Organizations

### 6.1 The single identifier rule

```
formbuilder.Organization.id  ==  users.org_config.orgId  ==  Keycloak org alias  ==  x-org-id
      (cuid, immutable)              (VARCHAR 255)                                (already sent
                                                                                   by the SPA)
```

Never use `Organization.slug` — it is user-editable and would break the link on rename. The
frontend already puts `Organization.id` in `x-org-id`
([src/lib/api.ts](src/lib/api.ts#L41-L43)). **No mapping table is ever needed.**

### 6.2 Provisioning saga

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant FB as Forms backend
    participant DB as formbuilder
    participant UM as UMS
    participant KC as Keycloak

    FE->>FB: POST /api/orgs {name, slug, industry}
    FB->>DB: INSERT Organization (provisioningStatus=PROVISIONING) → id (cuid)
    FB->>UM: POST /api/organisations {orgId:<cuid>, appId, name}   [x-app-id]
    UM->>KC: POST /admin/realms/Form-Builder/organizations {name, alias:<cuid>}
    UM-->>FB: 201
    FB->>UM: POST /api/role ×5   [x-app-id, x-org-id]  → 5 role ids
    FB->>DB: INSERT OrgUser (userId, role=OWNER, roleId=<per-org OWNER id>)
    FB->>UM: POST /api/organisations/<cuid>/members {userId}
    FB->>UM: POST /api/user-app-roles {userId, roleId, appId}      [x-org-id]
    FB->>DB: INSERT Team "General"; provisioningStatus = ACTIVE
    FB-->>FE: 201 {org}
```

### 6.3 Making it survive failure at every arrow

There is no distributed transaction available, so every step must be individually safe.

- **Local first, remote second.** The cuid must exist before UMS can be told about it.
  New column `Organization.provisioningStatus` (`PROVISIONING | ACTIVE | FAILED | DELETING`);
  `orgMiddleware` rejects anything but `ACTIVE` with `409 org is still being provisioned`.
  A half-built org is never usable.
- **Compensate on the first failure.** If `POST /organisations` fails, delete the local
  `Organization` row and surface the UMS error verbatim. The user retries the same slug and
  nothing is stranded.
- **Idempotency everywhere.** Treat "already exists" as success on org create, role create
  and member add (W4). Every step must be safe to re-run.
- **Steps 4–7 go through the outbox** (§8), written in the same Prisma transaction as the
  local rows. A `FAILED` org is finished by the worker or by `npm run org:reconcile`, not by
  the user.

### 6.4 Deletion unwind (W7)

Mark `provisioningStatus = DELETING` immediately so the org vanishes from the UI, then, in
the background worker, in this exact order:

```
local cascade (forms, teams, invites, members)
  → DELETE /user-app-roles/:userId/:appId   per member   [x-org-id]
  → DELETE /organisations/:orgId/members/:userId per member
  → PATCH  /role/:id  ×5   (deactivate — after holders are gone, so W8 cannot bite)
  → DELETE /organisations/:orgId
```

### 6.5 Field mapping

| `formbuilder.Organization` | `users.org_config` | Note |
| --- | --- | --- |
| `id` (cuid) | `orgId` | join key; also the Keycloak org `alias` |
| `name` | `name` | captured at create only — UMS has no setter (W6) |
| `slug`, `logo`, `industry` | — | Sify Forms only; never sent. Renaming an org never touches UMS |
| — | `appId` | always `Form-Builder` |
| — | `isActive` | UMS-owned; mirror into `orgMiddleware` on the slow path |

---

## 7. Phase 4 — Role definitions consumed from UMS

### 7.1 Per-org materialisation

Because of W2, each org receives its own copy of the five definitions (`OWNER`, `ADMIN`,
`CREATOR`, `ANALYST`, `VIEWER`) from
[backend/src/config/rbac.config.ts](backend/src/config/rbac.config.ts), created with
`x-org-id` set. `uk_role_name_appId_orgId` makes this unique per org and idempotent.

This is the correct model, not a workaround: Sify Forms already ships
`POST /orgs/:orgId/roles` behind `MANAGE_ROLES`, so orgs are *expected* to diverge. The five
seeded roles are a template, not a global constant. Cost is bounded — 5 rows per org, once,
read through a 60-second cache. At 1,000 orgs that is 5,000 rows.

**Features** (`POST /api/feature`) are also org-scoped under `usesOrgs = 1`. UMS does *not*
validate `permission.privilege[].feature` against the `features` table when creating a role,
so seeding features is **optional** and only feeds the UMS admin dashboard. Seed them per
org on a best-effort, non-blocking path.

### 7.2 `rbac.client.ts` changes

[backend/src/service/rbac.client.ts](backend/src/service/rbac.client.ts):

- Send `x-org-id` on `/role/*`, `/user-app-roles/*`, `/feature/*` — thread `orgId` through
  `listRoles`, `resolveRoleId`, `createRole`, `updateRole`.
- **Key the role cache on `` `${appId}|${orgId}` ``.** Today there is a single global cache
  slot, so with two orgs one org's role definitions would be served to the other. That is a
  cross-tenant authorization defect the moment a second org exists.
- Swap `getCallerToken()` for the service token (§5).

### 7.3 Surviving a UMS outage — non-negotiable

Today `fail()` throws on any non-200 and **the entire application stops authorizing
requests**. Role definitions change perhaps monthly; taking Sify Forms down for them is
indefensible. Three layers in `listRoles()`:

1. **Stale-while-revalidate** — on fetch failure, serve the cached copy regardless of age,
   log at `warn`, retry with backoff.
2. **Persisted last-known-good** — write every successful fetch to a `RoleDefinitionCache`
   row. On cold start with UMS down, load from there. Without this, a restart during an
   outage is a full outage.
3. **Circuit breaker** — after 5 consecutive failures, stop calling for 30 s. Prevents a slow
   UMS from exhausting the event loop through 5-second timeouts on every request.

Escalate to **`503`, never `403`**, when all three miss. A `403` here trains users to believe
their permissions were revoked.

### 7.4 `permission.service.ts` changes

[backend/src/service/permission.service.ts](backend/src/service/permission.service.ts) needs
only three things:

- pass `orgId` into `listRoles(orgId)`;
- distinguish "role definition genuinely unavailable" (→ `503`, do **not** cache) from "user
  has no membership" (→ empty actions, cacheable);
- keep the existing 30 s `(user, org)` cache and the existing `invalidatePermissions()` calls
  on every membership change — that part is already correct.

### 7.5 Hot-path cost

Token verification is local (JWKS cached 1 h). Role definitions are cached 60 s per
`(appId, orgId)`. Assignment lookup is a local indexed Prisma read.
**Steady state: zero UMS calls per request.** Only the first request per org per minute pays
a single call.

---

## 8. Phase 5 — Role assignments

### 8.1 Where the truth lives, and why

`OrgUser` stays the **local read model and the transactional anchor** — it is joined to
invite acceptance, team defaults and org-deletion cascades. Moving it across a network
boundary turns the hottest write path in the product into a distributed transaction, and
leaves Sify Forms unable to authorize *anything* when UMS blinks.

UMS `user_app_roles` is written on **every** assignment change, so cross-app admin screens
and the UMS dashboard are correct. That satisfies "assignments live in UMS" without making
Sify Forms unavailable when UMS is.

| Local event | UMS calls (all with `x-app-id` + `x-org-id`) |
| --- | --- |
| member added | `POST /organisations/:orgId/members` → then read-then-write `user-app-roles` (W4) |
| role changed | `GET /user-app-roles/:userId/:appId` → `PUT` if present, `POST` if not (W5) |
| member removed | `DELETE /user-app-roles/:userId/:appId` → `DELETE /organisations/:orgId/members/:userId` |

### 8.2 Transactional outbox

- **Never fail the user's request because a mirror failed.** Log, enqueue, return 200.
- A `UmsOutbox` row is written **in the same Prisma transaction** as the membership change —
  the transactional-outbox pattern. No new infrastructure, no `setTimeout`.
- A worker drains it with exponential backoff, marks `DEAD` after N attempts, and emits a
  metric.
- **`npm run rbac:reconcile`** runs nightly: diffs `OrgUser` against
  `GET /user-app-roles/users/:appId` per org and repairs drift. A non-zero and rising diff
  count means the outbox is broken — alert on the trend, not the value.

### 8.3 Optional verification mode

Behind `UMS_ASSIGNMENT_READ_THROUGH=true`, `getEffectivePermissions` additionally calls
`GET /user-app-roles/:userId/:appId` and logs any disagreement with `OrgUser`. Run it in
staging to prove the mirror is exact; leave it off in production for latency.

---

## 9. Phase 6 — Frontend

| Change | File | Why |
| --- | --- | --- |
| Delete `keycloakApi` entirely; all auth through `api` | [src/lib/api.ts](src/lib/api.ts) | one origin, one interceptor; `x-app-id` and the UMS host stop leaking to the browser (W10) |
| Access token in a module variable, not `localStorage` | [src/lib/api.ts](src/lib/api.ts), [src/store/authSlice.ts](src/store/authSlice.ts) | XSS on a form-schema renderer must not yield a refresh token |
| Refresh via `POST /api/auth/refresh` with `withCredentials: true` | [src/lib/api.ts](src/lib/api.ts#L106) | refresh token unreachable from JS |
| Signup calls only `POST /api/auth/register` | [src/store/authSlice.ts](src/store/authSlice.ts#L22) | removes the dual write that creates permanently broken accounts |
| Profile update calls only `PUT /api/auth/profile` | [src/store/authSlice.ts](src/store/authSlice.ts#L112) | removes the second dual write |
| Signup form validation matched to UMS Joi bounds | signup form + `SignUpSchema` | W9 — otherwise the user hits a raw UMS 400 |
| Keep the `x-org-id` interceptor and `rotateOrganizationRequestScope()` unchanged | [src/lib/api.ts](src/lib/api.ts#L27-L43) | already correct; the abort-on-switch guard prevents cross-org data bleed |
| Handle `409 provisioning` in the org switcher and after create | [src/components/layout/OrgSwitcher.tsx](src/components/layout/OrgSwitcher.tsx) | §6.3 |

Bootstrap: on load with no access token in memory, call `POST /api/auth/refresh` once.
Success → session resumes silently; failure → redirect to login. This replaces the current
"read `localStorage` and hope".

---

## 10. `formbuilder` schema changes

[backend/prisma/schema.prisma](backend/prisma/schema.prisma):

```prisma
model Organization {
  // …existing fields…
  provisioningStatus String    @default("PROVISIONING")   // PROVISIONING | ACTIVE | FAILED | DELETING
  umsSyncedAt        DateTime?
}

model OrgUser {
  // change: "ORG_MEMBER" is not a role that exists in rbac.config.ts, so
  // findDefinition() logs a warning and grants zero actions.
  role String @default("VIEWER")
}

model OrgInvite {
  role String @default("CREATOR")   // == DEFAULT_ORG_MEMBER_ROLE
}

/// Last-known-good role definitions per (appId, orgId) — survives a UMS outage
/// across a process restart (§7.3).
model RoleDefinitionCache {
  id        String   @id @default(cuid())
  appId     String
  orgId     String
  payload   String   @db.LongText
  fetchedAt DateTime @default(now())

  @@unique([appId, orgId])
}

/// Transactional outbox for UMS mirroring (§8.2).
model UmsOutbox {
  id            String   @id @default(cuid())
  kind          String   // ORG_CREATE | ROLE_SEED | FEATURE_SEED | MEMBER_ADD |
                         // ROLE_ASSIGN | ROLE_UNASSIGN | MEMBER_REMOVE | ORG_DELETE
  orgId         String
  payload       String   @db.LongText
  status        String   @default("PENDING")  // PENDING | DONE | DEAD
  attempts      Int      @default(0)
  nextAttemptAt DateTime @default(now())
  lastError     String?  @db.Text
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([status, nextAttemptAt])
  @@index([orgId])
}
```

Because both databases are empty today, these are additive migrations with **no backfill**.

---

## 11. Environment

```diff
 # --- UMS ---
+UMS_BASE_URL=https://apidev.sifymodernization.digital/user-mgt
+UMS_APP_ID=Form-Builder
+UMS_TIMEOUT_MS=5000
+UMS_SERVICE_USER_EMAIL=svc-form-builder@sify.internal
+UMS_SERVICE_USER_PASSWORD=<secrets manager>

 # --- Keycloak (NOT the UMS gateway — see §1.2) ---
+KEYCLOAK_ISSUER=http://1.6.37.35/keycloak/realms/Form-Builder
+KEYCLOAK_JWKS_URI=http://1.6.37.35/keycloak/realms/Form-Builder/protocol/openid-connect/certs
+KEYCLOAK_CLIENT_ID=Form-Builder
-KEYCLOAK_BASE_URL=https://apidev.sifymodernization.digital   # misleading; remove or rename

 # --- RBAC ---
 RBAC_APP_ID=Form-Builder
-RBAC_SERVICE_URL=…            # root .env and backend/.env disagree — collapse into UMS_BASE_URL
-RBAC_SERVICE_TOKEN=
 RBAC_CACHE_TTL_MS=30000
+RBAC_ROLE_CACHE_TTL_MS=60000
+RBAC_BREAKER_THRESHOLD=5

 # --- flags ---
+UMS_ORG_SYNC_ENABLED=false
+UMS_ROLE_MIRROR_ENABLED=false
+UMS_ASSIGNMENT_READ_THROUGH=false

-JWT_SECRET="your-super-secret-jwt-key-change-in-production"   # dead: we sign nothing
```

`RBAC_APP_ID=Form-Builder` already matches `app_auth_config.appId` **exactly**, hyphen
included. Do not "correct" it to `FormBuilder` — `roles.appId` has a foreign key to it.

Also rotate before go-live: the DB password, `DMS_API_KEY`, `AI_API_KEY` and `JWT_SECRET`
are all committed in [.env](.env). Treat every one as compromised; add `.env` to
`.gitignore` and scrub history.

---

## 12. Ordered work list

| Phase | Deliverable | Blocked by |
| --- | --- | --- |
| **0** | M1–M5 manual prerequisites; env split; confirm the live token's `azp`/`email` claims | — |
| **1** | Issuer pinning + JIT provisioning + drop cookie access-token fallback | 0 |
| **2** | `ums.client.ts` with the service-token provider; prove `GET /role/Form-Builder` + `x-org-id` returns 200 | 0, 1 |
| **3** | Auth proxy (`/login`, `/refresh`, `/logout`, `/forgot-password`), signup saga, rate limiting, refresh cookie | 2 |
| **4** | Prisma migration (§10); org provisioning saga + `provisioningStatus` gate + compensation | 2 |
| **5** | Per-org role materialisation; `rbac.client` per-org cache key + SWR + persisted cache + breaker; `permission.service` 503 path; block deactivating held roles | 4 |
| **6** | Outbox table + worker; assignment mirroring; `org:reconcile` and `rbac:reconcile` scripts | 4, 5 |
| **7** | Frontend: drop `keycloakApi`, in-memory token, cookie refresh, W9 validation, 409 handling | 3 |

### Appendix — file-by-file

| File | Phase | Change |
| --- | --- | --- |
| [backend/src/middleware/auth.middleware.ts](backend/src/middleware/auth.middleware.ts) | 1 | Pin issuer/algorithms, assert `azp`, JIT provision, drop cookie access token |
| [backend/src/service/ums.client.ts](backend/src/service/ums.client.ts) | 2 | **New** — service-token provider + user/org/member/assignment endpoints |
| [backend/src/routes/auth.routes.ts](backend/src/routes/auth.routes.ts) | 3 | Add `/login`, `/refresh`, `/forgot-password`, `/confirm-forgot-password` |
| [backend/src/service/auth.service.ts](backend/src/service/auth.service.ts) | 3 | Signup saga with compensation; profile forwarding |
| [backend/src/schemas](backend/src/schemas) | 3 | `SignUpSchema` bounds matched to UMS Joi (W9) |
| [backend/prisma/schema.prisma](backend/prisma/schema.prisma) | 4 | `provisioningStatus`, `RoleDefinitionCache`, `UmsOutbox`, role defaults |
| [backend/src/service/org.service.ts](backend/src/service/org.service.ts) | 4 | Provisioning saga, compensation, deletion unwind |
| [backend/src/middleware/auth.middleware.ts](backend/src/middleware/auth.middleware.ts) | 4 | `orgMiddleware` rejects non-`ACTIVE` orgs with 409 |
| [backend/src/service/rbac.client.ts](backend/src/service/rbac.client.ts) | 5 | `x-org-id`, per-org cache key, SWR, persisted cache, circuit breaker, service token |
| [backend/src/service/permission.service.ts](backend/src/service/permission.service.ts) | 5 | Thread `orgId`; 503 vs empty-actions |
| [backend/src/service/role.service.ts](backend/src/service/role.service.ts) | 5 | Block deactivating a role that has holders (W8) |
| [backend/src/service/ums.outbox.ts](backend/src/service/ums.outbox.ts) | 6 | **New** — worker + enqueue helpers |
| [backend/src/scripts/seedRbac.ts](backend/src/scripts/seedRbac.ts) | 5 | `--org <orgId>` flag, `x-org-id`, service token |
| [src/lib/api.ts](src/lib/api.ts) | 7 | Remove `keycloakApi`; in-memory token; cookie refresh |
| [src/store/authSlice.ts](src/store/authSlice.ts) | 7 | Single-call login / signup / profile |

---

## 13. Test plan

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Token signed by a foreign issuer | `401`, and **no outbound JWKS fetch** to the foreign host |
| 2 | Token with `alg: none` or HS256 | `401` |
| 3 | Token with a valid signature but wrong `azp` | `401` |
| 4 | Expired access token | `401`, then transparent refresh from the cookie |
| 5 | Kill the backend between the UMS user create and the local insert | Keycloak user removed by compensation; retry with the same email succeeds |
| 6 | Log in as a user present in Keycloak but absent from `formbuilder.User` | JIT-provisioned; request succeeds |
| 7 | Signup with a 2-character first name | Our validation error, not a raw UMS 400 (W9) |
| 8 | Org create with UMS stopped | `Organization` row rolled back; clear error; no orphan |
| 9 | Org create where `POST /role` fails on role 3 of 5 | Org `FAILED`; outbox/`org:reconcile` completes it; org unusable until `ACTIVE` |
| 10 | Org create when the Keycloak `organizations` feature is off | Fails fast with a readable error naming M1 |
| 11 | Re-run the provisioning saga for an existing org | Idempotent — no duplicate-key 500 (W4) |
| 12 | Two orgs; user is OWNER in A and VIEWER in B | Permissions differ per `x-org-id`; **no role-cache bleed** (§7.2) |
| 13 | Stop UMS after a successful role fetch | Requests keep working from stale cache; `warn` logged |
| 14 | Stop UMS **and** restart the backend | Requests keep working from `RoleDefinitionCache` |
| 15 | UMS returns 500 continuously | `503` once the breaker opens — never `403` |
| 16 | Change a member's role | Local effective permissions change immediately; `user_app_roles` correct within 60 s |
| 17 | Mirror call fails | User request still `200`; `UmsOutbox` row present; reconcile repairs it |
| 18 | Deactivate a role that has holders | Blocked with a clear error (W8) |
| 19 | `x-org-id` for an org the user does not belong to | `403` from `orgMiddleware`, **no UMS call made** |
| 20 | Rapid org switching | In-flight requests aborted; no previous-org data renders |
| 21 | Delete an org with 3 members | Unwind completes; `org_config` row gone; no FK errors (W7) |
| 22 | Public form submission `POST /api/submissions` | Unaffected — still anonymous and rate-limited |
| 23 | 200 rps steady state | Zero UMS calls per request; p99 auth overhead < 5 ms |

Tests 1, 3, 12, 13, 14, 15 are the ones that would otherwise be discovered in production.

---

## 14. Rollout

1. **Staging, UMS binary untouched.** Phases 0–7 end to end. This proves the entire design
   needs no UMS code change.
2. **Production, feature-flagged.** `UMS_ORG_SYNC_ENABLED` and `UMS_ROLE_MIRROR_ENABLED`.
   Off → current local-only behaviour **plus** the security fixes, which are never flagged
   off. On → full integration.
3. **Rollback.** Because `OrgUser` and all org content stay local and authoritative,
   disabling both flags returns Sify Forms to a fully working state with no data loss. Rows
   already written to UMS are inert. This is precisely why the ownership split in §0 is drawn
   where it is.

---

## 15. Things to raise with the UMS team later (not blockers)

These are all worked around above; fixing them upstream would let us delete code.

1. `getAllRolesForApplication` filtering `AND orgId = ?` instead of
   `AND (orgId = ? OR orgId IS NULL)` — fixing it removes the per-org role cloning in §7.1.
2. No service-account path in `authMiddleware` — forces the M2 service user.
3. `attachRoleToUser` / `updateRoleForUserByUserIdAndAppId` are not upserts — forces
   read-then-write.
4. No `PUT /organisations/:id` to rename an org.
5. `POST /app-auth-config` is unauthenticated — currently mitigated only at the network layer.
6. JWKS URI derived from the untrusted token's `iss` in UMS `authMiddleware` (same class of
   bug we are fixing on our side in §4.1).
7. No webhook or event stream for "user deactivated" / "org deactivated" — we can only
   discover deactivation on the next cache refresh, up to 60 s late.
