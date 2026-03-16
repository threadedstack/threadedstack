# OAI-Compatible API — PR Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 14 issues identified in the PR review for the OpenAI-compatible API implementation — type normalization, critical bug fixes, error handling improvements, and test coverage.

**Architecture:** Extract shared base types in domain and backend, relocate OAI types from service to types directory, eliminate double `resolveAgentConfig` call via optional `resolvedConfig` parameter, and fix 7 error handling issues. All changes are backward-compatible refactors.

**Tech Stack:** TypeScript, Vitest, Express 5, SSE streaming

**Spec:** `docs/superpowers/specs/2026-03-15-oai-pr-fixes-design.md`

**CRITICAL RULES (from project memory — include in ALL subagent prompts):**
- NEVER commit, amend, or change git history in ANY way
- NEVER leave TODO, FIXME, or placeholder comments in code
- NEVER use fake/test API keys in integration tests — use `env.testProviderKey` / `env.testAgentId`
- All tests must pass before the task is considered complete
- Run `pnpm types` to verify TypeScript type checks pass

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `repos/domain/src/types/ai.types.ts` | Add `TAgentOverrides` base, redefine `TAgentRunOverrides` |
| Modify | `repos/domain/src/types/epd.types.ts` | Redefine endpoint overrides to extend `TAgentOverrides` |
| Create | `repos/backend/src/types/oai.types.ts` | All OAI types (request, response, model, error) |
| Modify | `repos/backend/src/types/agent.types.ts` | Add `TAgentRuntimeConfig`, `TResolvedAgentConfig`, `TResolveAgentOpts`; add `resolvedConfig?` to `TAgentExecOpts` |
| Modify | `repos/backend/src/types/session.types.ts` | Redefine `TSession` as `TSessionPayload & TAgentRuntimeConfig` |
| Modify | `repos/backend/src/types/index.ts` | Add `oai.types` export |
| Delete | `repos/backend/src/services/openai/types.ts` | Replaced by `types/oai.types.ts` |
| Modify | `repos/backend/src/services/openai/requestAdapter.ts` | Update imports, fix array system messages |
| Modify | `repos/backend/src/services/openai/responseAdapter.ts` | Update imports |
| Modify | `repos/backend/src/services/endpoints/agentEndpoint.ts` | Add `resolvedConfig` to `runHeadless`, fix error logging |
| Modify | `repos/backend/src/endpoints/agents/oaiChatCompletions.ts` | Use `resolveAgentConfig` instead of `agent.get`, pass `resolvedConfig` |
| Modify | `repos/backend/src/endpoints/agents/oaiModels.ts` | Import `TOAIModel`, replace dead `!brand` guard with try-catch |
| Modify | `repos/backend/src/endpoints/ai/onWSConnect.ts` | Simplify `resolveSession` spread, fix empty catch |
| Modify | `repos/backend/src/utils/agent/resolveAgentConfig.ts` | Remove type definitions (import from `@TBE/types`), fix skills log severity |
| Modify | `repos/backend/src/services/openai/requestAdapter.test.ts` | Add array system message test |
| Modify | `repos/backend/src/services/openai/responseAdapter.test.ts` | Update imports |
| Modify | `repos/backend/src/endpoints/agents/oaiChatCompletions.test.ts` | Update mocks for `resolvedConfig` flow |
| Modify | `repos/backend/src/endpoints/agents/oaiModels.test.ts` | Update mock: throw instead of returning null |
| Create | `repos/backend/src/utils/agent/resolveAgentConfig.test.ts` | New unit tests for `resolveAgentConfig` |
| Modify | `repos/backend/src/endpoints/agents/runAgent.test.ts` | Add `runHeadless` direct tests |

---

## Chunk 1: Type Normalization

### Task 1: Extract `TAgentOverrides` Base Type in Domain

**Files:**
- Modify: `repos/domain/src/types/ai.types.ts:91-98`

- [ ] **Step 1: Add `TAgentOverrides` and redefine `TAgentRunOverrides`**

In `repos/domain/src/types/ai.types.ts`, replace lines 91-98:

```typescript
// REPLACE THIS:
export type TAgentRunOverrides = {
  model?: string
  tools?: string[]
  maxSteps?: number
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

// WITH THIS:
/** Base override fields shared by all agent execution contexts. */
export type TAgentOverrides = {
  model?: string
  tools?: string[]
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export type TAgentRunOverrides = TAgentOverrides & {
  maxSteps?: number
}
```

- [ ] **Step 2: Run domain type check**

Run: `cd repos/domain && pnpm types`

Expected: 0 errors. `TAgentRunOverrides` is structurally identical to before.

---

### Task 2: Redefine Endpoint Overrides to Extend Base

**Files:**
- Modify: `repos/domain/src/types/epd.types.ts:155-179`

- [ ] **Step 1: Add import and redefine `TAgentEndpointConfig` overrides**

In `repos/domain/src/types/epd.types.ts`, add `TAgentOverrides` to imports at line 1 and redefine the overrides block.

At the top of the file, change:

```typescript
// REPLACE THIS:
import type { THttpMethod } from './http.types'

// WITH THIS:
import type { THttpMethod } from './http.types'
import type { TAgentOverrides } from './ai.types'
```

Then replace the `TAgentEndpointConfig` definition (lines 155-179):

```typescript
// REPLACE THIS:
export type TAgentEndpointConfig = TSharedEndpointOpts<
  EEndpointType.agent,
  {
    /** Agent ID to use for this endpoint */
    agentId: string
    /** Optional overrides for this specific endpoint */
    overrides?: {
      /** Override system prompt */
      systemPrompt?: string
      /** Override model */
      model?: string
      /** Override max tokens */
      maxTokens?: number
      /** Override tools */
      tools?: string[]
      /** Override function IDs */
      functionIds?: string[]
      /** Override provider IDs */
      providerIds?: string[]
      /** Additional environment variables */
      envVars?: Record<string, string>
      /** Additional secrets (by ID) */
      secrets?: string[]
    }
  }
>

// WITH THIS:
export type TAgentEndpointConfig = TSharedEndpointOpts<
  EEndpointType.agent,
  {
    /** Agent ID to use for this endpoint */
    agentId: string
    /** Optional overrides for this specific endpoint */
    overrides?: TAgentOverrides & {
      /** Override function IDs */
      functionIds?: string[]
      /** Override provider IDs */
      providerIds?: string[]
      /** Additional environment variables */
      envVars?: Record<string, string>
      /** Additional secrets (by ID) */
      secrets?: string[]
    }
  }
>
```

- [ ] **Step 2: Run domain type check**

Run: `cd repos/domain && pnpm types`

Expected: 0 errors. The resulting type is structurally identical (same fields), plus `temperature` is now included via the base type.

---

### Task 3: Create OAI Types File

**Files:**
- Create: `repos/backend/src/types/oai.types.ts`
- Delete: `repos/backend/src/services/openai/types.ts`
- Modify: `repos/backend/src/types/index.ts`

- [ ] **Step 1: Create `repos/backend/src/types/oai.types.ts`**

Copy the entire contents of `repos/backend/src/services/openai/types.ts` to `repos/backend/src/types/oai.types.ts`. No changes to the type definitions — just relocating.

```typescript
/**
 * OpenAI Chat Completions API types.
 * These mirror the shapes expected/returned by the `openai` npm package.
 */

export type TOAIContentPart =
  | { type: `text`; text: string }
  | { type: `image_url`; image_url: { url: string; detail?: string } }

export type TOAIToolCall = {
  id: string
  type: `function`
  function: { name: string; arguments: string }
}

export type TOAIMessage = {
  role: `system` | `user` | `assistant` | `tool`
  content: string | TOAIContentPart[] | null
  name?: string
  tool_calls?: TOAIToolCall[]
  tool_call_id?: string
}

export type TOAIRequest = {
  model?: string
  messages: TOAIMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  max_completion_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string | string[]
  seed?: number
  response_format?: { type: string }
}

export type TOAIUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export type TOAIChoiceMessage = {
  role: `assistant`
  content: string | null
  tool_calls?: TOAIToolCall[]
}

export type TOAIChoiceDelta = {
  role?: `assistant`
  content?: string | null
  tool_calls?: TOAIToolCall[]
}

export type TOAIChoice = {
  index: number
  message: TOAIChoiceMessage
  finish_reason: string | null
}

export type TOAIChunkChoice = {
  index: number
  delta: TOAIChoiceDelta
  finish_reason: string | null
}

export type TOAIResponse = {
  id: string
  object: `chat.completion`
  created: number
  model: string
  choices: TOAIChoice[]
  usage: TOAIUsage
}

export type TOAIChunk = {
  id: string
  object: `chat.completion.chunk`
  created: number
  model: string
  choices: TOAIChunkChoice[]
  usage?: TOAIUsage
}

export type TOAIErrorBody = {
  error: {
    message: string
    type: string
    param: string | null
    code: string | null
  }
}

export type TOAIModel = {
  id: string
  object: `model`
  created: number
  owned_by: string
}

export type TOAIModelList = {
  object: `list`
  data: TOAIModel[]
}
```

- [ ] **Step 2: Add export to `repos/backend/src/types/index.ts`**

Add at the end of `repos/backend/src/types/index.ts`:

```typescript
export * from './oai.types'
```

- [ ] **Step 3: Delete `repos/backend/src/services/openai/types.ts`**

Remove the file entirely.

- [ ] **Step 4: Update imports in `repos/backend/src/services/openai/requestAdapter.ts`**

```typescript
// REPLACE THIS:
import type { TOAIMessage, TOAIRequest } from './types'

// WITH THIS:
import type { TOAIMessage, TOAIRequest } from '@TBE/types'
```

- [ ] **Step 5: Update imports in `repos/backend/src/services/openai/responseAdapter.ts`**

```typescript
// REPLACE THIS:
import type { TOAIResponse, TOAIChunk, TOAIUsage, TOAIErrorBody } from './types'

// WITH THIS:
import type { TOAIResponse, TOAIChunk, TOAIUsage, TOAIErrorBody } from '@TBE/types'
```

- [ ] **Step 6: Update imports in `repos/backend/src/services/openai/responseAdapter.test.ts`**

No import changes needed — tests import from `./responseAdapter`, not from `./types` directly.

- [ ] **Step 7: Import `TOAIModel` in `repos/backend/src/endpoints/agents/oaiModels.ts`**

Add at the top of the file, in the existing import block:

```typescript
import type { TEndpointConfig, TRequest, TOAIModel } from '@TBE/types'
```

Then replace the inline type (lines 39-45) with `TOAIModel[]`:

```typescript
// REPLACE THIS:
      const models: Array<{
        id: string
        object: `model`
        created: number
        owned_by: string
      }> = []

// WITH THIS:
      const models: TOAIModel[] = []
```

- [ ] **Step 8: Run backend type check**

Run: `cd repos/backend && pnpm types`

Expected: 0 errors. All imports resolve to the new location.

---

### Task 4: Extract `TAgentRuntimeConfig` and Move Types to `agent.types.ts`

**Files:**
- Modify: `repos/backend/src/types/agent.types.ts`
- Modify: `repos/backend/src/types/session.types.ts`
- Modify: `repos/backend/src/utils/agent/resolveAgentConfig.ts`

- [ ] **Step 1: Rewrite `repos/backend/src/types/agent.types.ts`**

Replace the entire file:

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

export type TFunctionExecutionHandler = (
  functionId: string,
  input: unknown
) => Promise<{
  duration: number
  output: unknown
  success: boolean
  error?: string
}>

/** Shared runtime fields between TSession and TResolvedAgentConfig. */
export type TAgentRuntimeConfig = {
  llmConfig: TLLMAdapterConfig
  sandboxConfig: TSandboxConfig
  environment?: TAgentEnvironment
  customFunctions: Function[]
  functionMap: Map<string, Function>
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
  overrides?: TAgentOverrides & {
    envVars?: Record<string, string>
  }
}

export type TAgentExecOpts = {
  agentId: string
  prompt: string
  userId: string
  threadId?: string
  projectId?: string
  providerId?: string
  overrides?: TAgentOverrides & {
    envVars?: Record<string, string>
  }
  resolvedConfig?: TResolvedAgentConfig
}
```

- [ ] **Step 2: Rewrite `repos/backend/src/types/session.types.ts`**

Replace the entire file:

```typescript
import type { TAgentRuntimeConfig } from './agent.types'

export type TSessionPayload = {
  orgId: string
  userId: string
  agentId: string
  projectId?: string
}

export type TSession = TSessionPayload & TAgentRuntimeConfig
```

Note: `TFunctionExecutionHandler` is defined in `agent.types.ts` (alongside `TAgentRuntimeConfig` which uses it). `session.types.ts` imports only from `agent.types.ts` — no circular dependency.

- [ ] **Step 3: Remove type exports from `repos/backend/src/utils/agent/resolveAgentConfig.ts`**

Replace the type definitions and imports at the top of the file:

```typescript
// REPLACE THIS:
import type { TDatabase } from '@tdsk/database'
import type { IAgentRunnerDB } from '@tdsk/agent'
import type { TApp } from '@TBE/types'
import type {
  Agent,
  Skill,
  Function,
  TLLMProviderBrand,
  TLLMAdapterConfig,
  TSandboxConfig,
  TAgentEnvironment,
} from '@tdsk/domain'
import type { TFunctionExecutionHandler } from '@TBE/types'

// ... (TResolvedAgentConfig and TResolveAgentOpts type definitions)

// WITH THIS:
import type { TDatabase } from '@tdsk/database'
import type { IAgentRunnerDB } from '@tdsk/agent'
import type {
  TApp,
  TResolvedAgentConfig,
  TResolveAgentOpts,
} from '@TBE/types'
import type {
  TLLMProviderBrand,
  TLLMAdapterConfig,
  TSandboxConfig,
} from '@tdsk/domain'
```

Remove the `TResolvedAgentConfig` and `TResolveAgentOpts` type definitions entirely (they now live in `@TBE/types`).

Keep the `createDBAdapter` function and `resolveAgentConfig` function unchanged except for the return type annotation (it already returns `Promise<TResolvedAgentConfig>`).

- [ ] **Step 4: Run backend type check**

Run: `cd repos/backend && pnpm types`

Expected: 0 errors. All consumers import from `@TBE/types` which re-exports from both `agent.types.ts` and `session.types.ts`.

---

## Chunk 2: Critical Fixes

### Task 5: Eliminate Double `resolveAgentConfig` Call

**Files:**
- Modify: `repos/backend/src/services/endpoints/agentEndpoint.ts`
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.ts`

- [ ] **Step 1: Update `runHeadless` to accept optional `resolvedConfig`**

In `repos/backend/src/services/endpoints/agentEndpoint.ts`, update the imports at line 3:

```typescript
// REPLACE THIS:
import type { TRequest, TAgentExecOpts } from '@TBE/types'

// WITH THIS:
import type { TRequest, TAgentExecOpts, TResolvedAgentConfig } from '@TBE/types'
```

Then update `runHeadless` (lines 49-107) to accept and use optional `resolvedConfig`:

```typescript
  runHeadless = async (
    req: TRequest,
    db: TDatabase,
    opts: TAgentExecOpts & { onEvent: (event: TStreamEvent) => void }
  ): Promise<{ threadId: string }> => {
    const {
      prompt,
      userId,
      agentId,
      overrides,
      projectId,
      providerId,
      onEvent,
      resolvedConfig,
      threadId: existingThreadId,
    } = opts

    const config = resolvedConfig ?? await resolveAgentConfig(agentId, db, req.app as any, {
      userId,
      projectId,
      providerId,
      overrides,
    })

    // Get or create thread
    let threadId = existingThreadId
    if (!threadId) {
      const { data: thread, error: threadErr } = await db.services.thread.create({
        userId,
        agentId,
        orgId: config.orgId,
        projectId,
        name: prompt.substring(0, 100),
      })

      if (threadErr || !thread) throw new Exception(500, `Failed to create thread`)
      threadId = thread.id
    }

    const handle = await AgentRunner.run({
      prompt,
      userId,
      agentId,
      threadId,
      llmConfig: config.llmConfig,
      sandboxConfig: config.sandboxConfig,
      orgId: config.orgId,
      db: config.db,
      environment: config.environment,
      tools: config.tools,
      skills: config.skills,
      customFunctions: config.customFunctions || [],
      onExecuteFunction: config.onExecuteFunction,
      onEvent,
    })
    await handle.waitForIdle()

    return { threadId }
  }
```

- [ ] **Step 2: Update `run` to pass `resolvedConfig` to `runHeadless`**

In the same file, update the `run` method (lines 114-187) to pass the pre-resolved config:

```typescript
  run = async (
    req: TRequest,
    res: Response,
    db: TDatabase,
    opts: TAgentExecOpts
  ): Promise<void> => {
    const { prompt, userId, agentId, projectId, providerId, overrides } = opts
    const existingThreadId = opts.threadId

    // Pre-resolve config BEFORE SSE headers so errors return proper JSON responses.
    const config = await resolveAgentConfig(agentId, db, req.app as any, {
      userId,
      projectId,
      providerId,
      overrides,
    })

    // Pre-create thread for the X-Thread-Id header
    let threadId = existingThreadId
    if (!threadId) {
      const { data: thread, error: threadErr } = await db.services.thread.create({
        userId,
        agentId,
        orgId: config.orgId,
        projectId,
        name: prompt.substring(0, 100),
      })

      if (threadErr || !thread) throw new Exception(500, `Failed to create thread`)
      threadId = thread.id
    }

    // Set up SSE headers — after all setup so errors above return proper JSON
    res.setHeader(`X-Thread-Id`, threadId)
    res.setHeader(`Connection`, `keep-alive`)
    res.setHeader(`Cache-Control`, `no-cache`)
    res.setHeader(`Content-Type`, `text/event-stream`)
    res.flushHeaders()

    // Send thread ID as first event
    res.write(`data: ${JSON.stringify({ type: `thread`, threadId })}\n\n`)

    // Handle client disconnect
    let aborted = false
    req.on(`close`, () => {
      aborted = true
    })

    try {
      await this.runHeadless(req, db, {
        ...opts,
        threadId,
        resolvedConfig: config,
        onEvent: (event) => {
          if (aborted) return
          res.write(`data: ${JSON.stringify(event)}\n\n`)
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Agent execution failed`
      logger.error(`[AgentEndpoint] Agent run failed`, {
        error: err instanceof Error ? err : message,
        stack: err instanceof Error ? err.stack : undefined,
        agentId,
        threadId,
      })
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: `error`, error: message })}\n\n`)
      }
    }

    // End the SSE stream.
    if (!aborted) {
      res.write(`data: [DONE]\n\n`)
      res.end()
    }
  }
```

Note: The error logging fix (Section 3G — Issue #9) is included here — full error object with stack trace and context.

- [ ] **Step 3: Update `oaiChatCompletions.ts` to use `resolveAgentConfig`**

In `repos/backend/src/endpoints/agents/oaiChatCompletions.ts`, add the `resolveAgentConfig` import and update the thread seeding + agent execution flow:

```typescript
// REPLACE THIS import block (lines 1-18):
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { nanoid } from 'nanoid'
import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { AgentEndpoint } from '@TBE/services/endpoints/agentEndpoint'
import {
  extractPrompt,
  buildOverrides,
  convertOAIMessages,
} from '@TBE/services/openai/requestAdapter'
import {
  createStreamingAdapter,
  createNonStreamingAdapter,
  formatOAIError,
} from '@TBE/services/openai/responseAdapter'

// WITH THIS:
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { nanoid } from 'nanoid'
import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { AgentEndpoint } from '@TBE/services/endpoints/agentEndpoint'
import { resolveAgentConfig } from '@TBE/utils/agent/resolveAgentConfig'
import {
  extractPrompt,
  buildOverrides,
  convertOAIMessages,
} from '@TBE/services/openai/requestAdapter'
import {
  createStreamingAdapter,
  createNonStreamingAdapter,
  formatOAIError,
} from '@TBE/services/openai/responseAdapter'
```

Then replace the thread seeding section. Replace the block starting at `const agent = new AgentEndpoint()` through the message seeding and agent execution (the entire section from `const agent = new AgentEndpoint()` to the end of the action function). The new code:

```typescript
    const agent = new AgentEndpoint()

    // Resolve agent config once — replaces separate agent.get call and
    // avoids double-resolution when runHeadless is called later.
    let config
    try {
      config = await resolveAgentConfig(agentId, db, req.app as any, {
        userId,
        overrides,
      })
    } catch (err) {
      const { status, body: errBody } = formatOAIError(err)
      res.status(status).json(errBody)
      return
    }

    // Seed thread with prior messages if conversation has history.
    let threadId: string | undefined
    const priorMessages = body.messages.slice(0, -1)
    if (priorMessages.length) {
      const converted = convertOAIMessages(priorMessages)
      if (converted.length) {
        try {
          const { data: thread, error: threadErr } = await db.services.thread.create({
            userId,
            agentId,
            orgId: config.orgId,
            name: prompt.substring(0, 100),
          })

          if (threadErr || !thread) {
            const { status, body: errBody } = formatOAIError(
              new Exception(500, `Failed to create thread for conversation seeding`)
            )
            res.status(status).json(errBody)
            return
          }

          threadId = thread.id

          for (const msg of converted) {
            await db.services.message.create({
              threadId,
              type: msg.type,
              content: msg.content,
            })
          }
        } catch (err) {
          logger.error(`[OAI Chat] Message seeding failed`, {
            agentId,
            error: err instanceof Error ? err.message : err,
          })
          const { status, body: errBody } = formatOAIError(
            err instanceof Exception ? err : new Exception(500, `Failed to seed conversation history`)
          )
          res.status(status).json(errBody)
          return
        }
      }
    }

    if (body.stream) {
      // Streaming mode — SSE with OpenAI chunk format
      res.setHeader(`Content-Type`, `text/event-stream`)
      res.setHeader(`Cache-Control`, `no-cache`)
      res.setHeader(`Connection`, `keep-alive`)
      res.flushHeaders()

      const adapter = createStreamingAdapter(res, completionId, modelName)
      adapter.sendInitial()

      let aborted = false
      req.on(`close`, () => {
        aborted = true
      })

      try {
        await agent.runHeadless(req, db, {
          agentId,
          prompt,
          userId,
          threadId,
          overrides,
          resolvedConfig: config,
          onEvent: (event) => {
            if (aborted) return
            adapter.onEvent(event)
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : `Agent execution failed`
        logger.error(`[OAI Chat] Streaming error:`, message)
        if (!aborted) {
          res.write(`data: ${JSON.stringify({
            error: { message, type: `server_error`, param: null, code: null },
          })}\n\n`)
        }
      }

      if (!aborted) {
        adapter.finish()
      }
    } else {
      // Non-streaming mode — collect events, return JSON
      const adapter = createNonStreamingAdapter(completionId, modelName)

      try {
        await agent.runHeadless(req, db, {
          agentId,
          prompt,
          userId,
          threadId,
          overrides,
          resolvedConfig: config,
          onEvent: adapter.onEvent,
        })
      } catch (err) {
        const { status, body: errBody } = formatOAIError(err)
        res.status(status).json(errBody)
        return
      }

      try {
        res.status(200).json(adapter.build())
      } catch (err) {
        // build() throws if an error event was captured
        const { status, body: errBody } = formatOAIError(err)
        res.status(status).json(errBody)
      }
    }
```

- [ ] **Step 4: Run backend type check**

Run: `cd repos/backend && pnpm types`

Expected: 0 errors.

---

## Chunk 3: Error Handling Fixes

### Task 6: Fix Remaining Error Handling Issues

**Files:**
- Modify: `repos/backend/src/endpoints/ai/onWSConnect.ts`
- Modify: `repos/backend/src/utils/agent/resolveAgentConfig.ts`
- Modify: `repos/backend/src/services/openai/requestAdapter.ts`
- Modify: `repos/backend/src/endpoints/agents/oaiModels.ts`

- [ ] **Step 1: Simplify `resolveSession` spread in `onWSConnect.ts` (Issue #10)**

In `repos/backend/src/endpoints/ai/onWSConnect.ts`, replace the `resolveSession` function body (the return block inside the try, approximately lines 39-48):

```typescript
// REPLACE THIS:
    return {
      session: {
        agentId: config.agent.id,
        orgId: config.orgId,
        userId: payload.userId,
        projectId: payload.projectId,
        environment: config.environment,
        customFunctions: config.customFunctions,
        functionMap: config.functionMap,
        skills: config.skills,
        tools: config.tools,
        envVars: config.envVars,
        llmConfig: config.llmConfig,
        sandboxConfig: config.sandboxConfig,
        db: config.db,
        onExecuteFunction: config.onExecuteFunction,
      },
    }

// WITH THIS:
    const { agent, effectiveAgent, orgId, ...runtimeConfig } = config
    return {
      session: {
        agentId: agent.id,
        orgId,
        userId: payload.userId,
        projectId: payload.projectId,
        ...runtimeConfig,
      },
    }
```

- [ ] **Step 2: Fix empty catch on session promise in `onWSConnect.ts` (Issue #4)**

In the same file, find the `.catch(() => {})` in the `close` handler (around line 108-109):

```typescript
// REPLACE THIS:
    }).catch(() => {})

// WITH THIS:
    }).catch((err) => {
      logger.error(`[WS] Session cleanup error`, { error: err instanceof Error ? err.message : err })
    })
```

- [ ] **Step 3: Fix skills loading severity in `resolveAgentConfig.ts` (Issue #5)**

In `repos/backend/src/utils/agent/resolveAgentConfig.ts`, find the skills loading block:

```typescript
// REPLACE THIS:
    if (skillsErr) {
      logger.warn(`Failed to load skills for agent ${agentId}`, { error: skillsErr })
    }

// WITH THIS:
    if (skillsErr) {
      logger.error(`Failed to load skills for agent ${agentId}`, { error: skillsErr })
    }
```

- [ ] **Step 4: Fix array-format system messages in `requestAdapter.ts` (Issue #8)**

In `repos/backend/src/services/openai/requestAdapter.ts`, replace the system message extraction in `buildOverrides` (lines 136-137):

```typescript
// REPLACE THIS:
    overrides.systemPrompt = systemMessages
      .map((m) => (typeof m.content === `string` ? m.content : ``))
      .filter(Boolean)
      .join(`\n`)

// WITH THIS:
    overrides.systemPrompt = systemMessages
      .map((m) =>
        typeof m.content === `string`
          ? m.content
          : Array.isArray(m.content)
            ? m.content.filter((p) => p.type === `text`).map((p) => (p as { text: string }).text).join(`\n`)
            : ``
      )
      .filter(Boolean)
      .join(`\n`)
```

- [ ] **Step 5: Replace dead `!brand` guard with try-catch in `oaiModels.ts` (Issue #6)**

In `repos/backend/src/endpoints/agents/oaiModels.ts`, replace the provider loop (lines 46-62):

```typescript
// REPLACE THIS:
      for (const provider of agent.providers || []) {
        const brand = resolveProviderType(provider as any)
        if (!brand) {
          logger.warn(`[OAI Models] Cannot resolve provider type`, { providerId: provider.id, agentId })
          continue
        }

        const providerModels = ModelRegistry.getModels(brand)
        for (const m of providerModels) {
          models.push({
            id: m.id,
            object: `model`,
            created,
            owned_by: brand,
          })
        }
      }

// WITH THIS:
      for (const provider of agent.providers || []) {
        try {
          const brand = resolveProviderType(provider as any)
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
          logger.warn(`[OAI Models] Cannot resolve provider type`, {
            providerId: provider.id,
            agentId,
            error: err instanceof Error ? err.message : err,
          })
        }
      }
```

- [ ] **Step 6: Run backend type check**

Run: `cd repos/backend && pnpm types`

Expected: 0 errors.

---

## Chunk 4: Test Updates

### Task 7: Update Existing Tests for Type and Import Changes

**Files:**
- Modify: `repos/backend/src/services/openai/requestAdapter.test.ts`
- Modify: `repos/backend/src/endpoints/agents/oaiModels.test.ts`
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.test.ts`

- [ ] **Step 1: Add array system message test in `requestAdapter.test.ts` (Issue #8)**

Add a new test at the end of the `buildOverrides` describe block (after the existing tests, before the closing `}`):

```typescript
  it(`should extract text from array-format system messages`, () => {
    const result = buildOverrides({
      messages: [
        {
          role: `system`,
          content: [
            { type: `text`, text: `You are helpful.` },
            { type: `text`, text: `Be concise.` },
          ],
        },
        { role: `user`, content: `hello` },
      ],
    })
    expect(result.systemPrompt).toBe(`You are helpful.\nBe concise.`)
  })

  it(`should handle mixed string and array system messages`, () => {
    const result = buildOverrides({
      messages: [
        { role: `system`, content: `First instruction.` },
        {
          role: `system`,
          content: [{ type: `text`, text: `Second instruction.` }],
        },
        { role: `user`, content: `hello` },
      ],
    })
    expect(result.systemPrompt).toBe(`First instruction.\nSecond instruction.`)
  })
```

- [ ] **Step 2: Update `oaiModels.test.ts` — mock throws instead of returning null**

In `repos/backend/src/endpoints/agents/oaiModels.test.ts`, update the "skip providers with unresolvable type" test (lines 230-268).

Replace the mock setup that returns `null` with one that throws:

```typescript
// REPLACE THIS test (lines 230-268):
  it(`should skip providers with unresolvable type and log warning`, async () => {
    const { resolveProviderType } = await import(`@TBE/utils/providers/resolveProviderType`)
    const { logger } = await import(`@TBE/utils/logger`)
    const { ModelRegistry } = await import(`@TBE/services/providers/modelRegistry`)

    const mockResolve = resolveProviderType as ReturnType<typeof vi.fn>
    const mockGetModels = ModelRegistry.getModels as ReturnType<typeof vi.fn>

    mockResolve
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(`openai`)

    mockGetModels.mockReturnValue([{ id: `gpt-4o`, name: `GPT-4o` }])

    const app = buildApp({
      id: `agent-1`,
      orgId: `org-1`,
      providers: [
        { id: `prov-bad`, brand: `unknown`, name: `Unknown`, type: `ai`, options: {} },
        { id: `prov-2`, brand: `openai`, name: `OpenAI`, type: `ai`, options: {} },
      ],
    })
    mockReq.app = app

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(logger.warn).toHaveBeenCalledWith(
      `[OAI Models] Cannot resolve provider type`,
      expect.objectContaining({ providerId: `prov-bad`, agentId: `agent-1` })
    )

    expect(mockStatus).toHaveBeenCalledWith(200)
    const responseData = mockJson.mock.calls[0][0]
    expect(responseData.data).toHaveLength(1)
    expect(responseData.data[0]).toEqual(
      expect.objectContaining({ id: `gpt-4o`, owned_by: `openai` })
    )
  })

// WITH THIS:
  it(`should skip providers with unresolvable type and log warning`, async () => {
    const { resolveProviderType } = await import(`@TBE/utils/providers/resolveProviderType`)
    const { logger } = await import(`@TBE/utils/logger`)
    const { ModelRegistry } = await import(`@TBE/services/providers/modelRegistry`)

    const mockResolve = resolveProviderType as ReturnType<typeof vi.fn>
    const mockGetModels = ModelRegistry.getModels as ReturnType<typeof vi.fn>

    mockResolve
      .mockImplementationOnce(() => { throw new Error(`Unknown provider brand`) })
      .mockReturnValueOnce(`openai`)

    mockGetModels.mockReturnValue([{ id: `gpt-4o`, name: `GPT-4o` }])

    const app = buildApp({
      id: `agent-1`,
      orgId: `org-1`,
      providers: [
        { id: `prov-bad`, brand: `unknown`, name: `Unknown`, type: `ai`, options: {} },
        { id: `prov-2`, brand: `openai`, name: `OpenAI`, type: `ai`, options: {} },
      ],
    })
    mockReq.app = app

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(logger.warn).toHaveBeenCalledWith(
      `[OAI Models] Cannot resolve provider type`,
      expect.objectContaining({ providerId: `prov-bad`, agentId: `agent-1` })
    )

    expect(mockStatus).toHaveBeenCalledWith(200)
    const responseData = mockJson.mock.calls[0][0]
    expect(responseData.data).toHaveLength(1)
    expect(responseData.data[0]).toEqual(
      expect.objectContaining({ id: `gpt-4o`, owned_by: `openai` })
    )
  })
```

- [ ] **Step 3: Update `oaiChatCompletions.test.ts` — add `resolveAgentConfig` mock and update tests**

In `repos/backend/src/endpoints/agents/oaiChatCompletions.test.ts`, add a mock for `resolveAgentConfig` after the existing mocks (after line 33):

```typescript
const mockResolveAgentConfig = vi.fn().mockResolvedValue({
  agent: { id: `agent-1` },
  effectiveAgent: { id: `agent-1` },
  orgId: `org-1`,
  llmConfig: {},
  sandboxConfig: {},
  environment: undefined,
  customFunctions: [],
  functionMap: new Map(),
  skills: [],
  tools: undefined,
  envVars: {},
  db: {},
  onExecuteFunction: vi.fn(),
})
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: (...args: any[]) => mockResolveAgentConfig(...args),
}))
```

In the `beforeEach`, add after `mockConvertOAIMessages.mockReturnValue([])`:

```typescript
    mockResolveAgentConfig.mockResolvedValue({
      agent: { id: `agent-1` },
      effectiveAgent: { id: `agent-1` },
      orgId: `org-1`,
      llmConfig: {},
      sandboxConfig: {},
      environment: undefined,
      customFunctions: [],
      functionMap: new Map(),
      skills: [],
      tools: undefined,
      envVars: {},
      db: {},
      onExecuteFunction: vi.fn(),
    })
```

Update the `buildApp` function — remove the `agent.get` mock since `oaiChatCompletions` no longer calls it:

```typescript
// REPLACE THIS:
const buildApp = () =>
  ({
    locals: {
      db: {
        services: {
          agent: { get: vi.fn().mockResolvedValue({ data: { orgId: `org-1` } }) },
          thread: { create: vi.fn().mockResolvedValue({ data: { id: `thread-1` } }) },
          message: { create: vi.fn().mockResolvedValue({ data: {} }) },
        },
      },
    },
  } as unknown as TApp)

// WITH THIS:
const buildApp = () =>
  ({
    locals: {
      db: {
        services: {
          thread: { create: vi.fn().mockResolvedValue({ data: { id: `thread-1` } }) },
          message: { create: vi.fn().mockResolvedValue({ data: {} }) },
        },
      },
    },
  } as unknown as TApp)
```

Update the thread seeding test — remove the `agent.get` assertion since it's no longer called:

In the "should seed thread with prior messages" test, remove these two lines:

```typescript
    // REMOVE THESE LINES:
    expect(db.services.agent.get).toHaveBeenCalledWith(`agent-1`, { sanitize: true })
```

Update the thread seeding test's thread.create assertion — `orgId` now comes from `resolveAgentConfig` result (`config.orgId`), not from `agent.get`:

```typescript
    // This assertion stays the same — orgId still comes from config:
    expect(db.services.thread.create).toHaveBeenCalledWith({
      userId: `test-user-id`,
      agentId: `agent-1`,
      orgId: `org-1`,
      name: `Follow-up`,
    })
```

Verify that `runHeadless` calls now include `resolvedConfig`:

```typescript
    // Update any runHeadless assertions to include resolvedConfig:
    expect(mockRunHeadless).toHaveBeenCalledWith(
      mockReq,
      mockReq.app?.locals.db,
      expect.objectContaining({
        agentId: `agent-1`,
        prompt: `Hello`,
        userId: `test-user-id`,
        resolvedConfig: expect.objectContaining({ orgId: `org-1` }),
        onEvent: expect.any(Function),
      })
    )
```

- [ ] **Step 4: Run unit tests for modified files**

Run: `cd repos/backend && npx vitest run --config configs/vitest.config.ts src/endpoints/agents/oaiChatCompletions.test.ts src/endpoints/agents/oaiModels.test.ts src/services/openai/requestAdapter.test.ts`

Expected: All tests pass.

---

### Task 8: Add `resolveAgentConfig` Unit Tests

**Files:**
- Create: `repos/backend/src/utils/agent/resolveAgentConfig.test.ts`
- Reference: `repos/backend/src/endpoints/agents/runAgent.test.ts` (mock patterns)
- Reference: `repos/backend/src/utils/agent/resolveAgentConfig.ts` (source under test)

- [ ] **Step 1: Create the test file**

Create `repos/backend/src/utils/agent/resolveAgentConfig.test.ts`. Follow mock patterns from `runAgent.test.ts` — mock `db.services.*`, `SecretResolver`, `FunctionExecutor`, `resolveProviderType`, and `resolveAgentDeps`.

The test file should cover:
- Agent not found → throws 404
- Agent has no providers → throws 404 (`Agent has no provider configured`)
- Provider selection with explicit `providerId` override
- No API key found → throws 400
- Override merging precedence (temperature, maxTokens, systemPrompt, model)
- Skills loading failure → continues with empty array, logs error
- `resolveProviderType` throws for invalid brand → exception propagates
- K8s sandbox pod startup path (when sandboxType is kubernetes)
- `onExecuteFunction` callback — function found vs not found
- `envVars` passthrough from overrides
- `createDBAdapter` returns proper adapter shape

Mock setup pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock(`@tdsk/domain`, async () => {
  const actual = await vi.importActual(`@tdsk/domain`)
  return {
    ...actual,
    deriveKey: vi.fn().mockResolvedValue(Buffer.alloc(32, `key`)),
    decryptValue: vi.fn().mockResolvedValue(`sk-test-key`),
  }
})

vi.mock(`@TBE/utils/providers/resolveProviderType`, () => ({
  resolveProviderType: vi.fn().mockReturnValue(`anthropic`),
}))

vi.mock(`@TBE/utils/agent/resolveAgentDeps`, () => ({
  resolveAgentDeps: vi.fn().mockResolvedValue({
    environment: undefined,
    customFunctions: [],
  }),
}))
```

For each test, build a minimal `db` mock and `app` mock matching the patterns in `runAgent.test.ts`. The `agent.get` mock should return an agent with `providers`, `orgId`, `primaryProvider`, `resolveModel`, `getEffectiveConfig`, and `envVars`.

- [ ] **Step 2: Run the new test file**

Run: `cd repos/backend && npx vitest run --config configs/vitest.config.ts src/utils/agent/resolveAgentConfig.test.ts`

Expected: All tests pass.

---

### Task 9: Add `runHeadless` Direct Tests

**Files:**
- Modify: `repos/backend/src/endpoints/agents/runAgent.test.ts`

- [ ] **Step 1: Add `runHeadless` test cases**

Add a new `describe` block at the end of `runAgent.test.ts` (before the file's closing):

```typescript
describe(`AgentEndpoint.runHeadless (direct)`, () => {
  // ... setup similar to existing tests
})
```

Test cases to add:
- Happy path — resolves config, creates thread, runs agent, returns `{ threadId }`
- Uses pre-resolved config when `resolvedConfig` provided (verify `resolveAgentConfig` is NOT called)
- Reuses existing thread when `threadId` provided (verify thread.create is NOT called)
- Thread creation failure → throws 500
- `onEvent` callback passed through to `AgentRunner.run`

Mock the `AgentEndpoint` class directly (import and instantiate). Use the same mocking patterns already established in the file.

- [ ] **Step 2: Run the test file**

Run: `cd repos/backend && npx vitest run --config configs/vitest.config.ts src/endpoints/agents/runAgent.test.ts`

Expected: All existing + new tests pass.

---

## Chunk 5: Verification

### Task 10: Full Verification

- [ ] **Step 1: Run full backend type check**

Run: `cd repos/backend && pnpm types`

Expected: 0 errors.

- [ ] **Step 2: Run full domain type check**

Run: `cd repos/domain && pnpm types`

Expected: 0 errors.

- [ ] **Step 3: Run full workspace type checks**

Run: `pnpm types`

Expected: All 13 repos pass with 0 errors.

- [ ] **Step 4: Run full backend test suite**

Run: `cd repos/backend && pnpm test`

Expected: All test files pass (85+), including new and updated OAI test files.

- [ ] **Step 5: Run full workspace tests**

Run: `pnpm test`

Expected: All repos pass.

- [ ] **Step 6: Run integration tests**

Run: `cd repos/integration && npx vitest run --config configs/vitest.config.ts src/tier3/oai-compat.test.ts`

Expected: Error tests pass. LLM tests pass if `hasLLM()` is true, skip gracefully otherwise.
