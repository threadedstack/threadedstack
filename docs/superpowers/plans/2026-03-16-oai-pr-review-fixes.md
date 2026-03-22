# OAI PR Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical, important, and suggested issues from the comprehensive PR review of the OpenAI-compatible API endpoints.

**Architecture:** Fixes are organized into 4 waves: (1) type refinements & dead code, (2) error handling & auth, (3) comment accuracy, (4) test coverage. Waves 1-3 can run in parallel. Wave 4 depends on waves 1-3.

**Tech Stack:** TypeScript, Express 5, Vitest

**Issue #5 (streaming error format):** Confirmed correct — bare `{ error: {...} }` matches OpenAI's actual SSE protocol. The `openai` SDK's SSE parser checks `if (data && data.error)` on the raw parsed object. No change needed.

**Issue #2 (integration tsconfig):** User confirmed this is intentional and aligned with other repos. No change needed.

---

## Chunk 1: Type Refinements & Dead Code Cleanup

### Task 1: Refine OAI types in `oai.types.ts`

**Files:**
- Modify: `repos/backend/src/types/oai.types.ts`

- [ ] **Step 1: Add `developer` role and narrow `finish_reason`**

> **Note:** Adding `developer` to the role union makes it a valid input type, but `convertOAIMessages` has no roleMap entry for it, so `developer` messages are intentionally skipped (not seeded and not used as systemPrompt). This matches how `system` messages are also excluded from `convertOAIMessages` — they are extracted separately via `buildOverrides`. If `developer` should be treated like `system`, that would be a separate feature enhancement. For now, the type accepts it (per OpenAI spec) and silently drops it (same as unknown roles).

```typescript
// Line 17: Add 'developer' to role union
export type TOAIMessage = {
  role: `system` | `user` | `assistant` | `tool` | `developer`
  content: string | TOAIContentPart[] | null
  name?: string
  tool_calls?: TOAIToolCall[]
  tool_call_id?: string
}

// Line 57: Narrow finish_reason on TOAIChoice
export type TOAIChoice = {
  index: number
  message: TOAIChoiceMessage
  finish_reason: `stop` | `length` | `tool_calls` | `content_filter` | null
}

// Line 63: Narrow finish_reason on TOAIChunkChoice
export type TOAIChunkChoice = {
  index: number
  delta: TOAIChoiceDelta
  finish_reason: `stop` | `length` | `tool_calls` | `content_filter` | null
}
```

- [ ] **Step 2: Narrow error type on `TOAIErrorBody`**

```typescript
// Line 87: Narrow type field
export type TOAIErrorBody = {
  error: {
    message: string
    type: `invalid_request_error` | `authentication_error` | `rate_limit_error` | `server_error`
    param: string | null
    code: string | null
  }
}
```

- [ ] **Step 3: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: PASS (or fix any cascading type errors from narrowed unions)

---

### Task 2: Extract `TAgentExecOverrides` and `THeadlessRunOpts`, remove `functionMap`

**Files:**
- Modify: `repos/backend/src/types/agent.types.ts`
- Modify: `repos/domain/src/types/epd.types.ts`
- Modify: `repos/backend/src/utils/agent/resolveAgentConfig.ts`

- [ ] **Step 1: Extract `TAgentExecOverrides` in `agent.types.ts`**

Replace the repeated `TAgentOverrides & { envVars?: Record<string, string> }` pattern:

```typescript
import type {
  Skill,
  Function,
  Agent,
  TLLMAdapterConfig,
  TAgentEnvironment,
  TSandboxConfig,
  TAgentOverrides,
} from '@tdsk/domain'
import type { IAgentRunnerDB } from '@tdsk/agent'
import type { TStreamEvent } from '@tdsk/domain'

export type TFunctionExecutionHandler = (
  functionId: string,
  input: unknown
) => Promise<{
  duration: number
  output: unknown
  success: boolean
  error?: string
}>

/** Extended overrides that include envVars (used by exec and resolve paths). */
export type TAgentExecOverrides = TAgentOverrides & {
  envVars?: Record<string, string>
}

/** Shared runtime fields between TSession and TResolvedAgentConfig. */
export type TAgentRuntimeConfig = {
  llmConfig: TLLMAdapterConfig
  sandboxConfig: TSandboxConfig
  environment?: TAgentEnvironment
  customFunctions: Function[]
  skills: Skill[]
  tools?: string[]
  envVars: Record<string, string>
  db: IAgentRunnerDB
  onExecuteFunction: TFunctionExecutionHandler
}

export type TResolvedAgentConfig = TAgentRuntimeConfig & {
  agent: Agent
  effectiveAgent: Agent
  orgId: string
}

export type TResolveAgentOpts = {
  userId?: string
  projectId?: string
  providerId?: string
  overrides?: TAgentExecOverrides
}

export type TAgentExecOpts = {
  agentId: string
  prompt: string
  userId: string
  threadId?: string
  projectId?: string
  providerId?: string
  overrides?: TAgentExecOverrides
  resolvedConfig?: TResolvedAgentConfig
}

/** Options for AgentEndpoint.runHeadless — adds onEvent callback to exec opts. */
export type THeadlessRunOpts = TAgentExecOpts & {
  onEvent: (event: TStreamEvent) => void
}
```

Key changes:
- `functionMap` removed from `TAgentRuntimeConfig` (it was derived state only used inside `onExecuteFunction`)
- `TAgentExecOverrides` replaces repeated `TAgentOverrides & { envVars?: ... }`
- `THeadlessRunOpts` named type for `runHeadless` parameter

- [ ] **Step 2: Update `epd.types.ts` to use `TAgentOverrides` import (already done)**

Verify that `TAgentEndpointConfig` in `repos/domain/src/types/epd.types.ts` already uses `TAgentOverrides` from the domain types. This type has endpoint-specific fields (`functionIds`, `providerIds`, `secrets`) that go beyond `TAgentExecOverrides`, so it correctly keeps its own extension. No change needed here — just verify.

- [ ] **Step 3: Update `resolveAgentConfig.ts` — keep `functionMap` as local variable**

In `repos/backend/src/utils/agent/resolveAgentConfig.ts`, `functionMap` is only used to build `onExecuteFunction`. Keep it as a local variable instead of exporting it on the return type:

```typescript
// Line 85: functionMap stays as local variable (no change to this line)
const functionMap = new Map(customFunctions.map((fn: any) => [fn.id, fn]))

// Line 142-156: Remove functionMap from return object
return {
  agent,
  effectiveAgent,
  llmConfig,
  sandboxConfig,
  environment: effectiveAgent.environment,
  customFunctions,
  skills: skills || [],
  tools: (overrides?.tools || effectiveAgent.tools) as string[] | undefined,
  envVars: (effectiveAgent.envVars as Record<string, string>) ?? {},
  db: createDBAdapter(db),
  orgId: agent.orgId,
  onExecuteFunction,
}
```

- [ ] **Step 4: Update `agentEndpoint.ts` to use `THeadlessRunOpts`**

In `repos/backend/src/services/endpoints/agentEndpoint.ts`, change `runHeadless` signature:

```typescript
import type { TRequest, TAgentExecOpts, THeadlessRunOpts } from '@TBE/types'

// Line 49: Use named type instead of anonymous intersection
runHeadless = async (
  req: TRequest,
  db: TDatabase,
  opts: THeadlessRunOpts
): Promise<{ threadId: string }> => {
```

- [ ] **Step 5: Update all consumers that reference `functionMap` on session/config**

Search for `functionMap` usage across the codebase and remove references. The `Websocket.#buildInitOpts` spreads session fields — verify it still works without `functionMap`. Since `TSession = TSessionPayload & TAgentRuntimeConfig` and `functionMap` is removed from `TAgentRuntimeConfig`, any code trying to read `session.functionMap` will get a type error (good — tells us what to fix).

Known test files that include `functionMap` in mock data (must remove):
- `repos/backend/src/endpoints/agents/oaiChatCompletions.test.ts` — `functionMap: new Map()` in mock config objects
- `repos/backend/src/endpoints/agents/runAgent.test.ts` — `functionMap: new Map()` in mock session/config objects

- [ ] **Step 6: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: PASS

---

### Task 3: Remove unused `db` parameter from `Websocket.#buildInitOpts`

**Files:**
- Modify: `repos/backend/src/services/websocket/websocket.ts`

- [ ] **Step 1: Remove `db` parameter**

```typescript
// Line 82-86: Remove db parameter
async #buildInitOpts(
  session: TSession,
  threadId: string
): Promise<TAgentInitOpts> {
```

- [ ] **Step 2: Update call sites**

```typescript
// Line 127: Remove db argument
const initOpts = await this.#buildInitOpts(session, threadId)
```

- [ ] **Step 3: Run type check and tests**

Run: `cd repos/backend && pnpm types && pnpm test`
Expected: PASS

---

## Chunk 2: Error Handling & Authorization

### Task 4: Add authorization checks to OAI endpoints

**Files:**
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.ts`
- Modify: `repos/backend/src/endpoints/agents/oaiModels.ts`
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.test.ts`
- Modify: `repos/backend/src/endpoints/agents/oaiModels.test.ts`

Pattern reference: `repos/backend/src/endpoints/agents/getAgent.ts` uses:
```typescript
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'
await checkPermission(req, EPermAction.read, EPermResource.agent, { orgId: agent.orgId })
```

- [ ] **Step 1: Add `checkPermission` to `oaiChatCompletions.ts`**

After `resolveAgentConfig` returns (which loads the agent), add a permission check:

```typescript
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

// After line 79 (after resolveAgentConfig try/catch), add:
try {
  await checkPermission(req, EPermAction.read, EPermResource.agent, {
    orgId: config.orgId,
  })
} catch (err) {
  const { status, body: errBody } = formatOAIError(err)
  res.status(status).json(errBody)
  return
}
```

- [ ] **Step 2: Add `checkPermission` to `oaiModels.ts`**

After agent lookup, add permission check. Since `oaiModels` already has an outer try-catch that calls `formatOAIError`, the `checkPermission` call can be added directly without its own try-catch — if it throws, the outer catch will format it:

```typescript
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

// After the agent-not-found check (line 37), add directly (no wrapping try-catch needed):
await checkPermission(req, EPermAction.read, EPermResource.agent, {
  orgId: agent.orgId,
})
```

- [ ] **Step 3: Add mock for `checkPermission` in both test files**

```typescript
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
}))
```

- [ ] **Step 4: Add auth denial tests to both test files**

```typescript
it(`should return 403 when user lacks permission`, async () => {
  const { checkPermission } = await import(`@TBE/utils/auth/checkPermission`)
  const mockCheck = checkPermission as ReturnType<typeof vi.fn>
  mockCheck.mockRejectedValueOnce(new Exception(403, `Forbidden`))

  const ep = getEndpointCfg(/* ... */)
  await ep.action(mockReq as TRequest, mockRes as Response)

  expect(mockFormatOAIError).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }))
  expect(mockStatus).toHaveBeenCalledWith(403)
})
```

- [ ] **Step 5: Run tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS

---

### Task 5: Fix message seeding — check `db.services.message.create()` return value

**Files:**
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.ts`
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.test.ts`

- [ ] **Step 1: Check return value of each `message.create` call**

Replace the seeding loop (lines 105-111):

```typescript
for (const msg of converted) {
  const { error: msgErr } = await db.services.message.create({
    threadId,
    type: msg.type,
    content: msg.content,
  })
  if (msgErr) {
    logger.error(`[OAI Chat] Failed to seed message`, {
      agentId,
      threadId,
      messageType: msg.type,
      error: msgErr instanceof Error ? msgErr.message : msgErr,
    })
    const { status, body: errBody } = formatOAIError(
      new Exception(500, `Failed to seed conversation message`)
    )
    res.status(status).json(errBody)
    return
  }
}
```

- [ ] **Step 2: Add test for message creation failure during seeding**

```typescript
it(`should return error if message creation fails during seeding`, async () => {
  const ep = getEndpointCfg(oaiChatCompletions as any)
  mockReq.body = {
    messages: [
      { role: `user`, content: `First` },
      { role: `user`, content: `Second` },
    ],
  }
  mockExtractPrompt.mockReturnValue(`Second`)
  mockConvertOAIMessages.mockReturnValue([
    { type: `user`, content: [{ type: `text`, text: `First` }] },
  ])
  const db = mockReq.app?.locals.db as any
  db.services.message.create.mockResolvedValue({ data: null, error: new Error(`DB write error`) })

  await ep.action(mockReq as TRequest, mockRes as Response)

  expect(mockStatus).toHaveBeenCalledWith(500)
  expect(mockJson).toHaveBeenCalled()
  expect(mockRunHeadless).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS

---

### Task 6: Fix `mapStopReason` — map `toolUse` to `tool_calls`

**Files:**
- Modify: `repos/backend/src/services/openai/responseAdapter.ts`
- Modify: `repos/backend/src/services/openai/responseAdapter.test.ts`

- [ ] **Step 1: Update `mapStopReason`**

```typescript
const mapStopReason = (reason: string): `stop` | `length` | `tool_calls` | `content_filter` => {
  switch (reason) {
    case EStreamStopReason.endTurn:
      return `stop`
    case EStreamStopReason.maxTokens:
      return `length`
    case EStreamStopReason.toolUse:
      return `tool_calls`
    default:
      return `stop`
  }
}
```

- [ ] **Step 2: Add test for `toolUse` stop reason mapping**

```typescript
it(`should map toolUse stop reason to tool_calls`, () => {
  const adapter = createNonStreamingAdapter(`chatcmpl-1`, `test-model`)
  adapter.onEvent({ type: EStreamEventType.done, stopReason: EStreamStopReason.toolUse })
  const result = adapter.build()
  expect(result.choices[0].finish_reason).toBe(`tool_calls`)
})
```

Also add a streaming test:

```typescript
it(`should map toolUse done event to tool_calls finish_reason`, () => {
  const res = createMockRes()
  const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
  adapter.onEvent({ type: EStreamEventType.done, stopReason: EStreamStopReason.toolUse })

  const chunk = JSON.parse(res._chunks[0].replace(`data: `, ``))
  expect(chunk.choices[0].finish_reason).toBe(`tool_calls`)
})
```

- [ ] **Step 3: Run tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS

---

### Task 7: Fix streaming error logging in `oaiChatCompletions.ts`

**Files:**
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.ts`

- [ ] **Step 1: Replace string logging with structured logging**

Replace lines 154-161:

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : `Agent execution failed`
  logger.error(`[OAI Chat] Streaming error`, {
    error: err instanceof Error ? err : message,
    stack: err instanceof Error ? err.stack : undefined,
    agentId,
    threadId,
  })
  if (!aborted) {
    res.write(`data: ${JSON.stringify({
      error: { message, type: `server_error`, param: null, code: null },
    })}\n\n`)
  }
}
```

This matches the pattern used in `agentEndpoint.ts:174`.

---

### Task 8: Add logging for `convertContent` fallback in `requestAdapter.ts`

**Files:**
- Modify: `repos/backend/src/services/openai/requestAdapter.ts`

- [ ] **Step 1: Add warning when content is replaced with placeholder**

```typescript
if (!part.image_url?.url) {
  logger.warn(`[OAI RequestAdapter] image_url content part has no URL, replacing with placeholder`)
  return { type: EContentType.text as const, text: `[unsupported content]` }
}
```

---

### Task 9: Fix `parseClientMsg` error handling in `onWSConnect.ts`

**Files:**
- Modify: `repos/backend/src/endpoints/ai/onWSConnect.ts`

- [ ] **Step 1: Distinguish SyntaxError from unexpected errors, add context to WS error handler**

```typescript
const parseClientMsg = (raw: Buffer | string): TWSClientMsg | null => {
  try {
    const msg = JSON.parse(typeof raw === `string` ? raw : raw.toString(`utf8`))
    if (!msg || typeof msg.type !== `string` || !ClientMsgTypes.has(msg.type)) return null
    return msg as TWSClientMsg
  } catch (err) {
    if (err instanceof SyntaxError) {
      logger.debug(`WS parse failed for message: ${String(raw).slice(0, 200)}`)
    } else {
      logger.warn(`WS unexpected parse error`, {
        error: err instanceof Error ? err.message : err,
      })
    }
    return null
  }
}
```

Also update the WebSocket error handler (line 112-114) to include context:

```typescript
ws.on(`error`, (err: Error) => {
  logger.error(`WebSocket error`, {
    error: err.message,
    stack: err.stack,
    agentId: payload.agentId,
    userId: payload.userId,
  })
})
```

---

### Task 10: Fix `formatOAIError` — extract info from non-Error values

**Files:**
- Modify: `repos/backend/src/services/openai/responseAdapter.ts`
- Modify: `repos/backend/src/services/openai/responseAdapter.test.ts`

- [ ] **Step 1: Improve message extraction for non-Error values**

```typescript
export const formatOAIError = (err: unknown): { status: number; body: TOAIErrorBody } => {
  const status = err instanceof Exception ? err.status : 500
  const message = err instanceof Error
    ? err.message
    : typeof err === `string`
      ? err
      : `Internal server error`

  // ... rest unchanged
}
```

- [ ] **Step 2: Update existing test and add new tests for string/unknown error values**

The existing test at `responseAdapter.test.ts` tests `formatOAIError('string error')` and expects `Internal server error`. After this change, it will return `'string error'` instead. Update the existing test and add new ones:

```typescript
// UPDATE the existing test (was testing string → generic, now string → uses the string)
it(`should use string message for string error values`, () => {
  const { body } = formatOAIError(`Rate limit exceeded`)
  expect(body.error.message).toBe(`Rate limit exceeded`)
})

// ADD a new test for truly unknown values (non-string, non-Error)
it(`should use generic message for non-string non-Error values`, () => {
  const { body } = formatOAIError(42)
  expect(body.error.message).toBe(`Internal server error`)
})
```

- [ ] **Step 3: Run tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS

---

### Task 11: Split `oaiModels` provider loop catch

**Files:**
- Modify: `repos/backend/src/endpoints/agents/oaiModels.ts`

- [ ] **Step 1: Split try-catch into provider resolution and model listing**

Replace lines 42-61:

```typescript
for (const provider of agent.providers || []) {
  let brand: string
  try {
    brand = resolveProviderType(provider as any)
  } catch (err) {
    logger.warn(`[OAI Models] Cannot resolve provider type`, {
      providerId: provider.id,
      agentId,
      error: err instanceof Error ? err.message : err,
    })
    continue
  }

  try {
    const providerModels = ModelRegistry.getModels(brand)
    for (const m of providerModels) {
      models.push({
        id: m.id,
        object: `model`,
        created,
        owned_by: brand,
      })
    }
  } catch (err) {
    logger.error(`[OAI Models] Failed to get models for provider`, {
      providerId: provider.id,
      brand,
      agentId,
      error: err instanceof Error ? err.message : err,
    })
  }
}
```

- [ ] **Step 2: Add test for `ModelRegistry.getModels` failure (separate from provider resolution)**

In `oaiModels.test.ts`, add a test covering the new inner catch for model listing failures:

```typescript
it(`should log error and continue when ModelRegistry.getModels throws`, async () => {
  const { resolveProviderType } = await import(`@TBE/utils/providers/resolveProviderType`)
  const { ModelRegistry } = await import(`@TBE/services/providers/modelRegistry`)
  const { logger } = await import(`@TBE/utils/logger`)

  const mockResolve = resolveProviderType as ReturnType<typeof vi.fn>
  const mockGetModels = ModelRegistry.getModels as ReturnType<typeof vi.fn>

  mockResolve.mockReturnValue(`anthropic`)
  mockGetModels.mockImplementation(() => { throw new Error(`Registry unavailable`) })

  const ep = getEndpointCfg(mockReq.app as TApp, oaiModels as any)
  await ep.action(mockReq as TRequest, mockRes as Response)

  expect(logger.error).toHaveBeenCalledWith(
    `[OAI Models] Failed to get models for provider`,
    expect.objectContaining({ brand: `anthropic`, error: `Registry unavailable` })
  )
  expect(mockStatus).toHaveBeenCalledWith(200)
  expect(mockJson).toHaveBeenCalledWith({ object: `list`, data: [] })
})
```

- [ ] **Step 3: Run tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS

---

## Chunk 3: Comment Fixes

### Task 12: Fix all comment accuracy issues

**Files:**
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.ts`
- Modify: `repos/backend/src/utils/agent/resolveAgentConfig.ts`
- Modify: `repos/backend/src/services/openai/requestAdapter.ts`
- Modify: `repos/backend/src/services/openai/responseAdapter.ts`
- Modify: `repos/backend/src/services/endpoints/agentEndpoint.ts`
- Modify: `repos/backend/src/services/websocket/websocket.ts`

- [ ] **Step 1: Fix `oaiChatCompletions.ts` JSDoc (lines 21-32)**

Replace:
```
 * When messages.length > 1, prior messages are seeded into the thread
 * as conversation history before running the agent.
```
With:
```
 * All messages except the last user message are seeded into a new thread
 * as conversation history. The last user message becomes the agent prompt.
```

- [ ] **Step 2: Fix `resolveAgentConfig.ts` JSDoc (lines 28-35)**

Replace:
```
 * Consolidates duplicated setup logic from:
 * - AgentEndpoint.run() (SSE path)
 * - resolveSession() in onWSConnect.ts (WebSocket path)
 * - Websocket.#buildInitOpts() in websocket.ts (WebSocket path)
```
With:
```
 * Consolidates agent setup logic shared by:
 * - SSE agent execution path (AgentEndpoint)
 * - WebSocket session resolution (onWSConnect)
 * - OpenAI-compat endpoints (oaiChatCompletions)
```

- [ ] **Step 3: Fix `requestAdapter.ts` — add cross-reference for system messages**

Change line 57-58 from:
```
 * System messages are excluded (handled separately as systemPrompt override).
```
To:
```
 * System messages are excluded — they are extracted as systemPrompt in buildOverrides().
```

- [ ] **Step 4: Fix `requestAdapter.ts` — document supported vs dropped OAI params**

Add to `buildOverrides` JSDoc (line 120-123):
```
 * Build TAgentRunOverrides from OpenAI request parameters.
 * Extracts system messages as systemPrompt override.
 *
 * Supported: model, temperature, max_tokens, max_completion_tokens, system messages.
 * Silently ignored: top_p, frequency_penalty, presence_penalty, stop, seed, response_format.
```

- [ ] **Step 5: Fix `responseAdapter.ts` — document exhaustive switch intent**

Change the comment at line 91-92 from:
```
// Events with no OpenAI equivalent — silently dropped
```
To:
```
// Events with no OpenAI equivalent — intentionally dropped.
// This switch should remain exhaustive over EStreamEventType values.
```

- [ ] **Step 6: Fix `agentEndpoint.ts` — clarify `[DONE]` convention**

Change line 186 from:
```
// SSE uses OpenAI-compatible `[DONE]` sentinel; WS uses typed JSON `{ type: "done" }`.
```
To:
```
// SSE streams terminate with `[DONE]` sentinel (same convention as OpenAI); WS uses typed JSON `{ type: "done" }`.
```

- [ ] **Step 7: Fix `websocket.ts` — remove transitional language**

Change line 263-264 from:
```
 * Maps the existing event types to the new WS protocol.
```
To:
```
 * Maps TStreamEvent types to EWSEventType WebSocket messages for client consumption.
```

Change lines 79-80 from:
```
 * Session now includes sandboxConfig, skills, functionMap, db, and
 * onExecuteFunction — all resolved by resolveAgentConfig().
```
To:
```
 * Session includes sandboxConfig, skills, db, and
 * onExecuteFunction — all resolved by resolveAgentConfig().
```

---

## Chunk 4: Test Coverage Additions

### Task 13: Add K8s sandbox path tests for `resolveAgentConfig`

**Files:**
- Modify: `repos/backend/src/utils/agent/resolveAgentConfig.test.ts`

- [ ] **Step 1: Add test for K8s sandbox with explicit podName**

```typescript
it(`should set sandbox podName from environment when provided`, async () => {
  const agent = buildMockAgent({
    environment: { temperature: 0.7, sandboxType: `kubernetes`, podName: `my-pod` },
  })
  const db = buildMockDb(agent)

  const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

  expect(result.sandboxConfig.provider).toBe(`kubernetes`)
  expect(result.sandboxConfig.options).toEqual({ podName: `my-pod` })
})
```

- [ ] **Step 2: Add test for K8s sandbox with dynamic startPod**

```typescript
it(`should start pod via sandbox.startPod when sandboxId provided`, async () => {
  const mockStartPod = vi.fn().mockResolvedValue(`started-pod-name`)
  const agent = buildMockAgent({
    environment: { temperature: 0.7, sandboxType: `kubernetes`, sandboxId: `sb-1` },
  })
  const db = buildMockDb(agent)
  const app = {
    locals: {
      config: { egress: { allowed: true } },
      sandbox: { startPod: mockStartPod },
    },
  } as unknown as TApp

  const result = await resolveAgentConfig(`agent-1`, db as any, app, {
    userId: `user-1`,
  })

  expect(mockStartPod).toHaveBeenCalledWith({
    userId: `user-1`,
    orgId: `org-1`,
    egressOpts: { allowed: true },
    projectId: ``,
    sandboxId: `sb-1`,
  })
  expect(result.sandboxConfig.options).toEqual({ podName: `started-pod-name` })
})
```

- [ ] **Step 3: Add test for K8s sandbox 503 when no podName available**

```typescript
it(`should throw 503 when K8s sandbox has no podName and no sandbox service`, async () => {
  const agent = buildMockAgent({
    environment: { temperature: 0.7, sandboxType: `kubernetes` },
  })
  const db = buildMockDb(agent)

  await expect(
    resolveAgentConfig(`agent-1`, db as any, buildMockApp())
  ).rejects.toThrow(`K8s sandbox not available`)
})
```

- [ ] **Step 4: Run tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS

---

### Task 14: Add streaming abort tests for `oaiChatCompletions`

**Files:**
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.test.ts`

- [ ] **Step 1: Add test for abort suppressing writes and finish**

```typescript
it(`should not write or finish when client disconnects during streaming`, async () => {
  const ep = getEndpointCfg(oaiChatCompletions as any)
  mockReq.body = { messages: [{ role: `user`, content: `Hello` }], stream: true }

  // Capture the close handler and fire it during runHeadless
  let closeHandler: () => void
  mockOn.mockImplementation((event: string, handler: () => void) => {
    if (event === `close`) closeHandler = handler
  })
  mockRunHeadless.mockImplementation(async () => {
    closeHandler!()
    return { threadId: `thread-1` }
  })

  await ep.action(mockReq as TRequest, mockRes as Response)

  // sendInitial is called before runHeadless, so it should have been called
  expect(mockSendInitial).toHaveBeenCalled()
  // But finish should NOT be called since client disconnected
  expect(mockFinish).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Add test for abort suppressing error writes**

```typescript
it(`should not write error when client disconnects during streaming error`, async () => {
  const ep = getEndpointCfg(oaiChatCompletions as any)
  mockReq.body = { messages: [{ role: `user`, content: `Hello` }], stream: true }

  let closeHandler: () => void
  mockOn.mockImplementation((event: string, handler: () => void) => {
    if (event === `close`) closeHandler = handler
  })
  mockRunHeadless.mockImplementation(async () => {
    closeHandler!()
    throw new Error(`LLM crashed`)
  })

  await ep.action(mockReq as TRequest, mockRes as Response)

  // Error write should be suppressed since client disconnected
  expect(mockWrite).not.toHaveBeenCalledWith(expect.stringContaining(`LLM crashed`))
  expect(mockFinish).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS

---

### Task 15: Add `resolveAgentConfig` error → OAI format test

**Files:**
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.test.ts`

- [ ] **Step 1: Add test for resolveAgentConfig failure returning OAI error**

```typescript
it(`should return OAI-formatted error when resolveAgentConfig fails`, async () => {
  const ep = getEndpointCfg(oaiChatCompletions as any)
  const { Exception } = await import(`@tdsk/domain`)
  mockResolveAgentConfig.mockRejectedValueOnce(new Exception(404, `Agent not found`))
  mockFormatOAIError.mockReturnValue({
    status: 404,
    body: { error: { message: `Agent not found`, type: `invalid_request_error`, param: null, code: null } },
  })

  await ep.action(mockReq as TRequest, mockRes as Response)

  expect(mockFormatOAIError).toHaveBeenCalled()
  expect(mockStatus).toHaveBeenCalledWith(404)
  expect(mockJson).toHaveBeenCalledWith(
    expect.objectContaining({
      error: expect.objectContaining({ message: `Agent not found` }),
    })
  )
  expect(mockRunHeadless).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS

---

### Task 16: Add remaining test gap coverage

**Files:**
- Modify: `repos/backend/src/services/openai/requestAdapter.test.ts`
- Modify: `repos/backend/src/services/openai/responseAdapter.test.ts`

- [ ] **Step 1: Add test for unknown roles skipped in `convertOAIMessages`**

```typescript
it(`should skip messages with unrecognized roles`, () => {
  const result = convertOAIMessages([
    { role: `developer` as any, content: `system instruction` },
    { role: `user`, content: `hello` },
  ])
  expect(result).toHaveLength(1)
  expect(result[0].type).toBe(EMsgType.user)
})
```

- [ ] **Step 2: Add test for `max_tokens` alone (without `max_completion_tokens`)**

```typescript
it(`should extract max_tokens as maxTokens`, () => {
  const result = buildOverrides({ messages: [], max_tokens: 500 })
  expect(result.maxTokens).toBe(500)
})
```

- [ ] **Step 3: Add tests for silently dropped streaming event types**

```typescript
it(`should silently drop toolCallStart events`, () => {
  const res = createMockRes()
  const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
  adapter.onEvent({ type: EStreamEventType.toolCallStart, id: `call-1`, name: `search` })
  expect(res.write).not.toHaveBeenCalled()
})

it(`should silently drop toolResult events`, () => {
  const res = createMockRes()
  const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
  adapter.onEvent({ type: EStreamEventType.toolResult, toolUseId: `call-1`, content: `result` })
  expect(res.write).not.toHaveBeenCalled()
})
```

- [ ] **Step 4: Run all tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS

---

## Final Validation

### Task 17: Full type check and test suite

- [ ] **Step 1: Run full type check across repos**

Run: `pnpm types`
Expected: All repos pass

- [ ] **Step 2: Run full backend test suite**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

- [ ] **Step 3: Run integration tests (if K8s available)**

Run: `cd repos/integration && npx vitest run --config configs/vitest.config.ts src/tier3/oai-compat.test.ts`
Expected: PASS (or skip if K8s not available)
