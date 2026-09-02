# Multi-Organization Switching and Tenant Isolation Audit

## Executive summary

The reported “role switching” and “Form not found” behavior was primarily a frontend scope-transition defect, not evidence that the backend returned another organization's form. The API correctly scopes protected form reads by both form ID and current organization ID. However, the browser retained organization-A forms, roles, members, submissions, and builder state after switching to organization B. Clicking an A form still visible in B sent B's `x-org-id`; the backend correctly returned “Form not found.”

This change makes organization switching an explicit state boundary: in-flight old-scope requests are aborted, organization-scoped Redux stores are cleared, destination screens refetch when the organization ID changes, and late responses are ignored.

## Request and authorization model

1. The frontend stores the selected organization ID in `localStorage.currentOrgId`.
2. The Axios request interceptor sends it as `x-org-id`.
3. `orgMiddleware` confirms the authenticated user is an organization member or owner.
4. Form services query protected forms with both `id` and `orgId`.
5. Effective permissions are cached by `userId|orgId`, so a role held in A is not reused as the role in B.

The browser's current organization is routing context, not an authorization boundary. The backend membership, permission, team/form ownership, sharing, and response-policy checks remain authoritative.

## Confirmed issues and fixes

### 1. Forms from the previous organization remained visible

**Example:** Alice is an Admin in Alpha and a Viewer in Beta. She opens Alpha's dashboard, switches to Beta while already on `/dashboard`, and still sees Alpha's form cards.

**Cause:** Dashboard and Forms List fetch effects did not depend on `currentOrg.id`; navigating from `/dashboard` to the same `/dashboard` route did not remount the page. The forms slice was not reset.

**Fix:** Forms are cleared during switching, both pages refetch on organization-ID changes, dashboard statistics reset immediately, and filters return to neutral values.

### 2. Stale form links produced “Form not found”

**Example:** After the stale Alpha cards appeared in Beta, opening an Alpha form called `GET /forms/:alphaFormId` with Beta's header.

**Backend behavior:** Correctly returned 404 because the DAO requires `{ id: alphaFormId, orgId: betaId }`.

**Fix:** Old cards are removed before navigation. The builder now clears `currentForm` while loading/rejecting and shows “Form unavailable in this organization” with a route back to the scoped form list rather than displaying stale data or spinning forever.

### 3. Late API responses could overwrite the new workspace

**Example:** Alpha's forms request is slow. The user switches to Beta, Beta loads, then Alpha's older response finishes and replaces Beta's list.

**Fix:** Organization switching aborts all in-flight API requests from the previous scope. Forms and single-form requests also capture their requested organization ID; reducers ignore responses whose scope no longer matches `currentOrgId`. Teams, members, invitations, and roles reject late fulfilled responses using the thunk's organization argument.

### 4. Organization-scoped stores were only partially reset

**Before:** The switcher reset teams and members only.

**Risk:** Current form, form lists, submission rows, response access, aggregate reports, shares, role views, and unsaved builder state could remain in browser memory and briefly render under the next organization.

**Fix:** Switching now resets teams, members, forms/current form, submissions, sharing/aggregate access, roles, and builder state before setting the new organization.

### 5. Role UI could show the previous organization's role catalogue state

**Example:** The user visits Roles in Alpha, switches to Beta, and a previously loaded role list or assignment count remains until another request finishes.

**Fix:** Role state resets on switch and late Alpha role responses are ignored. Assignment counts returned by the role endpoint are now filtered to the requested organization instead of counting memberships across every tenant.

### 6. Deleted or invalid saved organization IDs remained in local storage

**Example:** `currentOrgId` points to an organization that was deleted or from which the user was removed. Requests continue sending that ID and receive access-denied errors even though the user belongs to another organization.

**Fix:** Organization loading now selects the saved organization only if it remains accessible; otherwise it selects the first accessible organization and updates storage. Deleting the active organization updates/removes the stored ID. Logout/reset removes it.

### 7. Sidebar accessibility warning

**Observed warning:** “Blocked aria-hidden on an element because its descendant retained focus.”

**Cause:** The full sidebar wrapper had `aria-hidden="true"` even though it contained focusable links and buttons.

**Fix:** Removed `aria-hidden` from the interactive sidebar ancestor. Decorative elements retain appropriate hidden semantics.

### 8. Console `VM... startTime` errors

The `VM3600:2` stack is an injected anonymous script, not an application source or built asset path. The functions `reportAllChanges`, `requestIdleCallback`, and missing `startTime` are consistent with a browser extension, monitoring agent, or developer-tools snippet. This error is separate from the sidebar warning and Likert code.

To identify it, reproduce in a clean Incognito profile with extensions disabled and inspect DevTools **Sources → VM3600**. If it disappears, enable extensions one at a time. Application exceptions normally point to the deployed `index-<hash>.js`, a source-mapped application file, or an API request.

## Backend findings

### Controls confirmed

- Protected form reads and writes require authenticated organization middleware.
- Form DAOs use organization ID in protected lookup predicates.
- Organization membership is checked server-side; changing local storage cannot grant membership.
- Effective-permission cache keys include both user and organization.
- Form response access is recalculated per form and organization.
- URL organization parameters take precedence on organization routes and are membership checked.

### Architectural limitation: role definitions are globally shared

Role **assignments** are organization-specific, but role **definitions** currently live in an external RBAC service keyed by application, not organization. Consequently, changing the permissions of a shared custom role can affect members assigned that role name in multiple organizations.

**Example:** Alpha and Beta both assign `REVIEWER`. An authorized role manager changes `REVIEWER` in Alpha. Because the definition is global, Beta's `REVIEWER` definition also changes after cache invalidation.

This is an existing architecture limitation documented in `role.service.ts`; it is not fully solved by frontend switching. A complete isolation fix requires one of:

1. Add `orgId` tenancy to role definitions in the RBAC service; or
2. Store custom role definitions locally per organization and reserve external RBAC definitions for immutable system roles.

Until that migration, role managers must be informed that custom role-definition changes are application-wide. Assignment counts are now scoped in the UI, but definition scope remains global.

## Likert issue relation

The earlier public-page exception `Cannot set properties of undefined (setting 'surveyMatrixComplete')` occurred before the control rendered and made the Likert UI appear unselectable. That callback map was initialized in commit `cbc8698`. The latest implementation additionally uses React Hook Form's `Controller` for object-valued survey answers rather than registering a hidden scalar input. Matrix selections now flow directly through the form controller in public forms, while preview uses the same shared control with local state.

If a deployed console still reports `surveyMatrixComplete`, it is serving an older frontend bundle. Verify the deployed Git commit and invalidate HTML/CDN caches; hashed JS assets alone are not enough if cached HTML references an old hash.

## Verification matrix

Use two organizations where the same user has different roles:

| Scenario | Expected result |
|---|---|
| Admin in A → Viewer in B | Edit/create navigation disappears after B permissions load; no A forms render |
| Switch on `/dashboard` | Statistics and cards clear, then show B data |
| Switch on `/forms` | Form list and team filter reset, then show B data |
| Switch while an A request is deliberately delayed | A request aborts/late result is ignored |
| Open an A form ID while B is selected | Clear unavailable message; no A schema is displayed |
| Switch while viewing submissions | Rows, aggregate data, shares, and access state are cleared |
| Delete active organization | Another accessible org is selected and persisted, or selection is removed |
| Edit role assignments in A | B assignments remain unchanged |
| Compare assigned counts | Counts reflect only the selected organization |
| Edit a globally shared role definition | Treat as application-wide until role-definition tenancy is implemented |
| Keyboard-focus sidebar, then open/close switcher | No focused descendant is inside an `aria-hidden` ancestor |
| Select every Likert row in preview/public | Selection remains visible; required validation passes only when all required rows are answered |

## Deployment checks

1. Confirm the new frontend Git commit is deployed.
2. Rebuild rather than reusing an old `dist` directory.
3. Invalidate cached `index.html` and service-worker/CDN shell responses.
4. Test in a clean browser profile without extensions.
5. Verify API requests carry the newly selected `x-org-id` immediately after switching.
6. Verify stale requests appear canceled in the Network panel.
7. Confirm a wrong-org form ID returns 404/Unavailable and never returns schema data.
