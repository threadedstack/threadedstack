# Project-Level API Keys Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend API keys to support project-level scoping, so a project-scoped key grants access only to that project's resources — not the entire org.

**Architecture:** The database schema already supports project-scoped keys (exclusive arc: orgId XOR projectId). The backend CRUD already accepts `projectId`. The main gaps are: (1) proxy doesn't attach project context to `req.user`, (2) backend doesn't enforce project-level access boundaries, (3) admin UI doesn't expose project-level key management. This is a "close the gaps" task, not a greenfield build.

**Tech Stack:** Express 5, Drizzle ORM, React/MUI, existing auth middleware

---

## Task 1: Proxy — Attach Project Context to req.user

**Files:**
- Modify: `repos/proxy/src/middleware/setupApiKeyAuth.ts`
- Test: `repos/proxy/src/middleware/setupApiKeyAuth.test.ts` (co-located, extend existing)

**Step 1: Read the current proxy middleware**

Read `repos/proxy/src/middleware/setupApiKeyAuth.ts` to understand the exact `req.user` shape.

**Step 2: Write failing test**

Add test for project-scoped key behavior:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('setupApiKeyAuth - project-scoped keys', () => {
  it('attaches projectId to req.user when key has projectId', async () => {
    // Mock DB to return a project-scoped key
    const mockKey = {
      id: 'key1',
      orgId: null,
      projectId: 'proj1',
      userId: 'user1',
      scopes: 'read',
      active: true,
      keyHash: 'hash1',
    }

    // Call middleware with Authorization: Bearer tdsk_...
    // Assert req.user includes projectId: 'proj1'
  })

  it('attaches orgId to req.user when key has orgId', async () => {
    const mockKey = {
      id: 'key1',
      orgId: 'org1',
      projectId: null,
      userId: 'user1',
      scopes: 'admin',
      active: true,
      keyHash: 'hash2',
    }

    // Assert req.user includes orgId: 'org1', projectId: undefined
  })
})
```

**Step 3: Run test to verify it fails**

Run: `cd repos/proxy && pnpm test -- src/middleware/setupApiKeyAuth.test.ts`
Expected: FAIL — `req.user` doesn't have `projectId` or `orgId`

**Step 4: Update proxy middleware**

In `repos/proxy/src/middleware/setupApiKeyAuth.ts`, update the `req.user` assignment:

Current code:
```typescript
req.user = {
  email: ``,
  userId: apiKey.userId,
  role: scopeToRole(apiKey.scopes),
}
```

Change to:
```typescript
req.user = {
  email: ``,
  userId: apiKey.userId,
  role: scopeToRole(apiKey.scopes),
  ...(apiKey.orgId && { orgId: apiKey.orgId }),
  ...(apiKey.projectId && { projectId: apiKey.projectId }),
  apiKeyId: apiKey.id,
}
```

**Step 5: Update the user type if needed**

Check `repos/proxy/src/types/` or `repos/domain/src/types/` for the `req.user` type definition. Add `orgId?: string`, `projectId?: string`, `apiKeyId?: string` fields.

**Step 6: Run tests to verify they pass**

Run: `cd repos/proxy && pnpm test`
Expected: PASS

**Step 7: Run type checks**

Run: `cd repos/proxy && pnpm types`
Expected: No type errors

**Step 8: Commit**

```
feat(proxy): attach orgId/projectId to req.user for API key auth
```

---

## Task 2: Domain — Extend Types for Project-Scoped Key Context

**Files:**
- Modify: `repos/domain/src/types/` (auth or user types)

**Step 1: Read current auth/user types**

Find where `req.user` type is defined. Check `repos/domain/src/types/auth.types.ts`, `repos/proxy/src/types/`, and `repos/backend/src/types/`.

**Step 2: Add project-scope fields to the user context type**

Add optional fields to the type used for `req.user`:
```typescript
// In the appropriate auth types file
export type TApiKeyContext = {
  apiKeyId: string
  orgId?: string
  projectId?: string
}
```

Extend the existing user type:
```typescript
// req.user shape
{
  userId: string
  email: string
  role: string
  orgId?: string      // Set when API key is org-scoped
  projectId?: string  // Set when API key is project-scoped
  apiKeyId?: string   // Set when authenticated via API key
}
```

**Step 3: Run type checks across repos**

Run: `pnpm types` (root — checks all repos)
Expected: No type errors

**Step 4: Commit**

```
feat(domain): add project-scope fields to auth user context type
```

---

## Task 3: Backend — Enforce Project-Level Access Boundaries

**Files:**
- Modify: `repos/backend/src/endpoints/apiKeys/createApiKey.ts`
- Modify: `repos/backend/src/endpoints/apiKeys/listApiKeys.ts`
- Modify: `repos/backend/src/utils/auth/validateApiKey.ts`
- Create or modify: `repos/backend/src/middleware/` (project access guard)
- Test: `repos/backend/src/endpoints/apiKeys/apiKeys.test.ts` (co-located, extend existing)

**Step 1: Read backend endpoint files**

Read `createApiKey.ts`, `listApiKeys.ts`, and the permission check utilities.

**Step 2: Write failing tests for project-level permission enforcement**

```typescript
describe('createApiKey - project-scoped', () => {
  it('allows org admin to create project-scoped key for any user', async () => {
    // Org admin creates key with projectId — should succeed
  })

  it('allows project member to create project-scoped key for themselves', async () => {
    // Project member creates key for self with scope <= their role
  })

  it('rejects project member creating key with admin scope when they are member role', async () => {
    // Member tries to create admin-scoped project key — should fail
  })

  it('rejects project member creating key for another user', async () => {
    // Member tries to create key for different userId — should fail
  })
})
```

**Step 3: Run tests to verify they fail**

Run: `cd repos/backend && pnpm test -- src/endpoints/apiKeys/apiKeys.test.ts`
Expected: FAIL — no permission enforcement exists

**Step 4: Add scope ceiling validation to createApiKey**

In `repos/backend/src/utils/auth/validateApiKey.ts`, add a function:
```typescript
/**
 * Validates that the requesting user can create a key with the given scope
 * for the target project. Enforces:
 * - Org admins can do anything
 * - Project members can only create keys for themselves
 * - Scope ceiling: member can't create admin-scoped key
 */
export const validateProjectKeyPermission = (params: {
  requesterRole: string        // The requester's role in the project
  requesterUserId: string      // Who is making the request
  targetUserId?: string        // Who the key is for
  requestedScopes: string      // Comma-separated scopes
  isOrgAdmin: boolean          // Whether requester is org admin+
}): { valid: boolean; error?: string } => {
  const { requesterRole, requesterUserId, targetUserId, requestedScopes, isOrgAdmin } = params

  // Org admins bypass all project-level restrictions
  if (isOrgAdmin) return { valid: true }

  // Non-admins can only create keys for themselves
  if (targetUserId && targetUserId !== requesterUserId) {
    return { valid: false, error: 'Project members can only create API keys for themselves' }
  }

  // Scope ceiling enforcement
  const scopeHierarchy = { read: 1, write: 2, admin: 3 }
  const roleToMaxScope = { viewer: 1, member: 2, admin: 3 }
  const maxAllowed = roleToMaxScope[requesterRole] || 1
  const requestedMax = Math.max(
    ...requestedScopes.split(',').map(s => scopeHierarchy[s.trim()] || 0)
  )

  if (requestedMax > maxAllowed) {
    return { valid: false, error: `Your project role (${requesterRole}) cannot create keys with scope exceeding your permissions` }
  }

  return { valid: true }
}
```

**Step 5: Wire validation into createApiKey endpoint**

In `repos/backend/src/endpoints/apiKeys/createApiKey.ts`, before creating the key:
```typescript
if (projectId) {
  const permCheck = validateProjectKeyPermission({
    requesterRole: /* lookup user's role in project */,
    requesterUserId: req.user.userId,
    targetUserId: userId,
    requestedScopes: scopes,
    isOrgAdmin: /* check if user is org admin+ */,
  })
  if (!permCheck.valid) {
    return res.status(403).json({ error: permCheck.error })
  }
}
```

**Step 6: Run tests to verify they pass**

Run: `cd repos/backend && pnpm test`
Expected: PASS

**Step 7: Run type checks**

Run: `cd repos/backend && pnpm types`
Expected: No type errors

**Step 8: Commit**

```
feat(backend): enforce project-level permission checks for API key creation
```

---

## Task 4: Backend — Project Access Guard Middleware

**Files:**
- Create: `repos/backend/src/middleware/projectAccessGuard.ts`
- Test: `repos/backend/src/middleware/projectAccessGuard.test.ts` (co-located)

**Step 1: Write failing test**

```typescript
describe('projectAccessGuard', () => {
  it('allows request when API key has no projectId (org-scoped)', async () => {
    // req.user.projectId is undefined — pass through
  })

  it('allows request when target projectId matches API key projectId', async () => {
    // req.user.projectId === req.params.projectId — pass through
  })

  it('rejects request when target projectId differs from API key projectId', async () => {
    // req.user.projectId !== req.params.projectId — 403
  })

  it('rejects project-scoped key accessing org-level resources', async () => {
    // req.user.projectId is set but route has no projectId param — 403
  })
})
```

**Step 2: Implement middleware**

```typescript
import type { Request, Response, NextFunction } from 'express'

/**
 * Middleware that enforces project-level access boundaries for project-scoped API keys.
 * Org-scoped keys pass through unrestricted.
 * Project-scoped keys can only access their specific project.
 */
export const projectAccessGuard = (req: Request, res: Response, next: NextFunction) => {
  const keyProjectId = req.user?.projectId

  // Org-scoped key or JWT auth — no project restriction
  if (!keyProjectId) return next()

  // Project-scoped key — check if the request targets the correct project
  const targetProjectId = req.params.projectId || req.body?.projectId || req.query?.projectId

  if (!targetProjectId) {
    // Project-scoped key trying to access org-level resource
    return res.status(403).json({ error: 'Project-scoped API key cannot access org-level resources' })
  }

  if (targetProjectId !== keyProjectId) {
    return res.status(403).json({ error: 'API key does not have access to this project' })
  }

  next()
}
```

**Step 3: Wire into relevant routes**

Add `projectAccessGuard` to backend route handlers that deal with project-scoped resources:
- Endpoints routes
- Functions routes
- Project secrets routes
- Project agents routes

**Step 4: Run tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS

**Step 5: Commit**

```
feat(backend): add projectAccessGuard middleware for project-scoped API keys
```

---

## Task 5: Database — Add Project-Scoped Query Methods

**Files:**
- Modify: `repos/database/src/services/apiKey.ts`
- Test: `repos/database/src/services/apiKey.test.ts` (co-located, create or extend)

**Step 1: Add getByProject query method**

```typescript
/**
 * List API keys scoped to a specific project
 */
async getByProject(projectId: string, filters?: { active?: boolean; userId?: string }) {
  const where: Record<string, any> = { projectId }
  if (filters?.active !== undefined) where.active = filters.active
  if (filters?.userId) where.userId = filters.userId

  return this.db.select().from(apiKeys).where(and(
    eq(apiKeys.projectId, projectId),
    ...(filters?.active !== undefined ? [eq(apiKeys.active, filters.active)] : []),
    ...(filters?.userId ? [eq(apiKeys.userId, filters.userId)] : []),
  ))
}
```

**Step 2: Run tests**

Run: `cd repos/database && pnpm test`
Expected: PASS

**Step 3: Commit**

```
feat(database): add project-scoped API key query methods
```

---

## Task 6: Admin UI — Project API Keys Page

**Files:**
- Create: `repos/admin/src/pages/Projects/ProjectApiKeys.tsx`
- Modify: `repos/admin/src/pages/Projects/` (routing)
- Modify: `repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx` (minor — pass projectId)

**Step 1: Read existing OrgApiKeys page for reference**

Read `repos/admin/src/pages/Orgs/OrgApiKeys.tsx` to understand the pattern.

**Step 2: Create ProjectApiKeys page**

Create `repos/admin/src/pages/Projects/ProjectApiKeys.tsx` following the same pattern as OrgApiKeys but:
- Uses `projectId` from route params
- Passes `projectId` to `CreateApiKeyDrawer`
- Filters listed keys by project
- Lists only project members in user selector
- Restricts scope options based on current user's project role

```tsx
import { useParams } from 'react-router-dom'
import { CreateApiKeyDrawer } from '@TAF/components/Orgs/CreateApiKeyDrawer'

export const ProjectApiKeys = () => {
  const { orgId, projectId } = useParams()
  // ... follow OrgApiKeys pattern but with projectId context

  return (
    <>
      {/* API key list table */}
      <CreateApiKeyDrawer
        orgId={orgId!}
        projectId={projectId}
        // Pass project members as users
        users={projectMembers}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={refetch}
      />
    </>
  )
}
```

**Step 3: Add route for project API keys**

In the project routing file, add:
```typescript
{ path: 'api-keys', element: <ProjectApiKeys /> }
```

**Step 4: Add project subnav entry**

In the project navigation config, add an "API Keys" nav item pointing to the new route.

**Step 5: Run admin build and type checks**

Run: `cd repos/admin && pnpm build && pnpm types`
Expected: Clean build, no type errors

**Step 6: Commit**

```
feat(admin): add ProjectApiKeys page with project-scoped key creation
```

---

## Task 7: Update CreateApiKeyDrawer for Role-Based Scope Restriction

**Files:**
- Modify: `repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx`

**Step 1: Read the current drawer code**

Read `repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx` to understand form fields.

**Step 2: Add scope restriction logic**

When `projectId` is set and user is not an org admin, disable scope options that exceed the user's project role:

```tsx
// New prop
type TCreateApiKeyDrawerProps = {
  // ... existing props
  maxScope?: 'read' | 'write' | 'admin'  // Restricts available scope checkboxes
}

// In the component:
const scopeOptions = [
  { value: 'read', label: 'Read', disabled: false },
  { value: 'write', label: 'Write', disabled: maxScope === 'read' },
  { value: 'admin', label: 'Admin', disabled: maxScope !== 'admin' },
]
```

**Step 3: Run admin tests and type checks**

Run: `cd repos/admin && pnpm test && pnpm types`
Expected: PASS

**Step 4: Commit**

```
feat(admin): restrict API key scope options based on user's project role
```

---

## Task 8: Integration Tests

**Files:**
- Create: `repos/integration/src/tier1/project-api-keys.test.ts`

**Step 1: Write API integration tests**

```typescript
import { describe, it, expect } from 'vitest'
import { loadEnvs, api } from '../utils'

describe('Project-scoped API keys', () => {
  it('creates a project-scoped API key', async () => {
    const res = await api.post('/_/api-keys', {
      name: 'test-project-key',
      projectId: env.testProjectId,
      scopes: 'read',
    })
    expect(res.status).toBe(200)
    expect(res.data.projectId).toBe(env.testProjectId)
    expect(res.data.orgId).toBeNull()
  })

  it('project-scoped key can access its project', async () => {
    // Use the project key to call a project-scoped endpoint
    // Should succeed
  })

  it('project-scoped key cannot access org-level resources', async () => {
    // Use the project key to call /_/orgs
    // Should get 403
  })

  it('project-scoped key cannot access other projects', async () => {
    // Use the project key to call endpoints for a different projectId
    // Should get 403
  })

  it('org-scoped key can still access project resources', async () => {
    // Use org key to access project endpoints
    // Should succeed (hierarchical access)
  })
})
```

**Step 2: Run integration tests**

Run: `cd repos/integration && pnpm test -- src/tier1/project-api-keys.test.ts`
Expected: PASS against live K8s

**Step 3: Commit**

```
test(integration): add project-scoped API key integration tests
```

---

## Task 9: Run Full Validation

**Step 1: Run all unit tests**

Run: `pnpm test` (root)
Expected: All repos pass

**Step 2: Run type checks**

Run: `pnpm types` (root)
Expected: No type errors

**Step 3: Run integration tests**

Run: `cd repos/integration && pnpm test`
Expected: All tier1 + tier3 tests pass

**Step 4: Run Playwright tests**

Run: `cd repos/integration && pnpm test:ui`
Expected: All tier2 tests pass (existing + new)
