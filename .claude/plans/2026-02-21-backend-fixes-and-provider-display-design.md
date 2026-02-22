# Backend Fixes & Provider Display — Design

**Date:** 2026-02-21
**Tasks:** 3 (2 P0 + 1 P1)
**Repos:** backend, admin, integration

## Tasks

### 1. [P0] Usage page "Org Owner not found"

**Root cause:** `getOrgLimits.ts:26` and `checkQuota.ts:39` query the `roles` table via `db.services.role.getOrgOwner(orgId)`. If no `owner` role record exists, they throw HTTP 500 "Org owner not found".

**Key insight:** The `organizations` table has `ownerId` (NOT NULL, indexed) — the actual source of truth. The schema comment says "determines subscription/quota limits". Using the roles table is an unnecessary indirection.

**Fix:** Replace `getOrgOwner()` with `db.services.org.get(orgId)` → use `org.data.ownerId` directly. No changes to `createOrg.ts` needed (it already sets `ownerId` and creates an owner role).

**Files:**
- `repos/backend/src/endpoints/quotas/getOrgLimits.ts` — replace role lookup with org lookup
- `repos/backend/src/endpoints/quotas/checkQuota.ts` — same
- `repos/backend/src/endpoints/quotas/quotas.test.ts` — update mocks, add "no owner role" test

### 2. [P0] Secret resolver should not fallback

**Root cause:** `SecretResolver.resolveApiKey()` (lines 162-233) has 4-tier fallback: Direct → Agent-scoped → Provider-scoped → Org-scoped. Tiers 1-3 allow unintended secret resolution.

**Key insight:** `provider.secretId` is the required, explicit secret assignment. The 4-tier fallback breaks explicit secret management by silently pulling secrets from unrelated scopes.

**Fix:** Delete tiers 1-3. Keep only Tier 0 (direct `provider.secretId` lookup). Return empty string if no `secretId` or decryption fails. Callers already handle empty string → throw 400.

**Files:**
- `repos/backend/src/services/secrets/secretResolver.ts` — remove tiers 1-3
- `repos/backend/src/services/secrets/secretResolver.test.ts` — remove/update tier fallback tests

### 3. [P1] Provider not showing in Agents list

**Root cause:** Backend data pipeline (Drizzle eager load → AgentModel → JSON → `new Agent()`) looks correct. `ProjectAgents.tsx` already has a `getProviderName()` helper (lines 54-58) that looks up from Jotai providers atom, but it's never used in the column render.

**Fix (debug + fallback):**
1. Add backend test verifying agent list includes hydrated provider objects
2. Wire `getProviderName()` fallback into both `OrgAgents.tsx` and `ProjectAgents.tsx` column renders
3. Pattern: `agent.primaryProvider?.name || getProviderName(agent.providers?.[0]?.id) || '-'`

**Files:**
- `repos/admin/src/pages/Orgs/OrgAgents.tsx` — add provider fallback
- `repos/admin/src/pages/Projects/ProjectAgents.tsx` — wire existing helper
- `repos/backend/src/endpoints/agents/agents.test.ts` — add provider hydration test

### Integration Tests

All fixes get regression tests in `repos/integration/`:
1. Quota limits: `GET /quotas/:orgId/limits` returns 200 (not 500) for orgs without owner role
2. Secret resolver: Agent run with provider missing `secretId` → clear 400 error
3. Agent list: Fetch agents → provider name populated in response

## Approach Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Quota owner lookup | `org.ownerId` directly | NOT NULL, indexed, single source of truth |
| Secret resolver failure | Return empty string | Preserves existing caller contract (throw 400) |
| Provider display | Admin fallback + backend test | Defensive — works regardless of data pipeline state |
