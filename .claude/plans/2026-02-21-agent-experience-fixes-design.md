# Agent Experience Fixes — Design Document

**Date:** 2026-02-21
**Scope:** 4 issues (1 P0, 3 P1) across backend, database, and admin repos
**Status:** Approved

## Issues

| ID | Priority | Title | Repos |
|----|----------|-------|-------|
| 1 | P0 | Removing secrets from agent does not persist | backend, database, admin |
| 2 | P1 | Secrets selector shows UUID instead of name | admin |
| 3 | P1 | Providers selector showing empty tag | admin |
| 4 | P1 | Functions not loaded in function selector | admin |

## Issue 1: Agent Secrets Removal (P0, Cross-Repo)

### Root Cause

The write path for agent-secret associations is broken across 6 layers:

1. `AgentDrawer.tsx` sends `secrets: Secret[]` (full objects) in the agent save payload
2. `agentsApi.ts` passes this through unchanged
3. `updateAgent.ts` / `createAgent.ts` destructure `projectIds`, `functionIds`, `providerIds` but NOT `secrets` — it falls into `...agent` spread
4. `agent.ts` (database service) destructures `projects`, `functionIds`, `providerIds` but NOT `secretIds`
5. `base.ts` `update()` calls Drizzle `.set({...rest})` — `secrets` array is silently ignored (no column exists)
6. `#relations()` handles projects/functions/providers junction tables but has no secret handling

The read path works correctly — `with()` returns `{ secrets: true }`, and `agentsRelations` declares `secrets: many(secrets)`.

### Approach: `secretIds` Array (Mirroring Junction Pattern)

Selected over two alternatives:
- ~~Separate API endpoint~~ — doubles API calls, inconsistent with existing patterns
- ~~Handle full Secret objects~~ — fragile, fights against the ID-based pattern

### Key Architectural Difference: FK Pattern vs Junction Tables

Secrets use a direct FK column (`secrets.agentId`), not a junction table. The mutation pattern differs:

| | Junction (providers/functions) | FK (secrets) |
|---|---|---|
| Assign | `INSERT INTO agentProviders {agentId, providerId}` | `UPDATE secrets SET agentId = ? WHERE id = ?` |
| Detach all | `DELETE FROM agentProviders WHERE agentId = ?` | `UPDATE secrets SET agentId = NULL WHERE agentId = ?` |
| Constraint | Composite unique on junction | Exclusive arc CHECK: only one scope column non-null |

When reassigning a secret to an agent, the exclusive arc columns (`orgId`, `projectId`, `providerId`) must be cleared to satisfy the CHECK constraint.

### Changes by Layer

**Database — `repos/database/src/services/agent.ts`:**
- Add `secretIds?: string[]` to `TAgentInsertOpts` and `TAgentRelations`
- In `#relations()`, add secretIds handling:
  ```
  if (secretIds?.length) {
    for each secretId:
      UPDATE secrets SET agentId = id, orgId = NULL, projectId = NULL, providerId = NULL
      WHERE id = secretId
  }
  ```
- In `update()`: extract `secretIds` from data, add conditional detach (`UPDATE secrets SET agentId = NULL WHERE agentId = id`) before `#relations()` — only when `secretIds` is provided (not undefined)
- In `create()`: extract `secretIds` from data, pass to `#relations()`

**Backend — `repos/backend/src/endpoints/agents/updateAgent.ts`:**
- Add `secretIds = []` to the `req.body` destructuring alongside `projectIds`/`functionIds`/`providerIds`
- Pass `secretIds` through to the database service call

**Backend — `repos/backend/src/endpoints/agents/createAgent.ts`:**
- Same destructuring change as updateAgent

**Admin — `repos/admin/src/components/Agents/AgentDrawer.tsx`:**
- Change `onSave` payload from `secrets: Secret[]` to `secretIds: string[]` (the `selectedSecrets` state already stores IDs)

## Issue 2: Secrets Selector Shows UUID (P1)

### Root Cause

Race condition: `selectedSecrets` (IDs) is set synchronously from `agent.secrets` in the pre-population effect, but `secretsList` (used by `getOptionLabel` to resolve names) is empty until the async fetch completes. MUI Autocomplete renders chips immediately, `secretLabel()` falls back to returning the raw UUID.

### Fix

Seed `secretsList` from `agent.secrets` during the synchronous pre-population effect in `AgentDrawer.tsx`:
```typescript
if (agent.secrets?.length) {
  setSecretsList(prev => prev?.length ? prev : agent.secrets)
}
```

The async fetch will overwrite with the complete list when it resolves.

## Issue 3: Providers Selector Shows Empty Tag (P1)

### Root Cause

Same race condition. `providerIds` is set synchronously from `agent.providers?.map(p => p.id)`, but `aiProviders` is empty until `fetchProviders` resolves. `getProviderName(id)` returns UUID or empty string.

### Fix

Seed `aiProviders` from `agent.providers` during the synchronous pre-population effect:
```typescript
if (agent.providers?.length) {
  setAiProviders(prev => prev?.length ? prev : agent.providers
    .filter(p => p.type === 'ai')
    .map(p => ({ id: p.id, name: p.name || p.id }))
  )
}
```

## Issue 4: Functions Not Loaded in Selector (P1)

### Root Cause

Not a race condition — a missing code path. `AgentDrawer.tsx` only fetches functions when `projectId` is truthy. The `OrgAgents.tsx` page opens the drawer without passing `projectId`, so `fetchFunctions` is never called. Agents can have functions via project associations, but the selector shows empty.

### Fix

In the data-loading effect, use the agent's first project as a fallback:
```typescript
const effectiveProjectId = projectId || agent?.projects?.[0]?.id
if (effectiveProjectId) {
  const functionsResult = await fetchFunctions({ orgId, projectId: effectiveProjectId })
  // ...
}
```

Also seed `availableFunctions` from `agent.functions` during pre-population (same pattern as secrets/providers) to avoid showing UUIDs for pre-selected function IDs.

## Test Strategy

### Unit Tests

**Database (`agent.test.ts`):**
- `create()` with `secretIds` — verify secrets are attached (agentId set)
- `update()` with `secretIds` — verify old secrets detached, new ones attached
- `update()` with empty `secretIds` — verify all secrets detached
- `update()` without `secretIds` key — verify secrets untouched
- Verify exclusive arc columns cleared on attachment

**Backend (`agents.test.ts`):**
- `POST /agents` with `secretIds` — verify passed to DB service
- `PUT /agents/:id` with `secretIds` — verify passed to DB service
- `PUT /agents/:id` with `secretIds` removing a secret — verify detachment

### Integration Tests (`repos/integration`)

**Tier 1 — API Contract:**
- Create agent with `secretIds`, verify response includes secrets
- Update agent removing a `secretId`, verify it's detached
- Verify detached secret's `agentId` is NULL (re-fetch secret)

**Estimated additions:** ~8-12 unit tests, ~3-5 integration tests
