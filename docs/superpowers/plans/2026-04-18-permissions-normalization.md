# Permissions Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix permission system gaps, normalize enforcement to route-level middleware, eliminate inline duplication, add exec action, and bring permission awareness to both frontends.

**Architecture:** Domain layer gets null-role handling and exec action. Backend moves all permission checks from inline handler calls to declarative `authorize()` middleware on route configs. Shared `usePermissions` hook and `PermissionGate` component move to `@tdsk/components` for both admin and threads SPAs.

**Tech Stack:** TypeScript, Express 5 middleware, React hooks, Jotai state, @tdsk/domain permission utilities

**Spec:** `docs/superpowers/specs/2026-04-18-permissions-normalization-design.md`

**CRITICAL RULES FOR ALL TASKS:**
- **NEVER** run `git commit`, `git push`, or any git history-modifying commands
- **NEVER** add TODO/FIXME comments — implement everything fully
- Exported types go in the repo's `types/` directory, never co-located
- Run `pnpm types` in affected repos after changes to verify type safety

---

## File Structure

### Domain (`repos/domain/`)
| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/permissions.types.ts` | Modify | Add `exec` action, remove dead types |
| `src/constants/values.ts` | Modify | Add `exec` to PermissionMatrix |
| `src/utils/permissions/permissions.ts` | Modify | Null-role handling for all functions |
| `src/models/role.ts` | Modify | Update method signatures |

### Backend (`repos/backend/`)
| File | Action | Responsibility |
|------|--------|---------------|
| `src/utils/auth/checkPermission.ts` | Modify | Null return from getUserRole, delete 3 functions |
| `src/utils/auth/requireResource.ts` | Modify | Simplify to fetch+404 only |
| `src/middleware/authorize.ts` | Modify | Keep authorize(), delete 7 exports, add body extraction |
| ~80 endpoint handler files | Modify | Remove inline checks, add middleware to config |
| `src/endpoints/subscriptions/*.ts` | Modify | Wire to permission matrix |
| `src/endpoints/sandboxes/onShellConnect.ts` | Modify | Add exec permission, remove pod-ownership gate |

### Components (`repos/components/`)
| File | Action | Responsibility |
|------|--------|---------------|
| `src/hooks/permissions/usePermissions.ts` | Create | Shared permission hook |
| `src/hooks/permissions/useCanPerform.ts` | Create | Thin action check wrapper |
| `src/hooks/permissions/index.ts` | Create | Barrel export |
| `src/components/Permissions/PermissionsProvider.tsx` | Create | Context provider for role |
| `src/components/Permissions/PermissionGate.tsx` | Create | Conditional render gate |
| `src/components/Permissions/index.ts` | Create | Barrel export |

### Admin (`repos/admin/`)
| File | Action | Responsibility |
|------|--------|---------------|
| `src/hooks/permissions/usePermissions.tsx` | Modify | Thin wrapper over shared hook |
| `src/hooks/permissions/useCanPerform.tsx` | Delete | Import from @tdsk/components |
| `src/components/Permissions/PermissionGate.tsx` | Delete | Import from @tdsk/components |
| `src/components/Users/InviteUserDrawer.tsx` | Modify | Add permission gating |
| `src/components/Users/EditUserDrawer.tsx` | Modify | Add permission gating |
| `src/components/Users/Users.tsx` | Modify | Normalize button gating |
| Root provider | Modify | Add PermissionsProvider |

### Threads (`repos/threads/`)
| File | Action | Responsibility |
|------|--------|---------------|
| `src/hooks/permissions/usePermissions.ts` | Create | App-specific wrapper |
| `src/hooks/permissions/index.ts` | Create | Barrel export |
| `src/state/orgs.ts` or equivalent | Modify | Store userRole from API response |
| Root provider | Modify | Add PermissionsProvider |
| `src/pages/Session/Session.tsx` | Modify | Gate by exec permission |
| `src/pages/Sandbox/Sandbox.tsx` | Modify | Gate create/connect |
| `src/components/Session/SessionCommands.tsx` | Modify | Gate by exec permission |

---

## Task 1: Domain — Add exec action and update PermissionMatrix

**Files:**
- Modify: `repos/domain/src/types/permissions.types.ts`
- Modify: `repos/domain/src/constants/values.ts`

- [ ] **Step 1: Add `exec` to EPermAction enum**

In `repos/domain/src/types/permissions.types.ts`, add `exec` after `manage`:

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

Remove the TODO comment about exec (lines 31-32).

- [ ] **Step 2: Remove dead types from permissions.types.ts**

Delete `EPermScope` enum (lines 68-72), `TPermScope` type alias (line 63), and `TPermission` type (lines 77-81). Also delete the `scope: EPermScope` reference inside `TPermission` since the whole type is being removed.

After removal, the file should have: `ERoleType`, `TRoleType`, `EPermAction`, `TPermAction`, `EPermResource`, `TPermResource`, `TRoleContext`, `TPermCheckResult`, `TRoleUser`.

- [ ] **Step 3: Add `exec` column to PermissionMatrix**

In `repos/domain/src/constants/values.ts`, add `[EPermAction.exec]` to every resource entry in `PermissionMatrix`:

```typescript
[EPermResource.org]: {
  [EPermAction.create]: ERoleType.member,
  [EPermAction.read]: ERoleType.viewer,
  [EPermAction.update]: ERoleType.admin,
  [EPermAction.delete]: ERoleType.owner,
  [EPermAction.manage]: ERoleType.admin,
  [EPermAction.exec]: ERoleType.admin,
},
```

Use these `exec` levels per resource:
- `sandbox`: `ERoleType.member` — members can use sandboxes
- `agent`: `ERoleType.member` — members can run agents
- `function`: `ERoleType.member` — members can invoke functions
- All other 17 resources: `ERoleType.admin`

Also add the `EPermAction` import if not already imported.

- [ ] **Step 4: Verify types compile**

Run: `cd repos/domain && pnpm types`
Expected: Clean pass with no errors.

---

## Task 2: Domain — Null-role handling in permission utilities

**Files:**
- Modify: `repos/domain/src/utils/permissions/permissions.ts`
- Modify: `repos/domain/src/models/role.ts`

- [ ] **Step 1: Update getRoleLevel to accept null**

```typescript
export const getRoleLevel = (role: ERoleType | null): number => {
  if (role === null) return -1
  return RoleHierarchy.indexOf(role)
}
```

- [ ] **Step 2: Update hasMinRole to accept null**

```typescript
export const hasMinRole = (userRole: ERoleType | null, requiredRole: ERoleType): boolean => {
  if (userRole === null) return false
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole)
}
```

- [ ] **Step 3: Update canPerform to handle null**

```typescript
export const canPerform = (
  userRole: ERoleType | null,
  action: EPermAction,
  resource: EPermResource
): TPermCheckResult => {
  if (userRole === null) {
    return {
      allowed: false,
      reason: `Not a member of this organization or project`,
    }
  }

  const requiredRole = PermissionMatrix[resource]?.[action]

  if (!requiredRole) {
    return {
      allowed: false,
      reason: `Unknown permission: ${action} on ${resource}`,
    }
  }

  const allowed = hasMinRole(userRole, requiredRole)

  return {
    allowed,
    requiredRole,
    reason: allowed ? undefined : `Requires ${requiredRole} role or higher`,
  }
}
```

- [ ] **Step 4: Update remaining utility functions**

Update `canAccessSecretValue`:
```typescript
export const canAccessSecretValue = (userRole: ERoleType | null): boolean => {
  if (userRole === null) return false
  return hasMinRole(userRole, ERoleType.admin)
}
```

Update `isSuperAdmin`:
```typescript
export const isSuperAdmin = (userRole: ERoleType | null): boolean => {
  if (userRole === null) return false
  return userRole === ERoleType.super
}
```

Update `getHighestRole`:
```typescript
export const getHighestRole = (roles: (ERoleType | null)[]): ERoleType | null => {
  const validRoles = roles.filter((r): r is ERoleType => r !== null)
  if (!validRoles.length) return null

  return validRoles.reduce((highest, current) =>
    getRoleLevel(current) > getRoleLevel(highest) ? current : highest
  )
}
```

Update `canManageRole`:
```typescript
export const canManageRole = (managerRole: ERoleType | null, targetRole: ERoleType): boolean => {
  if (managerRole === null) return false
  if (isSuperAdmin(managerRole)) return true
  return getRoleLevel(managerRole) > getRoleLevel(targetRole)
}
```

Update `getAllowedActions`:
```typescript
export const getAllowedActions = (
  userRole: ERoleType | null,
  resource: EPermResource
): EPermAction[] => {
  if (userRole === null) return []
  const permissions = PermissionMatrix[resource]
  if (!permissions) return []

  return Object.entries(permissions)
    .filter(([_, requiredRole]) => hasMinRole(userRole, requiredRole))
    .map(([action, _]) => action as EPermAction)
}
```

- [ ] **Step 5: Update Role model**

In `repos/domain/src/models/role.ts`, update the method signatures to match. The `type` property stays `ERoleType` (not nullable — persisted roles always have a type). The methods call the updated utility functions:

```typescript
hasMinRole(required: ERoleType): boolean {
  return hasMinRole(this.type, required)
}
```

No signature change needed on the model methods since `this.type` is always `ERoleType`.

- [ ] **Step 6: Run tests and type check**

Run: `cd repos/domain && pnpm types && pnpm test`
Expected: Types pass. Tests may need updates if they test the old viewer fallback behavior. Fix any failing tests to expect null instead of viewer for non-member scenarios.

---

## Task 3: Backend — Core permission system changes

**Files:**
- Modify: `repos/backend/src/utils/auth/checkPermission.ts`
- Modify: `repos/backend/src/utils/auth/requireResource.ts`
- Modify: `repos/backend/src/middleware/authorize.ts`

- [ ] **Step 1: Update getUserRole to return null**

In `repos/backend/src/utils/auth/checkPermission.ts`:

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
    if (orgRole?.type) {
      roles.push(orgRole.type as ERoleType)
    }
  }

  if (context.projectId) {
    const { data: projectRole } = await db.services.role.getProjectRole(
      userId,
      context.projectId
    )
    if (projectRole?.type) roles.push(projectRole.type as ERoleType)
  }

  return roles.length > 0 ? getHighestRole(roles) : null
}
```

- [ ] **Step 2: Update checkPermission to handle null**

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

- [ ] **Step 3: Delete requireOrgMember, requireProjectMember, requireMinRole**

Remove these three functions entirely from `checkPermission.ts`. Keep only: `getUserRole`, `checkPermission`, and the `TPermissionContext` type export.

Update the import of `getHighestRole` to handle the new null-aware signature — it already returns `ERoleType | null` from domain, which matches the new `getUserRole` return type.

- [ ] **Step 4: Simplify requireResource**

Replace the contents of `repos/backend/src/utils/auth/requireResource.ts`:

```typescript
import { Exception } from '@tdsk/domain'

/**
 * Fetch a resource by ID, throw 404 if not found.
 * Permission checking is handled by authorize() middleware.
 */
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

- [ ] **Step 5: Clean up authorize.ts middleware**

Replace the contents of `repos/backend/src/middleware/authorize.ts`:

```typescript
import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'
import type { EPermAction, EPermResource } from '@tdsk/domain'
import type { TPermissionContext } from '@TBE/utils/auth/checkPermission'

import { fromAuthHeaders } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * Middleware to check permission for an action on a resource.
 * Context is extracted from request params, query, body, and auth headers.
 * This is the primary permission enforcement mechanism — use on route configs.
 */
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

Everything else (`requireOrg`, `requireProject`, `requireRole`, `superAdminOnly`, `ownerOnly`, `adminOnly`, `memberOnly`) is deleted.

- [ ] **Step 6: Verify types compile**

Run: `cd repos/backend && pnpm types`
Expected: Will show errors for files still importing deleted functions. That's expected — those get fixed in subsequent tasks.

---

## Task 4: Backend — Migrate org endpoints to authorize middleware

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/getOrg.ts`
- Modify: `repos/backend/src/endpoints/orgs/updateOrg.ts`
- Modify: `repos/backend/src/endpoints/orgs/deleteOrg.ts`
- Modify: `repos/backend/src/endpoints/orgs/listOrgMembers.ts`
- Modify: `repos/backend/src/endpoints/orgs/addOrgMember.ts`
- Modify: `repos/backend/src/endpoints/orgs/removeOrgMember.ts`
- Modify: `repos/backend/src/endpoints/orgs/inviteOrgUser.ts`
- Modify: `repos/backend/src/endpoints/orgs/updateOrgRole.ts`
- Modify: `repos/backend/src/endpoints/orgs/deleteOrgRole.ts`
- Modify: `repos/backend/src/endpoints/orgs/updateMemberRole.ts`
- Modify: `repos/backend/src/endpoints/orgs/orgQuickstart.ts`
- Modify: `repos/backend/src/endpoints/orgs/listOrgs.ts`

**Pattern for each file:**

1. Add `authorize` import: `import { authorize } from '@TBE/middleware/authorize'`
2. Add `EPermAction, EPermResource` imports from `@tdsk/domain`
3. Add `middleware: [authorize(EPermAction.X, EPermResource.Y)]` to the endpoint config
4. Remove the inline `checkPermission()` or `requireOrgMember()` call from the handler
5. Remove now-unused imports of `checkPermission`, `requireOrgMember`, etc.

- [ ] **Step 1: Migrate simple org CRUD endpoints**

For each of these files, add `authorize()` middleware and remove inline check:

| File | Middleware | Remove |
|------|-----------|--------|
| `updateOrg.ts` | `authorize(EPermAction.update, EPermResource.org)` | `checkPermission` call |
| `deleteOrg.ts` | `authorize(EPermAction.delete, EPermResource.org)` | `checkPermission` call |
| `listOrgMembers.ts` | `authorize(EPermAction.read, EPermResource.role)` | `requireOrgMember` call |
| `inviteOrgUser.ts` | `authorize(EPermAction.create, EPermResource.role)` | `checkPermission` call |
| `deleteOrgRole.ts` | `authorize(EPermAction.delete, EPermResource.role)` | `checkPermission` call |
| `orgQuickstart.ts` | `authorize(EPermAction.create, EPermResource.project)` | `checkPermission` call |

Example transformation for `updateOrg.ts`:

Before:
```typescript
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

export const updateOrg: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req, res) => {
    const orgId = req.params.id
    await checkPermission(req, EPermAction.update, EPermResource.org, { orgId })
    // ... business logic
  },
}
```

After:
```typescript
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'

export const updateOrg: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.org)],
  action: async (req, res) => {
    // ... business logic only
  },
}
```

- [ ] **Step 2: Migrate complex org endpoints (keep conditional logic)**

These endpoints keep `getUserRole()` for branching but add `authorize()` for the base check:

| File | Middleware | Keep in handler |
|------|-----------|----------------|
| `getOrg.ts` | `authorize(EPermAction.read, EPermResource.org)` | `getUserRole()` for attaching role to response. Remove `requireOrgMember` call. |
| `addOrgMember.ts` | `authorize(EPermAction.manage, EPermResource.org)` | `getUserRole()` for `canManageRole` check. Remove `checkPermission` call. |
| `removeOrgMember.ts` | `authorize(EPermAction.manage, EPermResource.org)` | `getUserRole()` for `canManageRole` check. Remove `checkPermission` call. |
| `updateMemberRole.ts` | `authorize(EPermAction.manage, EPermResource.org)` | `getUserRole()` for `canManageRole` check. Remove `checkPermission` call. |
| `updateOrgRole.ts` | `authorize(EPermAction.update, EPermResource.role)` | `getUserRole()` for `canManageRole` check. Remove `checkPermission` call. |

- [ ] **Step 3: Fix listOrgs.ts super admin detection**

`listOrgs.ts` calls `getUserRole(req, {})` with empty context to detect super admins. Replace with direct check on the user's platform-level role:

```typescript
const isSuper = isSuperAdmin((req.user?.role ?? ``) as ERoleType)
```

Remove the `getUserRole` import. Do NOT add `authorize()` middleware — this endpoint is context-free (lists all orgs the user belongs to).

- [ ] **Step 4: Verify types compile**

Run: `cd repos/backend && pnpm types`

---

## Task 5: Backend — Migrate project endpoints

**Files:**
- Modify: `repos/backend/src/endpoints/projects/createProject.ts`
- Modify: `repos/backend/src/endpoints/projects/updateProject.ts`
- Modify: `repos/backend/src/endpoints/projects/deleteProject.ts`
- Modify: `repos/backend/src/endpoints/projects/getProject.ts`
- Modify: `repos/backend/src/endpoints/projects/listProjectMembers.ts`
- Modify: `repos/backend/src/endpoints/projects/addProjectMember.ts`
- Modify: `repos/backend/src/endpoints/projects/removeProjectMember.ts`
- Modify: `repos/backend/src/endpoints/projects/updateProjectMemberRole.ts`

- [ ] **Step 1: Migrate simple project endpoints**

| File | Middleware | Remove |
|------|-----------|--------|
| `createProject.ts` | `authorize(EPermAction.create, EPermResource.project)` | `checkPermission` call |
| `updateProject.ts` | `authorize(EPermAction.update, EPermResource.project)` | `checkPermission` call |
| `deleteProject.ts` | `authorize(EPermAction.delete, EPermResource.project)` | `checkPermission` call |
| `getProject.ts` | `authorize(EPermAction.read, EPermResource.project)` | `requireOrgMember` call |
| `listProjectMembers.ts` | `authorize(EPermAction.read, EPermResource.role)` | `requireOrgMember` call |

- [ ] **Step 2: Migrate complex project endpoints**

| File | Middleware | Keep in handler |
|------|-----------|----------------|
| `addProjectMember.ts` | `authorize(EPermAction.manage, EPermResource.project)` | `getUserRole()` for canManageRole. Remove `checkPermission`. |
| `removeProjectMember.ts` | `authorize(EPermAction.manage, EPermResource.project)` | `getUserRole()` for canManageRole. Remove `checkPermission`. |
| `updateProjectMemberRole.ts` | `authorize(EPermAction.manage, EPermResource.project)` | `getUserRole()` for canManageRole. Remove `checkPermission`. |

- [ ] **Step 3: Verify types compile**

Run: `cd repos/backend && pnpm types`

---

## Task 6: Backend — Migrate sandbox endpoints with exec action

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/createSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/updateSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/deleteSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/getSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/listSandboxes.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/copySandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/connectSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/startSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/stopSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/execInSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/getSandboxStatus.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/listSessions.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/listSandboxThreads.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/sandboxProjectConfig.ts`

- [ ] **Step 1: Migrate simple sandbox CRUD endpoints**

| File | Middleware | Remove |
|------|-----------|--------|
| `createSandbox.ts` | `authorize(EPermAction.create, EPermResource.sandbox)` | `checkPermission` call |
| `getSandbox.ts` | `authorize(EPermAction.read, EPermResource.sandbox)` | `requireResourceWithPermission` → use `requireResource` |
| `updateSandbox.ts` | `authorize(EPermAction.update, EPermResource.sandbox)` | `requireResourceWithPermission` → use `requireResource` |
| `deleteSandbox.ts` | `authorize(EPermAction.delete, EPermResource.sandbox)` | `requireResourceWithPermission` → use `requireResource` |
| `getSandboxStatus.ts` | `authorize(EPermAction.read, EPermResource.sandbox)` | `requireResourceWithPermission` → use `requireResource` |
| `listSessions.ts` | `authorize(EPermAction.read, EPermResource.sandbox)` | `requireResourceWithPermission` → use `requireResource` |
| `listSandboxThreads.ts` | `authorize(EPermAction.read, EPermResource.thread)` | `checkPermission` call |

For files using `requireResourceWithPermission`, replace with `requireResource` from the simplified module:

```typescript
import { requireResource } from '@TBE/utils/auth/requireResource'
// ...
const sandbox = await requireResource(db.services.sandbox, id, `Sandbox`)
```

- [ ] **Step 2: Migrate exec-action sandbox endpoints**

These endpoints change from `read`/`update`/`create`/`delete` to `exec`:

| File | Middleware | Remove |
|------|-----------|--------|
| `connectSandbox.ts` | `authorize(EPermAction.exec, EPermResource.sandbox)` | `requireResourceWithPermission` → use `requireResource` |
| `startSandbox.ts` | `authorize(EPermAction.exec, EPermResource.sandbox)` | `requireResourceWithPermission` → use `requireResource` |
| `stopSandbox.ts` | `authorize(EPermAction.exec, EPermResource.sandbox)` | `requireResourceWithPermission` → use `requireResource` |
| `execInSandbox.ts` | `authorize(EPermAction.exec, EPermResource.sandbox)` | `requireResourceWithPermission` → use `requireResource` |

- [ ] **Step 3: Migrate complex sandbox endpoints**

| File | Middleware | Keep in handler |
|------|-----------|----------------|
| `listSandboxes.ts` | `authorize(EPermAction.read, EPermResource.sandbox)` | `getUserRole()` for admin filtering. Remove `checkPermission`. |
| `copySandbox.ts` | `authorize(EPermAction.create, EPermResource.sandbox)` | `getUserRole()` for project association filtering. Remove `checkPermission`. |

- [ ] **Step 4: Migrate sandboxProjectConfig.ts**

This file exports 3 endpoint configs. Each gets its own middleware:

| Endpoint | Middleware |
|----------|-----------|
| `getSandboxProjectConfig` | `authorize(EPermAction.read, EPermResource.sandbox)` |
| `upsertSandboxProjectConfig` | `authorize(EPermAction.update, EPermResource.sandbox)` |
| `deleteSandboxProjectConfig` | `authorize(EPermAction.update, EPermResource.sandbox)` |

Each still needs to fetch the sandbox to get orgId for the handler logic, but the `checkPermission` calls inside each handler are removed.

- [ ] **Step 5: Verify types compile**

Run: `cd repos/backend && pnpm types`

---

## Task 7: Backend — Migrate remaining resource endpoints

**Files:** All endpoint handlers in agents/, threads/, secrets/, endpoints/, functions/, domains/, assets/, skills/, schedules/, apiKeys/, invitations/, quotas/, users/, ai/

- [ ] **Step 1: Migrate agent endpoints**

| File | Middleware | Notes |
|------|-----------|-------|
| `createAgent.ts` | `authorize(EPermAction.create, EPermResource.agent)` | Remove `checkPermission` |
| `updateAgent.ts` | `authorize(EPermAction.update, EPermResource.agent)` | Remove `checkPermission` |
| `deleteAgent.ts` | `authorize(EPermAction.delete, EPermResource.agent)` | Remove `checkPermission` |
| `getAgent.ts` | `authorize(EPermAction.read, EPermResource.agent)` | Keep `getUserRole` for response enrichment. Remove `checkPermission`. |
| `listAgents.ts` | `authorize(EPermAction.read, EPermResource.agent)` | Keep `getUserRole` for project filtering. Remove `checkPermission`. |
| `agentProjectConfig.ts` | `authorize(read/update, agent)` per sub-endpoint | Remove inline `checkPermission` calls |
| `oaiModels.ts` | `authorize(EPermAction.read, EPermResource.agent)` | Remove `checkPermission` |
| `oaiChatCompletions.ts` | `authorize(EPermAction.read, EPermResource.agent)` | Remove `checkPermission` |

- [ ] **Step 2: Migrate thread/message endpoints**

| File | Middleware |
|------|-----------|
| `createThread.ts` | `authorize(EPermAction.create, EPermResource.thread)` |
| `getThread.ts` | `authorize(EPermAction.read, EPermResource.thread)` |
| `updateThread.ts` | `authorize(EPermAction.update, EPermResource.thread)` |
| `deleteThread.ts` | `authorize(EPermAction.delete, EPermResource.thread)` |
| `listThreads.ts` | `authorize(EPermAction.read, EPermResource.thread)` |
| `branchThread.ts` | `authorize(EPermAction.create, EPermResource.thread)` |
| `createMessage.ts` | `authorize(EPermAction.create, EPermResource.message)` |
| `listMessages.ts` | `authorize(EPermAction.read, EPermResource.message)` |
| `updateMessage.ts` | `authorize(EPermAction.update, EPermResource.message)` |
| `deleteMessage.ts` | `authorize(EPermAction.delete, EPermResource.message)` |
| `uploadFile.ts` | `authorize(EPermAction.create, EPermResource.asset)` |

All remove their inline `checkPermission` call.

- [ ] **Step 3: Migrate secret endpoints**

| File | Middleware | Notes |
|------|-----------|-------|
| `createSecret.ts` | `authorize(EPermAction.create, EPermResource.secret)` | Complex — keep handler logic for scope determination |
| `updateSecret.ts` | `authorize(EPermAction.update, EPermResource.secret)` | Remove `checkPermission` |
| `deleteSecret.ts` | `authorize(EPermAction.delete, EPermResource.secret)` | Remove `checkPermission` |
| `getSecret.ts` | `authorize(EPermAction.read, EPermResource.secret)` | Keep `getUserRole` for value stripping. Remove `checkPermission`. |
| `listSecrets.ts` | `authorize(EPermAction.read, EPermResource.secret)` | Keep `getUserRole` for value stripping. Remove `checkPermission`. |

- [ ] **Step 4: Migrate endpoint/function/domain endpoints**

Apply the same pattern. Files using `requireResourceWithPermission` switch to `requireResource`:

| File group | Pattern |
|-----------|---------|
| `endpoints/*.ts` (5 files) | `create/read/update/delete` on `EPermResource.endpoint` |
| `functions/*.ts` (5 files) | `create/read/update/delete` on `EPermResource.function` |
| `domains/*.ts` (5 files) | `create/read/update/delete` on `EPermResource.domain` |

- [ ] **Step 5: Migrate asset, skill, schedule, provider endpoints**

| File group | Pattern |
|-----------|---------|
| `assets/*.ts` (5 files) | `create/read/update/delete` on `EPermResource.asset` |
| `skills/*.ts` (7 files incl. attach/detach) | `create/read/update/delete` on `EPermResource.skill` (attach/detach use `update` on `agent`) |
| `schedules/*.ts` (6 files incl. trigger) | `create/read/update/delete` on `EPermResource.schedule` |
| `providers/*.ts` (5 files) | `create/read/update/delete` on `EPermResource.provider`. Files using `requireResourceWithPermission` switch to `requireResource`. |

- [ ] **Step 6: Migrate API key, invitation, quota, user endpoints**

| File | Middleware | Notes |
|------|-----------|-------|
| `createApiKey.ts` | `authorize(EPermAction.create, EPermResource.apiKey)` | Complex — keep `getUserRole` for scope validation |
| `getApiKey.ts` | `authorize(EPermAction.read, EPermResource.apiKey)` | `requireResourceWithPermission` → `requireResource` |
| `updateApiKey.ts` | `authorize(EPermAction.update, EPermResource.apiKey)` | `requireResourceWithPermission` → `requireResource` |
| `deleteApiKey.ts` | `authorize(EPermAction.delete, EPermResource.apiKey)` | `requireResourceWithPermission` → `requireResource` |
| `listApiKeys.ts` | `authorize(EPermAction.read, EPermResource.apiKey)` | Complex — keep branching logic |
| `listInvitations.ts` | `authorize(EPermAction.read, EPermResource.role)` | Remove `checkPermission` |
| `revokeInvitation.ts` | `authorize(EPermAction.delete, EPermResource.role)` | Remove `checkPermission` |
| `getOrgQuota.ts` | `authorize(EPermAction.read, EPermResource.quota)` | Remove `requireOrgMember` |
| `getOrgLimits.ts` | `authorize(EPermAction.read, EPermResource.quota)` | Remove `requireOrgMember` |
| `checkQuota.ts` | `authorize(EPermAction.read, EPermResource.quota)` | Remove `requireOrgMember` |
| `createUser.ts` | `authorize(EPermAction.create, EPermResource.user)` | Remove `checkPermission` |
| `updateUser.ts` | `authorize(EPermAction.update, EPermResource.user)` | Remove `checkPermission` |
| `deleteUser.ts` | `authorize(EPermAction.delete, EPermResource.user)` | Remove `checkPermission` |
| `listUsers.ts` | `authorize(EPermAction.read, EPermResource.user)` | Remove `requireOrgMember`. Keep `getUserRole` for super admin logic if still needed; otherwise replace with `isSuperAdmin(req.user?.role)`. |

`ai/createSession.ts`: `authorize(EPermAction.read, EPermResource.agent)` — remove `checkPermission`.

- [ ] **Step 7: Verify types compile and tests pass**

Run: `cd repos/backend && pnpm types && pnpm test`
Expected: Types clean. Some tests may fail if they mock `checkPermission` or `requireOrgMember` — update those mocks. Tests that mock `checkPermission` can often be simplified since the handler no longer calls it (the middleware is not invoked in unit tests).

---

## Task 8: Backend — Wire subscription endpoints to permission matrix

**Files:**
- Modify: `repos/backend/src/endpoints/subscriptions/getCurrentSubscription.ts`
- Modify: `repos/backend/src/endpoints/subscriptions/getInvoices.ts`
- Modify: `repos/backend/src/endpoints/subscriptions/createCheckout.ts`
- Modify: `repos/backend/src/endpoints/subscriptions/updateSubscription.ts`
- Modify: `repos/backend/src/endpoints/subscriptions/cancelSubscription.ts`
- Modify: `repos/backend/src/endpoints/subscriptions/createPortalSession.ts`

- [ ] **Step 1: Add authorize middleware to each subscription endpoint**

| File | Middleware |
|------|-----------|
| `getCurrentSubscription.ts` | `authorize(EPermAction.read, EPermResource.subscription)` |
| `getInvoices.ts` | `authorize(EPermAction.read, EPermResource.subscription)` |
| `createCheckout.ts` | `authorize(EPermAction.create, EPermResource.subscription)` |
| `updateSubscription.ts` | `authorize(EPermAction.update, EPermResource.subscription)` |
| `cancelSubscription.ts` | `authorize(EPermAction.delete, EPermResource.subscription)` |
| `createPortalSession.ts` | `authorize(EPermAction.manage, EPermResource.subscription)` |

Each handler currently uses `req.user?.id` to find the subscription. The `authorize()` middleware needs an `orgId` for context — it will be extracted from auth headers (for API key auth) or query params (for JWT auth).

For handlers that find the subscription by `userId`, update them to accept `orgId` and look up the org owner's subscription:

```typescript
const auth = fromAuthHeaders(req)
const orgId = auth.orgId || (req.query?.orgId as string)
if (!orgId) throw new Exception(400, `Organization ID required`)

const { data: org } = await db.services.org.get(orgId)
if (!org) throw new Exception(404, `Organization not found`)

const { data: subscription } = await db.services.subscription.findByUser(org.ownerId)
```

`getPlans.ts` stays unchanged (no middleware — public endpoint).

- [ ] **Step 2: Verify types compile**

Run: `cd repos/backend && pnpm types`

---

## Task 9: Backend — Shell WebSocket permission normalization

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`

- [ ] **Step 1: Add exec permission check after authentication**

After step 3 (auth) where `orgId` and `userId` are determined, add the permission check. Since `onShellConnect` receives `IncomingMessage` (not Express `TRequest`), construct the check using `db` and `canPerform` directly:

```typescript
// After orgId and userId are determined (after auth, before pod lookup):
const { data: userOrgRole } = await db.services.role.getOrgRole(userId, orgId)
const effectiveRole = userOrgRole?.type as ERoleType | null ?? null
const permResult = canPerform(effectiveRole, EPermAction.exec, EPermResource.sandbox)
if (!permResult.allowed) {
  ws.close(4003, permResult.reason || `Permission denied`)
  return
}
```

Add imports:
```typescript
import { canPerform, EPermAction, EPermResource } from '@tdsk/domain'
import type { ERoleType } from '@tdsk/domain'
```

- [ ] **Step 2: Remove pod-ownership restriction for new session creation**

Remove the check at current step 7 that blocks non-pod-owners:

```typescript
// DELETE this block:
if (podOwnerUserId !== userId) {
  ws.close(4003, `Cannot create sessions on a pod you did not start`)
  return
}
```

Keep `validatePodOwnership(podName, orgId)` — that validates the pod belongs to the org.

- [ ] **Step 3: Update cross-user join to use exec permission**

Replace the org-membership check in the cross-user join section:

Before:
```typescript
const { data: userRole, error: roleErr } = await db.services.role.getOrgRole(userId, orgId)
if (!userRole) {
  ws.close(4003, `Not authorized to join this session`)
  return
}
```

After:
```typescript
const { data: joinUserRole } = await db.services.role.getOrgRole(userId, orgId)
const joinRole = (joinUserRole?.type as ERoleType | null) ?? null
const joinPermResult = canPerform(joinRole, EPermAction.exec, EPermResource.sandbox)
if (!joinPermResult.allowed) {
  ws.close(4003, `Not authorized to join this session`)
  return
}
```

Keep the `visibility !== ESandboxSessionVisibility.public` check before this.

- [ ] **Step 4: Verify types compile**

Run: `cd repos/backend && pnpm types`

---

## Task 10: Shared Components — Permission hooks and components

**Files:**
- Create: `repos/components/src/hooks/permissions/usePermissions.ts`
- Create: `repos/components/src/hooks/permissions/useCanPerform.ts`
- Create: `repos/components/src/hooks/permissions/index.ts`
- Create: `repos/components/src/components/Permissions/PermissionsProvider.tsx`
- Create: `repos/components/src/components/Permissions/PermissionGate.tsx`
- Create: `repos/components/src/components/Permissions/index.ts`
- Modify: `repos/components/src/hooks/index.ts`
- Modify: `repos/components/src/components/index.ts`

- [ ] **Step 1: Create PermissionsProvider context**

Create `repos/components/src/components/Permissions/PermissionsProvider.tsx`:

```typescript
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { ERoleType } from '@tdsk/domain'

type TPermissionsContext = {
  role: ERoleType | null
}

const PermissionsContext = createContext<TPermissionsContext>({ role: null })

export const usePermissionsContext = () => useContext(PermissionsContext)

type TPermissionsProviderProps = {
  role: ERoleType | null
  children: ReactNode
}

export const PermissionsProvider = ({ role, children }: TPermissionsProviderProps) => {
  const value = useMemo(() => ({ role }), [role])
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}
```

- [ ] **Step 2: Create shared usePermissions hook**

Create `repos/components/src/hooks/permissions/usePermissions.ts`:

```typescript
import { useMemo } from 'react'
import type { ERoleType, EPermResource } from '@tdsk/domain'
import {
  canPerform,
  hasMinRole,
  isSuperAdmin,
  canManageRole,
  canAccessSecretValue,
  EPermAction,
  EPermResource as EPR,
} from '@tdsk/domain'

export type TUsePermissions = {
  role: ERoleType | null

  isSuper: boolean
  isOwner: boolean
  isAdmin: boolean
  isMember: boolean
  isViewer: boolean

  canCreate: (resource: EPermResource) => boolean
  canRead: (resource: EPermResource) => boolean
  canUpdate: (resource: EPermResource) => boolean
  canDelete: (resource: EPermResource) => boolean
  canManage: (resource: EPermResource) => boolean
  canExec: (resource: EPermResource) => boolean

  canAccessSecretValues: boolean
  canManageMembers: boolean
  canManageApiKeys: boolean
  canDeleteOrg: boolean
  canInviteUsers: boolean

  canAssignRole: (targetRole: ERoleType) => boolean
}

export const usePermissions = (role: ERoleType | null): TUsePermissions => {
  return useMemo((): TUsePermissions => {
    const check = (action: EPermAction, resource: EPermResource) =>
      canPerform(role, action, resource).allowed

    return {
      role,

      isSuper: isSuperAdmin(role),
      isOwner: hasMinRole(role, `owner` as ERoleType),
      isAdmin: hasMinRole(role, `admin` as ERoleType),
      isMember: hasMinRole(role, `member` as ERoleType),
      isViewer: hasMinRole(role, `viewer` as ERoleType),

      canCreate: (resource) => check(EPermAction.create, resource),
      canRead: (resource) => check(EPermAction.read, resource),
      canUpdate: (resource) => check(EPermAction.update, resource),
      canDelete: (resource) => check(EPermAction.delete, resource),
      canManage: (resource) => check(EPermAction.manage, resource),
      canExec: (resource) => check(EPermAction.exec, resource),

      canAccessSecretValues: canAccessSecretValue(role),
      canManageMembers: check(EPermAction.manage, EPR.org),
      canManageApiKeys: check(EPermAction.create, EPR.apiKey),
      canDeleteOrg: check(EPermAction.delete, EPR.org),
      canInviteUsers: check(EPermAction.create, EPR.user),

      canAssignRole: (targetRole) => canManageRole(role, targetRole),
    }
  }, [role])
}
```

- [ ] **Step 3: Create shared useCanPerform hook**

Create `repos/components/src/hooks/permissions/useCanPerform.ts`:

```typescript
import { useMemo } from 'react'
import type { EPermAction, EPermResource, ERoleType } from '@tdsk/domain'
import { canPerform } from '@tdsk/domain'

export const useCanPerform = (
  role: ERoleType | null,
  action: EPermAction,
  resource: EPermResource
): boolean => {
  return useMemo(() => canPerform(role, action, resource).allowed, [role, action, resource])
}
```

- [ ] **Step 4: Create PermissionGate component**

Create `repos/components/src/components/Permissions/PermissionGate.tsx`:

```typescript
import type { ReactNode } from 'react'
import type { EPermAction, EPermResource, ERoleType } from '@tdsk/domain'

import { hasMinRole, canPerform } from '@tdsk/domain'
import { usePermissionsContext } from './PermissionsProvider'
import { usePermissions } from '../../hooks/permissions/usePermissions'
import type { TUsePermissions } from '../../hooks/permissions/usePermissions'

type TPermissionGateProps = {
  children: ReactNode
  fallback?: ReactNode
} & (
  | { action: EPermAction; resource: EPermResource }
  | { minRole: ERoleType }
  | { check: keyof TUsePermissions }
)

export const PermissionGate = (props: TPermissionGateProps) => {
  const { children, fallback = null } = props
  const { role } = usePermissionsContext()
  const permissions = usePermissions(role)

  const hasPermission = (() => {
    if (`action` in props && `resource` in props) {
      return canPerform(role, props.action, props.resource).allowed
    }
    if (`minRole` in props) {
      return hasMinRole(role, props.minRole)
    }
    if (`check` in props) {
      const value = permissions[props.check]
      return typeof value === `boolean` ? value : Boolean(value)
    }
    return false
  })()

  return hasPermission ? <>{children}</> : <>{fallback}</>
}
```

- [ ] **Step 5: Create barrel exports**

Create `repos/components/src/hooks/permissions/index.ts`:
```typescript
export * from './usePermissions'
export * from './useCanPerform'
```

Create `repos/components/src/components/Permissions/index.ts`:
```typescript
export * from './PermissionGate'
export * from './PermissionsProvider'
```

Update `repos/components/src/hooks/index.ts` — add:
```typescript
export * from './permissions'
```

Update `repos/components/src/components/index.ts` — add:
```typescript
export * from './Permissions'
```

- [ ] **Step 6: Verify types compile**

Run: `cd repos/components && pnpm types`

---

## Task 11: Admin UI — Replace local permission hooks with shared, fix gating

**Files:**
- Modify: `repos/admin/src/hooks/permissions/usePermissions.tsx`
- Delete contents of: `repos/admin/src/hooks/permissions/useCanPerform.tsx`
- Delete contents of: `repos/admin/src/components/Permissions/PermissionGate.tsx`
- Modify: `repos/admin/src/hooks/permissions/index.ts`
- Modify: `repos/admin/src/components/Permissions/index.ts`
- Modify: `repos/admin/src/components/Users/InviteUserDrawer.tsx`
- Modify: `repos/admin/src/components/Users/EditUserDrawer.tsx`
- Modify: `repos/admin/src/components/Users/Users.tsx`
- Modify: `repos/admin/src/actions/users/api/updateOrgRole.ts`
- Modify: `repos/admin/src/actions/users/api/inviteToOrg.ts`
- Modify: Admin app root component

- [ ] **Step 1: Replace usePermissions with thin wrapper**

Replace `repos/admin/src/hooks/permissions/usePermissions.tsx`:

```typescript
import { usePermissions as usePermissionsBase } from '@tdsk/components'
import type { TUsePermissions } from '@tdsk/components'
import { useUser, useActiveOrgRole } from '@TAF/state/selectors'
import { ERoleType } from '@tdsk/domain'

export type { TUsePermissions }

export const usePermissions = (): TUsePermissions => {
  const [user] = useUser()
  const [activeOrgRole] = useActiveOrgRole()

  const role: ERoleType | null =
    user?.role === `super` ? ERoleType.super : (activeOrgRole as ERoleType) || null

  return usePermissionsBase(role)
}
```

- [ ] **Step 2: Replace useCanPerform and PermissionGate with re-exports**

Replace `repos/admin/src/hooks/permissions/useCanPerform.tsx`:
```typescript
export { useCanPerform } from '@tdsk/components'
```

Replace `repos/admin/src/components/Permissions/PermissionGate.tsx`:
```typescript
export { PermissionGate } from '@tdsk/components'
```

- [ ] **Step 3: Add PermissionsProvider to admin app root**

Find the admin app root component and wrap with `PermissionsProvider`. The role comes from the admin's `usePermissions` hook, but the provider needs a raw role value. Add a small wrapper component:

```typescript
import { PermissionsProvider } from '@tdsk/components'
import { useUser, useActiveOrgRole } from '@TAF/state/selectors'
import { ERoleType } from '@tdsk/domain'

const AdminPermissionsProvider = ({ children }: { children: ReactNode }) => {
  const [user] = useUser()
  const [activeOrgRole] = useActiveOrgRole()
  const role: ERoleType | null =
    user?.role === `super` ? ERoleType.super : (activeOrgRole as ERoleType) || null

  return <PermissionsProvider role={role}>{children}</PermissionsProvider>
}
```

Wrap the app content with this provider.

- [ ] **Step 4: Fix InviteUserDrawer permission gating**

In `repos/admin/src/components/Users/InviteUserDrawer.tsx`, add permission check:

```typescript
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'

// Inside the component:
const { canInviteUsers } = usePermissions()

// Update the disabled logic:
const inviteDisabled = !canInvite || !canInviteUsers || loading || !email.trim()
```

Add a visual indicator when the user lacks permission (e.g., a tooltip on the disabled button explaining "Admin role required to invite users").

- [ ] **Step 5: Fix EditUserDrawer permission gating**

In `repos/admin/src/components/Users/EditUserDrawer.tsx`:

```typescript
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'

// Inside the component:
const { canManageMembers, canAssignRole } = usePermissions()

// Disable role selector:
<RoleSelect
  showAlert
  roleType={roleType}
  disabled={roleLoading || !canManageMembers}
  onChange={(e) => setRoleType(e.target.value as TRoleType)}
/>
```

- [ ] **Step 6: Normalize Users.tsx button gating**

In `repos/admin/src/components/Users/Users.tsx`:

```typescript
const { canManageMembers } = usePermissions()

// Edit button:
disabled={!canManageMembers}

// Delete button:
disabled={!canManageMembers || user.role === ERoleType.super || user.id === currentUser?.id}
```

- [ ] **Step 7: Remove TODO comments**

In `repos/admin/src/actions/users/api/updateOrgRole.ts`, remove the TODO comment about client-side UX (lines 11-12).

In `repos/admin/src/actions/users/api/inviteToOrg.ts`, remove the TODO comment about client-side UX (lines 8-9).

- [ ] **Step 8: Verify types compile and test**

Run: `cd repos/admin && pnpm types && pnpm test`

---

## Task 12: Threads SPA — Add permission awareness

**Files:**
- Create: `repos/threads/src/hooks/permissions/usePermissions.ts`
- Create: `repos/threads/src/hooks/permissions/index.ts`
- Modify: `repos/threads/src/hooks/index.ts`
- Modify: `repos/threads/src/state/` (org role storage)
- Modify: `repos/threads/src/index.tsx` (add PermissionsProvider)
- Modify: `repos/threads/src/pages/Session/Session.tsx`
- Modify: `repos/threads/src/pages/Sandbox/Sandbox.tsx`
- Modify: `repos/threads/src/components/Session/SessionCommands.tsx`

- [ ] **Step 1: Store org role from API response**

The backend's `listOrgs` endpoint already returns `userRole` on each org. The threads app needs to store it.

In the threads state, add a derived atom or modify the org selection logic to track the active org's role. Find where `orgsApi.list()` results are stored (in `repos/threads/src/actions/init.ts`) and ensure the `userRole` field is preserved.

Add a Jotai atom for the active org role in `repos/threads/src/state/` (e.g., in `app.ts` or a new `permissions.ts`):

```typescript
import { atom } from 'jotai'
import type { TRoleType } from '@tdsk/domain'

export const activeOrgRoleState = atom<TRoleType | null>(null)
```

Add accessors in `repos/threads/src/state/accessors.ts`:
```typescript
export const getActiveOrgRole = () => store.get(activeOrgRoleState)
export const setActiveOrgRole = (role: TRoleType | null) => store.set(activeOrgRoleState, role)
```

Add selector hook in `repos/threads/src/state/selectors.ts`:
```typescript
export const useActiveOrgRole = () => useAtom(activeOrgRoleState)
```

Update the org selection action (in `init.ts` or `selectOrg.ts`) to set the role when an org is selected:

```typescript
const selectedOrg = orgs.find(o => o.id === orgId)
setActiveOrgRole((selectedOrg as any)?.userRole ?? null)
```

- [ ] **Step 2: Create usePermissions wrapper for threads**

Create `repos/threads/src/hooks/permissions/usePermissions.ts`:

```typescript
import { usePermissions as usePermissionsBase } from '@tdsk/components'
import type { TUsePermissions } from '@tdsk/components'
import { ERoleType } from '@tdsk/domain'
import { useActiveOrgRole } from '@/state/selectors'

export type { TUsePermissions }

export const usePermissions = (): TUsePermissions => {
  const [activeOrgRole] = useActiveOrgRole()
  const role = (activeOrgRole as ERoleType) || null
  return usePermissionsBase(role)
}
```

Create `repos/threads/src/hooks/permissions/index.ts`:
```typescript
export * from './usePermissions'
```

Update `repos/threads/src/hooks/index.ts` to add:
```typescript
export * from './permissions'
```

- [ ] **Step 3: Add PermissionsProvider to threads root**

In `repos/threads/src/index.tsx`, add the provider inside the Jotai Provider, after AuthProvider:

```typescript
import { PermissionsProvider } from '@tdsk/components'
import { useActiveOrgRole } from '@/state/selectors'

// Create a wrapper component that reads the role from state:
const ThreadsPermissionsProvider = ({ children }: { children: ReactNode }) => {
  const [activeOrgRole] = useActiveOrgRole()
  const role = (activeOrgRole as ERoleType) || null
  return <PermissionsProvider role={role}>{children}</PermissionsProvider>
}
```

Place it in the provider stack:
```
<Jotai Provider>
  <AuthProvider>
    <ThreadsPermissionsProvider>
      <App />
    </ThreadsPermissionsProvider>
  </AuthProvider>
</Jotai Provider>
```

- [ ] **Step 4: Gate sandbox actions in Sandbox.tsx**

In `repos/threads/src/pages/Sandbox/Sandbox.tsx`:

```typescript
import { usePermissions } from '@/hooks/permissions'
import { EPermResource } from '@tdsk/domain'

// Inside the component:
const { canExec, canCreate } = usePermissions()
const canExecSandbox = canExec(EPermResource.sandbox)
const canCreateSandbox = canCreate(EPermResource.sandbox)
```

Gate UI elements:
- "New Session" / "Connect" buttons: only render if `canExecSandbox`
- "Create Sandbox" button (if present): only render if `canCreateSandbox`

- [ ] **Step 5: Gate session commands in SessionCommands.tsx**

In `repos/threads/src/components/Session/SessionCommands.tsx`:

Replace the `isOwner` pod-ownership check with exec permission check for action buttons:

```typescript
import { usePermissions } from '@/hooks/permissions'
import { EPermResource } from '@tdsk/domain'

const { canExec } = usePermissions()
const canExecSandbox = canExec(EPermResource.sandbox)
```

- Stop/restart/recreate buttons: gate with `canExecSandbox` (instead of `isOwner`)
- Visibility toggle: keep gated by `session.userId === user.id` (session-creator-only, not role-based)
- "Leave" button: always shown for non-creators

- [ ] **Step 6: Gate session page in Session.tsx**

In `repos/threads/src/pages/Session/Session.tsx`:

Replace the `isOwner` check (currently `session.podOwnerUserId === user.id`) with permission-based check for exec controls. Keep `isOwner` for session-creator-specific features (visibility toggle).

```typescript
const { canExec } = usePermissions()
const canExecSandbox = canExec(EPermResource.sandbox)
const isSessionCreator = !!session && !!user && session.userId === user.id
```

For shared sessions without exec permission: render terminal output as read-only (disable input forwarding).

- [ ] **Step 7: Visual treatment for view-only shared sessions**

In `repos/threads/src/components/Sidebar/NavSessionItem.tsx`, add visual distinction for shared sessions where the user lacks exec permission:

```typescript
import { usePermissions } from '@/hooks/permissions'
import { EPermResource } from '@tdsk/domain'

const { canExec } = usePermissions()
const canExecSandbox = canExec(EPermResource.sandbox)
```

For shared sessions without exec: add a visual indicator (e.g., muted styling, "view-only" label) so users know they can watch but not interact.

- [ ] **Step 8: Verify types compile**

Run: `cd repos/threads && pnpm types`

---

## Task 13: Backend — Update unit tests

**Files:**
- Modify: All test files that mock `checkPermission`, `requireOrgMember`, `requireResourceWithPermission`

- [ ] **Step 1: Find all test files with permission mocks**

Search for test files that mock the deleted functions:

```bash
cd repos/backend && grep -rl "checkPermission\|requireOrgMember\|requireProjectMember\|requireResourceWithPermission\|requireMinRole" src/ --include="*.test.ts"
```

- [ ] **Step 2: Update test mocks**

For each test file:

1. Tests that mock `checkPermission` — since the handler no longer calls it (middleware does), remove the mock. The handler's business logic can be tested directly without permission mocking.

2. Tests that mock `requireOrgMember` or `requireProjectMember` — remove these mocks entirely (functions deleted).

3. Tests that mock `requireResourceWithPermission` — update to mock `requireResource` (the simplified version) which just needs to return the resource data or throw 404.

4. Tests that import from `@TBE/middleware/authorize` — update to only reference `authorize` (other exports deleted).

- [ ] **Step 3: Run all backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass. Fix any failures.

---

## Task 14: Full build verification

- [ ] **Step 1: Run type checks across all repos**

Run from root: `pnpm types`

This checks types across all sub-repos including cross-repo dependencies.

- [ ] **Step 2: Run unit tests across all repos**

Run from root: `pnpm test`

- [ ] **Step 3: Build backend**

Run: `pnpm --filter @tdsk/backend build`
Expected: Clean build.

- [ ] **Step 4: Build admin**

Run: `pnpm --filter @tdsk/admin build`
Expected: Clean build.

- [ ] **Step 5: Build threads**

Run: `pnpm --filter @tdsk/threads build` (if build script exists)

- [ ] **Step 6: Update domain skill doc**

Update `.claude/skills/tdsk-domain/SKILL.md` to reflect:
- `EPermScope` removed
- `EPermAction.exec` added
- Permission utilities accept `null` role

---
