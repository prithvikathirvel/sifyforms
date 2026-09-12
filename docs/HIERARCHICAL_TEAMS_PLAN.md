# Hierarchical Teams — Minimal Practical Plan

> Goal: Move from flat `Team` list to nested teams with minimal code change, no complex permissions. Teams stay as grouping + share targets, not role containers.

---

## 1. Current State (Flat)

**Prisma today:**
```prisma
model Team {
  id        String @id
  orgId     String
  name      String
  slug      String @unique([orgId, slug])
  description String?
  isDefault Boolean @default(false)
  createdBy String
  org       Organization @relation(...)
  members   TeamMember[]
  forms     Form[]
}
```

- `GET /orgs/:orgId/teams` returns flat array.
- Frontend `TeamsPage.tsx` renders flat list.
- `TeamTreeSelect.tsx` name says tree but is flat search.
- `Form.teamId` = grouping only. Access = `OrgUser.role` + `FormShare`.

**What we keep:**
- No team-level roles (keep your simplification).
- Org role still sole permission source.
- Default team (`General`) still exists.

---

## 2. Minimal Hierarchical Model (What to add)

### 2.1 Schema change — only 2 new columns

```prisma
model Team {
  id          String  @id @default(cuid())
  orgId       String
  name        String
  slug        String
  description String?
  createdBy   String
  isDefault   Boolean @default(false)

  // --- NEW ---
  parentId    String? // self reference, null = root team
  parent      Team?   @relation("TeamHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children    Team[]  @relation("TeamHierarchy")
  depth       Int     @default(0) // denormalized for easy query + limit, 0=root, 1=child, etc
  // -----------

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  members     TeamMember[]
  forms       Form[]

  @@unique([orgId, slug]) // keep org-wide uniqueness — simpler than per-parent
  @@index([orgId, parentId])
  @@index([parentId])
}
```

**Why this is minimal:**
- Adjacency list (`parentId`) only — no closure table, no nested set.
- `depth` is cached to enforce max depth without recursion.
- `onDelete: SetNull` → deleting parent doesn't cascade delete children (we handle in service).

### 2.2 Rules (5 simple rules)

1. **Default team is always root:** `isDefault=true` ⇒ `parentId=null, depth=0`, cannot be moved, cannot have parent.
2. **Max depth = 3** (configurable): `Root(0) -> L1(1) -> L2(2) -> L3(3)`. Prevents insane trees. Enough for `Engineering > Frontend > DesignSystem`.
3. **No cycles:** `parentId` cannot be self or any descendant. Check by walking up ancestors.
4. **Same org only:** parent and child must have same `orgId`.
5. **Slug uniqueness stays org-wide:** easier than scoped uniqueness.

---

## 3. Visibility & Access — Pick ONE minimal model

You asked for `Team visibility`. There are 3 ways, from simplest to slightly smarter:

### Option A: Visual Hierarchy Only (EASIEST — Recommended for MVP)

- Teams are nested **only for UI grouping**.
- Membership does NOT inherit.
- Form listing: if form belongs to child team, you see it only if you can see that exact team.
- Sharing: `FormShare` to a team still means only direct members.

**Pros:** Zero permission logic change. 1-day implementation.
**Cons:** Parent managers must be added to each child manually.

```
Engineering (members: Alice)
 └─ Frontend (members: Bob)
    Form "Login Page" in Frontend
    → Alice does NOT see it unless also member of Frontend or org ADMIN
```

### Option B: Top-Down Implicit Membership (RECOMMENDED FINAL)

- Parent members implicitly have access to all descendants **for listing/visibility only**, not as explicit members.
- Implementation: when checking `findTeamsForUser` or `reachableTeamIds`, also include ancestors' memberships.
- Still no role inheritance — just visibility.

**Logic:**
```ts
function getEffectiveTeamIds(userId, orgId):
  direct = [teams where user is TeamMember]
  ancestors = for each direct team, walk up parent chain, collect all ancestors
  return direct + ancestors? No — opposite for visibility:
  
  // For form access via team share:
  // If form shared to parent team, child team members should NOT automatically get it (bottom-up no)
  // If user is in parent, they should see child forms (top-down yes)

  effectiveVisibleTeams = direct teams + all their descendants
```

**Example:**
```
Engineering (Alice)
 └─ Frontend (Bob)
    └─ UI Kit (Carol)

Alice sees: Engineering, Frontend, UI Kit (because she is at top)
Bob sees: Frontend, UI Kit (his team + its child)
Carol sees: UI Kit only
```

**Pros:** Intuitive for managers. Minimal code (one recursive query).
**Cons:** Need to update `formAccess.service.ts` `reachableTeamIds` + `teamDao.findTeamsForUser`.

**This is the sweet spot I recommend after Option A ships.**

### Option C: Full Inheritance (DO NOT DO in MVP)

Parent members = implicit members of children + permission inheritance + share inheritance both ways. Complex, bug prone.

**Verdict:** Start with **A**, add **B** in next PR. Document B as target.

---

## 4. Backend Changes (Minimal)

### 4.1 DAO changes

Add to `TeamDao.ts`:
```ts
findTeamWithAncestors(teamId): Promise<TeamRecord[]> // walk up parent chain
findTeamWithDescendants(teamId): Promise<TeamRecord[]> // BFS down
findTeamsTree(orgId): Promise<TeamTreeNode[]> // build tree in memory

interface TeamTreeNode extends TeamRecord {
  children: TeamTreeNode[]
  _count: { members: number, forms: number }
}
```

**MySQL implementation (simple, no recursive SQL):**
```ts
async findTeamsTree(orgId) {
  const flat = await prisma.team.findMany({ 
    where: { orgId },
    include: { _count: { select: { members: true, forms: true } } },
    orderBy: { name: 'asc' }
  });
  // build map id -> node
  const map = new Map(flat.map(t => [t.id, { ...t, children: [] }]));
  const roots: TeamTreeNode[] = [];
  for (const team of flat) {
    if (team.parentId && map.has(team.parentId)) {
      map.get(team.parentId)!.children.push(map.get(team.id)!);
    } else {
      roots.push(map.get(team.id)!);
    }
  }
  return roots;
}
```

### 4.2 Service validation

In `team.service.ts` `createTeam`:

```ts
export async function createTeam(orgId, creatorId, input: { name, slug?, description?, parentId? }) {
  // existing checks...
  
  let depth = 0;
  if (input.parentId) {
    const parent = await teamDao.findTeamById(input.parentId);
    if (!parent || parent.orgId !== orgId) throw 404;
    if (parent.depth >= MAX_DEPTH) throw 400 `Max depth ${MAX_DEPTH} reached`;
    // cycle check not needed on create (new id)
    depth = parent.depth + 1;
  }

  return teamDao.createTeam({
    orgId, name, slug, description,
    parentId: input.parentId || null,
    depth,
    createdBy: creatorId
  });
}
```

**Move team (new service):**
```ts
export async function moveTeam(orgId, teamId, newParentId: string | null) {
  const team = await loadTeamInOrg(orgId, teamId);
  if (team.isDefault) throw 400 "General cannot be moved";
  if (teamId === newParentId) throw 400 "Cannot be parent of itself";

  let newDepth = 0;
  if (newParentId) {
    const parent = await loadTeamInOrg(orgId, newParentId);
    // cycle check: walk up from parent, ensure we never hit teamId
    let cur = parent;
    while (cur) {
      if (cur.id === teamId) throw 400 "Cycle detected — cannot move team under its own descendant";
      cur = cur.parentId ? await teamDao.findTeamById(cur.parentId) : null;
    }
    if (parent.depth >= MAX_DEPTH) throw 400;
    // also check subtree depth won't exceed max
    const maxSubtreeDepth = await getMaxSubtreeDepth(teamId); // deepest child depth - team.depth
    if (parent.depth + 1 + maxSubtreeDepth > MAX_DEPTH) throw 400 "Move would exceed max depth";
    newDepth = parent.depth + 1;
  }

  // update this team + all descendants depth delta
  const delta = newDepth - team.depth;
  await teamDao.moveTeamSubtree(teamId, newParentId, delta);
}
```

**Delete team — updated:**
```ts
export async function deleteTeam(orgId, teamId) {
  const team = await loadTeamInOrg(orgId, teamId);
  if (team.isDefault) throw...

  const fallback = await teamDao.findDefaultTeam(orgId);
  const children = await teamDao.findDirectChildren(teamId);

  // Option 1 (minimal): re-parent children to team's parent (or root if team was root)
  // Option 2: move children to default/general — simpler but loses structure
  // Recommended: Option 1

  for (const child of children) {
    await teamDao.updateTeam(child.id, { 
      parentId: team.parentId, 
      depth: team.parentId ? (await teamDao.findTeamById(team.parentId))!.depth + 1 : 0 
    });
    // also fix its subtree depths recursively (use delta)
  }

  const formsMoved = await formDao.reassignFormsToTeam(team.id, fallback?.id ?? team.parentId ?? null);
  await teamDao.deleteTeam(team.id);
}
```

### 4.3 Schema validation (zod)

```ts
export const CreateTeamSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
  parentId: z.string().cuid().nullable().optional(), // NEW
});

export const MoveTeamSchema = z.object({
  parentId: z.string().cuid().nullable(), // null = make root
});
```

### 4.4 Routes

```
POST   /orgs/:orgId/teams          — now accepts parentId
GET    /orgs/:orgId/teams          — add ?format=tree|flat (default tree for new UI, flat for backward compat)
GET    /orgs/:orgId/teams/:teamId  — include ancestors: { team, ancestors, children }
PUT    /orgs/:orgId/teams/:teamId  — edit name/desc (parent not editable here)
POST   /orgs/:orgId/teams/:teamId/move — { parentId }
DELETE /orgs/:orgId/teams/:teamId  — now re-parents children
```

Keep existing member routes same — they work with nested IDs.

---

## 5. Frontend Changes (Minimal)

### 5.1 Types

```ts
// src/types/index.ts
export interface Team {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null; // NEW
  depth: number;           // NEW
  isDefault?: boolean;
  _count?: { members: number; forms?: number };
  children?: Team[];       // populated only when format=tree
}
```

### 5.2 TeamsPage — from flat list to tree

Current: flat list with `teams.map`.

New: recursive component.

```tsx
function TeamNode({ team, level, selectedId, onSelect }) {
  const [expanded, setExpanded] = useState(level < 2); // auto expand first 2 levels
  return (
    <>
      <div style={{ paddingLeft: level * 16 }} className="flex items-center">
        {team.children?.length > 0 && (
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown/> : <ChevronRight/>}
          </button>
        )}
        <button onClick={() => onSelect(team.id)} className={selectedId===team.id ? 'bg-primary/10' : ''}>
          {team.name}
        </button>
      </div>
      {expanded && team.children?.map(child => (
        <TeamNode key={child.id} team={child} level={level+1} ... />
      ))}
    </>
  )
}
```

**Create dialog:** add parent selector (use existing `TeamTreeSelect` but now it IS a tree).

### 5.3 TeamTreeSelect — finally a real tree

Replace flat filter with tree search:

- Show indentation via `depth`.
- Search should flatten tree but show breadcrumbs: `Engineering > Frontend`.
- Keep searchable.

```tsx
function flattenWithPath(teams, prefix=[]): {team, path}[] 
// returns all nodes with breadcrumb path for search
```

### 5.4 FormsList grouping

If you group forms by team, now show tree grouping:

```
General (3 forms)
Engineering (1)
  Frontend (2)
    Design System (1)
```

---

## 6. Examples

### Example Org Structure

```
Acme Corp (org)
├── General (default, root)
│   └── forms: Welcome Survey
├── Engineering (root)
│   ├── forms: Tech RFC Template
│   ├── Frontend (child of Engineering)
│   │   ├── members: Bob, Carol
│   │   ├── forms: UI Feedback Form
│   │   └── Design System (child of Frontend, depth 2)
│   │       └── forms: Component Request
│   └── Backend (child of Engineering)
│       └── forms: API Review Checklist
└── Marketing (root)
    └── forms: Campaign Survey
```

**Creation flow:**
```json
POST /orgs/acme/teams
{ "name": "Engineering" } // root, depth 0

POST /orgs/acme/teams
{ "name": "Frontend", "parentId": "<engineering-id>" } // depth 1

POST /orgs/acme/teams
{ "name": "Design System", "parentId": "<frontend-id>" } // depth 2
```

**Move:**
```json
POST /orgs/acme/teams/<design-system-id>/move
{ "parentId": "<backend-id>" } // move Design System under Backend
```

**List tree:**
```json
GET /orgs/acme/teams?format=tree
[
  { "id": "general", "name": "General", "parentId": null, "depth": 0, "children": [] },
  { 
    "id": "eng", "name": "Engineering", "depth": 0,
    "children": [
      { "id": "fe", "name": "Frontend", "depth": 1, "parentId": "eng",
        "children": [{ "id": "ds", "name": "Design System", "depth": 2 }]
      }
    ]
  }
]
```

### Visibility Example (Option B)

- User Alice is member of Engineering only.
- `GET /orgs/acme/teams?effectiveFor=Alice` or client-side computed:
  - Visible teams = Engineering + all descendants = Engineering, Frontend, Backend, Design System.
- Form in Design System → Alice sees it because she sees its team.
- Form share to Engineering → Does Alice's membership count? Yes (direct). Does Bob (Frontend member) get it? No, unless we decide share inheritance. **Minimal: NO share inheritance** — share to parent does NOT grant child members. Only top-down visibility for listing.

If you want share inheritance later, one line change in `formAccess.service.ts`:

```ts
// when resolving team shares, also consider ancestors of user's teams
teamIds = [direct teamIds + all ancestors of those teams] // user in child gets parent shares? bottom-up
// OR
teamIds = [direct teamIds + all descendants] // parent member gets child shares? top-down — already covered by visibility
```

---

## 7. Migration

```sql
-- 1. Add columns (nullable, safe)
ALTER TABLE Team ADD COLUMN parentId VARCHAR(191) NULL;
ALTER TABLE Team ADD COLUMN depth INT NOT NULL DEFAULT 0;

-- 2. Index
CREATE INDEX Team_orgId_parentId_idx ON Team(orgId, parentId);
CREATE INDEX Team_parentId_idx ON Team(parentId);

-- 3. FK self-reference (optional, but good)
ALTER TABLE Team ADD CONSTRAINT Team_parentId_fkey FOREIGN KEY (parentId) REFERENCES Team(id) ON DELETE SET NULL;

-- Existing teams stay root (parentId=null, depth=0) — no data migration needed.
```

Prisma migration: `npx prisma migrate dev --name add_team_hierarchy`

Backfill script not needed — all existing are roots.

---

## 8. Edge Cases & Guards

| Case | Handling |
|------|----------|
| Create team with invalid parentId | 404 Parent not found / different org |
| Depth exceeded | 400 Max depth 3 |
| Cycle (A->B->A) | Walk ancestors, 400 Cycle detected |
| Move default team | 400 Not allowed |
| Delete team with children | Re-parent children to deleted team's parent (preserve tree) |
| Delete team with forms | Forms → default team (existing logic) or → parent if you prefer |
| Slug clash | Keep org-wide uniqueness error |
| Frontend infinite loop | Depth limit + cycle guard in service prevents DB loop; UI also guards `if depth>10 break` |

---

## 9. Rollout Plan (2 PRs)

### PR 1: Structural Hierarchy (Visual only — Option A)
1. Prisma schema + migration
2. DAO: `findTeamsTree`, `moveTeamSubtree`, `getMaxSubtreeDepth`
3. Service: create with parentId, move, delete re-parent
4. Routes: add `parentId` to create, new `/move` endpoint, `?format=tree`
5. Frontend: TeamsPage tree view, TeamTreeSelect tree, Create dialog parent picker
6. Tests: create child, move, cycle prevention, delete re-parent

**No permission change in PR1 — shipable in 1-2 days.**

### PR 2: Top-Down Visibility (Option B)
1. Update `teamDao.findTeamsForUser` to optionally include descendants
2. Update `formAccess.service.ts` `reachableTeamIds` to return effective visible teams
3. Update `Form` list query to filter by visible teams (if user is not ADMIN)
4. Add `GET /orgs/:orgId/teams?effective=true` or compute client side
5. UI badge: show "inherited access" vs "direct member"

---

## 10. What NOT to do in MVP

- ❌ No team-level roles (keep OrgUser.role)
- ❌ No bottom-up share inheritance (child share → parent)
- ❌ No permission inheritance (parent ADMIN → child ADMIN) — org role already covers
- ❌ No closure table / materialized path — adjacency + depth is enough for 3 levels
- ❌ No team visibility private/public toggle — all teams visible to org members (existing behavior)
- ❌ No drag-drop reordering priority — use tree UI only

Future if needed: add `visibility: 'VISIBLE' | 'HIDDEN'` per team, or `isPrivate` boolean.

---

## 11. Minimal Code Snippet Checklist

**Backend:**
- [ ] `schema.prisma` add parentId, depth, self relation
- [ ] `TeamDao` interface add tree methods
- [ ] `MySQLTeamDao` implement tree builder (in-memory)
- [ ] `team.service.ts` add parent handling + MAX_DEPTH=3 + cycle check
- [ ] `team.schema.ts` add parentId zod
- [ ] New route `POST /:orgId/teams/:teamId/move`
- [ ] Update delete logic to re-parent

**Frontend:**
- [ ] `Team` type add parentId, depth, children
- [ ] `teamsSlice` handle tree response
- [ ] `TeamsPage.tsx` recursive TreeNode component + expand/collapse
- [ ] `TeamTreeSelect.tsx` render indentation + breadcrumb search
- [ ] CreateTeam dialog add parent dropdown

---

## 12. TL;DR Decision

**Do this:**
- Add `parentId` nullable + `depth` int + self relation.
- Max depth 3, default team always root.
- Delete re-parents children to deleted team's parent.
- PR1 = visual hierarchy only, PR2 = top-down visibility where parent members see child forms.

**Example final UX:**
> User creates "Engineering" → creates "Frontend" under Engineering → sees indented tree. Manager in Engineering automatically sees all forms under Frontend and its children without being added manually (after PR2).

This is the simplest that still feels hierarchical and matches your existing "teams are buckets, roles are org-wide" philosophy.
