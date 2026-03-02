# Integration Tests for Pi-Mono Changes

## Context

All pi-mono integration batches (0–4) are complete: skills/schedules CRUD, file upload, thread branching, WebSocket enhancements, auth unification, admin UI pages, and REPL pi-tui migration. Five new integration test files already exist as untracked files but need fixes (fake API keys). Additional test coverage is needed for thread branching, REPL fork/tree commands, and the `?include=branches,parent` thread query.

**Goal**: Complete integration test coverage for all new pi-mono features.

---

## Existing Tests to Fix (Fake API Keys)

The 5 untracked test files use fake keys like `'sk-test-schedule-lifecycle'`. Per project rules, all integration tests must use `env.testProviderKey` with `providerBrand: 'zai'`, and fall back to `env.testZaiAgentId || env.testAgentId`.

**Pattern to apply** (from `ws-close-resilience.test.ts`):

```typescript
const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

beforeAll(async () => {
  if (env.testProviderKey) {
    const qsRes = await post(`/orgs/${ctx.orgId}/quickstart`, {
      providerBrand: 'zai',
      apiKey: env.testProviderKey,
      projectName: uniqueName('...'),
      agentName: uniqueName('...'),
    })
    if (qsRes.status === 201 && qsRes.data?.data?.agent?.id) {
      qsResult = qsRes.data.data
      agentId = qsResult.agent.id
    }
  }
  if (!agentId) agentId = getAgentId()
})
```

### Files to fix

| File | Change |
|------|--------|
| `repos/integration/src/tier1/schedule-lifecycle.test.ts` | Replace `providerBrand: 'anthropic'` + `apiKey: 'sk-test-schedule-lifecycle'` with `env.testProviderKey` + `providerBrand: 'zai'` pattern. Add `env` import. Add `hasLLM()` guard or use `test.skipIf` for setup |
| `repos/integration/src/tier1/skill-lifecycle.test.ts` | Same fix — replace `'sk-test-skill-lifecycle'` |
| `repos/integration/src/tier1/thread-file-upload.test.ts` | Same fix — replace `'sk-test-upload-lifecycle'` |
| `repos/integration/src/tier1/thread-message-order.test.ts` | Same fix — replace `'sk-test-msg-order'` |

> `ws-close-resilience.test.ts` already uses the correct pattern — no changes needed.

---

## New Test Files

### 1. `repos/integration/src/tier1/thread-branching.test.ts`

**Tests thread branching API and `?include=branches,parent` query param.**

Setup: quickstart agent → create thread → create 4 messages (user/assistant alternating with delays).

| Test | Endpoint | Assertion |
|------|----------|-----------|
| `POST branch with valid messageId returns 201` | `POST /orgs/:orgId/agents/:agentId/threads/:threadId/branch` | Status 201, response has `id`, `parentThreadId === originalThreadId`, `branchMessageId === messageId`, messages array with messages up to branch point |
| `branched thread contains messages up to branch point only` | `GET .../threads/:branchedThreadId/messages` | Only messages at or before the branch messageId are present |
| `GET thread with ?include=branches shows branches` | `GET .../threads/:threadId?include=branches` | Response has `branches` array containing the branched thread |
| `GET thread with ?include=parent shows parent` | `GET .../threads/:branchedThreadId?include=parent` | Response has `parentThread` with original thread's ID |
| `GET thread with ?include=branches,parent shows both` | `GET .../threads/:branchedThreadId?include=branches,parent` | Both `branches` and `parentThread` present |
| `POST branch with missing messageId returns 400` | `POST .../branch` with `{}` | Status 400 |
| `POST branch with non-existent messageId returns 404 or 400` | `POST .../branch` with `{ messageId: 'zz99999999' }` | Status 404 or 400 |
| `POST branch on non-existent thread returns 404` | `POST .../threads/zz99999999/branch` | Status 404 |
| `POST branch without auth returns 401` | `POST .../branch` with `noAuth: true` | Status 401 |

**Cleanup**: Delete branched thread, original thread, quickstart resources.

**Utilities**: `get`, `post`, `del` from `api-client`, `readContext`, `tryDelete`, `uniqueName`, `env`.

### 2. `repos/integration/src/tier1/repl-thread-branching.test.ts`

**Tests REPL ApiClient `branchThread` and `getThread` with include against live backend.**

Setup: `createTestAuth()` → `new ApiClient(auth)` → quickstart via `post()` → create thread + messages.

| Test | Method | Assertion |
|------|--------|-----------|
| `branchThread returns Thread with parentThreadId` | `client.branchThread(orgId, agentId, threadId, messageId)` | Returns `Thread` instance, `parentThreadId` set, `branchMessageId` set |
| `getThread with include=branches returns branches` | `client.getThread(orgId, agentId, threadId, { include: ['branches'] })` | Thread has `branches` array |
| `getThread with include=parent on branched thread` | `client.getThread(orgId, agentId, branchedId, { include: ['parent'] })` | Thread has `parentThread` |

**Imports**: `ApiClient` from `@tdsk/repl`, `Thread` from `@tdsk/domain`, `createTestAuth` from `repl-auth`, `cleanupQuickstart`, `cleanupThread` from `repl-cleanup`.

---

## Implementation Steps

### Step 1: Fix fake API keys (4 files)
For each of the 4 files:
1. Add `import { env } from '../utils/env'`
2. Add `const getAgentId = () => env.testZaiAgentId || env.testAgentId`
3. Replace `beforeAll` quickstart block to use `env.testProviderKey` with `providerBrand: 'zai'`
4. When `!env.testProviderKey`, fall back to `getAgentId()` for `agentId`
5. For tests that don't need an LLM but do need an agent, skip if setup failed (existing `setupFailed` pattern works)

### Step 2: Create `thread-branching.test.ts`
1. Create file at `repos/integration/src/tier1/thread-branching.test.ts`
2. Follow the exact pattern from `skill-lifecycle.test.ts` (quickstart setup + cleanup)
3. Use `env.testProviderKey` / `providerBrand: 'zai'` pattern
4. Create thread + 4 messages in `beforeAll` (reuse pattern from `thread-message-order.test.ts`)
5. Implement all 9 tests from the table above
6. Cleanup: branched threads, original thread, quickstart resources

### Step 3: Create `repl-thread-branching.test.ts`
1. Create file at `repos/integration/src/tier1/repl-thread-branching.test.ts`
2. Follow exact pattern from `repl-api-client.test.ts` (createTestAuth + ApiClient)
3. Create thread + messages in `beforeAll`
4. Implement 3 tests from the table above
5. Cleanup via `cleanupThread` + `cleanupQuickstart`

### Step 4: Run all integration tests
```bash
cd repos/integration && pnpm test
```
Verify all new and fixed tests pass. Fix any failures.

### Step 5: Run type checks
```bash
pnpm types
```

---

## Verification

```bash
# Run all integration tests (tier1 + tier3)
cd repos/integration && pnpm test

# Run just the new/fixed tests in isolation
cd repos/integration && pnpm test -- --reporter=verbose src/tier1/thread-branching.test.ts
cd repos/integration && pnpm test -- --reporter=verbose src/tier1/repl-thread-branching.test.ts
cd repos/integration && pnpm test -- --reporter=verbose src/tier1/schedule-lifecycle.test.ts
cd repos/integration && pnpm test -- --reporter=verbose src/tier1/skill-lifecycle.test.ts
cd repos/integration && pnpm test -- --reporter=verbose src/tier1/thread-file-upload.test.ts
cd repos/integration && pnpm test -- --reporter=verbose src/tier1/thread-message-order.test.ts

# Type checks
pnpm types
```

**Success criteria**: All integration tests pass (including pre-existing ones). No type errors.
