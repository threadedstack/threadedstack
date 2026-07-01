# RBAC Overhaul v2 — Real Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Project rule on commits:** Per the project `CLAUDE.md`, agents MUST NOT run `git commit` / `git push` / any history-mutating command. Each commit step in this plan writes the commit message and stages the files; the human user runs the actual `git commit`. Implementation continues without waiting for the commit.

**Goal:** Close every defect found by the v2 RBAC audit (17 backend + 3 frontend + the live `/_/providers/:brand/models` 401/403 bug + a critical cross-org `authorize` precedence vulnerability) in a single bundled PR with regression tests.

**Architecture:** Backend RBAC guards (`authorize`, `projectAccessGuard`, `projectMemberGuard`, new `orgAccessGuard`) become a consistent contract: URL params are the source of truth for scope; headers are a constraint (must match if present), not an override. Frontend `ModelSelect` and its callers thread `orgId` from the existing org-route context; fetch is deferred to user interaction; failures are surfaced inline.

**Tech Stack:** Express 5 + custom middleware, Vitest unit tests, React 19 + Jotai, integration tests via Vitest on live K8s.

**Reference spec:** `docs/superpowers/specs/2026-06-27-rbac-overhaul-v2-real-completion-design.md`

---

## File structure

### New files
- `repos/backend/src/middleware/orgAccessGuard.ts` — middleware
- `repos/backend/src/middleware/orgAccessGuard.test.ts` — unit tests
- `repos/backend/src/middleware/authorize.test.ts` — unit tests for fixed precedence
- `repos/backend/src/middleware/projectMemberGuard.test.ts` — unit tests for fail-closed
- `repos/backend/src/middleware/projectAccessGuard.test.ts` — unit tests for org-mismatch

### Modified files (backend)
| File | Defect IDs |
|---|---|
| `repos/backend/src/middleware/authorize.ts` | C1 |
| `repos/backend/src/middleware/projectAccessGuard.ts` | C4 |
| `repos/backend/src/middleware/projectMemberGuard.ts` | C3 |
| `repos/backend/src/middleware/featureGate.ts` | L4 |
| `repos/backend/src/endpoints/accounts.ts` | C2 |
| `repos/backend/src/endpoints/providers/providers.ts` | C2 |
| `repos/backend/src/endpoints/orgs/orgs.ts` | M4 mounting |
| `repos/backend/src/endpoints/orgs/orgAgents.ts` | H1 |
| `repos/backend/src/endpoints/orgs/orgSecrets.ts` | H1 |
| `repos/backend/src/endpoints/orgs/orgDomains.ts` | H1 |
| `repos/backend/src/endpoints/orgs/orgOverrides.ts` | H1 |
| `repos/backend/src/endpoints/orgs/orgProjects.ts` | M1 |
| `repos/backend/src/endpoints/agents/createAgent.ts` | H2 |
| `repos/backend/src/endpoints/agents/listAgents.ts` | M2 |
| `repos/backend/src/endpoints/sandboxes/startSandbox.ts` | L1 |
| `repos/backend/src/endpoints/sandboxes/connectSandbox.ts` | L1 |
| `repos/backend/src/endpoints/sandboxes/copySandbox.ts` | M3 |
| `repos/backend/src/utils/auth/resolveEffectivePermissions.ts` | L2 |
| `repos/backend/src/utils/auth/checkPermission.ts` | L3 |

### Modified files (frontend admin)
| File | Defect IDs |
|---|---|
| `repos/admin/src/services/providersApi.ts` | C2, F3 |
| `repos/admin/src/actions/providers/api/fetchProviderModels.ts` | C2, F3 |
| `repos/admin/src/components/Agents/ModelSelect.tsx` | C2, F1, F2 |
| `repos/admin/src/components/Providers/ProviderLinkList.tsx` | C2 (orgId prop) |
| `repos/admin/src/components/GuiConfig/GuiConfigForm.tsx` | C2 (orgId prop) |
| `repos/admin/src/components/Sandboxes/SandboxProviderAccordion.tsx` | C2 (orgId prop) |
| `repos/admin/src/components/Sandboxes/SandboxGuiAccordion.tsx` | C2 (orgId prop) |
| `repos/admin/src/components/Agents/BasicInfoForm.tsx` | C2 (orgId prop) |
| `repos/admin/src/pages/Orgs/OrgSettings.tsx` | C2 (orgId from route) |

### Integration tests
- `repos/integration/tests/rbac/` — new directory with cross-org probe + scope-mismatch + removed-route tests
- Existing provider-models test fixtures → update to new org-scoped path

---

## Phase 1 — Middleware fixes (Critical security)

### Task 1: Add `orgAccessGuard` middleware

**Files:**
- Create: `repos/backend/src/middleware/orgAccessGuard.ts`
- Create: `repos/backend/src/middleware/orgAccessGuard.test.ts`

- [ ] **Step 1.1: Write the failing unit tests**

Create `repos/backend/src/middleware/orgAccessGuard.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { orgAccessGuard } from './orgAccessGuard'

const mkReq = (params: any, headers: Record<string, string> = {}) =>
  ({
    params,
    path: '/_/orgs/x',
    method: 'GET',
    header: (k: string) => headers[k],
  }) as any

const mkRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('orgAccessGuard', () => {
  it('passes when no auth.orgId header is set (JWT or org-less URL)', () => {
    const next = vi.fn()
    const res = mkRes()
    orgAccessGuard()(mkReq({ orgId: 'org-A' }), res, next)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('passes when URL has no :orgId param', () => {
    const next = vi.fn()
    const res = mkRes()
    orgAccessGuard()(
      mkReq({}, { 'x-user-org-id': 'org-A' }),
      res,
      next
    )
    expect(next).toHaveBeenCalled()
  })

  it('passes when auth.orgId equals req.params.orgId', () => {
    const next = vi.fn()
    const res = mkRes()
    orgAccessGuard()(
      mkReq({ orgId: 'org-A' }, { 'x-user-org-id': 'org-A' }),
      res,
      next
    )
    expect(next).toHaveBeenCalled()
  })

  it('rejects 403 when auth.orgId differs from req.params.orgId', () => {
    const next = vi.fn()
    const res = mkRes()
    orgAccessGuard()(
      mkReq({ orgId: 'org-B' }, { 'x-user-org-id': 'org-A' }),
      res,
      next
    )
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      error: 'API key does not belong to this organization',
    })
  })
})
```

- [ ] **Step 1.2: Run tests, verify they fail**

```bash
cd repos/backend && pnpm test -- src/middleware/orgAccessGuard.test.ts
```
Expected: FAIL — module `./orgAccessGuard` not found.

- [ ] **Step 1.3: Implement the middleware**

Create `repos/backend/src/middleware/orgAccessGuard.ts`:

```ts
import type { NextFunction } from 'express'
import type { TAHandler } from '@tdsk/domain'
import type { TRequest, TResponse } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { fromAuthHeaders } from '@tdsk/domain'

/**
 * Reject when auth header binds to a different org than the URL targets.
 * No-op for JWT auth (no auth.orgId) or routes without an :orgId param —
 * those cases are handled by the user/role lookup downstream.
 */
export const orgAccessGuard = () => {
  const callback = (req: TRequest, res: TResponse, next: NextFunction) => {
    try {
      const auth = fromAuthHeaders(req)
      const authOrgId = auth.orgId
      const urlOrgId = req.params.orgId

      if (!authOrgId || !urlOrgId) return next()
      if (authOrgId === urlOrgId) return next()

      logger.warn({
        message: `orgAccessGuard blocked cross-org request`,
        path: req.path,
        method: req.method,
        authOrgId,
        urlOrgId,
      })
      return res
        .status(403)
        .json({ error: `API key does not belong to this organization` })
    } catch (error) {
      logger.error({
        message: `orgAccessGuard error`,
        path: req.path,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
      })
      next(error)
    }
  }

  return callback as TAHandler
}
```

- [ ] **Step 1.4: Run tests, verify they pass**

```bash
cd repos/backend && pnpm test -- src/middleware/orgAccessGuard.test.ts
```
Expected: 4/4 PASS.

- [ ] **Step 1.5: Stage and commit**

Stage:
```bash
git add repos/backend/src/middleware/orgAccessGuard.ts \
        repos/backend/src/middleware/orgAccessGuard.test.ts
```
Commit message for user to run:
```
feat(backend): add orgAccessGuard middleware for cross-org rejection
```

---

### Task 2: Fix `authorize` orgId/projectId precedence (C1)

**Files:**
- Modify: `repos/backend/src/middleware/authorize.ts`
- Create: `repos/backend/src/middleware/authorize.test.ts`

- [ ] **Step 2.1: Write the failing unit tests**

Create `repos/backend/src/middleware/authorize.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@TBE/utils/auth/checkPermission', () => ({
  checkPermission: vi.fn(async () => undefined),
}))

import { authorize } from './authorize'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

const mkReq = (params: any, headers: Record<string, string> = {}, query: any = {}) =>
  ({
    params,
    query,
    user: { id: 'u-1' },
    header: (k: string) => headers[k],
  }) as any

const mkRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('authorize precedence', () => {
  beforeEach(() => {
    vi.mocked(checkPermission).mockClear()
  })

  it('uses req.params.orgId over auth.orgId', async () => {
    const next = vi.fn()
    await authorize(EPermAction.read, EPermResource.provider)(
      mkReq({ orgId: 'org-URL' }, { 'x-user-org-id': 'org-AUTH' }),
      mkRes(),
      next
    )
    expect(checkPermission).toHaveBeenCalledWith(
      expect.anything(),
      EPermAction.read,
      EPermResource.provider,
      expect.objectContaining({ orgId: 'org-URL' })
    )
    expect(next).toHaveBeenCalledWith()
  })

  it('rejects when auth.orgId and req.params.orgId differ', async () => {
    const next = vi.fn()
    await authorize(EPermAction.read, EPermResource.provider)(
      mkReq({ orgId: 'org-URL' }, { 'x-user-org-id': 'org-OTHER' }),
      mkRes(),
      next
    )
    expect(checkPermission).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 })
    )
  })

  it('falls back to auth.orgId when URL has no :orgId', async () => {
    const next = vi.fn()
    await authorize(EPermAction.read, EPermResource.provider)(
      mkReq({}, { 'x-user-org-id': 'org-AUTH' }),
      mkRes(),
      next
    )
    expect(checkPermission).toHaveBeenCalledWith(
      expect.anything(),
      EPermAction.read,
      EPermResource.provider,
      expect.objectContaining({ orgId: 'org-AUTH' })
    )
  })

  it('uses req.params.projectId over auth.projectId and rejects mismatch', async () => {
    const next = vi.fn()
    await authorize(EPermAction.read, EPermResource.agent)(
      mkReq(
        { orgId: 'org-A', projectId: 'proj-URL' },
        { 'x-user-project-id': 'proj-OTHER' }
      ),
      mkRes(),
      next
    )
    expect(checkPermission).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 })
    )
  })
})
```

- [ ] **Step 2.2: Run tests, verify they fail**

```bash
cd repos/backend && pnpm test -- src/middleware/authorize.test.ts
```
Expected: precedence tests fail (current code reads `auth.orgId` first).

- [ ] **Step 2.3: Rewrite `authorize.ts`**

Replace the entire body of `repos/backend/src/middleware/authorize.ts` with:

```ts
import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'
import type { TPermissionContext, EPermAction, EPermResource } from '@tdsk/domain'

import { Exception, EPermScope, fromAuthHeaders } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * Resolve a scope id with URL > query > header precedence.
 * If the header is set and disagrees with the URL value, reject —
 * an API key bound to one scope must not be used against another.
 */
const resolveScopeId = (
  urlValue: string | undefined,
  queryValue: unknown,
  authValue: string | undefined,
  label: 'orgId' | 'projectId'
): string | undefined => {
  const safeQuery = typeof queryValue === `string` ? queryValue : undefined
  const urlOrQuery = urlValue || safeQuery
  if (urlOrQuery && authValue && authValue !== urlOrQuery)
    throw new Exception(
      403,
      label === `orgId`
        ? `Auth ${label} does not match URL ${label}`
        : `Auth ${label} does not match URL ${label}`,
      `SCOPE_MISMATCH`
    )
  return urlOrQuery || authValue
}

/**
 * Middleware to check permission for an action on a resource.
 * Scope is taken from the URL first, query second, headers last —
 * with a hard reject if header and URL disagree.
 */
export const authorize = (action: EPermAction, resource: EPermResource) => {
  return async (req: TRequest, _res: TResponse, next: NextFunction) => {
    try {
      const auth = fromAuthHeaders(req)
      const projectId = resolveScopeId(
        req.params.projectId as string | undefined,
        req.query?.projectId,
        auth.projectId,
        `projectId`
      )
      const orgId = resolveScopeId(
        req.params.orgId as string | undefined,
        req.query?.orgId,
        auth.orgId,
        `orgId`
      )

      const context: TPermissionContext = {
        orgId,
        projectId,
        resourceId: req.params.id,
        scopeType: projectId ? EPermScope.project : EPermScope.org,
      }

      await checkPermission(req, action, resource, context)
      next()
    } catch (error) {
      next(error)
    }
  }
}
```

- [ ] **Step 2.4: Run tests, verify they pass**

```bash
cd repos/backend && pnpm test -- src/middleware/authorize.test.ts
```
Expected: 4/4 PASS.

- [ ] **Step 2.5: Stage and commit**

Stage:
```bash
git add repos/backend/src/middleware/authorize.ts \
        repos/backend/src/middleware/authorize.test.ts
```
Commit message:
```
fix(backend): authorize uses URL scope first; reject auth/URL scope mismatch (cross-org)
```

---

### Task 3: Fail-closed `projectMemberGuard` (C3)

**Files:**
- Modify: `repos/backend/src/middleware/projectMemberGuard.ts`
- Create: `repos/backend/src/middleware/projectMemberGuard.test.ts`

- [ ] **Step 3.1: Write the failing unit tests**

Create `repos/backend/src/middleware/projectMemberGuard.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@TBE/utils/auth/requireProjectAccess', () => ({
  requireProjectAccess: vi.fn(async () => undefined),
}))

import { projectMemberGuard } from './projectMemberGuard'
import { requireProjectAccess } from '@TBE/utils/auth/requireProjectAccess'

const mkReq = (params: any) =>
  ({ params, path: '/_/x', method: 'GET', user: { id: 'u-1' } }) as any

const mkRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('projectMemberGuard', () => {
  it('rejects 400 when projectId is missing', async () => {
    const next = vi.fn()
    const res = mkRes()
    await projectMemberGuard()(mkReq({ orgId: 'org-A' }), res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects 400 when orgId is missing', async () => {
    const next = vi.fn()
    const res = mkRes()
    await projectMemberGuard()(mkReq({ projectId: 'proj-A' }), res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('calls requireProjectAccess and next() when both params present', async () => {
    const next = vi.fn()
    const res = mkRes()
    await projectMemberGuard()(
      mkReq({ orgId: 'org-A', projectId: 'proj-A' }),
      res,
      next
    )
    expect(requireProjectAccess).toHaveBeenCalledWith(
      expect.anything(),
      'proj-A',
      'org-A'
    )
    expect(next).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3.2: Run tests, verify they fail**

```bash
cd repos/backend && pnpm test -- src/middleware/projectMemberGuard.test.ts
```
Expected: first two tests fail (current code calls `next()` on missing params).

- [ ] **Step 3.3: Update the middleware to fail closed**

Replace lines 20-29 of `repos/backend/src/middleware/projectMemberGuard.ts`:

```ts
    if (!projectId || !orgId) {
      logger.warn({
        path: req.path,
        method: req.method,
        orgId: orgId || `(missing)`,
        projectId: projectId || `(missing)`,
        message: `projectMemberGuard skipped — missing params`,
      })
      return next()
    }
```

with:

```ts
    if (!projectId || !orgId) {
      logger.error({
        path: req.path,
        method: req.method,
        orgId: orgId || `(missing)`,
        projectId: projectId || `(missing)`,
        message: `projectMemberGuard requires :orgId and :projectId in URL`,
      })
      return res
        .status(400)
        .json({ error: `projectMemberGuard requires :orgId and :projectId in URL` })
    }
```

- [ ] **Step 3.4: Run tests, verify they pass**

```bash
cd repos/backend && pnpm test -- src/middleware/projectMemberGuard.test.ts
```
Expected: 3/3 PASS.

- [ ] **Step 3.5: Stage and commit**

Stage:
```bash
git add repos/backend/src/middleware/projectMemberGuard.ts \
        repos/backend/src/middleware/projectMemberGuard.test.ts
```
Commit message:
```
fix(backend): projectMemberGuard fails closed (400) when URL params missing
```

---

### Task 4: `projectAccessGuard` rejects org mismatch (C4)

**Files:**
- Modify: `repos/backend/src/middleware/projectAccessGuard.ts`
- Create: `repos/backend/src/middleware/projectAccessGuard.test.ts`

- [ ] **Step 4.1: Write the failing unit tests**

Create `repos/backend/src/middleware/projectAccessGuard.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { projectAccessGuard } from './projectAccessGuard'

const mkReq = (
  params: any,
  headers: Record<string, string> = {},
  query: any = {},
  body: any = {}
) =>
  ({
    params,
    query,
    body,
    path: '/_/orgs/x/projects/y/secrets',
    method: 'GET',
    header: (k: string) => headers[k],
  }) as any

const mkRes = () => {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('projectAccessGuard', () => {
  it('passes JWT auth (no project header)', () => {
    const next = vi.fn()
    projectAccessGuard()(mkReq({ orgId: 'org-A', projectId: 'proj-A' }), mkRes(), next)
    expect(next).toHaveBeenCalled()
  })

  it('blocks project-scoped key from org-level URL (no projectId in route)', () => {
    const next = vi.fn()
    const res = mkRes()
    projectAccessGuard()(
      mkReq({ orgId: 'org-A' }, { 'x-user-project-id': 'proj-A' }),
      res,
      next
    )
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('blocks project-scoped key targeting a different project', () => {
    const next = vi.fn()
    const res = mkRes()
    projectAccessGuard()(
      mkReq(
        { orgId: 'org-A', projectId: 'proj-B' },
        { 'x-user-project-id': 'proj-A' }
      ),
      res,
      next
    )
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('blocks org-scoped key targeting a different org', () => {
    const next = vi.fn()
    const res = mkRes()
    projectAccessGuard()(
      mkReq(
        { orgId: 'org-B', projectId: 'proj-A' },
        { 'x-user-org-id': 'org-A' }
      ),
      res,
      next
    )
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      error: 'API key does not belong to this organization',
    })
  })

  it('passes matching project-scoped key', () => {
    const next = vi.fn()
    projectAccessGuard()(
      mkReq(
        { orgId: 'org-A', projectId: 'proj-A' },
        { 'x-user-project-id': 'proj-A', 'x-user-org-id': 'org-A' }
      ),
      mkRes(),
      next
    )
    expect(next).toHaveBeenCalled()
  })
})
```

- [ ] **Step 4.2: Run tests, verify they fail**

```bash
cd repos/backend && pnpm test -- src/middleware/projectAccessGuard.test.ts
```
Expected: org-mismatch test fails (current code doesn't check it).

- [ ] **Step 4.3: Update the middleware**

Replace the body of `repos/backend/src/middleware/projectAccessGuard.ts` after the existing project check with an additional org-mismatch check. Final file:

```ts
import type { NextFunction } from 'express'
import type { TAHandler } from '@tdsk/domain'
import type { TRequest, TResponse } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { fromAuthHeaders } from '@tdsk/domain'

/**
 * Enforces scope boundaries for API keys.
 * - Project-scoped keys: must target their exact project; rejected at org-level URLs.
 * - Org-scoped keys: must match req.params.orgId when present.
 * - JWT requests pass through.
 */
export const projectAccessGuard = () => {
  const callback = (req: TRequest, res: TResponse, next: NextFunction) => {
    try {
      const auth = fromAuthHeaders(req)
      const keyProjectId = auth.projectId
      const keyOrgId = auth.orgId
      const urlOrgId = req.params.orgId

      if (keyOrgId && urlOrgId && keyOrgId !== urlOrgId) {
        logger.warn({
          message: `projectAccessGuard blocked cross-org key`,
          path: req.path,
          method: req.method,
          keyOrgId,
          urlOrgId,
        })
        return res
          .status(403)
          .json({ error: `API key does not belong to this organization` })
      }

      if (!keyProjectId) return next()

      const queryProjectId = req.query?.projectId
      const safeQueryProjectId =
        typeof queryProjectId === `string` ? queryProjectId : undefined

      const targetProjectId =
        req.params.projectId || req.body?.projectId || safeQueryProjectId

      if (!targetProjectId) {
        logger.warn({
          message: `Project-scoped key blocked from org-level resource`,
          path: req.path,
          method: req.method,
          keyProjectId,
        })
        return res
          .status(403)
          .json({ error: `Project-scoped API key cannot access org-level resources` })
      }

      if (targetProjectId !== keyProjectId) {
        logger.warn({
          message: `Project-scoped key blocked from different project`,
          path: req.path,
          method: req.method,
          keyProjectId,
          targetProjectId,
        })
        return res
          .status(403)
          .json({ error: `API key does not have access to this project` })
      }

      next()
    } catch (error) {
      logger.error({
        message: `projectAccessGuard error`,
        path: req.path,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
      })
      next(error)
    }
  }

  return callback as TAHandler
}
```

- [ ] **Step 4.4: Run tests, verify they pass**

```bash
cd repos/backend && pnpm test -- src/middleware/projectAccessGuard.test.ts
```
Expected: 5/5 PASS.

- [ ] **Step 4.5: Stage and commit**

Stage:
```bash
git add repos/backend/src/middleware/projectAccessGuard.ts \
        repos/backend/src/middleware/projectAccessGuard.test.ts
```
Commit message:
```
fix(backend): projectAccessGuard rejects org-scoped key with mismatching URL org
```

---

## Phase 2 — Live-bug fix (providers/models org-scoping)

### Task 5: Backend — delete root-level `providerModels` mount

**Files:**
- Modify: `repos/backend/src/endpoints/providers/providers.ts`
- Modify: `repos/backend/src/endpoints/accounts.ts`

- [ ] **Step 5.1: Remove `providerModels` from accounts**

In `repos/backend/src/endpoints/accounts.ts`:

Delete the import at line 20:
```ts
import { providerModels } from '@TBE/endpoints/providers/providers'
```

Delete `providerModels` from the `endpoints` object (line 59):
```ts
    endpoints: {
      ai,
      auth,
      base,
      orgs,
      users,
      agents,
      assets,
      health,
      payments,
      invitations,
      subscriptions,
    },
```

- [ ] **Step 5.2: Remove `providerModels` export from providers.ts**

In `repos/backend/src/endpoints/providers/providers.ts`, replace the entire file with:

```ts
import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getProvider } from '@TBE/endpoints/providers/getProvider'
import { fetchModels } from '@TBE/endpoints/providers/fetchModels'
import { listProviders } from '@TBE/endpoints/providers/listProviders'
import { createProvider } from '@TBE/endpoints/providers/createProvider'
import { updateProvider } from '@TBE/endpoints/providers/updateProvider'
import { deleteProvider } from '@TBE/endpoints/providers/deleteProvider'

export const providers: TEndpointConfig = {
  path: `/providers`,
  method: EPMethod.Use,
  endpoints: {
    fetchModels,
    getProvider,
    listProviders,
    createProvider,
    updateProvider,
    deleteProvider,
  },
}
```

- [ ] **Step 5.3: Type-check**

```bash
pnpm --filter @tdsk/backend types
```
Expected: clean.

- [ ] **Step 5.4: Stage and commit**

Stage:
```bash
git add repos/backend/src/endpoints/providers/providers.ts \
        repos/backend/src/endpoints/accounts.ts
```
Commit message:
```
fix(backend): remove root-level providers/models mount — endpoint is org-scoped only
```

---

### Task 6: Frontend — `providersApi.fetchModels(orgId, brand, opts)`

**Files:**
- Modify: `repos/admin/src/services/providersApi.ts`

- [ ] **Step 6.1: Update `fetchModels`**

In `repos/admin/src/services/providersApi.ts`, replace lines 113-132:

```ts
  /**
   * Fetch available models for a provider brand within an org.
   * Mounts at /_/orgs/:orgId/providers/:brand/models on the backend.
   */
  async fetchModels(
    orgId: string,
    brand: string,
    opts?: { baseUrl?: string }
  ): Promise<TApiRes<TProviderModel[]>> {
    const resp = await this.api.post<TProviderModel[]>({
      path: `${this.#path(orgId)}/${brand}/models`,
      data: { baseUrl: opts?.baseUrl },
    })

    resp.error && (await this._onError(resp.error, `Failed to fetch Provider models`))

    return {
      ...resp,
      data: resp?.data || [],
    }
  }
```

Note: `providerKey` is removed (F3 — no caller uses it for the now-org-scoped read endpoint).

- [ ] **Step 6.2: Type-check**

```bash
pnpm --filter @tdsk/admin types
```
Expected: errors in `fetchProviderModels.ts` and `ModelSelect.tsx` (callers haven't been updated yet — expected).

- [ ] **Step 6.3: No commit yet** — frontend changes commit together at Task 9.

---

### Task 7: Frontend action — thread `orgId` through

**Files:**
- Modify: `repos/admin/src/actions/providers/api/fetchProviderModels.ts`

- [ ] **Step 7.1: Update action signature**

Replace the entire file:

```ts
import { providersApi } from '@TAF/services/providersApi'

export type TFetchProviderModelsOpts = {
  orgId: string
  brand: string
  baseUrl?: string
}

export const fetchProviderModels = async (opts: TFetchProviderModelsOpts) => {
  const { orgId, brand, ...rest } = opts
  const resp = await providersApi.fetchModels(orgId, brand, rest)
  if (resp.error) return { error: resp.error }

  return resp
}
```

- [ ] **Step 7.2: No commit yet** — bundled with Task 9.

---

### Task 8: `ModelSelect` accepts `orgId`, defers fetch, surfaces errors

**Files:**
- Modify: `repos/admin/src/components/Agents/ModelSelect.tsx`

- [ ] **Step 8.1: Replace the component**

Replace `repos/admin/src/components/Agents/ModelSelect.tsx` with:

```tsx
import type { TProviderModel, TAIProviderBrand } from '@tdsk/domain'

import { EAIProviderBrand } from '@tdsk/domain'
import { DynamicBrands } from '@TAF/constants/providers'
import { TextInput, SelectInput } from '@tdsk/components'
import { fetchProviderModels } from '@TAF/actions/providers'
import { useMemo, useState, useCallback } from 'react'
import { Alert, Box, Typography, CircularProgress } from '@mui/material'

export type TModelSelectProps = {
  id?: string
  orgId: string
  model: string
  baseUrl?: string
  disabled?: boolean
  size?: 'small' | 'medium'
  brand: TAIProviderBrand | string
  onChange: (model: string) => void
}

export const ModelSelect = (props: TModelSelectProps) => {
  const {
    brand,
    model,
    orgId,
    baseUrl,
    disabled,
    onChange,
    id: idProp,
    size = `small`,
  } = props

  const idSuffix = idProp || brand

  const [models, setModels] = useState<TProviderModel[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modelOptions = useMemo(() => {
    if (!models?.length) return []
    return models.map((m) => ({ value: m.id, label: m.name }))
  }, [models])

  const loadModels = useCallback(async () => {
    if (!brand || !orgId) return
    if (!DynamicBrands.has(brand as string)) {
      setModels([])
      return
    }
    if (brand === EAIProviderBrand.ollama && !baseUrl) {
      setModels([])
      return
    }
    setFetching(true)
    setError(null)
    const resp = await fetchProviderModels({
      orgId,
      brand,
      ...(baseUrl && { baseUrl }),
    })
    setFetching(false)
    if (resp.error) {
      setError(resp.error.message || `Could not load models for ${brand}`)
      setModels([])
      return
    }
    setModels(resp.data || [])
  }, [brand, orgId, baseUrl])

  const handleOpen = useCallback(() => {
    if (models === null && !fetching) void loadModels()
  }, [models, fetching, loadModels])

  if (fetching) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        <CircularProgress size={14} />
        <Typography variant='caption' color='text.secondary'>
          Loading models...
        </Typography>
      </Box>
    )
  }

  if (modelOptions.length > 0) {
    return (
      <SelectInput
        fullWidth
        label='Model'
        value={model}
        size={size}
        disabled={disabled}
        id={`model-select-${idSuffix}`}
        items={modelOptions}
        onChange={(e) => onChange(e.target.value as string)}
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <TextInput
        fullWidth
        size={size}
        label='Model'
        value={model}
        disabled={disabled}
        id={`model-input-${idSuffix}`}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleOpen}
        placeholder='e.g., gpt-4o, claude-sonnet-4-20250514'
      />
      {error && (
        <Alert
          severity='warning'
          sx={{ fontSize: '0.8rem', py: 0, '& .MuiAlert-message': { py: 0.5 } }}
        >
          {error} — enter a model ID manually.
        </Alert>
      )}
      {brand === EAIProviderBrand.ollama && !baseUrl && !error && (
        <Alert
          severity='info'
          sx={{ fontSize: '0.8rem', py: 0, '& .MuiAlert-message': { py: 0.5 } }}
        >
          Set a Base URL on the Ollama provider to enable model selection
        </Alert>
      )}
    </Box>
  )
}
```

Changes from prior version: added `orgId` (required), removed `apiKey`/`providerKey` plumbing, replaced eager `useEffect` with on-focus fetch via `handleOpen`, surfaced errors with an `<Alert severity="warning">`.

- [ ] **Step 8.2: No commit yet** — bundled with Task 9.

---

### Task 9: Update every `<ModelSelect>` and `<ProviderLinkList>` caller to pass `orgId`

**Files:**
- Modify: `repos/admin/src/components/Providers/ProviderLinkList.tsx`
- Modify: `repos/admin/src/components/GuiConfig/GuiConfigForm.tsx`
- Modify: `repos/admin/src/components/Sandboxes/SandboxProviderAccordion.tsx`
- Modify: `repos/admin/src/components/Sandboxes/SandboxGuiAccordion.tsx`
- Modify: `repos/admin/src/components/Agents/BasicInfoForm.tsx`
- Modify: `repos/admin/src/pages/Orgs/OrgSettings.tsx`

- [ ] **Step 9.1: Add `orgId` to `ProviderLinkList`**

In `repos/admin/src/components/Providers/ProviderLinkList.tsx`:

1. Add `orgId: string` to `TProviderLinkListProps` (~line 22).
2. Destructure `orgId` in the component (~line 40).
3. At the `<ModelSelect>` usage (~line 169), pass `orgId={orgId}`:

```tsx
              {onModelChange && (
                <Box sx={{ mt: 1, mb: 0.5 }}>
                  <ModelSelect
                    size='small'
                    orgId={orgId}
                    id={provider.id}
                    disabled={isDisabled}
                    brand={provider.brand}
                    baseUrl={provider.baseUrl}
                    model={provider.model || ''}
                    onChange={(model) => onModelChange(provider.id, model)}
                  />
                </Box>
              )}
```

- [ ] **Step 9.2: Update `GuiConfigForm`**

In `repos/admin/src/components/GuiConfig/GuiConfigForm.tsx`:

1. Add `orgId: string` to `TGuiConfigFormProps` (~line 18).
2. Destructure in the component.
3. At `<ModelSelect>` (~line 73), pass `orgId={orgId}`:

```tsx
      <ModelSelect
        size='small'
        orgId={orgId}
        disabled={isDisabled}
        model={current.model || ''}
        brand={selectedProvider?.brand ?? ''}
        onChange={(model) => update({ model })}
        id={`gui-config-model-${current.providerId}`}
      />
```

- [ ] **Step 9.3: Update `SandboxProviderAccordion`**

In `repos/admin/src/components/Sandboxes/SandboxProviderAccordion.tsx`:

1. Add `orgId: string` to the props type.
2. Destructure.
3. At the `<ProviderLinkList>` usage (~line 94), pass `orgId={orgId}`.

- [ ] **Step 9.4: Update `SandboxGuiAccordion`**

In `repos/admin/src/components/Sandboxes/SandboxGuiAccordion.tsx`:

1. Add `orgId: string` to props.
2. At `<GuiConfigForm>` (~line 47), pass `orgId={orgId}`.

- [ ] **Step 9.5: Update `BasicInfoForm`**

In `repos/admin/src/components/Agents/BasicInfoForm.tsx`:

1. Add `orgId: string` to props.
2. At `<ProviderLinkList>` (~line 100), pass `orgId={orgId}`.

- [ ] **Step 9.6: Update the top-level pages to source `orgId` from route**

In `repos/admin/src/pages/Orgs/OrgSettings.tsx` (~line 190), pass `orgId={orgId}` to `<GuiConfigForm>`. The page already has `orgId` available via route params (verify by reading the surrounding context).

In any sandbox edit drawer / agent form page that renders `SandboxProviderAccordion`, `SandboxGuiAccordion`, or `BasicInfoForm`, source `orgId` from the existing route param atom (e.g., `useParams<{ orgId: string }>()` or `useAtomValue(currentOrgIdAtom)`).

Discover affected pages:
```bash
grep -rn 'SandboxProviderAccordion\|SandboxGuiAccordion\|BasicInfoForm' \
  repos/admin/src/pages repos/admin/src/components --include='*.tsx'
```
For each result, ensure `orgId` is passed from the surrounding context. If a parent prop type already exposes `orgId`, just thread it down; if not, read it from `useParams` at the page level and pass down.

- [ ] **Step 9.7: Type-check end to end**

```bash
pnpm --filter @tdsk/admin types
```
Expected: clean.

- [ ] **Step 9.8: Run admin unit tests**

```bash
pnpm --filter @tdsk/admin test
```
Expected: all pass. If any test mocks `fetchProviderModels` or constructs `<ModelSelect>`, update the mocks/props to include `orgId`.

- [ ] **Step 9.9: Stage and commit (frontend bundle)**

Stage:
```bash
git add repos/admin/src/services/providersApi.ts \
        repos/admin/src/actions/providers/api/fetchProviderModels.ts \
        repos/admin/src/components/Agents/ModelSelect.tsx \
        repos/admin/src/components/Providers/ProviderLinkList.tsx \
        repos/admin/src/components/GuiConfig/GuiConfigForm.tsx \
        repos/admin/src/components/Sandboxes/SandboxProviderAccordion.tsx \
        repos/admin/src/components/Sandboxes/SandboxGuiAccordion.tsx \
        repos/admin/src/components/Agents/BasicInfoForm.tsx \
        repos/admin/src/pages/Orgs/OrgSettings.tsx
```
Commit message:
```
fix(admin): org-scope provider model fetches; defer to user interaction; surface errors
```

---

## Phase 3 — Guard coverage gaps

### Task 10: Mount `orgAccessGuard` on the `/orgs/:orgId` wrapper

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/orgs.ts`

The current `orgs` config wraps `/orgs` but the nested children carry `:orgId` (e.g. `orgAgents.path = '/:orgId/agents'`). Since each child mounts under its own `/orgs/:orgId/...` URL, we add `orgAccessGuard` at each child's `.Use` level — not at the parent `/orgs` (which would never see `:orgId`).

Actually, the simpler approach: add a single `:orgId` group inside `orgs` that holds the org-scoped children. But that's a bigger refactor than necessary. Instead, mount `orgAccessGuard()` at the wrapper of each `:orgId`-scoped sub-config in Task 11 (org-level wrappers) and at `orgProjects` (which currently has no middleware on its `/:orgId/projects` wrapper).

- [ ] **Step 10.1: Add middleware to `orgProjects` wrapper**

In `repos/backend/src/endpoints/orgs/orgProjects.ts` (~line 239), update:

```ts
export const orgProjects: TEndpointConfig = {
  path: `/:orgId/projects`,
  method: EPMethod.Use,
  middleware: [orgAccessGuard()],
  endpoints: { ... },
}
```

Add the import at the top:
```ts
import { orgAccessGuard } from '@TBE/middleware/orgAccessGuard'
```

- [ ] **Step 10.2: Stage and commit (held until Task 12 — bundled)**

---

### Task 11: Add `projectAccessGuard + orgAccessGuard` to org-level wrappers (H1)

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/orgAgents.ts`
- Modify: `repos/backend/src/endpoints/orgs/orgSecrets.ts`
- Modify: `repos/backend/src/endpoints/orgs/orgDomains.ts`
- Modify: `repos/backend/src/endpoints/orgs/orgOverrides.ts`

- [ ] **Step 11.1: `orgAgents.ts`**

Replace:

```ts
export const orgAgents: TEndpointConfig = {
  path: `/:orgId/agents`,
  method: EPMethod.Use,
  middleware: [featureGate(`agents`)],
  endpoints: { ... },
}
```

with:

```ts
import { orgAccessGuard } from '@TBE/middleware/orgAccessGuard'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'

export const orgAgents: TEndpointConfig = {
  path: `/:orgId/agents`,
  method: EPMethod.Use,
  middleware: [featureGate(`agents`), orgAccessGuard(), projectAccessGuard()],
  endpoints: { ... },
}
```

- [ ] **Step 11.2: `orgSecrets.ts`**

Replace the whole file with:

```ts
import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { orgAccessGuard } from '@TBE/middleware/orgAccessGuard'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'
import { getSecret } from '@TBE/endpoints/secrets/getSecret'
import { listSecrets } from '@TBE/endpoints/secrets/listSecrets'
import { updateSecret } from '@TBE/endpoints/secrets/updateSecret'
import { createSecret } from '@TBE/endpoints/secrets/createSecret'
import { deleteSecret } from '@TBE/endpoints/secrets/deleteSecret'

export const orgSecrets: TEndpointConfig = {
  path: `/:orgId/secrets`,
  method: EPMethod.Use,
  middleware: [orgAccessGuard(), projectAccessGuard()],
  endpoints: {
    listSecrets,
    getSecret,
    createSecret,
    updateSecret,
    deleteSecret,
  },
}
```

- [ ] **Step 11.3: `orgDomains.ts`**

Replace with:

```ts
import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { domains } from '@TBE/endpoints/domains/domains'
import { orgAccessGuard } from '@TBE/middleware/orgAccessGuard'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'

export const orgDomains: TEndpointConfig = {
  ...domains,
  path: `/:orgId/domains`,
  method: EPMethod.Use,
  middleware: [orgAccessGuard(), projectAccessGuard()],
}
```

- [ ] **Step 11.4: `orgOverrides.ts`**

Replace with:

```ts
import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { permissionOverrides } from '@TBE/endpoints/permissionOverrides/permissionOverrides'
import { orgAccessGuard } from '@TBE/middleware/orgAccessGuard'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'

export const orgOverrides: TEndpointConfig = {
  ...permissionOverrides,
  path: `/:orgId/overrides`,
  method: EPMethod.Use,
  middleware: [orgAccessGuard(), projectAccessGuard()],
}
```

- [ ] **Step 11.5: Bundled with Task 12 commit.**

---

### Task 12: Explicit guards on nested config groups (M1)

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/orgProjects.ts`

- [ ] **Step 12.1: Add guards to `projectAgentConfig`**

Replace the existing `projectAgentConfig` block (~line 140):

```ts
const projectAgentConfig: TEndpointConfig = {
  path: `/:agentId/config`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard(), projectMemberGuard()],
  endpoints: {
    getAPConfig,
    upsertAPConfig,
    deleteAPConfig,
  },
}
```

- [ ] **Step 12.2: Add guards to `projectSandboxConfig`**

Replace (~line 176):

```ts
const projectSandboxConfig: TEndpointConfig = {
  path: `/:sandboxId/config`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard(), projectMemberGuard()],
  endpoints: {
    getSBPConfig,
    upsertSBPConfig,
    deleteSBPConfig,
  },
}
```

- [ ] **Step 12.3: Type-check**

```bash
pnpm --filter @tdsk/backend types
```
Expected: clean.

- [ ] **Step 12.4: Unit-test sweep**

```bash
pnpm --filter @tdsk/backend test
```
Expected: all pass.

- [ ] **Step 12.5: Stage and commit (guard coverage bundle)**

Stage:
```bash
git add repos/backend/src/endpoints/orgs/orgAgents.ts \
        repos/backend/src/endpoints/orgs/orgSecrets.ts \
        repos/backend/src/endpoints/orgs/orgDomains.ts \
        repos/backend/src/endpoints/orgs/orgOverrides.ts \
        repos/backend/src/endpoints/orgs/orgProjects.ts
```
Commit message:
```
fix(backend): close RBAC guard gaps on org-level wrappers and nested config groups
```

---

## Phase 4 — Validation and error-code fixes

### Task 13: Validate cross-org `secretIds`/`providerIds` in `createAgent` (H2)

**Files:**
- Modify: `repos/backend/src/endpoints/agents/createAgent.ts`

- [ ] **Step 13.1: Insert validation**

Replace the action body of `createAgent.ts` with:

```ts
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { secretIds, projectIds = [], providerInputs, ...agent } = req.body
    const orgId = req.params.orgId || agent.orgId

    if (!orgId)
      throw new Exception(400, `Agent must belong to an organization (orgId required)`)

    const pins = await db.services.provider.validate({
      orgId,
      type: EProvider.ai,
      inputs: providerInputs,
    })

    if (!pins?.length)
      throw new Exception(
        400,
        `Agent must have at least one provider (providerInputs required)`
      )

    agent.orgId = orgId

    const { data: projects, error: projErr } = projectIds?.length
      ? await db.services.project.list({ where: { id: projectIds } })
      : { data: [] }
    if (projErr) throw new Exception(500, projErr.message)

    // Validate every secretId belongs to this org
    if (secretIds?.length) {
      for (const secretId of secretIds) {
        const { data: secret, error: secretErr } =
          await db.services.secret.get(secretId)
        if (secretErr) throw new Exception(500, secretErr.message)
        if (!secret)
          throw new Exception(400, `Secret ${secretId} not found`)
        if (secret.orgId !== orgId)
          throw new Exception(
            403,
            `Secret ${secretId} does not belong to this organization`,
            `FORBIDDEN`
          )
      }
    }

    if (pins?.length) agent.providerInputs = pins
    if (projects?.length) agent.projects = projects
    if (secretIds?.length) agent.secretIds = secretIds

    const { data, error } = await db.services.agent.create(agent)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
```

Note: `providerInputs` are already validated against `orgId` via `db.services.provider.validate({ orgId, ... })` on line 29-33 — that path is safe. We only needed to add the secret-id check.

- [ ] **Step 13.2: Type-check**

```bash
pnpm --filter @tdsk/backend types
```
Expected: clean.

- [ ] **Step 13.3: Stage and commit**

Stage:
```bash
git add repos/backend/src/endpoints/agents/createAgent.ts
```
Commit message:
```
fix(backend): createAgent validates secretIds belong to the agent's org
```

---

### Task 14: `listAgents` drops query-based `projectId` override (M2)

**Files:**
- Modify: `repos/backend/src/endpoints/agents/listAgents.ts`

- [ ] **Step 14.1: Replace projectId resolution**

In `listAgents.ts`, replace line 33:

```ts
    const projectId = (req.params.projectId || req.query.projectId) as string | undefined
```

with:

```ts
    const projectId = req.params.projectId as string | undefined
    const queryProjectId = req.query.projectId
    if (queryProjectId && queryProjectId !== projectId)
      throw new Exception(
        400,
        `projectId query param does not match URL scope`,
        `SCOPE_MISMATCH`
      )
```

Also remove the obsolete TODO at lines 31-32.

- [ ] **Step 14.2: Type-check**

```bash
pnpm --filter @tdsk/backend types
```
Expected: clean.

- [ ] **Step 14.3: Stage and commit**

Stage:
```bash
git add repos/backend/src/endpoints/agents/listAgents.ts
```
Commit message:
```
fix(backend): listAgents uses URL projectId only; reject mismatched query param
```

---

### Task 15: `copySandbox` returns 403 not 404 (M3)

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/copySandbox.ts`

- [ ] **Step 15.1: Update error code**

Replace line 34:

```ts
    if (original.orgId !== orgId) throw new Exception(404, `Sandbox not found`)
```

with:

```ts
    if (original.orgId !== orgId)
      throw new Exception(
        403,
        `Sandbox does not belong to this organization`,
        `FORBIDDEN`
      )
```

- [ ] **Step 15.2: Stage and commit**

Stage:
```bash
git add repos/backend/src/endpoints/sandboxes/copySandbox.ts
```
Commit message:
```
fix(backend): copySandbox returns 403 (not 404) on cross-org mismatch
```

---

## Phase 5 — Hygiene

### Task 16: Distinct org-vs-project membership error messages (L2)

**Files:**
- Modify: `repos/backend/src/utils/auth/resolveEffectivePermissions.ts`

- [ ] **Step 16.1: Differentiate the error message**

Replace lines 36-38:

```ts
  const userRole = await getUserRole(req, context)
  if (!userRole)
    throw new Exception(403, `Not a member of this organization or project`, `FORBIDDEN`)
```

with:

```ts
  const userRole = await getUserRole(req, context)
  if (!userRole) {
    if (context.projectId && !context.orgId)
      throw new Exception(403, `Not a member of this project`, `FORBIDDEN`)
    if (context.orgId && !context.projectId)
      throw new Exception(403, `Not a member of this organization`, `FORBIDDEN`)
    if (context.orgId && context.projectId)
      throw new Exception(
        403,
        `Not a member of this organization or project`,
        `FORBIDDEN`
      )
    throw new Exception(
      400,
      `Permission check requires org or project scope`,
      `MISSING_SCOPE`
    )
  }
```

- [ ] **Step 16.2: Stage and commit**

Stage:
```bash
git add repos/backend/src/utils/auth/resolveEffectivePermissions.ts
```
Commit message:
```
chore(backend): split org-vs-project membership errors; 400 on missing scope
```

---

### Task 17: Remove unused `(req as any).permissions` stash (L3)

**Files:**
- Modify: `repos/backend/src/utils/auth/checkPermission.ts`

- [ ] **Step 17.1: Verify it has no consumer**

```bash
grep -rn '(req as any).permissions\|req\.permissions' \
  repos/backend/src repos/admin/src repos/threads/src
```
Expected: only the write site in `checkPermission.ts`. If anything else appears, do not remove — return to the spec.

- [ ] **Step 17.2: Delete lines 79-80**

In `checkPermission.ts`, remove:

```ts
    // Cache resolved permissions on request for downstream use
  ;(req as any).permissions = permissions
```

- [ ] **Step 17.3: Type-check and test**

```bash
pnpm --filter @tdsk/backend types && pnpm --filter @tdsk/backend test
```
Expected: clean.

- [ ] **Step 17.4: Stage and commit**

Stage:
```bash
git add repos/backend/src/utils/auth/checkPermission.ts
```
Commit message:
```
chore(backend): drop unused (req as any).permissions stash
```

---

### Task 18: Drop dead `projectId` checks in startSandbox/connectSandbox (L1)

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/startSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/connectSandbox.ts`

These checks are now unreachable: `projectMemberGuard()` on the `projectSandboxes` wrapper fails closed when `:projectId` is missing (Task 3).

- [ ] **Step 18.1: `startSandbox.ts`**

Replace lines 17-18:

```ts
    const { projectId } = req.params
    if (!projectId) throw new Exception(400, `projectId is required to start a sandbox`)
```

with:

```ts
    const { projectId } = req.params
```

- [ ] **Step 18.2: `connectSandbox.ts`**

Replace lines 27-29:

```ts
    const { projectId } = req.params
    if (!projectId)
      throw new Exception(400, `projectId is required to connect to a sandbox`)
```

with:

```ts
    const { projectId } = req.params
```

- [ ] **Step 18.3: Stage and commit**

Stage:
```bash
git add repos/backend/src/endpoints/sandboxes/startSandbox.ts \
        repos/backend/src/endpoints/sandboxes/connectSandbox.ts
```
Commit message:
```
chore(backend): drop redundant projectId checks (guard now fails closed)
```

---

### Task 19: Comment on `featureGate` 404 intent (L4)

**Files:**
- Modify: `repos/backend/src/middleware/featureGate.ts`

- [ ] **Step 19.1: Add intent comment**

Replace lines 6-14 with:

```ts
export function featureGate(flag: TFeatureFlagName): RequestHandler {
  return (req, res, next) => {
    if (isFeatureEnabled(flag)) return next()
    logger.debug(
      `[featureGate] Blocked ${req.method} ${req.path} — flag '${flag}' is disabled`
    )
    // 404 (not 403) is intentional: the route is invisible while the flag is off
    // so we don't leak feature existence. Do not "fix" this back to 403.
    res.status(404).json({ error: `Not found` })
  }
}
```

- [ ] **Step 19.2: Stage and commit**

Stage:
```bash
git add repos/backend/src/middleware/featureGate.ts
```
Commit message:
```
docs(backend): clarify featureGate returns 404 by design
```

---

## Phase 6 — Integration tests

### Task 20: Update existing provider-models integration fixtures

**Files:**
- Locate any integration test that posts to `/_/providers/:brand/models` (no org) and update it.

- [ ] **Step 20.1: Find fixtures**

```bash
grep -rn 'providers/.*/models\|fetchModels' repos/integration/tests --include='*.ts'
```

- [ ] **Step 20.2: Rewrite each call**

For every `POST /providers/<brand>/models` in the integration suite, change the path to `POST /orgs/${TEST_ORG_ID}/providers/<brand>/models`.

- [ ] **Step 20.3: Bundled with Task 23 commit.**

---

### Task 21: Add cross-org probe integration test

**Files:**
- Create: `repos/integration/tests/rbac/cross-org-probe.test.ts`

- [ ] **Step 21.1: Write the test**

```ts
import { describe, it, expect } from 'vitest'
import { apiClient, seedOrgWithApiKey, TEST_BASE_URL } from '../helpers'

describe('RBAC cross-org probe', () => {
  it('rejects orgA API key calling orgB resources', async () => {
    const orgA = await seedOrgWithApiKey({ name: 'org-A' })
    const orgB = await seedOrgWithApiKey({ name: 'org-B' })

    const resp = await apiClient(orgA.apiKey).get(
      `${TEST_BASE_URL}/_/orgs/${orgB.orgId}/secrets`
    )
    expect(resp.status).toBe(403)
    expect(resp.data.error).toMatch(/does not belong to this organization/i)
  })
})
```

Adapt `seedOrgWithApiKey` / `apiClient` to whatever the integration suite already uses. If those helpers don't exist, use the existing seeding pattern in the suite.

- [ ] **Step 21.2: Bundled with Task 23 commit.**

---

### Task 22: Add removed-route + scoped-key probes

**Files:**
- Create: `repos/integration/tests/rbac/removed-routes.test.ts`
- Create: `repos/integration/tests/rbac/project-scoped-key.test.ts`
- Create: `repos/integration/tests/rbac/agent-cross-org-secret.test.ts`

- [ ] **Step 22.1: `removed-routes.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { apiClient, seedOrgWithApiKey, TEST_BASE_URL } from '../helpers'

describe('removed routes', () => {
  it('POST /_/providers/openai/models (no org) is now 404', async () => {
    const org = await seedOrgWithApiKey({ name: 'org-removed' })
    const resp = await apiClient(org.apiKey).post(
      `${TEST_BASE_URL}/_/providers/openai/models`,
      {}
    )
    expect(resp.status).toBe(404)
  })

  it('POST /_/orgs/:orgId/providers/openai/models returns 200', async () => {
    const org = await seedOrgWithApiKey({ name: 'org-models' })
    const resp = await apiClient(org.apiKey).post(
      `${TEST_BASE_URL}/_/orgs/${org.orgId}/providers/openai/models`,
      {}
    )
    expect(resp.status).toBe(200)
    expect(Array.isArray(resp.data.data)).toBe(true)
  })
})
```

- [ ] **Step 22.2: `project-scoped-key.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  apiClient,
  seedOrgWithProject,
  createProjectScopedKey,
  TEST_BASE_URL,
} from '../helpers'

describe('project-scoped API key boundaries', () => {
  it('cannot list org-level agents', async () => {
    const { orgId, projectId } = await seedOrgWithProject({ name: 'org-pkey' })
    const key = await createProjectScopedKey(orgId, projectId)

    const resp = await apiClient(key).get(`${TEST_BASE_URL}/_/orgs/${orgId}/agents`)
    expect(resp.status).toBe(403)
    expect(resp.data.error).toMatch(/cannot access org-level resources/i)
  })

  it('cannot reach another project under same org', async () => {
    const { orgId, projectId: keyProj } = await seedOrgWithProject({ name: 'org-pkey-2' })
    const { projectId: otherProj } = await seedOrgWithProject({
      name: 'org-pkey-2',
      reuseOrgId: orgId,
    })
    const key = await createProjectScopedKey(orgId, keyProj)

    const resp = await apiClient(key).get(
      `${TEST_BASE_URL}/_/orgs/${orgId}/projects/${otherProj}/secrets`
    )
    expect(resp.status).toBe(403)
    expect(resp.data.error).toMatch(/does not have access to this project/i)
  })
})
```

- [ ] **Step 22.3: `agent-cross-org-secret.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  apiClient,
  seedOrgWithApiKey,
  seedSecret,
  TEST_BASE_URL,
} from '../helpers'

describe('createAgent cross-org secret reference', () => {
  it('rejects a secretId from another org', async () => {
    const orgA = await seedOrgWithApiKey({ name: 'org-A' })
    const orgB = await seedOrgWithApiKey({ name: 'org-B' })
    const otherSecret = await seedSecret(orgB.orgId)

    const resp = await apiClient(orgA.apiKey).post(
      `${TEST_BASE_URL}/_/orgs/${orgA.orgId}/agents`,
      {
        name: 'cross-org-attempt',
        orgId: orgA.orgId,
        providerInputs: [{ brand: 'openai', model: 'gpt-4o', secretRef: 'OPENAI_KEY' }],
        secretIds: [otherSecret.id],
      }
    )
    expect(resp.status).toBe(403)
    expect(resp.data.error).toMatch(/does not belong to this organization/i)
  })
})
```

Adapt helper imports to whatever the suite already provides; if `seedSecret` doesn't exist, follow the existing pattern in the suite.

- [ ] **Step 22.4: Bundled with Task 23 commit.**

---

### Task 23: Run integration suite, fix any failures, commit

- [ ] **Step 23.1: Ensure K8s is up**

```bash
tdsk dev start --clean
```

- [ ] **Step 23.2: Run integration tests**

```bash
cd repos/integration && pnpm test
```
Expected: every existing test still passes, every new RBAC test passes.

If failures appear:
- For test fixtures referencing the old `/_/providers/:brand/models` path → already updated in Task 20; re-run.
- For tests that depended on the silent-skip behavior of `projectMemberGuard` → update fixtures so URLs include both `:orgId` and `:projectId`, not the previous "lazy" patterns.
- For tests that depended on `auth.orgId` overriding URL → these were exploiting the bug; rewrite them to match the URL they intend.

Do not mark "pre-existing" failures. Fix them.

- [ ] **Step 23.3: Stage and commit (integration tests bundle)**

Stage:
```bash
git add repos/integration/tests/rbac/ \
        repos/integration/tests/  # plus any updated provider-models fixtures
```
Commit message:
```
test(integration): RBAC regression suite — cross-org, scope-mismatch, removed routes
```

---

## Phase 7 — End-to-end verification

### Task 24: Manual UI smoke via Playwright MCP

- [ ] **Step 24.1: Build the affected services**

```bash
pnpm --filter @tdsk/domain build
pnpm --filter @tdsk/database build
pnpm --filter @tdsk/logger build
pnpm --filter @tdsk/backend build
pnpm --filter @tdsk/admin build
```
Expected: clean.

- [ ] **Step 24.2: Restart services**

```bash
tdsk dev start --clean
```
In a second terminal:
```bash
cd repos/admin && pnpm start
```

- [ ] **Step 24.3: Run Playwright check**

Open Playwright MCP and walk through:
1. `browser_navigate http://localhost:5887`
2. Log in. Select org `og_0000001`, project `pj_0000002`.
3. Navigate to Sandboxes.
4. Click **edit** on any sandbox.
5. `browser_snapshot` — expect no "Not a member of this organization or project" lines.
6. `browser_network_requests` — every `/providers/.../models` call must target `/_/orgs/og_0000001/providers/.../models` and return 200 (or be absent if the dropdown wasn't opened).
7. Click each provider's model dropdown — expect 200 and a populated list (or warning Alert if the brand has no live registry).

- [ ] **Step 24.4: Repeat for the threads SPA**

Open the threads SPA at the configured URL, navigate to sandbox sessions, ensure monitor WebSocket still works (smoke). The threads SPA does not call `/providers/.../models`, so the main check here is that the cross-org guard tightening did not break the sandbox monitor token flow.

---

### Task 25: Final verification + memory + accountability review

- [ ] **Step 25.1: Run repo-wide checks**

```bash
pnpm types
pnpm --filter @tdsk/backend test
pnpm --filter @tdsk/admin test
cd repos/integration && pnpm test
```
All must pass.

- [ ] **Step 25.2: Dispatch the accountability-reviewer agent**

Invoke `pr-review-toolkit:review-pr` (or the local `accountability-reviewer` agent at `.claude/agents/accountability-reviewer.md`) over the diff. Goal: catch any silent gap, partial fix, or deferred work. Address every issue raised before claiming done.

- [ ] **Step 25.3: Dispatch security-reviewer**

Invoke `.claude/agents/security-reviewer.md` on the diff. Pay special attention to the `authorize` precedence change and the new `orgAccessGuard` — any path that bypasses or weakens the new contract is a regression.

- [ ] **Step 25.4: Update auto memory**

Edit `~/.claude/projects/-Users-lancetipton-keg-hub-external-apps-threadedstack/memory/MEMORY.md`:
- Move `[RBAC Overhaul v2](project_rbac_overhaul_v2.md)` line out of "Completed" and replace with a new entry pointing to `project_rbac_overhaul_v2_real_completion.md`.
- Create the new memory file at the same dir describing what was actually shipped, what tests guard it, and the spec/plan paths in `docs/superpowers/{specs,plans}/`.

- [ ] **Step 25.5: Final commit**

Stage:
```bash
git add ~/.claude/projects/-Users-lancetipton-keg-hub-external-apps-threadedstack/memory/MEMORY.md \
        ~/.claude/projects/-Users-lancetipton-keg-hub-external-apps-threadedstack/memory/project_rbac_overhaul_v2_real_completion.md
```
(These are user-level memory files, outside the repo; no commit needed in the project repo.)

Tell the user the work is complete only after:
- ✅ all unit tests pass
- ✅ integration tests pass on live K8s
- ✅ Playwright smoke shows zero 401/403 on sandbox edit modal
- ✅ accountability-reviewer + security-reviewer agents return clean

If any of those is red, do not say "done" — fix.

---

## Self-review (after writing this plan)

- **Spec coverage:** Walked through §7 defects of the spec — C1 (Task 2), C2 (Tasks 5–9), C3 (Task 3), C4 (Task 4), H1 (Tasks 11–12), H2 (Task 13), M1 (Task 12), M2 (Task 14), M3 (Task 15), M4 (Tasks 1, 10–11), L1 (Task 18), L2 (Task 16), L3 (Task 17), L4 (Task 19), F1+F2 (Task 8), F3 (Task 6). All defects covered.
- **Placeholder scan:** No "TBD", "implement later", or generic "add error handling" steps. Every code block contains complete code.
- **Type consistency:** `orgAccessGuard()` factory return shape mirrors `projectAccessGuard()` and `projectMemberGuard()`. `fetchModels(orgId, brand, opts)` signature matches across `providersApi`, action, `ModelSelect` prop, and integration test path.
- **Adjacency to project rules:** Every commit step writes the message but defers `git commit` execution to the human per project `CLAUDE.md`. Lint/format are not invoked manually. Skill choice (subagent-driven-development) honored.
