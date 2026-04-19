# Permissions Normalization Design Spec

**Date:** 2026-04-18
**Status:** Approved
**Scope:** Fix permission system gaps, normalize enforcement patterns, eliminate duplication

## Problem Statement

The RBAC system has solid foundations (hierarchical roles, permission matrix, utility functions) but suffers from:

1. **Unused middleware** — `authorize()`, `requireOrg()`, `requireProject()`, `requireRole()` and convenience wrappers are defined in `repos/backend/src/middleware/authorize.ts` but never applied to any route. All ~70 endpoints do inline `checkPermission()` calls instead, duplicating context extraction logic.

2. **Dangerous viewer fallback** — `getUserRole()` returns `ERoleType.viewer` when a user has no role in the org/project context. Since viewer can read most resources, any authenticated user could read resources in orgs they don't belong to if the endpoint doesn't also call `requireOrgMember()`.

3. **Inconsistent membership checks** — Some endpoints use `requireOrgMember()` (getOrg, getProject, quota endpoints), others rely on `checkPermission()` with the viewer fallback. No consistent pattern.

4. **Missing `exec` action** — Sandbox exec/shell operations use `EPermAction.read` via `requireResourceWithPermission`, which is semantically wrong. A TODO at `permissions.types.ts:31` notes this.

5. **Subscription endpoints unprotected** — All 7 subscription endpoints have zero permission checks. The permission matrix defines subscription permissions but they're never wired up.

6. **Shell WebSocket bypasses permission system** — `onShellConnect` authenticates independently and uses pod-ownership logic instead of the permission matrix.

7. **Dead types** — `EPermScope`, `TPermScope`, `TPermission` are defined but never imported or used anywhere.

8. **Frontend gaps** — Admin UI has TODO comments about missing permission gating. Threads SPA has zero role-based permission awareness despite being the primary user-facing app.

9. **Duplicated permission infrastructure** — Admin has `usePermissions`, `useCanPerform`, and `PermissionGate` locally. Threads needs the same infrastructure. Both should share from `@tdsk/components`.

## Design

### 1. Domain Layer Changes

**File:** `repos/domain/src/types/permissions.types.ts`

Add `exec` to `EPermAction`:

```typescript
export enum EPermAction {
  create = `create`,
  read = `read`,
  update = `update`,
  delete = `delete`,
  manage = `manage`,
  exec = `exec`,
}
```

Remove dead types:

- Delete `EPermScope` enum (lines 68-72)
- Delete `TPermScope` type alias (line 63)
- Delete `TPermission` type (lines 77-81)

**File:** `repos/domain/src/constants/values.ts`

Add `exec` column to every resource in `PermissionMatrix`:

| Resource | exec level | Rationale |
|----------|-----------|-----------|
| sandbox | member | Members can use sandboxes they have access to |
| agent | member | Members can run agents |
| function | member | Members can invoke functions |
| All others | admin | Default; most resources don't have exec semantics |

**File:** `repos/domain/src/utils/permissions/permissions.ts`

Update functions to handle `null` role (non-member):

- `getRoleLevel(role: ERoleType | null)` — returns `-1` for `null`
- `hasMinRole(userRole: ERoleType | null, requiredRole: ERoleType)` — `null` always returns `false`
- `canPerform(userRole: ERoleType | null, action, resource)` — `null` returns `{ allowed: false, reason: "Not a member of this organization or project" }`
- `getHighestRole(roles: (ERoleType | null)[])` — filters out nulls, returns `null` if empty
- `canAccessSecretValue(userRole: ERoleType | null)` — `null` returns `false`
- `isSuperAdmin(userRole: ERoleType | null)` — `null` returns `false`
- `canManageRole(managerRole: ERoleType | null, targetRole: ERoleType)` — `null` returns `false`
- `getAllowedActions(userRole: ERoleType | null, resource)` — `null` returns `[]`

**File:** `repos/domain/src/models/role.ts`

Update `Role` model methods to match updated utility signatures. The `type` property type stays `ERoleType` (a persisted role always has a type). The null-role concept applies only to the *absence* of a role record, handled by `getUserRole()`.

### 2. Backend Permission System Core

**File:** `repos/backend/src/utils/auth/checkPermission.ts`

Change `getUserRole()` return type:

```typescript
export const getUserRole = async (
  req: TRequest,
  context: TPermissionContext
): Promise<ERoleType | null> => {
  const { db } = req.app.locals
  const userId = req.user?.id
  if (!userId) return null

  const roles: ERoleType[] = []

  if (context.orgId) {
    const { data: orgRole } = await db.services.role.getOrgRole(userId, context.orgId)
    if (orgRole?.type) roles.push(orgRole.type as ERoleType)
  }

  if (context.projectId) {
    const { data: projectRole } = await db.services.role.getProjectRole(userId, context.projectId)
    if (projectRole?.type) roles.push(projectRole.type as ERoleType)
  }

  return roles.length > 0 ? getHighestRole(roles) : null
}
```

Update `checkPermission()` to handle null:

```typescript
export const checkPermission = async (
  req: TRequest,
  action: EPermAction,
  resource: EPermResource,
  context: TPermissionContext = {}
): Promise<void> => {
  const userRole = await getUserRole(req, context)

  if (userRole !== null && isSuperAdmin(userRole)) return

  const result = canPerform(userRole, action, resource)

  if (!result.allowed)
    throw new Exception(
      403,
      result.reason || `Permission denied: cannot ${action} ${resource}`,
      `FORBIDDEN`
    )
}
```

Delete these functions (no longer needed — null-role denial handles membership implicitly):

- `requireOrgMember()`
- `requireProjectMember()`
- `requireMinRole()`

**File:** `repos/backend/src/utils/auth/requireResource.ts`

Simplify `requireResourceWithPermission()` → `requireResource()`:

```typescript
export const requireResource = async <T>(
  service: { get: (id: string, opts?: any) => Promise<{ data?: T; error?: any }> },
  id: string,
  label: string
): Promise<T> => {
  const { data, error } = await service.get(id)
  if (error) {
    if (error.message?.toLowerCase().includes(`not found`))
      throw new Exception(404, `${label} not found`)
    throw new Exception(500, error.message)
  }
  if (!data) throw new Exception(404, `${label} not found`)
  return data
}
```

Permission checking is now handled by `authorize()` middleware before the handler runs. The handler just fetches the resource.

### 3. Backend Middleware Normalization

**File:** `repos/backend/src/middleware/authorize.ts`

Keep `authorize()` as the primary middleware. Delete everything else from this file:

- Delete `requireOrg()`
- Delete `requireProject()`
- Delete `requireRole()`
- Delete `superAdminOnly()`, `ownerOnly()`, `adminOnly()`, `memberOnly()`

Update `authorize()` to extract context from all sources:

```typescript
export const authorize = (action: EPermAction, resource: EPermResource) => {
  return async (req: TRequest, res: TResponse, next: NextFunction) => {
    try {
      const auth = fromAuthHeaders(req)
      const context: TPermissionContext = {
        resourceId: req.params.id,
        projectId: req.params.projectId || (req.query?.projectId as string) || req.body?.projectId,
        orgId: auth.orgId || req.params.orgId || (req.query?.orgId as string) || req.body?.orgId,
      }

      await checkPermission(req, action, resource, context)
      next()
    } catch (error) {
      next(error)
    }
  }
}
```

### 4. Context-Free Endpoints

Some endpoints operate without org/project context and must NOT use `authorize()`:

| Endpoint | Reason | Handling |
|----------|--------|----------|
| `createOrg` | No org exists yet — user is creating one | Auth-only (global middleware). Any authenticated user can create an org. |
| `listOrgs` | Returns all orgs user is a member of | Auth-only. Calls `getUserRoles()` directly to get org list. |
| `getPlans` | Public plan info, no org context | No auth needed. |

**`listOrgs` specific fix:** Currently calls `getUserRole(req, {})` with empty context to detect super admins. With the null-role change, this returns `null` for non-super users. Fix: replace with direct `isSuperAdmin(req.user?.role as ERoleType)` check using the platform-level role from the user record (set by Neon Auth), not the org-scoped role. This is the only place where the platform-level `user.role` field matters — it identifies super admins who can list all orgs.

**`listOrgs` response `userRole` field:** Line 79 falls back to `ERoleType.viewer` when mapping org roles for display. This is a response data field, not a permission check — it stays as-is. Users without an explicit role record won't appear in `listOrgs` results anyway (they're filtered by membership).

### 5. Route-Level Middleware Application

**Pattern change for all ~70 simple CRUD endpoints:**

Before (inline check in handler):
```typescript
export const createProject: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req, res) => {
    await checkPermission(req, EPermAction.create, EPermResource.project, { orgId })
    // ... business logic
  },
}
```

After (middleware on route, handler is pure business logic):
```typescript
export const createProject: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.project)],
  action: async (req, res) => {
    // ... business logic only
  },
}
```

**Endpoints using `requireResourceWithPermission()` pattern** (getSandbox, getEndpoint, getFunction, deleteSandbox, updateSandbox, etc.):

These endpoints fetch a resource by ID then check permission using the resource's orgId/projectId. With middleware handling the base permission check using URL params + auth headers, the handler simplifies to using `requireResource()` (fetch + 404 only).

If the resource's orgId might differ from the auth context (cross-org access attempt), the handler should verify `resource.orgId === auth.orgId` as a data integrity check. This is lightweight and doesn't duplicate the permission logic.

**Complex endpoints with conditional logic** (~10 endpoints):

These get `authorize()` middleware for the base permission check. The handler keeps its conditional logic:

| Endpoint | Middleware | Handler Logic |
|----------|-----------|---------------|
| `listSandboxes` | `authorize(read, sandbox)` | Filter by project membership for non-admins |
| `listAgents` | `authorize(read, agent)` | Filter by project membership for non-admins |
| `getSecret` | `authorize(read, secret)` | Strip values for non-admin roles |
| `copySandbox` | `authorize(create, sandbox)` | Filter project associations for non-admins |
| `createSecret` | `authorize(create, secret)` | Determine org vs project scope context |
| `listSecrets` | `authorize(read, secret)` | Strip values for non-admin roles |
| `createApiKey` | `authorize(create, apiKey)` | Validate scope permissions |
| `listApiKeys` | `authorize(read, apiKey)` | Org vs project scope branching |

These handlers use `getUserRole()` directly for their branching logic (they need the role value, not just pass/fail).

**Endpoints using `requireOrgMember()`** — replaced by `authorize()`:

| Endpoint | Old | New |
|----------|-----|-----|
| `getOrg` | `requireOrgMember(req, orgId)` | `authorize(read, org)` |
| `getProject` | `requireOrgMember(req, orgId)` | `authorize(read, project)` |
| `listOrgMembers` | `requireOrgMember(req, orgId)` | `authorize(read, role)` |
| `listProjectMembers` | `requireOrgMember(req, orgId)` | `authorize(read, role)` |
| `getOrgQuota` | `requireOrgMember(req, orgId)` | `authorize(read, quota)` |
| `getOrgLimits` | `requireOrgMember(req, orgId)` | `authorize(read, quota)` |
| `checkQuota` | `requireOrgMember(req, orgId)` | `authorize(read, quota)` |
| `listUsers` | `requireOrgMember(req, orgId)` | `authorize(read, user)` |

### 6. New Exec Permission on Sandbox Endpoints

Endpoints that change from `read` to `exec`:

| Endpoint | Old action | New action |
|----------|-----------|-----------|
| `execInSandbox` | `read` (via requireResourceWithPermission) | `exec` |
| `connectSandbox` | `read` (via requireResourceWithPermission) | `exec` |
| `startSandbox` | `read` (via requireResourceWithPermission) | `exec` |
| `stopSandbox` | `read` (via requireResourceWithPermission) | `exec` |
| `listSessions` | `read` (via requireResourceWithPermission) | `read` (unchanged — viewing sessions is read) |
| `getSandboxStatus` | `read` (via requireResourceWithPermission) | `read` (unchanged) |

### 7. Subscription Endpoint Wiring

**File:** `repos/backend/src/endpoints/subscriptions/subscriptions.ts`

Add `authorize()` middleware to each subscription endpoint:

| Endpoint | Middleware |
|----------|-----------|
| `getPlans` | None (stays public — plan info is not org-specific) |
| `getCurrentSubscription` | `authorize(read, subscription)` |
| `getInvoices` | `authorize(read, subscription)` |
| `createCheckout` | `authorize(create, subscription)` |
| `updateSubscription` | `authorize(update, subscription)` |
| `cancelSubscription` | `authorize(delete, subscription)` |
| `createPortalSession` | `authorize(manage, subscription)` |

Each handler needs an orgId for context extraction. The orgId comes from auth headers (API key) or must be passed as a query param for JWT auth. Handlers that currently use only `req.user?.id` to find the subscription will need to accept orgId and look up the org owner's subscription instead.

### 8. Shell WebSocket Normalization

**File:** `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`

After authentication (step 3 — API key or shell token validation), add permission check:

```typescript
// After userId and orgId are determined from auth:
const userRole = await getUserRole(req, { orgId })
const result = canPerform(userRole, EPermAction.exec, EPermResource.sandbox)
if (!result.allowed) {
  ws.close(4003, result.reason || `Permission denied`)
  return
}
```

Note: `onShellConnect` receives `IncomingMessage`, not Express `TRequest`. The `getUserRole` call needs the `db` service from `app.locals` and a userId. Construct a minimal context object for the check rather than passing `req` directly.

Changes to session creation (step 7):

- **Remove** pod-ownership check (`podOwnerUserId !== userId` → close). Any user with `exec` permission can create sessions.
- **Keep** `validatePodOwnership(podName, orgId)` — this validates the pod belongs to the org, not the user.

Changes to cross-user join:

- **Replace** org-membership check with `exec` permission check:
  - Old: `db.services.role.getOrgRole(userId, orgId)` → deny if no role
  - New: `canPerform(userRole, EPermAction.exec, EPermResource.sandbox)` → deny if not allowed
- **Keep** session visibility requirement (must be `public`)

Session visibility toggling:

- **Keep** session-creator-only restriction (this is session-level ownership, not org-level permission)

### 9. Shared Permission Components

**Location:** `repos/components/src/hooks/permissions/`

Create shared `usePermissions` hook and `PermissionGate` component in `@tdsk/components`.

**`usePermissions(role: ERoleType | null)`:**

The hook accepts a role parameter (each app provides its role from its own state). Returns the same `TUsePermissions` interface currently in admin. Adds `canExec` for the new action.

```typescript
export type TUsePermissions = {
  role: ERoleType | null

  // Role checks
  isSuper: boolean
  isOwner: boolean
  isAdmin: boolean
  isMember: boolean
  isViewer: boolean

  // Action checks
  canCreate: (resource: EPermResource) => boolean
  canRead: (resource: EPermResource) => boolean
  canUpdate: (resource: EPermResource) => boolean
  canDelete: (resource: EPermResource) => boolean
  canManage: (resource: EPermResource) => boolean
  canExec: (resource: EPermResource) => boolean

  // Specific checks
  canAccessSecretValues: boolean
  canManageMembers: boolean
  canManageApiKeys: boolean
  canDeleteOrg: boolean
  canInviteUsers: boolean

  // Role management
  canAssignRole: (targetRole: ERoleType) => boolean
}

export const usePermissions = (role: ERoleType | null): TUsePermissions => {
  // ... same logic as admin's hook but accepts role as param
  // null role → all checks return false
}
```

**`useCanPerform(role, action, resource)`:**

Thin wrapper:

```typescript
export const useCanPerform = (
  role: ERoleType | null,
  action: EPermAction,
  resource: EPermResource
): boolean => {
  return useMemo(() => canPerform(role, action, resource).allowed, [role, action, resource])
}
```

**`PermissionGate`:**

Same interface as admin's current component, but takes `role` as a prop (or reads from a context provider):

```typescript
type TPermissionGateProps = {
  role: ERoleType | null
  children: ReactNode
  fallback?: ReactNode
} & (
  | { action: EPermAction; resource: EPermResource }
  | { minRole: ERoleType }
  | { check: keyof TUsePermissions }
)
```

Alternative: provide a `PermissionsProvider` context so `PermissionGate` doesn't need `role` on every instance. Each app wraps its tree with `<PermissionsProvider role={roleFromState}>` and the gate reads from context. This is cleaner for components nested deep in the tree.

Decision: Use the provider pattern. Each app has one `<PermissionsProvider>` near the root.

### 10. Admin UI Fixes

**File:** `repos/admin/src/hooks/permissions/usePermissions.tsx`

Delete. Import `usePermissions` from `@tdsk/components`. Create a thin app-specific wrapper that passes in the role:

```typescript
import { usePermissions as usePermissionsBase } from '@tdsk/components'

export const usePermissions = () => {
  const [user] = useUser()
  const [activeOrgRole] = useActiveOrgRole()
  const role = user?.role === `super` ? ERoleType.super : (activeOrgRole as ERoleType) || null
  return usePermissionsBase(role)
}
```

Note: The fallback changes from `ERoleType.viewer` to `null` — if no active org role, the user is treated as non-member (all checks return false). This is the correct behavior.

**File:** `repos/admin/src/hooks/permissions/useCanPerform.tsx`

Delete. Import from `@tdsk/components`.

**File:** `repos/admin/src/components/Permissions/PermissionGate.tsx`

Delete. Import from `@tdsk/components`. Wrap with `PermissionsProvider` in the admin app root.

**File:** `repos/admin/src/components/Users/InviteUserDrawer.tsx`

Add permission gating alongside existing subscription tier gating:

```typescript
const { canInviteUsers } = usePermissions()

// Update disabled logic:
const inviteDisabled = !canInvite || !canInviteUsers || loading || !email.trim()
```

Show permission-denied message when user lacks invite permission (separate from subscription tier message).

**File:** `repos/admin/src/components/Users/EditUserDrawer.tsx`

Gate role editing with permission check:

```typescript
const { canManageMembers, canAssignRole } = usePermissions()

// Disable role selector if user can't manage members:
<RoleSelect
  showAlert
  roleType={roleType}
  disabled={roleLoading || !canManageMembers}
  onChange={(e) => setRoleType(e.target.value as TRoleType)}
/>
```

Filter available roles in `RoleSelect` using `canAssignRole()` — only show roles the current user can assign.

**File:** `repos/admin/src/components/Users/Users.tsx`

Normalize delete/edit button gating to use `usePermissions()` consistently:

- Edit button: disabled if `!canManageMembers` (replaces ad-hoc viewer check)
- Delete button: gated by `canManageMembers` and `canAssignRole(targetRole)` (replaces ad-hoc isAdmin/isSelf checks)

**Clean up TODO comments** in `updateOrgRole.ts` and `inviteToOrg.ts` after the fixes are implemented.

### 11. Threads SPA Permission Gating

**Add `PermissionsProvider`** in threads app root — similar to admin, wraps the app with the role from state.

**Add `usePermissions` wrapper** in threads — passes the active org role from threads state to the shared hook.

**Gate sandbox actions:**

| UI Element | Permission Check | Behavior When Denied |
|-----------|-----------------|---------------------|
| "New Session" / "Connect" button | `canExec(sandbox)` | Hidden |
| "Create Sandbox" button | `canCreate(sandbox)` | Hidden |
| Stop/restart sandbox buttons | `canExec(sandbox)` | Hidden |
| Session commands panel | `canExec(sandbox)` | Show "Leave" only |
| Shared session list items | `canExec(sandbox)` | Show as view-only (no input forwarding) |
| Visibility toggle | Session creator only (unchanged) | Hidden for non-creators |

**Shared sessions:**

When a user lacks `exec` permission, shared sessions should still be visible (read-only terminal output) but input should be disabled. The join WebSocket connection can still be established for viewing, but the client should not send binary stdin frames.

## Files Changed Summary

### Domain (`repos/domain/`)
| File | Change |
|------|--------|
| `src/types/permissions.types.ts` | Add `exec` to EPermAction; remove EPermScope, TPermScope, TPermission |
| `src/constants/values.ts` | Add `exec` column to PermissionMatrix |
| `src/utils/permissions/permissions.ts` | All functions accept `ERoleType \| null`; null = deny |
| `src/models/role.ts` | Update method signatures to match |

### Backend (`repos/backend/`)
| File | Change |
|------|--------|
| `src/utils/auth/checkPermission.ts` | `getUserRole` returns null; delete requireOrgMember, requireProjectMember, requireMinRole |
| `src/utils/auth/requireResource.ts` | Simplify to `requireResource()` (fetch + 404 only) |
| `src/middleware/authorize.ts` | Keep `authorize()`, add body extraction; delete all other exports |
| `src/middleware/projectAccessGuard.ts` | No change |
| `src/middleware/enforceQuota.ts` | No change |
| ~70 endpoint handler files | Remove inline checkPermission/requireOrgMember calls; add `authorize()` to middleware array |
| `src/endpoints/subscriptions/*.ts` | Add authorize() middleware; add orgId context |
| `src/endpoints/sandboxes/onShellConnect.ts` | Add exec permission check; remove pod-ownership gate for new sessions |

### Components (`repos/components/`)
| File | Change |
|------|--------|
| `src/hooks/permissions/usePermissions.tsx` | New — shared hook accepting role param |
| `src/hooks/permissions/useCanPerform.tsx` | New — shared thin wrapper |
| `src/components/Permissions/PermissionGate.tsx` | New — shared gate component |
| `src/components/Permissions/PermissionsProvider.tsx` | New — context provider for role |

### Admin (`repos/admin/`)
| File | Change |
|------|--------|
| `src/hooks/permissions/usePermissions.tsx` | Replace with thin wrapper importing from @tdsk/components |
| `src/hooks/permissions/useCanPerform.tsx` | Delete; import from @tdsk/components |
| `src/components/Permissions/PermissionGate.tsx` | Delete; import from @tdsk/components |
| `src/components/Users/InviteUserDrawer.tsx` | Add canInviteUsers check |
| `src/components/Users/EditUserDrawer.tsx` | Add canManageMembers check, filter assignable roles |
| `src/components/Users/Users.tsx` | Normalize button gating to usePermissions |
| `src/actions/users/api/updateOrgRole.ts` | Remove TODO comment |
| `src/actions/users/api/inviteToOrg.ts` | Remove TODO comment |
| App root | Add PermissionsProvider |

### Threads (`repos/threads/`)
| File | Change |
|------|--------|
| `src/hooks/permissions/usePermissions.tsx` | New — thin wrapper importing from @tdsk/components |
| App root | Add PermissionsProvider |
| `src/pages/Session/Session.tsx` | Gate session commands by exec permission |
| `src/pages/Sandbox/Sandbox.tsx` | Gate create/connect by permission |
| `src/components/Session/SessionCommands.tsx` | Gate exec actions by permission instead of pod ownership |
| `src/components/Sidebar/NavSessionItem.tsx` | Visual treatment for view-only shared sessions |

## Out of Scope

- Fine-grained per-entity permission assignments (ACLs) — separate feature
- New `EPermScope` usage or scope-level enforcement — requires separate design
- Agent execution permission model (SSE/WebSocket agent runs) — separate from sandbox exec
- Database schema changes — none needed, roles table is sufficient
- Proxy changes — proxy is auth-only by design, no permission enforcement needed
