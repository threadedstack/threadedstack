# Feature Flag Domains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the Domains feature behind a compile-time feature flag (`domains: false`), matching the existing pattern used for `skills`, `schedules`, and `terminalGui`.

**Architecture:** Add `domains` to the existing `FeatureFlags` constant in `@tdsk/domain`, apply `featureGate('domains')` middleware to all three backend domain endpoint groups, conditionally hide nav items and routes in the admin SPA, and add skip guards to integration tests. Proxy `/domains/validate` (used by Caddy) is intentionally NOT gated.

**Tech Stack:** TypeScript, Express 5, React, Vitest, Playwright

**CRITICAL GIT RULE:** NEVER run `git commit`, `git push`, or any git history mutation. Only `git add`, `git status`, `git diff`, `git log`, `git branch`, `git show` are allowed. This applies to ALL subagents.

---

### Task 1: Add `domains` flag definition and type

**Files:**
- Modify: `repos/domain/src/types/featureFlag.types.ts:6-10`
- Modify: `repos/domain/src/constants/featureFlags.ts:3-16`

- [ ] **Step 1: Add `domains` to the `TFeatureFlags` type**

In `repos/domain/src/types/featureFlag.types.ts`, add `domains` to the intersection type:

```typescript
export type TFeatureFlags = Record<string, TFeatureFlagDef> & {
  skills: TFeatureFlagDef
  schedules: TFeatureFlagDef
  terminalGui: TFeatureFlagDef
  domains: TFeatureFlagDef
}
```

- [ ] **Step 2: Add `domains` flag entry to constants**

In `repos/domain/src/constants/featureFlags.ts`, add the `domains` entry to the `FeatureFlags` object:

```typescript
export const FeatureFlags: TFeatureFlags = {
  skills: {
    enabled: false,
    description: `Agent skill system`,
  },
  schedules: {
    enabled: false,
    description: `Cron-based agent execution`,
  },
  terminalGui: {
    enabled: false,
    description: `AST overlay for terminal output (generative UI)`,
  },
  domains: {
    enabled: false,
    description: `Custom domain verification and management`,
  },
}
```

- [ ] **Step 3: Run domain unit tests**

Run: `cd repos/domain && pnpm test`
Expected: All tests pass. The existing `featureFlags.test.ts` iterates `Object.entries(FeatureFlags)` so it automatically covers the new flag without changes.

- [ ] **Step 4: Verify type check**

Run: `cd repos/domain && pnpm types`
Expected: Clean — no type errors.

---

### Task 2: Update domain feature flag tests

**Files:**
- Modify: `repos/domain/src/constants/featureFlags.test.ts:7-9`

- [ ] **Step 1: Add `domains` to the explicit property check**

In `repos/domain/src/constants/featureFlags.test.ts`, add the assertion for the new flag in the `should define all expected flags` test:

```typescript
  it('should define all expected flags', () => {
    expect(FeatureFlags).toHaveProperty('terminalGui')
    expect(FeatureFlags).toHaveProperty('schedules')
    expect(FeatureFlags).toHaveProperty('skills')
    expect(FeatureFlags).toHaveProperty('domains')
  })
```

- [ ] **Step 2: Run tests to verify**

Run: `cd repos/domain && pnpm test`
Expected: All tests pass.

---

### Task 3: Gate backend org-scoped domain endpoints

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/orgDomains.ts:1-20`

- [ ] **Step 1: Add `featureGate` middleware to `orgDomains`**

In `repos/backend/src/endpoints/orgs/orgDomains.ts`, import and apply the middleware. This mirrors `orgSchedules.ts` exactly:

```typescript
import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getDomain } from '@TBE/endpoints/domains/getDomain'
import { listDomains } from '@TBE/endpoints/domains/listDomains'
import { createDomain } from '@TBE/endpoints/domains/createDomain'
import { updateDomain } from '@TBE/endpoints/domains/updateDomain'
import { deleteDomain } from '@TBE/endpoints/domains/deleteDomain'

export const orgDomains: TEndpointConfig = {
  path: `/:orgId/domains`,
  method: EPMethod.Use,
  middleware: [featureGate(`domains`)],
  endpoints: {
    getDomain,
    listDomains,
    createDomain,
    updateDomain,
    deleteDomain,
  },
}
```

- [ ] **Step 2: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass.

---

### Task 4: Gate backend project-scoped domain endpoints

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/orgProjects.ts:110-121`

- [ ] **Step 1: Add `featureGate` to `projectDomains` config**

In `repos/backend/src/endpoints/orgs/orgProjects.ts`, add the `featureGate` import at the top (alongside existing imports), then add it to the `projectDomains` middleware array at ~line 113:

Add import near the top of the file:
```typescript
import { featureGate } from '@TBE/middleware/featureGate'
```

Update the `projectDomains` config (~line 110):
```typescript
const projectDomains: TEndpointConfig = {
  path: `/:projectId/domains`,
  method: EPMethod.Use,
  middleware: [featureGate(`domains`), projectAccessGuard()],
  endpoints: {
    getDomain,
    listDomains,
    createDomain,
    updateDomain,
    deleteDomain,
  },
}
```

Note: `featureGate` comes before `projectAccessGuard()` so the 404 fires before any auth/access check, matching the pattern of not leaking feature existence.

- [ ] **Step 2: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass.

---

### Task 5: Gate standalone domain endpoints

**Files:**
- Modify: `repos/backend/src/endpoints/domains/domains.ts:1-20`

- [ ] **Step 1: Add `featureGate` middleware to standalone domains mount**

In `repos/backend/src/endpoints/domains/domains.ts`:

```typescript
import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getDomain } from '@TBE/endpoints/domains/getDomain'
import { listDomains } from '@TBE/endpoints/domains/listDomains'
import { createDomain } from '@TBE/endpoints/domains/createDomain'
import { updateDomain } from '@TBE/endpoints/domains/updateDomain'
import { deleteDomain } from '@TBE/endpoints/domains/deleteDomain'

export const domains: TEndpointConfig = {
  path: `/domains`,
  method: EPMethod.Use,
  middleware: [featureGate(`domains`)],
  endpoints: {
    getDomain,
    listDomains,
    createDomain,
    updateDomain,
    deleteDomain,
  },
}
```

- [ ] **Step 2: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Run backend type check**

Run: `cd repos/backend && pnpm types`
Expected: Clean — no type errors.

---

### Task 6: Gate admin navigation items

**Files:**
- Modify: `repos/admin/src/constants/nav.tsx:80-85,155-160`

- [ ] **Step 1: Gate OrgSubNav Domains visibility**

In `repos/admin/src/constants/nav.tsx`, update the `Domains` entry in `OrgSubNav` (~line 80-85). The `isFeatureEnabled` import already exists on line 12:

```typescript
  Domains: {
    text: `Domains`,
    to: buildRoute(ERoutePath.OrgDomains),
    Icon: <DnsIcon />,
    visible: (ctx) => hasOrgMember(ctx) && isFeatureEnabled(`domains`),
  },
```

- [ ] **Step 2: Gate ProjectSubNav Domains visibility**

In the same file, update the `Domains` entry in `ProjectSubNav` (~line 155-160):

```typescript
  Domains: {
    text: `Domains`,
    to: buildRoute(ERoutePath.ProjectDomains),
    Icon: <DnsIcon />,
    visible: (ctx) => hasProjectMember(ctx) && isFeatureEnabled(`domains`),
  },
```

- [ ] **Step 3: Run admin type check**

Run: `cd repos/admin && pnpm types`
Expected: Clean — no type errors.

---

### Task 7: Gate admin routes

**Files:**
- Modify: `repos/admin/src/routes/Routes.tsx:160-164,264-268`

- [ ] **Step 1: Wrap OrgDomains route in conditional spread**

In `repos/admin/src/routes/Routes.tsx`, the `isFeatureEnabled` import already exists. Wrap the OrgDomains route (~lines 160-164) in the same conditional spread pattern used for skills/schedules:

Replace:
```typescript
            {
              path: ERoutePath.Domains,
              loader: orgDomainsLoader,
              Component: () => <SuspensePage Component={OrgDomains} />,
            },
```

With:
```typescript
            ...(isFeatureEnabled(`domains`)
              ? [
                  {
                    path: ERoutePath.Domains,
                    loader: orgDomainsLoader,
                    Component: () => <SuspensePage Component={OrgDomains} />,
                  },
                ]
              : []),
```

- [ ] **Step 2: Wrap ProjectDomains route in conditional spread**

In the same file, wrap the ProjectDomains route (~lines 264-268):

Replace:
```typescript
                {
                  path: ERoutePath.Domains,
                  loader: projectDomainsLoader,
                  Component: () => <SuspensePage Component={ProjectDomains} />,
                },
```

With:
```typescript
                ...(isFeatureEnabled(`domains`)
                  ? [
                      {
                        path: ERoutePath.Domains,
                        loader: projectDomainsLoader,
                        Component: () => <SuspensePage Component={ProjectDomains} />,
                      },
                    ]
                  : []),
```

- [ ] **Step 3: Run admin type check**

Run: `cd repos/admin && pnpm types`
Expected: Clean — no type errors.

---

### Task 8: Add skip guards to integration tests

**Files:**
- Modify: `repos/integration/playwright/tier2/crud-domains.spec.ts:1-13`
- Modify: `repos/integration/playwright/tier2/org-pages-rendering.spec.ts:110`

- [ ] **Step 1: Add skip guard to `crud-domains.spec.ts`**

In `repos/integration/playwright/tier2/crud-domains.spec.ts`, add the import and `beforeEach` skip guard:

```typescript
import { test, expect } from '../fixtures/auth'
import { isFeatureEnabled } from '@tdsk/domain'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  collectErrors,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-org-domains-page'
const FORM_ID = 'domain-form'

test.describe('Domains UI', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isFeatureEnabled('domains'), 'domains feature flag is disabled')
  })

  test('should navigate to domains page and display the table', async ({
```

- [ ] **Step 2: Add skip guard to `org-pages-rendering.spec.ts`**

In `repos/integration/playwright/tier2/org-pages-rendering.spec.ts`, add a skip guard to the Org Domains test (~line 110). The `isFeatureEnabled` import already exists on line 2:

```typescript
  test('Org Domains - renders Domains heading', async ({ authenticatedPage: page, ctx }) => {
    test.skip(!isFeatureEnabled('domains'), 'domains feature flag is disabled')
    const errors: string[] = []
```

- [ ] **Step 3: Verify integration tests compile**

Run: `cd repos/integration && npx tsc --noEmit`
Expected: Clean — no type errors.

---

### Task 9: Full verification

- [ ] **Step 1: Run domain tests**

Run: `cd repos/domain && pnpm test`
Expected: All pass.

- [ ] **Step 2: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All pass.

- [ ] **Step 3: Run type checks across all repos**

Run: `pnpm types` (from workspace root)
Expected: All repos type-check clean.

- [ ] **Step 4: Verify backend returns 404 for gated endpoints**

Run (from within K8s or via proxy):
```bash
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer <token>" https://px.local.threadedstack.app/_/orgs/<orgId>/domains --insecure
```
Expected: `404` (since flag is disabled).

- [ ] **Step 5: Verify proxy `/domains/validate` is NOT gated**

Run:
```bash
curl -s -o /dev/null -w '%{http_code}' https://px.local.threadedstack.app/domains/validate?domain=test.example.com --insecure
```
Expected: `403` (domain not found — NOT 404 from feature gate). This confirms the proxy validation endpoint is still live.
