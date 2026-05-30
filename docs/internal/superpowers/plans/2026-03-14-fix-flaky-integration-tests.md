# Fix Flaky Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate flakiness in `ws-lifecycle.test.ts` and `repl-executor-llm.test.ts` integration tests by replacing hardcoded delays with event-driven waits, adding proper test timeouts, and adding retry resilience for LLM calls.

**Architecture:** Changes are test-only — no backend or agent code modified. Fix three categories: (1) race conditions from hardcoded `setTimeout` delays, (2) test timeouts shorter than cumulative LLM latency, (3) single-point-of-failure LLM calls without retry.

**Tech Stack:** Vitest, WebSocket (`ws`), TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `repos/integration/src/utils/ws-client.ts` | Modify | Filter ping messages, add `waitForMessage()` helper |
| `repos/integration/src/tier1/ws-lifecycle.test.ts` | Modify | Fix cancel + concurrent prompt tests, add test timeouts |
| `repos/integration/src/tier3/repl-executor-llm.test.ts` | Modify | Add retry to beforeAll LLM call, retry on message persistence |

---

## Chunk 1: ws-client.ts utilities

### Task 1: Filter Ping messages from collected messages

**Files:**
- Modify: `repos/integration/src/utils/ws-client.ts:67-78` (consumeWS message handler)
- Modify: `repos/integration/src/utils/ws-client.ts:144-151` (createWSConnection message handler)

- [ ] **Step 1: Add ping filter to consumeWS message handler**

In `consumeWS()`, skip `ping` messages so they don't pollute the messages array:

```typescript
// Line 69-70, after JSON.parse:
const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')) as WSMessage
if (msg.type === EWSEventType.Ping) return
messages.push(msg)
```

- [ ] **Step 2: Add ping filter to createWSConnection message handler**

In `createWSConnection()`, same pattern:

```typescript
// Line 146-147, after JSON.parse:
const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')) as WSMessage
if (msg.type === EWSEventType.Ping) return
messages.push(msg)
```

### Task 2: Add `waitForMessage()` helper

**Files:**
- Modify: `repos/integration/src/utils/ws-client.ts` (add new export after WSResult interface)

- [ ] **Step 1: Add the waitForMessage helper**

Add a utility that polls a messages array for a matching message type, with configurable timeout:

```typescript
export const waitForMessage = (
  messages: WSMessage[],
  type: string,
  timeoutMs = 15_000,
  pollMs = 100,
): Promise<WSMessage | null> =>
  new Promise((resolve) => {
    const start = Date.now()
    const iv = setInterval(() => {
      const match = messages.find(m => m.type === type)
      if (match) { clearInterval(iv); resolve(match) }
      else if (Date.now() - start >= timeoutMs) { clearInterval(iv); resolve(null) }
    }, pollMs)
  })
```

---

## Chunk 2: ws-lifecycle.test.ts fixes

### Task 3: Fix cancel test race condition

**Files:**
- Modify: `repos/integration/src/tier1/ws-lifecycle.test.ts:144-177`

- [ ] **Step 1: Replace hardcoded 3s delay with event-driven wait**

Replace the fixed `setTimeout(r, 3_000)` with `waitForMessage()` that waits for a `text_delta` event (proof that LLM has started streaming) before sending cancel:

```typescript
import { connectWS, consumeWS, createWSConnection, waitForMessage } from '../utils/ws-client'

// ... inside the cancel test:

// Wait for LLM to actually start streaming before cancelling
await waitForMessage(messages, EWSEventType.TextDelta, 15_000)
ws.send(JSON.stringify({ type: EWSEventType.Cancel }))
```

### Task 4: Fix concurrent prompt rejection test

**Files:**
- Modify: `repos/integration/src/tier1/ws-lifecycle.test.ts:303-333`

- [ ] **Step 1: Replace hardcoded 15s delay with event-driven wait for Done**

Replace `setTimeout(r, 15_000)` with `waitForMessage()` that waits for `done` event:

```typescript
// Wait for the agent to finish (Done event) instead of fixed 15s delay
await waitForMessage(messages, EWSEventType.Done, 60_000)
```

### Task 5: Add explicit test-level timeouts

**Files:**
- Modify: `repos/integration/src/tier1/ws-lifecycle.test.ts` (multiple tests)

- [ ] **Step 1: Add timeout to 2-sequential test**

```typescript
test.skipIf(!hasLLM())('session token can be reused across sequential WS connections', async () => {
  // ...
}, 180_000) // 2 sequential LLM calls × 60s + 60s buffer
```

- [ ] **Step 2: Add timeout to 3-sequential test**

```typescript
test.skipIf(!hasLLM())('session token works for a third sequential connection', async () => {
  // ...
}, 240_000) // 3 sequential LLM calls × 60s + 60s buffer
```

- [ ] **Step 3: Add timeout to concurrent connections test**

```typescript
test.skipIf(!hasLLM())('same session token supports concurrent WS connections', async () => {
  // ...
}, 180_000) // parallel but still needs buffer for LLM latency
```

- [ ] **Step 4: Add timeout to cancel test**

```typescript
test.skipIf(!hasLLM())('cancel message produces valid done reason', async () => {
  // ...
}, 120_000) // single LLM call + cancel wait + close wait
```

- [ ] **Step 5: Add timeout to concurrent prompt rejection test**

```typescript
test.skipIf(!hasLLM())('second prompt on same connection is rejected while first is running', async () => {
  // ...
}, 120_000) // single LLM call + error check
```

---

## Chunk 3: repl-executor-llm.test.ts fixes

### Task 6: Add retry to beforeAll LLM call

**Files:**
- Modify: `repos/integration/src/tier3/repl-executor-llm.test.ts:59-71`

- [ ] **Step 1: Wrap executor.run() in a retry loop**

Replace the single try/catch with a 2-attempt retry loop with backoff:

```typescript
const maxAttempts = 2
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    runResult = await executor.run({
      agentId,
      orgId: ctx.orgId,
      userId: ctx.userId,
      prompt: 'Respond with exactly: REPL_TEST_OK',
      onEvent: (event) => events.push(event),
    })
    if (runResult.threadId) threadIds.push(runResult.threadId)
    runError = null
    break
  } catch (err) {
    runError = err instanceof Error ? err : new Error(String(err))
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, 3_000))
      events.length = 0
    }
  }
}
```

### Task 7: Add retry for message persistence check

**Files:**
- Modify: `repos/integration/src/tier3/repl-executor-llm.test.ts:107-122`

- [ ] **Step 1: Add polling retry to listMessages call**

Replace the single `listMessages()` call with a retry loop that handles DB replication lag:

```typescript
test.skipIf(!hasProviderKey())(
  'user message persisted after run',
  async () => {
    expect(runResult).toBeTruthy()

    let userMessages: any[] = []
    for (let attempt = 0; attempt < 5; attempt++) {
      const messages = await executor.client.listMessages(
        ctx.orgId,
        agentId,
        runResult!.threadId
      )
      userMessages = messages.filter(m => m.type === 'user')
      if (userMessages.length > 0) break
      await new Promise(r => setTimeout(r, 1_000))
    }

    expect(userMessages.length).toBeGreaterThanOrEqual(1)
  }
)
```
