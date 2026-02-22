# Backend Fixes & Provider Display — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two P0 backend bugs (quota owner lookup, secret resolver fallback) and debug/fix the provider display pipeline in the admin agents list.

**Architecture:** Three independent fixes across `repos/backend` and `repos/admin`. Task 1 replaces role-based owner lookup with direct `org.ownerId`. Task 2 strips 3 fallback tiers from `SecretResolver.resolveApiKey()`. Task 3 wires a Jotai-based provider name fallback into both agent list pages.

**Tech Stack:** TypeScript, Express 5, Vitest, Drizzle ORM, React, Jotai, MUI

**CRITICAL GIT RULE:** NEVER commit, amend, revert, or change git history. Read-only git only (`git status`, `git diff`, `git log`). User handles all commits manually.

---

## Task 1: Fix Quota Owner Lookup (P0)

Replace `db.services.role.getOrgOwner(orgId)` with `db.services.org.get(orgId)` → use `org.data.ownerId` directly. The `organizations.ownerId` column is NOT NULL and indexed — the single source of truth.

**Files:**
- Modify: `repos/backend/src/endpoints/quotas/getOrgLimits.ts:25-31`
- Modify: `repos/backend/src/endpoints/quotas/checkQuota.ts:38-44`
- Modify: `repos/backend/src/endpoints/quotas/quotas.test.ts` (multiple sections)

### Step 1: Update test mocks — add `org.get` mock, remove `role.getOrgOwner` mock

In `repos/backend/src/endpoints/quotas/quotas.test.ts`, the mock app needs `db.services.org.get` instead of `db.services.role.getOrgOwner`.

**Replace the mock app's `db.services` block** (lines 31-42). Add `org: { get: vi.fn() }` and remove `getOrgOwner` from the `role` mock:

```typescript
// OLD (lines 31-42):
        services: {
          quota: {
            findByOrgAndPeriod: vi.fn(),
          },
          role: {
            getOrgOwner: vi.fn(),
            isOrgMember: vi.fn(),
          },
          subscription: {
            findByUser: vi.fn(),
          },
        },

// NEW:
        services: {
          quota: {
            findByOrgAndPeriod: vi.fn(),
          },
          org: {
            get: vi.fn(),
          },
          role: {
            isOrgMember: vi.fn(),
          },
          subscription: {
            findByUser: vi.fn(),
          },
        },
```

Run: `cd repos/backend && pnpm test -- --run src/endpoints/quotas/quotas.test.ts`
Expected: Multiple test failures (tests still reference `mockGetOrgOwner`)

### Step 2: Update `getOrgLimits` happy-path test to use `org.get`

In `quotas.test.ts`, the test "should return 200 with plan limits for org" (lines 226-270) uses `mockGetOrgOwner`. Replace with `org.get`.

```typescript
// OLD (lines 244-252):
      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrgOwner.mockResolvedValue({ data: { userId: 'owner_123' } })

// NEW:
      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrg = mockReq.app?.locals.db.services.org
        .get as ReturnType<typeof vi.fn>
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: 'owner_123' } })
```

Also update the assertion (line 263):
```typescript
// OLD:
      expect(mockGetOrgOwner).toHaveBeenCalledWith(mockOrgId)

// NEW:
      expect(mockGetOrg).toHaveBeenCalledWith(mockOrgId)
```

### Step 3: Update `getOrgLimits` free-tier test

In the test "should return free tier limits if owner has no subscription" (lines 272-309), same mock replacement:

```typescript
// OLD (lines 290-298):
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrgOwner.mockResolvedValue({ data: { userId: 'owner_123' } })

// NEW:
      const mockGetOrg = mockReq.app?.locals.db.services.org
        .get as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: 'owner_123' } })
```

### Step 4: Replace "should return 500 if org owner not found" test for `getOrgLimits`

The current test (lines 333-347) tests `getOrgOwner` returning null. Replace it with a test that checks `org.get` returning null (org not found):

```typescript
// OLD (lines 333-347):
    it('should return 500 if org owner not found', async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrgOwner.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Org owner not found'
      )
    })

// NEW:
    it('should return 500 if org not found', async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrg = mockReq.app?.locals.db.services.org
        .get as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrg.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Organization not found'
      )
    })
```

### Step 5: Update "should return 500 on database error" test for `getOrgLimits`

In the test (lines 349-364), replace `mockGetOrgOwner` with `mockGetOrg`:

```typescript
// OLD (lines 353-359):
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrgOwner.mockResolvedValue({ error: mockError })

// NEW:
      const mockGetOrg = mockReq.app?.locals.db.services.org
        .get as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrg.mockResolvedValue({ error: mockError })
```

### Step 6: Update all `checkQuota` tests that reference `mockGetOrgOwner`

All `checkQuota` tests that set up `mockGetOrgOwner` need the same replacement. The affected tests are:

1. **"should allow action within quota"** (line 375) — replace `mockGetOrgOwner` refs
2. **"should deny action exceeding quota"** (line 416) — same
3. **"should default amount to 1"** (line 457) — same
4. **"should return 400 for invalid resource"** (line 530) — same
5. **"should return 500 if org owner not found"** (line 561) — REPLACE entire test (same as Step 4 pattern)
6. **"should return 500 if product not configured"** (line 581) — same
7. **"should return 500 if failed to fetch limits"** (line 607) — same
8. **"should use tier-based product lookup"** (line 666) — same

For each, the pattern is identical:
```typescript
// OLD:
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>
      ...
      mockGetOrgOwner.mockResolvedValue({ data: { userId: 'owner_123' } })

// NEW:
      const mockGetOrg = mockReq.app?.locals.db.services.org
        .get as ReturnType<typeof vi.fn>
      ...
      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: 'owner_123' } })
```

For the checkQuota "should return 500 if org owner not found" test (line 561):
```typescript
// OLD (lines 561-579):
    it('should return 500 if org owner not found', async () => {
      ...
      mockGetOrgOwner.mockResolvedValue({ data: null })
      await expect(...).rejects.toThrow('Org owner not found')
    })

// NEW:
    it('should return 500 if org not found', async () => {
      ...
      mockGetOrg.mockResolvedValue({ data: null })
      await expect(...).rejects.toThrow('Organization not found')
    })
```

Run: `cd repos/backend && pnpm test -- --run src/endpoints/quotas/quotas.test.ts`
Expected: FAIL — tests expect new behavior but source still uses `getOrgOwner`

### Step 7: Add new test — org exists but ownerId is missing

Add a new test after "should return 500 if org not found" in the `getOrgLimits` section:

```typescript
    it('should return 500 if org has no ownerId', async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrg = mockReq.app?.locals.db.services.org
        .get as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: null } })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Organization not found'
      )
    })
```

Run: `cd repos/backend && pnpm test -- --run src/endpoints/quotas/quotas.test.ts`
Expected: FAIL — source code not updated yet

### Step 8: Implement fix in `getOrgLimits.ts`

Replace lines 25-31 in `repos/backend/src/endpoints/quotas/getOrgLimits.ts`:

```typescript
// OLD (lines 25-31):
    // Get org owner through roles table
    const ownerRole = await db.services.role.getOrgOwner(orgId)

    if (ownerRole.error || !ownerRole.data)
      throw new Exception(500, ownerRole.error?.message || `Org owner not found`)

    const ownerId = ownerRole.data.userId

// NEW:
    // Get org to determine owner
    const orgResult = await db.services.org.get(orgId)

    if (orgResult.error || !orgResult.data?.ownerId)
      throw new Exception(500, orgResult.error?.message || `Organization not found`)

    const ownerId = orgResult.data.ownerId
```

### Step 9: Implement fix in `checkQuota.ts`

Replace lines 38-44 in `repos/backend/src/endpoints/quotas/checkQuota.ts`:

```typescript
// OLD (lines 38-44):
    // Get org owner through roles table
    const ownerRole = await db.services.role.getOrgOwner(orgId)

    if (ownerRole.error || !ownerRole.data)
      throw new Exception(500, ownerRole.error?.message || `Org owner not found`)

    const ownerId = ownerRole.data.userId

// NEW:
    // Get org to determine owner
    const orgResult = await db.services.org.get(orgId)

    if (orgResult.error || !orgResult.data?.ownerId)
      throw new Exception(500, orgResult.error?.message || `Organization not found`)

    const ownerId = orgResult.data.ownerId
```

### Step 10: Run tests and verify all pass

Run: `cd repos/backend && pnpm test -- --run src/endpoints/quotas/quotas.test.ts`
Expected: ALL PASS

Run: `cd repos/backend && pnpm test -- --run`
Expected: ALL PASS (no regressions)

---

## Task 2: Remove Secret Resolver Fallback Tiers (P0)

Strip tiers 1-3 from `SecretResolver.resolveApiKey()`. Only Tier 0 (direct `provider.secretId` lookup) should remain. Return empty string if no `secretId` or decryption fails.

**Files:**
- Modify: `repos/backend/src/services/secrets/secretResolver.ts:162-233`
- Modify: `repos/backend/src/services/secrets/secretResolver.test.ts:172-291`

### Step 11: Update tests first — remove tier fallback tests, add new direct-only tests

In `repos/backend/src/services/secrets/secretResolver.test.ts`, the `resolveApiKey` test suite (lines 172-291) has these tests:

| Test | Lines | Action |
|------|-------|--------|
| Tier 0 success | 177-193 | KEEP as-is |
| Fallback to Tier 1 when no secretId | 195-211 | REPLACE |
| Fallback when secretId lookup returns null | 213-232 | REPLACE |
| Fallback when direct decrypt fails | 234-257 | REPLACE |
| Full 4-tier traversal | 259-278 | REMOVE |
| All tiers fail returns empty string | 280-290 | UPDATE |

**Replace** the tier 1/2/3 tests with these new tests:

```typescript
  // REPLACE test at line 195 ("should fall back to Tier 1 when secretId is not set"):
  it(`should return empty string when provider has no secretId`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveApiKey(
      { orgId: `org-1`, secrets: [] },
      { id: `prov-1` } // no secretId
    )

    expect(result).toBe(``)
    expect(db.services.secret.get).not.toHaveBeenCalled()
    expect(db.services.secret.list).not.toHaveBeenCalled()
  })

  // REPLACE test at line 213 ("should fall back when secretId lookup returns no data"):
  it(`should return empty string when secretId lookup returns no data`, async () => {
    const db = createMockDb()
    ;(db.services.secret.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
    })
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveApiKey(
      { orgId: `org-1`, secrets: [] },
      { id: `prov-1`, secretId: `secret-missing` }
    )

    expect(result).toBe(``)
    expect(db.services.secret.get).toHaveBeenCalledWith(`secret-missing`)
    expect(db.services.secret.list).not.toHaveBeenCalled()
  })

  // REPLACE test at line 234 ("should fall back when direct secret decryption fails"):
  it(`should return empty string when direct secret decryption fails`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    const mockDecrypt = decryptValue as ReturnType<typeof vi.fn>
    mockDecrypt.mockResolvedValueOnce(null) // decrypt fails

    const db = createMockDb()
    ;(db.services.secret.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { encryptedValue: fakeEncrypted(), orgId: `org-1` },
    })
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveApiKey(
      { orgId: `org-1`, secrets: [] },
      { id: `prov-1`, secretId: `secret-broken` }
    )

    expect(result).toBe(``)
    expect(db.services.secret.list).not.toHaveBeenCalled()
  })

  // REMOVE test at line 259 ("should fall back through all tiers to org-scoped") — DELETE entirely

  // UPDATE test at line 280 ("should return empty string when no secrets found anywhere"):
  // Already correct behavior — keep as-is, it tests no secretId → empty string
```

Run: `cd repos/backend && pnpm test -- --run src/services/secrets/secretResolver.test.ts`
Expected: FAIL — 3 new tests fail because source still has fallback tiers

### Step 12: Implement the fix — strip tiers 1-3 from `resolveApiKey`

In `repos/backend/src/services/secrets/secretResolver.ts`, replace lines 155-233 (the entire `resolveApiKey` method and its JSDoc):

```typescript
// OLD (lines 155-233):
  /**
   * Resolve an API key from secrets using a 4-tier fallback:
   * 0. Direct secret link via provider.secretId (O(1) lookup)
   * 1. Agent+provider-scoped secrets (agent relation filtered by providerId)
   * 2. Provider-scoped secrets (query by providerId)
   * 3. Org-scoped secrets (query by orgId)
   */
  resolveApiKey = async (
    agent: {
      secrets?: Array<{
        encryptedValue: string
        orgId?: string
        projectId?: string
        providerId?: string
        agentId?: string
      }>
      orgId: string
    },
    provider: { id: string; secretId?: string }
  ): Promise<string> => {
    let apiKey = ``

    // 0. Direct secret link (O(1) lookup)
    if (provider.secretId) {
      const { data: secret } = await this.db.services.secret.get(provider.secretId)
      if (secret?.encryptedValue) {
        const value = await this.decrypt(secret, agent.orgId)
        if (value) return value
      }
    }

    const providerId = provider.id

    // 1. Try agent-scoped secrets that match the target provider
    if (agent.secrets?.length) {
      const providerSecrets = agent.secrets.filter((s) => s.providerId === providerId)
      for (const secret of providerSecrets) {
        const value = await this.decrypt(secret, agent.orgId)
        if (value) {
          apiKey = value
          break
        }
      }
    }

    // 2. Try provider-scoped secrets
    if (!apiKey) {
      const { data: providerSecrets } = await this.db.services.secret.list({
        where: { providerId },
      })
      if (providerSecrets?.length) {
        for (const secret of providerSecrets) {
          const value = await this.decrypt(secret, agent.orgId)
          if (value) {
            apiKey = value
            break
          }
        }
      }
    }

    // 3. Try org-scoped secrets
    if (!apiKey) {
      const { data: orgSecrets } = await this.db.services.secret.list({
        where: { orgId: agent.orgId },
      })
      if (orgSecrets?.length) {
        for (const secret of orgSecrets) {
          const value = await this.decrypt(secret, agent.orgId)
          if (value) {
            apiKey = value
            break
          }
        }
      }
    }

    return apiKey
  }

// NEW:
  /**
   * Resolve an API key via provider.secretId (direct O(1) lookup only).
   * Returns empty string if no secretId set or decryption fails.
   * Callers handle empty string by throwing 400.
   */
  resolveApiKey = async (
    agent: {
      secrets?: Array<{
        encryptedValue: string
        orgId?: string
        projectId?: string
        providerId?: string
        agentId?: string
      }>
      orgId: string
    },
    provider: { id: string; secretId?: string }
  ): Promise<string> => {
    if (!provider.secretId) return ``

    const { data: secret } = await this.db.services.secret.get(provider.secretId)
    if (!secret?.encryptedValue) return ``

    const value = await this.decrypt(secret, agent.orgId)
    return value || ``
  }
```

### Step 13: Run secret resolver tests

Run: `cd repos/backend && pnpm test -- --run src/services/secrets/secretResolver.test.ts`
Expected: ALL PASS

### Step 14: Run full backend test suite

Run: `cd repos/backend && pnpm test -- --run`
Expected: ALL PASS (no regressions — callers already handle empty string)

---

## Task 3: Fix Provider Display in Agents List (P1)

Debug and fix the provider name display pipeline. Both `OrgAgents.tsx` and `ProjectAgents.tsx` show `agent.primaryProvider?.name || '-'`. The backend data pipeline (Drizzle eager load → `AgentModel` → `new Agent()`) looks correct, but `ProjectAgents.tsx` has an unused `getProviderName()` Jotai fallback. Wire it in as a defensive fallback.

**Files:**
- Modify: `repos/backend/src/endpoints/agents/agents.test.ts` — add provider hydration test
- Modify: `repos/admin/src/pages/Projects/ProjectAgents.tsx:169`
- Modify: `repos/admin/src/pages/Orgs/OrgAgents.tsx:146-153`

### Step 15: Add backend test verifying agent list includes provider data

In `repos/backend/src/endpoints/agents/agents.test.ts`, add a test inside the `GET /_/agents - List agents` describe block (after the existing happy-path test at ~line 140):

```typescript
    it(`should return agents with hydrated provider objects`, async () => {
      const mockAgents = [
        new Agent({
          id: `agent-1`,
          name: `Agent One`,
          orgId: `org-1`,
          providers: [
            { id: `provider-1`, name: `Anthropic`, type: `ai`, orgId: `org-1` },
          ] as any,
          projects: [],
        }),
      ]

      const mockList = mockReq.app?.locals.db.services.agent.list as ReturnType<
        typeof vi.fn
      >
      mockList.mockResolvedValue({ data: mockAgents })
      mockReq.params = { orgId: `org-1` }

      await ep.action(mockReq as TRequest, mockRes as Response)

      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].providers).toHaveLength(1)
      expect(responseData[0].providers[0].name).toBe(`Anthropic`)
      expect(responseData[0].primaryProvider?.name).toBe(`Anthropic`)
    })
```

Run: `cd repos/backend && pnpm test -- --run src/endpoints/agents/agents.test.ts`
Expected: PASS (this test validates the existing backend pipeline is correct)

### Step 16: Wire `getProviderName()` fallback into `ProjectAgents.tsx`

In `repos/admin/src/pages/Projects/ProjectAgents.tsx`, the `getProviderName` helper exists (lines 54-58) but is unused. Wire it into the provider column render (line 169):

```typescript
// OLD (line 169):
          {agent.primaryProvider?.name || '-'}

// NEW:
          {agent.primaryProvider?.name || getProviderName(agent.providers?.[0]?.id) || '-'}
```

### Step 17: Add `getProviderName()` helper and wire it into `OrgAgents.tsx`

`OrgAgents.tsx` loads `providers` from Jotai (line 30) but has no `getProviderName()` helper. Add one and wire it in.

Add the helper after the `useEffect` blocks (after line 44):

```typescript
  const getProviderName = (providerId: string) => {
    if (!providers || !providerId) return ''
    const provider = providers[providerId]
    return provider?.name || ''
  }
```

Then update the provider column render (line 151):

```typescript
// OLD (line 151):
          {agent.primaryProvider?.name || '-'}

// NEW:
          {agent.primaryProvider?.name || getProviderName(agent.providers?.[0]?.id) || '-'}
```

### Step 18: Run backend tests

Run: `cd repos/backend && pnpm test -- --run`
Expected: ALL PASS

### Step 19: Build admin to verify no TypeScript errors

Run: `cd repos/admin && pnpm build`
Expected: Build succeeds with no errors

---

## Final Verification

### Step 20: Run full backend test suite

Run: `cd repos/backend && pnpm test -- --run`
Expected: ALL PASS

### Step 21: Verify no cross-repo regressions

Run: `cd repos/backend && pnpm build`
Expected: Build succeeds

The changes are fully contained:
- **Task 1**: Only `repos/backend` — swaps `role.getOrgOwner()` → `org.get()` in 2 files
- **Task 2**: Only `repos/backend` — removes dead code paths from `secretResolver.ts`
- **Task 3**: `repos/backend` (test only) + `repos/admin` (2 UI files) — no API contract changes

No database schema changes. No domain model changes. No proxy changes.
