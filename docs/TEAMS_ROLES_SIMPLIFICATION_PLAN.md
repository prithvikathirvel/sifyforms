# Teams & Roles — Simplification Plan

_Proposal. Not implemented. Prepared 2026-08-31 against the current codebase._

## 1. The goal (in your words)

1. An organization can create **multiple teams**, but teams have **no hierarchy** (no sub-teams, no parent/child, no nesting).
2. A **role is assigned to the user alone** — one role per user per organization.
3. **No team-role attachment** — a team membership carries no role.

---

## 2. Current model vs. new model

### Current (as built today)

| Concept | Today |
|---|---|
| Team | Hierarchical. `Team.parentId`, `Team.path` (materialized `/root/child/own`), `Team.depth`. Nesting up to 5 levels. A default "General" team. |
| Team membership | `TeamMember` carries `roleId` + `role` ("one role per person per team"). |
| Org membership | `OrgUser` carries `roleId` + `role` (the org-level role). |
| Roles | Scoped: `ORG`, `TEAM`, or both (stored in the RBAC service `template` field). `TEAM_LEAD` is team-only. |
| Effective permission | Union of the **org role** + **team roles on the team and every ancestor** (roles inherit downward). |
| Form access | org role + owning-team/ancestor roles + explicit shares + response-policy ceiling. |

### New (proposed)

| Concept | New |
|---|---|
| Team | **Flat**. Just `id`, `orgId`, `name`, `slug`, `description`, `isDefault`, `createdBy`. No parent/path/depth. |
| Team membership | `TeamMember` becomes a **pure join** (`teamId`, `userId`). No role columns. |
| Org membership | `OrgUser.roleId` + `role` remain — **the single source of a user's role**. |
| Roles | **ORG scope only.** The `TEAM` scope and `TEAM_LEAD` disappear. |
| Effective permission | **The org role alone.** No team contribution. |
| Form access | org role + explicit shares + response-policy ceiling. |

Teams become **organizational buckets**: they group forms and are used to target sharing ("share this form with Team A"), but they no longer carry any permission of their own.

---

## 3. What stays the same (not touched)

- Organization membership, invites, and the org-role assignment + last-admin guard.
- **Form sharing** — still supports `USER` and `TEAM` principals.
- Form's `teamId` — a form still belongs to a team (used for grouping and for team-targeted shares).
- **Response policy ceilings** (STANDARD / ANONYMOUS / BLIND_REVIEW / RESTRICTED).
- The RBAC service owning role *definitions* (only its scope tags change).

---

## 4. What changes, layer by layer

### 4.1 Database (`backend/prisma/schema.prisma`)

- `Team`: **drop** `parentId`, `path`, `depth`; **drop** `@@index([parentId])`, `@@index([orgId, path])`; **drop** the `TeamTree` self-relation. Keep `@@unique([orgId, slug])` and `@@index([orgId])`.
- `TeamMember`: **drop** `roleId`, `role`. Keep `@@unique([teamId, userId])` (one membership per person per team) and `@@index([userId])`.
- `User.teamMemberships` and `Team.members` relations stay.

Requires one Prisma migration (the repo already uses `prisma migrate` — see `backend/prisma/migrations/`).

> Note: there are also Firestore and MongoDB DAOs behind the same `TeamDao` interface. If any deployment uses `DB_TYPE=firestore` or `mongodb`, the same structural change must be mirrored in those DAOs.

### 4.2 Backend

| File | Change |
|---|---|
| `config/rbac.config.ts` | Remove `MAX_TEAM_DEPTH`, `TEAM_SCOPE_ROLES`, `DEFAULT_TEAM_ROLE`, `DEFAULT_TEAM_MEMBER_ROLE`; change `SYSTEM_ROLE_SCOPES` so `TEAM_LEAD` is gone and all roles are `['ORG']`; remove `ACTIONS.ASSIGN_TEAM_ROLE` (and its `FEATURE_ACTIONS.TEAM` entry); `ORG_ONLY_ACTIONS` becomes obsolete (all actions are org-scoped). |
| `dao/interfaces/TeamDao.ts` | Remove `parentId`/`path`/`depth` from `TeamRecord`; remove `findSubtree`, `findChildren`, `setTeamPath`; `findTeamsByOrg` returns a flat list; `UpsertTeamMemberData` loses `roleId`/`role`. |
| `dao/mysql/team.dao.ts` (+ firestore, mongodb) | Implement the flat queries; drop subtree/children/path queries. |
| `service/team.service.ts` | `createTeam` drops parent/depth/path logic and the auto "creator becomes TEAM_LEAD" block; `listTeams` returns a flat list (no tree build); `deleteTeam` drops cascade/subtree logic (just re-home forms to General and delete); `addMember` drops role; `updateMemberRole` removed. |
| `service/permission.service.ts` | Delete `ancestryFromPath`; `getEffectivePermissions` collects **only** `orgMember` role. `teamRole` field goes away (or becomes null). |
| `service/formAccess.service.ts` | `reachableTeamIds` = direct memberships only (no descendant expansion). Everything else unchanged. |
| `service/role.service.ts` | Drop `TEAM` scope from validation/assignability (`assertRoleAssignable` keeps only `'ORG'`); `assignmentCounts` stops reading `teamMember.role`. |
| `schemas/team.schema.ts` | `CreateTeamSchema` drops `parentId`; `AddTeamMemberSchema`/`UpdateTeamMemberSchema` drop `role`. |
| `routes/org.routes.ts` | `POST /teams` no longer passes `teamIdFrom: 'body', parentId`; remove `PUT /teams/:teamId/members/:userId` (role update); `POST /teams/:teamId/members` body drops role. |
| `controllers/express/team.controller.ts` | Remove `updateMemberRole`; `addMember` stops accepting role. |
| `scripts/seedRbac.ts` | Stop seeding `TEAM_LEAD`; scope everything ORG. |

### 4.3 Frontend

| File | Change |
|---|---|
| `store/teamsSlice.ts` | `createTeam` drops `parentId`; remove `updateTeamMemberRole`; `addTeamMember` drops `role`; `fetchTeams` returns a flat list (`Team[]` not `TeamNode[]`). |
| `types/index.ts` | `Team` drops `parentId/path/depth`; remove `TeamNode` (or keep a flat alias); `TeamMember` drops `role`; `EffectivePermissions` drops `teamRole`. |
| `pages/TeamsPage.tsx` | Replace the tree render with a flat list; remove "create under parent", cascade-delete prompt, "inherits parent roles" copy, and the member role dropdown. |
| `components/forms/TeamTreeSelect.tsx` | Replace hierarchy rows with a flat select (drop path/`/` breadcrumbs and expand/collapse). |
| `pages/RolesPage.tsx` | Remove the ORG/TEAM scope selector (roles are ORG-only). |
| `hooks/usePermissions.ts` | `useRoleOptions` loses the `'TEAM'` scope; drop `TEAM_LEAD` builtin label. |

---

## 5. What breaks

### 5.1 Data (one-time, needs migration)

- Every existing `Team.parentId`, `Team.path`, `Team.depth` value becomes meaningless and is dropped. Any hierarchy the customer built flattens into one list.
- Every existing `TeamMember.roleId` / `TeamMember.role` value is **discarded**. Users who held `TEAM_LEAD` (or a custom team role) silently become plain members of that team.

### 5.2 End-user behavior (real access changes — needs sign-off)

- **Team leads lose their management powers.** Today a `TEAM_LEAD` can manage a team and its sub-teams. After the change, team management is an org-level ability, so those users keep only what their **org role** grants. If their org role is `CREATOR`/`VIEWER`, they lose it.
- **No more per-team permission narrowing.** Today an org can give someone `VIEWER` org-wide but `CREATOR` (or `TEAM_LEAD`) on one team so they can build there. That expression disappears — a user's permissions are now identical across the whole org.
- **Form access via owning team changes.** Today, roles on a form's owning team (and its ancestors) grant access to that form. After, the owning team grants nothing by itself; a user's form access = **org role** + **shares** + **policy ceiling**.
  - Implication: an org role that includes `EDIT_FORM` will now edit forms in **every** team, not just "their" team. If you need finer control per form, that must now come from **shares**.

### 5.3 API / contract

- `POST /orgs/:orgId/teams` — `parentId` no longer accepted.
- `POST /orgs/:orgId/teams/:teamId/members` — `role` no longer accepted.
- `PUT /orgs/:orgId/teams/:teamId/members/:userId` — **removed** (was "change team role").
- `GET /orgs/:orgId/teams` — returns a flat array, not a tree.
- `GET /orgs/:orgId/teams/:teamId` — no `children`; members have no `role`.

Any external consumer of these endpoints breaks.

### 5.4 UI

- Teams tree view, "create sub-team", cascade delete, and member-role dropdowns all go away (replaced with a flat list).
- The "Team" role scope in the Roles editor disappears.

---

## 6. Migration sequence (safe, ordered)

1. **Additive migration first** (no data loss): create the new flat columns/shape while keeping old ones, or better — do the structural change in one migration but with a **data backfill script** that, for each org, maps existing team-role holders to a sensible org role *before* dropping columns. (Recommend: prompt the org owner/your team for the mapping policy, e.g. "TEAM_LEAD → CREATOR", "TEAM_MEMBER → VIEWER".)
2. Backend: change services/routes/schemas to the new shape (single PR).
3. Frontend: change slices/types/pages to match (single PR).
4. Update `seedRbac.ts` and re-seed roles (retire `TEAM_LEAD`).
5. Update `docs/TEAMS_AND_ROLES_GUIDE.md` to describe the new model.
6. Cut over only after the role-mapping policy is agreed, because step 1 decides who keeps what access.

---

## 7. Example (before → after)

**Scenario:** Acme Corp has teams *Engineering* and *Engineering → Payments* (a sub-team), and *Marketing*.

*People today:*
- Alice — org role `ADMIN`.
- Bob — org role `VIEWER`, but `TEAM_LEAD` on *Engineering*.
- Carol — org role `CREATOR`, member of *Payments* with role `ANALYST`.

*Form:* "Exit Interview" is owned by *Payments*.

### Before (current behavior)

- Bob can manage *Engineering* and every sub-team including *Payments* (role inherits downward).
- Carol can build forms org-wide (CREATOR) and read *Payments* responses (ANALYST on *Payments*).
- The Exit Interview form is accessible to Bob (ancestor TEAM_LEAD) and Carol (Payments ANALYST).

### After (new behavior)

- Teams are flat: *Engineering*, *Payments*, *Marketing* — no parent/child.
- Bob's `TEAM_LEAD` role is gone. His org role `VIEWER` is all he has → he can view but **not** manage teams or build forms, anywhere.
- Carol's org role `CREATOR` is all she has → she can build forms in **all** teams, and read responses only if `CREATOR` includes a response action (otherwise she needs a share).
- The Exit Interview form's access now = org role + shares + policy. Nobody gets access just from being on *Payments*.

**What you'd have to do to preserve the old intent:**
- If Bob must keep managing Engineering, give him an org role that includes team-management actions (e.g. `ADMIN`), **or** accept that team management is org-wide now.
- If Carol should read only *Payments* responses (not Marketing's), use a **form share** on the specific forms.

---

## 8. Decisions I need from you before implementing

1. **Team management permission**: teams are now managed only by org-level admins (via org role), correct? (No more `TEAM_LEAD`.)
2. **Form access**: confirm that a user's org role applies **across all teams**, and per-form fine-tuning is done via **shares** only. (This is the biggest behavior change.)
3. **Role re-mapping for existing team-role holders**: what should `TEAM_LEAD` and team-level `CREATOR/ANALYST/VIEWER` map to as an org role during migration? (e.g. TEAM_LEAD → CREATOR, others → VIEWER.)
4. **Team membership purpose**: keep `TeamMember` as a pure join (for grouping + team shares)? I recommend yes.
5. **Scope**: this touches the RBAC service's role `template` tags (ORG/TEAM) — confirm we retire TEAM-scoped roles there too.

Once you answer these, I'll implement in the order in §6, keeping the same "no data loss, no surprise access change without sign-off" discipline we've used so far.
