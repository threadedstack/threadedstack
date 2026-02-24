# WebSocket Agent Execution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace SSE-based LLM proxy with bidirectional WebSocket for server-side agent execution, workspace file sync, and thin REPL/Admin clients.

**Architecture:** Backend runs the full AgentRunner (ReAct loop + tool execution + secrets) over WebSocket. REPL and Admin become thin WS clients that send prompts and receive streaming events. Workspace files sync lazily over the same WS connection. The existing `POST /_/agents/:id/run` SSE endpoint is kept for Endpoints and future sub-agent use.

**Tech Stack:** `ws` (Node.js WebSocket), Express 5, pi-mono Agent/AgentRunner, TypeScript shared types via `@tdsk/domain`

**Design Doc:** `docs/plans/2026-02-22-websocket-agent-execution-design.md`

---

## Phase 1: Domain Types

### Task 1: Create WS event type enum and message interfaces

**Files:**
- Create: `repos/domain/src/types/ws.types.ts`
- Modify: `repos/domain/src/types/index.ts`

**Step 1: Write the failing test**

Create a test that imports the new types.

```typescript
// repos/domain/src/types/ws.types.test.ts
import { describe, it, expect } from 'vitest'
import { EWSEventType } from './ws.types'

describe('EWSEventType', () => {
  it('should define all client-to-server event types', () => {
    expect(EWSEventType.Prompt).toBe('prompt')
    expect(EWSEventType.FileUpload).toBe('file_upload')
    expect(EWSEventType.WorkspaceManifest).toBe('workspace_manifest')
    expect(EWSEventType.Cancel).toBe('cancel')
  })

  it('should define all server-to-client event types', () => {
    expect(EWSEventType.TextDelta).toBe('text_delta')
    expect(EWSEventType.ToolExecutionStart).toBe('tool_execution_start')
    expect(EWSEventType.ToolExecutionEnd).toBe('tool_execution_end')
    expect(EWSEventType.FileRequest).toBe('file_request')
    expect(EWSEventType.FileChanged).toBe('file_changed')
    expect(EWSEventType.ThreadCreated).toBe('thread_created')
    expect(EWSEventType.TurnEnd).toBe('turn_end')
    expect(EWSEventType.Done).toBe('done')
    expect(EWSEventType.Error).toBe('error')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/domain && pnpm test -- --reporter verbose ws.types`
Expected: FAIL — `ws.types` module not found

**Step 3: Write the implementation**

```typescript
// repos/domain/src/types/ws.types.ts

/**
 * WebSocket event types shared across all repos.
 * Used as the `type` discriminator in all WS messages.
 */
export enum EWSEventType {
  // Client → Server
  Prompt = 'prompt',
  FileUpload = 'file_upload',
  WorkspaceManifest = 'workspace_manifest',
  Cancel = 'cancel',

  // Server → Client
  TextDelta = 'text_delta',
  ToolExecutionStart = 'tool_execution_start',
  ToolExecutionEnd = 'tool_execution_end',
  FileRequest = 'file_request',
  FileChanged = 'file_changed',
  ThreadCreated = 'thread_created',
  TurnEnd = 'turn_end',
  Done = 'done',
  Error = 'error',
}

export type TWSEventType = `${EWSEventType}`

// ── Client → Server Messages ──

export type TWSPromptMsg = {
  type: EWSEventType.Prompt
  prompt: string
  threadId?: string
  maxSteps?: number
}

export type TWSFileUploadMsg = {
  type: EWSEventType.FileUpload
  requestId: string
  path: string
  content: string
}

export type TWSWorkspaceManifestMsg = {
  type: EWSEventType.WorkspaceManifest
  rootDir: string
  files: { path: string; hash: string; size: number }[]
}

export type TWSCancelMsg = {
  type: EWSEventType.Cancel
}

export type TWSClientMsg =
  | TWSPromptMsg
  | TWSFileUploadMsg
  | TWSWorkspaceManifestMsg
  | TWSCancelMsg

// ── Server → Client Messages ──

export type TWSTextDeltaMsg = {
  type: EWSEventType.TextDelta
  delta: string
}

export type TWSToolExecStartMsg = {
  type: EWSEventType.ToolExecutionStart
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

export type TWSToolExecEndMsg = {
  type: EWSEventType.ToolExecutionEnd
  toolCallId: string
  result: string
  isError: boolean
}

export type TWSFileRequestMsg = {
  type: EWSEventType.FileRequest
  requestId: string
  path: string
}

export type TWSFileChangedMsg = {
  type: EWSEventType.FileChanged
  path: string
  content: string
}

export type TWSThreadCreatedMsg = {
  type: EWSEventType.ThreadCreated
  threadId: string
}

export type TWSTurnEndMsg = {
  type: EWSEventType.TurnEnd
  usage: { input: number; output: number }
}

export type TWSDoneMsg = {
  type: EWSEventType.Done
  reason: string
}

export type TWSErrorMsg = {
  type: EWSEventType.Error
  message: string
}

export type TWSServerMsg =
  | TWSTextDeltaMsg
  | TWSToolExecStartMsg
  | TWSToolExecEndMsg
  | TWSFileRequestMsg
  | TWSFileChangedMsg
  | TWSThreadCreatedMsg
  | TWSTurnEndMsg
  | TWSDoneMsg
  | TWSErrorMsg
```

**Step 4: Add barrel export**

In `repos/domain/src/types/index.ts`, add:
```typescript
export * from './ws.types'
```

**Step 5: Run test to verify it passes**

Run: `cd repos/domain && pnpm test -- --reporter verbose ws.types`
Expected: PASS

**Step 6: Run type check**

Run: `cd repos/domain && pnpm types`
Expected: No errors

---

## Phase 2: Backend Session Enhancement

### Task 2: Extend TSession type in session store

**Files:**
- Modify: `repos/backend/src/services/sessionStore.ts`
- Modify: `repos/backend/src/services/sessionStore.test.ts`

**Step 1: Write the failing test**

Add to `repos/backend/src/services/sessionStore.test.ts`:

```typescript
describe('extended session fields', () => {
  const extendedData = {
    ...mockSessionData,
    tools: ['shellExec', 'readFile'],
    envVars: { API_KEY: 'secret-123' },
    environment: { timeout: 60000, temperature: 0.7 },
    customFunctions: [{ id: 'fn-1', name: 'myFunc' }],
  }

  it('should store and retrieve tools', () => {
    const token = createSession(extendedData)
    const session = getSession(token)
    expect(session!.tools).toEqual(['shellExec', 'readFile'])
  })

  it('should store and retrieve envVars', () => {
    const token = createSession(extendedData)
    const session = getSession(token)
    expect(session!.envVars).toEqual({ API_KEY: 'secret-123' })
  })

  it('should store and retrieve environment', () => {
    const token = createSession(extendedData)
    const session = getSession(token)
    expect(session!.environment).toEqual({ timeout: 60000, temperature: 0.7 })
  })

  it('should store and retrieve customFunctions', () => {
    const token = createSession(extendedData)
    const session = getSession(token)
    expect(session!.customFunctions).toEqual([{ id: 'fn-1', name: 'myFunc' }])
  })

  it('should handle missing optional fields', () => {
    const token = createSession(mockSessionData)
    const session = getSession(token)
    expect(session!.tools).toBeUndefined()
    expect(session!.envVars).toBeUndefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/backend && pnpm test -- --reporter verbose sessionStore`
Expected: FAIL — TypeScript errors on new fields

**Step 3: Update TSession type**

In `repos/backend/src/services/sessionStore.ts`, update the `TSession` type:

```typescript
import type { TLLMAdapterConfig, TAgentEnvironment } from '@tdsk/domain'

export type TSession = {
  agentId: string
  orgId: string
  userId: string
  llmConfig: TLLMAdapterConfig
  createdAt: number
  // New fields for server-side agent execution
  tools?: string[]
  envVars?: Record<string, string>
  environment?: TAgentEnvironment
  customFunctions?: any[]
}
```

No other changes needed — the `createSession` function already spreads `...data`.

**Step 4: Run test to verify it passes**

Run: `cd repos/backend && pnpm test -- --reporter verbose sessionStore`
Expected: PASS (all existing + new tests)

---

### Task 3: Enhance createSession endpoint to store and return new fields

**Files:**
- Modify: `repos/backend/src/endpoints/ai/createSession.ts`
- Modify: `repos/backend/src/endpoints/ai/createSession.test.ts`

**Step 1: Write the failing tests**

Add to `repos/backend/src/endpoints/ai/createSession.test.ts`:

```typescript
it('should include tools in session response', async () => {
  const { decryptValue } = await import('@tdsk/domain')
  ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue('sk-test-key')

  const ep = getEndpointCfg(createSession as any)
  const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<typeof vi.fn>

  mockAgentGet.mockResolvedValue({
    data: buildAgent({
      tools: ['shellExec', 'readFile', 'writeFile'],
    }),
  })

  await ep.action(mockReq as TRequest, mockRes as Response)

  const responseData = mockJson.mock.calls[0][0]
  expect(responseData.data.tools).toEqual(['shellExec', 'readFile', 'writeFile'])
})

it('should include environment in session response', async () => {
  const { decryptValue } = await import('@tdsk/domain')
  ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue('sk-test-key')

  const ep = getEndpointCfg(createSession as any)
  const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<typeof vi.fn>

  mockAgentGet.mockResolvedValue({
    data: buildAgent({
      environment: { timeout: 60000, temperature: 0.7 },
    }),
  })

  await ep.action(mockReq as TRequest, mockRes as Response)

  const responseData = mockJson.mock.calls[0][0]
  expect(responseData.data.environment).toEqual({ timeout: 60000, temperature: 0.7 })
})

it('should NOT include envVars in session response', async () => {
  const { decryptValue } = await import('@tdsk/domain')
  ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue('sk-test-key')

  const ep = getEndpointCfg(createSession as any)
  const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<typeof vi.fn>

  mockAgentGet.mockResolvedValue({
    data: buildAgent({
      envVars: { SECRET_KEY: 'never-expose-this' },
    }),
  })

  await ep.action(mockReq as TRequest, mockRes as Response)

  const responseData = mockJson.mock.calls[0][0]
  expect(responseData.data).not.toHaveProperty('envVars')
  expect(responseData.data).not.toHaveProperty('customFunctions')
})

it('should store envVars server-side in session', async () => {
  const { decryptValue } = await import('@tdsk/domain')
  ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue('sk-test-key')

  // We need to spy on sessionStore.createSession to verify what's stored
  const sessionStore = await import('@TBE/services/sessionStore')
  const createSpy = vi.spyOn(sessionStore, 'createSession')

  const ep = getEndpointCfg(createSession as any)
  const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<typeof vi.fn>

  mockAgentGet.mockResolvedValue({
    data: buildAgent({
      envVars: { SECRET_KEY: 'stored-server-side' },
      tools: ['shellExec'],
      environment: { timeout: 30000 },
    }),
  })

  await ep.action(mockReq as TRequest, mockRes as Response)

  expect(createSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      envVars: { SECRET_KEY: 'stored-server-side' },
      tools: ['shellExec'],
      environment: { timeout: 30000 },
    })
  )

  createSpy.mockRestore()
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/backend && pnpm test -- --reporter verbose createSession`
Expected: FAIL — `tools` and `environment` not in response, `envVars` not stored

**Step 3: Update createSession endpoint**

In `repos/backend/src/endpoints/ai/createSession.ts`, update the session creation and response:

```typescript
// Replace the existing session creation block (lines 74-90) with:

// Create session with cached config + agent execution fields
const sessionToken = createStoreSession({
  agentId: agent.id,
  orgId: agent.orgId,
  userId,
  llmConfig,
  tools: agent.tools as string[] | undefined,
  envVars: agent.envVars,
  environment: agent.environment,
})

// Return token + non-sensitive config (no apiKey, no envVars)
res.status(200).json({
  data: {
    sessionToken,
    model: llmConfig.model,
    provider: providerType,
    maxTokens: llmConfig.maxTokens,
    systemPrompt: llmConfig.systemPrompt,
    tools: agent.tools,
    environment: agent.environment,
  },
})
```

**Step 4: Run test to verify it passes**

Run: `cd repos/backend && pnpm test -- --reporter verbose createSession`
Expected: PASS (all existing + new tests)

---

## Phase 3: Backend WebSocket Handler

### Task 4: Install `ws` dependency

**Files:**
- Modify: `repos/backend/package.json`

**Step 1: Install the `ws` package**

Run: `cd repos/backend && pnpm add ws && pnpm add -D @types/ws`

**Step 2: Verify installation**

Run: `cd repos/backend && node -e "require('ws'); console.log('ws OK')"`
Expected: `ws OK`

---

### Task 5: Create WebSocket handler with agent execution

**Files:**
- Create: `repos/backend/src/endpoints/ai/wsHandler.ts`
- Create: `repos/backend/src/endpoints/ai/wsHandler.test.ts`

**Step 1: Write the failing test**

```typescript
// repos/backend/src/endpoints/ai/wsHandler.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { IncomingMessage } from 'http'
import type WebSocket from 'ws'

import { EWSEventType } from '@tdsk/domain'
import { handleWSConnection } from './wsHandler'
import { resetSessionStore, createSession } from '@TBE/services/sessionStore'

vi.mock('@TBE/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@tdsk/agent', () => ({
  AgentRunner: { run: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@TBE/services/secrets/secretResolver', () => ({
  SecretResolver: vi.fn().mockImplementation(() => ({
    resolveApiKey: vi.fn().mockResolvedValue('sk-test'),
    resolveHeaders: vi.fn().mockResolvedValue({}),
    resolveBodyParams: vi.fn().mockResolvedValue({}),
  })),
}))

const createMockWS = () => {
  const sent: string[] = []
  return {
    send: vi.fn((data: string) => sent.push(data)),
    close: vi.fn(),
    on: vi.fn(),
    readyState: 1, // WebSocket.OPEN
    _sent: sent,
  } as unknown as WebSocket & { _sent: string[] }
}

const createMockReq = (token: string) =>
  ({
    url: `/ai/ws?token=${token}`,
  }) as IncomingMessage

const buildMockApp = () =>
  ({
    locals: {
      config: { server: { port: 5885 } },
      db: {
        services: {
          agent: { get: vi.fn() },
          thread: { create: vi.fn() },
          message: {
            list: vi.fn().mockResolvedValue({ data: [] }),
            create: vi.fn().mockResolvedValue({ data: { id: 'm1' } }),
          },
          function: { get: vi.fn() },
          secret: { get: vi.fn(), list: vi.fn().mockResolvedValue({ data: [] }) },
          role: {
            getOrgRole: vi.fn().mockResolvedValue({ data: { type: 'admin' } }),
          },
        },
      },
    },
  }) as any

describe('handleWSConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSessionStore()
  })

  afterEach(() => {
    resetSessionStore()
  })

  it('should close connection with 4001 for missing token', () => {
    const ws = createMockWS()
    const req = { url: '/ai/ws' } as IncomingMessage

    handleWSConnection(ws, req, buildMockApp())

    expect(ws.close).toHaveBeenCalledWith(4001, expect.stringContaining('token'))
  })

  it('should close connection with 4001 for invalid token', () => {
    const ws = createMockWS()
    const req = createMockReq('nonexistent-token')

    handleWSConnection(ws, req, buildMockApp())

    expect(ws.close).toHaveBeenCalledWith(4001, expect.stringContaining('Invalid'))
  })

  it('should accept connection with valid session token', () => {
    const token = createSession({
      agentId: 'agent-1',
      orgId: 'org-1',
      userId: 'user-1',
      llmConfig: { model: 'claude-sonnet-4-20250514', provider: 'anthropic' } as any,
    })

    const ws = createMockWS()
    const req = createMockReq(token)

    handleWSConnection(ws, req, buildMockApp())

    expect(ws.close).not.toHaveBeenCalled()
    expect(ws.on).toHaveBeenCalledWith('message', expect.any(Function))
    expect(ws.on).toHaveBeenCalledWith('close', expect.any(Function))
  })

  it('should send error for unknown message type', () => {
    const token = createSession({
      agentId: 'agent-1',
      orgId: 'org-1',
      userId: 'user-1',
      llmConfig: { model: 'claude-sonnet-4-20250514', provider: 'anthropic' } as any,
    })

    const ws = createMockWS()
    const req = createMockReq(token)

    handleWSConnection(ws, req, buildMockApp())

    // Get the message handler
    const messageHandler = (ws.on as any).mock.calls.find(
      (c: any[]) => c[0] === 'message'
    )[1]

    // Send unknown message
    messageHandler(JSON.stringify({ type: 'unknown_type' }))

    const lastSent = JSON.parse(ws._sent[ws._sent.length - 1])
    expect(lastSent.type).toBe(EWSEventType.Error)
  })

  it('should send error for invalid JSON', () => {
    const token = createSession({
      agentId: 'agent-1',
      orgId: 'org-1',
      userId: 'user-1',
      llmConfig: { model: 'claude-sonnet-4-20250514', provider: 'anthropic' } as any,
    })

    const ws = createMockWS()
    const req = createMockReq(token)

    handleWSConnection(ws, req, buildMockApp())

    const messageHandler = (ws.on as any).mock.calls.find(
      (c: any[]) => c[0] === 'message'
    )[1]

    messageHandler('not-json')

    const lastSent = JSON.parse(ws._sent[ws._sent.length - 1])
    expect(lastSent.type).toBe(EWSEventType.Error)
    expect(lastSent.message).toContain('parse')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/backend && pnpm test -- --reporter verbose wsHandler`
Expected: FAIL — module not found

**Step 3: Write the WebSocket handler**

```typescript
// repos/backend/src/endpoints/ai/wsHandler.ts
import type { IncomingMessage } from 'http'
import type WebSocket from 'ws'
import type { TApp } from '@TBE/types'
import type { TSession } from '@TBE/services/sessionStore'

import { URL } from 'url'
import { AgentRunner } from '@tdsk/agent'
import { logger } from '@TBE/utils/logger'
import { EWSEventType } from '@tdsk/domain'
import { ESandboxType } from '@tdsk/domain'
import { getSession, deleteSession } from '@TBE/services/sessionStore'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'

/**
 * Send a typed WS message. Silently drops if socket is not open.
 */
const send = (ws: WebSocket, msg: Record<string, unknown>): void => {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg))
}

/**
 * Create an IAgentRunnerDB adapter from the app's database services
 */
const createDBAdapter = (db: any) => ({
  createMessage: (data: any) => db.services.message.create(data),
  listMessages: (opts: any) =>
    db.services.message.list({
      limit: opts.limit,
      where: opts.where,
      offset: opts.offset,
    }),
})

/**
 * Handle an incoming WebSocket connection for agent execution.
 *
 * Auth: session token is passed as `?token=<uuid>` query param.
 * The token was obtained via `POST /_/ai/sessions` (JWT/API key auth).
 */
export const handleWSConnection = (
  ws: WebSocket,
  req: IncomingMessage,
  app: TApp
): void => {
  // 1. Extract and validate session token from query string
  const url = new URL(req.url || '', 'http://localhost')
  const token = url.searchParams.get('token')

  if (!token) {
    ws.close(4001, 'Session token required in ?token= query param')
    return
  }

  const session = getSession(token)
  if (!session) {
    ws.close(4001, 'Invalid or expired session')
    return
  }

  logger.info(`WS connected: agent=${session.agentId}, user=${session.userId}`)

  // 2. Execution state
  let abortController: AbortController | null = null
  const { db } = app.locals

  // 3. Handle incoming messages
  ws.on('message', async (raw: Buffer | string) => {
    let msg: any
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'))
    } catch {
      send(ws, { type: EWSEventType.Error, message: 'Failed to parse message as JSON' })
      return
    }

    switch (msg.type) {
      case EWSEventType.Prompt:
        await handlePrompt(ws, msg, session, db, app, () => abortController, (ac) => { abortController = ac })
        break

      case EWSEventType.Cancel:
        if (abortController) {
          abortController.abort()
          abortController = null
        }
        break

      case EWSEventType.FileUpload:
        // Phase 8 — workspace file sync (placeholder for now)
        logger.debug(`WS file_upload received: ${msg.path}`)
        break

      case EWSEventType.WorkspaceManifest:
        // Phase 8 — workspace manifest (placeholder for now)
        logger.debug(`WS workspace_manifest received: ${msg.files?.length} files`)
        break

      default:
        send(ws, { type: EWSEventType.Error, message: `Unknown message type: ${msg.type}` })
    }
  })

  // 4. Cleanup on disconnect
  ws.on('close', () => {
    logger.info(`WS disconnected: agent=${session.agentId}, user=${session.userId}`)
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  })
}

/**
 * Handle a `prompt` message — run the full agent loop server-side
 * and stream events back over WebSocket.
 */
async function handlePrompt(
  ws: WebSocket,
  msg: { prompt: string; threadId?: string; maxSteps?: number },
  session: TSession,
  db: any,
  app: TApp,
  getAbort: () => AbortController | null,
  setAbort: (ac: AbortController | null) => void
): Promise<void> {
  const { prompt, maxSteps } = msg
  if (!prompt) {
    send(ws, { type: EWSEventType.Error, message: 'prompt is required' })
    return
  }

  // Prevent concurrent runs on the same connection
  if (getAbort()) {
    send(ws, { type: EWSEventType.Error, message: 'Agent is already running. Send cancel first.' })
    return
  }

  const ac = new AbortController()
  setAbort(ac)

  try {
    // 1. Create or reuse thread
    let threadId = msg.threadId
    if (!threadId) {
      const { data: thread, error: threadErr } = await db.services.thread.create({
        userId: session.userId,
        agentId: session.agentId,
        orgId: session.orgId,
        name: prompt.substring(0, 100),
      })

      if (threadErr || !thread) {
        send(ws, { type: EWSEventType.Error, message: 'Failed to create thread' })
        return
      }

      threadId = thread.id
      send(ws, { type: EWSEventType.ThreadCreated, threadId })
    }

    // 2. Build sandbox config from session (envVars stay server-side)
    const sandboxConfig = {
      envVars: session.envVars ?? {},
      timeout: session.environment?.timeout ?? 300000,
      provider: ESandboxType.local,
    }

    // 3. Build function map for custom function execution
    const customFunctions = session.customFunctions || []
    const functionMap = new Map(customFunctions.map((fn: any) => [fn.id, fn]))

    // 4. Run the agent — events stream back over WS
    await AgentRunner.run({
      prompt,
      threadId,
      sandboxConfig,
      userId: session.userId,
      agentId: session.agentId,
      orgId: session.orgId,
      llmConfig: session.llmConfig,
      db: createDBAdapter(db),
      signal: ac.signal,
      tools: session.tools,
      environment: session.environment,
      customFunctions,
      maxSteps,
      onExecuteFunction: async (functionId, input) => {
        const func = functionMap.get(functionId)
        if (!func) {
          return { duration: 0, output: null, success: false, error: 'Function not found' }
        }
        return FunctionExecutor.execute(func, {
          context: { args: input as Record<string, any> },
        })
      },
      onEvent: (event) => {
        if (ac.signal.aborted) return
        // Bridge TStreamEvent to EWSEventType messages
        bridgeEventToWS(ws, event)
      },
    })

    // 5. Send done
    send(ws, { type: EWSEventType.Done, reason: 'complete' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent execution failed'
    if (!ac.signal.aborted) {
      send(ws, { type: EWSEventType.Error, message })
    }
  } finally {
    setAbort(null)
  }
}

/**
 * Bridge pi-mono TStreamEvent to EWSEventType WebSocket messages.
 * Maps the existing event types to the new WS protocol.
 */
function bridgeEventToWS(ws: WebSocket, event: any): void {
  switch (event.type) {
    case 'text':
      send(ws, { type: EWSEventType.TextDelta, delta: event.text })
      break
    case 'tool_call_start':
      send(ws, {
        type: EWSEventType.ToolExecutionStart,
        toolCallId: event.id,
        toolName: event.name,
        args: {},
      })
      break
    case 'tool_result':
      send(ws, {
        type: EWSEventType.ToolExecutionEnd,
        toolCallId: event.toolUseId,
        result: event.content,
        isError: event.isError ?? false,
      })
      break
    case 'tool_execution_update':
      send(ws, {
        type: EWSEventType.ToolExecutionEnd,
        toolCallId: event.toolUseId,
        result: event.content,
        isError: false,
      })
      break
    case 'error':
      send(ws, { type: EWSEventType.Error, message: event.error })
      break
    case 'done':
      send(ws, { type: EWSEventType.TurnEnd, usage: { input: 0, output: 0 } })
      break
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd repos/backend && pnpm test -- --reporter verbose wsHandler`
Expected: PASS

---

### Task 6: Attach WebSocket server to HTTP server

**Files:**
- Modify: `repos/backend/src/server/server.ts`
- Modify: `repos/backend/src/main.ts`

**Step 1: Write the failing test**

```typescript
// repos/backend/src/server/wsServer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createWSServer } from './wsServer'

vi.mock('@TBE/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('ws', () => {
  const mockWSS = {
    on: vi.fn(),
    handleUpgrade: vi.fn(),
    close: vi.fn(),
  }
  return {
    default: { Server: vi.fn(() => mockWSS) },
    WebSocketServer: vi.fn(() => mockWSS),
  }
})

describe('createWSServer', () => {
  it('should create a WebSocketServer with noServer: true', () => {
    const { WebSocketServer } = require('ws')
    const app = { locals: { db: {} } } as any

    createWSServer(app)

    expect(WebSocketServer).toHaveBeenCalledWith({ noServer: true })
  })

  it('should return an object with handleUpgrade method', () => {
    const app = { locals: { db: {} } } as any
    const result = createWSServer(app)

    expect(typeof result.handleUpgrade).toBe('function')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/backend && pnpm test -- --reporter verbose wsServer`
Expected: FAIL — module not found

**Step 3: Create wsServer module**

```typescript
// repos/backend/src/server/wsServer.ts
import type { IncomingMessage } from 'http'
import type { Socket } from 'net'
import type { TApp } from '@TBE/types'

import { WebSocketServer } from 'ws'
import { logger } from '@TBE/utils/logger'
import { handleWSConnection } from '@TBE/endpoints/ai/wsHandler'

const WS_PATH = '/ai/ws'

/**
 * Creates a WebSocket server for agent execution.
 * Uses `noServer: true` — the HTTP server's `upgrade` event is handled manually
 * so we can filter by path and let non-WS requests pass through.
 */
export const createWSServer = (app: TApp) => {
  const wss = new WebSocketServer({ noServer: true })

  const handleUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const pathname = new URL(req.url || '', 'http://localhost').pathname
    if (pathname !== WS_PATH) {
      // Not our path — destroy the socket so other upgrade handlers can take it
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      handleWSConnection(ws, req, app)
    })
  }

  logger.info(`WebSocket server ready on path: ${WS_PATH}`)

  return { wss, handleUpgrade }
}
```

**Step 4: Wire it into server.ts**

In `repos/backend/src/server/server.ts`, add the upgrade handler:

```typescript
import http from 'http'
import { app } from '@TBE/server/app'
import { logger } from '@TBE/utils/logger'
import { createWSServer } from '@TBE/server/wsServer'

export const initServer = () => {
  const { port } = app.locals.config.server
  const httpServer = http.createServer(app)

  // Attach WebSocket upgrade handler
  const { handleUpgrade } = createWSServer(app)
  httpServer.on('upgrade', handleUpgrade)

  const server = httpServer
    .listen(port, () => {
      logger.info(`🚀 Accounts Server running on port ${port}`)
    })
    .on('error', (e) => {
      logger.error({
        error: e.stack,
        message: `FATAL Error: ${e.name} ${e.message} - Shutting down server...`,
      })
      server.close()
    })

  return server
}
```

**Step 5: Run tests to verify everything passes**

Run: `cd repos/backend && pnpm test -- --reporter verbose wsServer`
Expected: PASS

---

## Phase 4: Proxy Updates

### Task 7: Update session auth to support query param token

**Files:**
- Modify: `repos/proxy/src/services/auth.ts`
- Modify: `repos/proxy/src/constants/values.ts`
- Modify: `repos/proxy/src/middleware/setupSessionAuth.ts`
- Modify: `repos/proxy/src/middleware/setupSessionAuth.test.ts`
- Modify: `repos/proxy/src/services/auth.test.ts`

**Step 1: Write the failing tests**

Add to `repos/proxy/src/middleware/setupSessionAuth.test.ts`:

```typescript
it('should call next when session token is in query param on /ai/ws', () => {
  mockAuth.isSession.mockImplementation((path: string) =>
    ['/ai/chat', '/ai/stream', '/ai/ws'].some((route) => path.startsWith(route))
  )
  // Override extract to also check query params
  mockAuth.extract.mockReturnValue('abc-session-token')

  const mockReq = {
    path: '/ai/ws',
    query: { token: 'abc-session-token' },
    headers: {},
  } as unknown as Request

  const middleware = validateSessionAuth(mockApp)
  middleware(mockReq, mockRes, mockNext)

  expect(mockNext).toHaveBeenCalled()
  expect(mockRes.status).not.toHaveBeenCalled()
})

it('should return 401 when no token on /ai/ws path', () => {
  mockAuth.isSession.mockImplementation((path: string) =>
    ['/ai/chat', '/ai/stream', '/ai/ws'].some((route) => path.startsWith(route))
  )
  mockAuth.extract.mockReturnValue(null)

  const mockReq = {
    path: '/ai/ws',
    query: {},
    headers: {},
  } as unknown as Request

  const middleware = validateSessionAuth(mockApp)
  middleware(mockReq, mockRes, mockNext)

  expect(mockRes.status).toHaveBeenCalledWith(401)
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/proxy && pnpm test -- --reporter verbose setupSessionAuth`
Expected: FAIL — `/ai/ws` not in SessionRoutes

**Step 3: Update proxy constants**

In `repos/proxy/src/constants/values.ts`:

```typescript
export const SessionRoutes = ['/ai/chat', '/ai/stream', '/ai/ws']
```

**Step 4: Update Auth.extract to also check query params**

In `repos/proxy/src/services/auth.ts`, update the `extract` method:

```typescript
extract = (req: Request): string | null => {
  const authHeader = req.headers.authorization
  if (authHeader) {
    if (authHeader.startsWith(BearerPrefix))
      return authHeader.slice(BearerPrefix.length).trim()

    if (authHeader.startsWith(SessionPrefix))
      return authHeader.slice(SessionPrefix.length).trim()

    logger.error('Invalid Authorization header:', authHeader)
    return null
  }

  // Fallback: check query param (used by WebSocket connections)
  const queryToken = (req as any).query?.token
  if (queryToken && typeof queryToken === 'string') return queryToken

  return null
}
```

**Step 5: Run tests to verify they pass**

Run: `cd repos/proxy && pnpm test -- --reporter verbose setupSessionAuth`
Expected: PASS (all existing + new tests)

**Step 6: Update auth.test.ts for query param extraction**

Add to `repos/proxy/src/services/auth.test.ts`:

```typescript
it('should extract token from query param when no Authorization header', () => {
  const auth = new Auth({ url: 'https://auth.example.com/.well-known/jwks.json' })
  const req = {
    headers: {},
    query: { token: 'session-from-query' },
  } as unknown as Request

  expect(auth.extract(req)).toBe('session-from-query')
})

it('should prefer Authorization header over query param', () => {
  const auth = new Auth({ url: 'https://auth.example.com/.well-known/jwks.json' })
  const req = {
    headers: { authorization: 'Session header-token' },
    query: { token: 'query-token' },
  } as unknown as Request

  expect(auth.extract(req)).toBe('header-token')
})
```

**Step 7: Run all proxy tests**

Run: `cd repos/proxy && pnpm test`
Expected: PASS (all tests)

---

## Phase 5: Remove SSE Stream Endpoint

### Task 8: Remove streamChat and aiStream

**Files:**
- Delete content of: `repos/backend/src/endpoints/ai/streamChat.ts`
- Delete content of: `repos/backend/src/endpoints/ai/stream.ts`
- Modify: `repos/backend/src/endpoints/ai/index.ts`
- Delete: `repos/backend/src/endpoints/ai/streamChat.test.ts`

**Step 1: Remove aiStream export**

In `repos/backend/src/endpoints/ai/index.ts`, change to:

```typescript
export { ai } from './ai'
```

Remove the `export { aiStream } from './stream'` line.

**Step 2: Find where aiStream is imported and remove those references**

Search for: `aiStream` across backend — it's likely imported in the endpoint mounting setup.

Run: `grep -r "aiStream" repos/backend/src/` to find all references.

Remove each reference. The mounting is in `repos/backend/src/middleware/setupEndpoints.ts` — remove the `aiStream` entry from the endpoint configs array.

**Step 3: Delete the stream files**

Delete the following files entirely:
- `repos/backend/src/endpoints/ai/streamChat.ts`
- `repos/backend/src/endpoints/ai/streamChat.test.ts`
- `repos/backend/src/endpoints/ai/stream.ts`

**Step 4: Run all backend tests**

Run: `cd repos/backend && pnpm test`
Expected: PASS (reduced count since streamChat tests removed)

**Step 5: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: No errors

---

### Task 9: Remove createStreamProxy from agent repo

**Files:**
- Delete content of: `repos/agent/src/stream/stream.ts`
- Delete: `repos/agent/src/stream/stream.test.ts`
- Modify: `repos/agent/src/stream/index.ts` or barrel
- Modify: `repos/agent/src/index.ts`

**Step 1: Check what the stream barrel exports**

Read `repos/agent/src/stream/index.ts` to see what it exports.

**Step 2: Remove stream export from barrel**

In `repos/agent/src/index.ts`, remove:
```typescript
export * from './stream'
```

**Step 3: Delete stream files**

Delete:
- `repos/agent/src/stream/stream.ts`
- `repos/agent/src/stream/stream.test.ts`
- `repos/agent/src/stream/` directory (if empty after removal)

**Step 4: Check for other imports of createStreamProxy**

The AgentRunner itself imports `createStreamProxy` in `repos/agent/src/runner/runner.ts` line 10:
```typescript
import { createStreamProxy } from '@TAG/stream/stream'
```

This import and the usage on line 86 (`const streamFn = opts.proxyConfig ? createStreamProxy(opts.proxyConfig) : undefined`) must be removed. The runner should no longer accept `proxyConfig`.

Update `repos/agent/src/runner/runner.ts`:
- Remove the import of `createStreamProxy`
- Remove the `proxyConfig` usage on line 86
- Set `streamFn` to `undefined` (or remove it)

Update `repos/agent/src/types/runner.types.ts`:
- Remove `TProxyConfig` type
- Remove `proxyConfig?` field from `TAgentRunOpts`

**Step 5: Run agent tests**

Run: `cd repos/agent && pnpm test`
Expected: PASS (reduced count since stream tests removed)

**Step 6: Run type check**

Run: `cd repos/agent && pnpm types`
Expected: No errors

---

## Phase 6: REPL WebSocket Client

### Task 10: Update TSessionInfo type in REPL

**Files:**
- Modify: `repos/repl/src/types/session.types.ts`

**Step 1: Update the type**

```typescript
import type { TLLMProviderBrand, TAgentEnvironment } from '@tdsk/domain'

export type TProviderInfo = {
  id: string
  name: string
  model: string
  provider: TLLMProviderBrand
}

export enum EConnectionStatus {
  connected = 'connected',
  disconnected = 'disconnected',
  reconnecting = 'reconnecting',
}

export type TConnectionStatus = `${EConnectionStatus}`

export type TSessionInfo = {
  model: string
  maxTokens?: number
  sessionToken: string
  systemPrompt?: string
  provider: TLLMProviderBrand
  tools?: string[]
  environment?: TAgentEnvironment
}

export type TCachedSession = {
  agentId: string
  providerId?: string
  session: TSessionInfo
}
```

---

### Task 11: Rewrite Executor to use WebSocket

**Files:**
- Modify: `repos/repl/src/services/executor.ts`
- Modify: `repos/repl/src/services/executor.test.ts`

**Step 1: Write the failing tests**

Replace the test file with WebSocket-based tests:

```typescript
// repos/repl/src/services/executor.test.ts
import type { ApiClient } from '@TRL/services/api'
import type { TStreamEvent } from '@tdsk/domain'

import { Executor } from '@TRL/services/executor'
import { EWSEventType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock WebSocket
const createMockWS = () => {
  const handlers: Record<string, Function> = {}
  return {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn((event: string, handler: Function) => {
      handlers[event] = handler
    }),
    removeEventListener: vi.fn(),
    readyState: 1,
    _handlers: handlers,
    _simulateMessage: (data: any) => {
      if (handlers.message) handlers.message({ data: JSON.stringify(data) })
    },
    _simulateClose: () => {
      if (handlers.close) handlers.close()
    },
    _simulateOpen: () => {
      if (handlers.open) handlers.open()
    },
  }
}

vi.mock('ws', () => ({
  default: vi.fn(() => createMockWS()),
  WebSocket: vi.fn(() => createMockWS()),
}))

const makeClient = () =>
  ({
    proxyUrl: 'https://proxy.test',
    createSession: vi.fn().mockResolvedValue({
      maxTokens: 4096,
      provider: 'anthropic',
      sessionToken: 'sess-abc',
      systemPrompt: 'You are helpful',
      model: 'claude-sonnet-4-20250514',
      tools: ['shellExec', 'readFile'],
      environment: { timeout: 60000 },
    }),
    createThread: vi.fn().mockResolvedValue({ id: 'thread-new' }),
    listMessages: vi.fn().mockResolvedValue([]),
    createMessage: vi.fn().mockResolvedValue({ id: 'm1' }),
    listOrgs: vi.fn(),
    getOrg: vi.fn(),
    listAgents: vi.fn(),
    getAgent: vi.fn(),
    listThreads: vi.fn(),
    getThread: vi.fn(),
  }) as unknown as ApiClient

describe('Executor (WebSocket)', () => {
  let executor: Executor
  let client: ReturnType<typeof makeClient>

  beforeEach(() => {
    vi.clearAllMocks()
    client = makeClient()
    executor = new Executor(client)
  })

  describe('client', () => {
    it('should expose the api client', () => {
      expect(executor.client).toBe(client)
    })
  })

  describe('createSession', () => {
    it('should call client.createSession', async () => {
      const session = await executor.createSession('agent-1')

      expect(client.createSession).toHaveBeenCalledWith('agent-1', undefined)
      expect(session.sessionToken).toBe('sess-abc')
      expect(session.provider).toBe('anthropic')
    })

    it('should include tools and environment in session', async () => {
      const session = await executor.createSession('agent-1')

      expect(session.tools).toEqual(['shellExec', 'readFile'])
      expect(session.environment).toEqual({ timeout: 60000 })
    })
  })

  describe('run', () => {
    it('should create a session when none cached', async () => {
      // The run method will try to connect WS — we just verify session creation
      const runPromise = executor.run({
        onEvent: vi.fn(),
        orgId: 'org-1',
        prompt: 'Hello',
        userId: 'user-1',
        agentId: 'agent-1',
      })

      // Simulate immediate close to end the run
      // (In real implementation, the WS open/message/close flow handles this)

      expect(client.createSession).toHaveBeenCalledWith('agent-1', undefined)
    })
  })

  describe('abort', () => {
    it('should not throw when no active connection', () => {
      expect(() => executor.abort()).not.toThrow()
    })
  })

  describe('clearSession', () => {
    it('should clear cached session', async () => {
      await executor.createSession('agent-1')
      executor.clearSession()

      // Creating session again should call the API
      await executor.createSession('agent-1')
      expect(client.createSession).toHaveBeenCalledTimes(2)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/repl && pnpm test -- --reporter verbose executor`
Expected: FAIL — old tests import AgentRunner which no longer exists

**Step 3: Rewrite Executor class**

```typescript
// repos/repl/src/services/executor.ts
import type { ApiClient } from '@TRL/services/api'
import type { TExecRunOpts, TSessionInfo, TRunResult } from '@TRL/types'

import WebSocket from 'ws'
import { EWSEventType } from '@tdsk/domain'

/**
 * Executor — thin WebSocket client that connects to backend for agent execution.
 *
 * Flow:
 * 1. Creates a session via HTTP (backend resolves API key, returns session token)
 * 2. Connects to WebSocket with session token
 * 3. Sends prompt message
 * 4. Receives streaming events and forwards them via onEvent callback
 */
export class Executor {
  #client: ApiClient
  #cachedSession: { session: TSessionInfo; agentId: string; providerId?: string } | null =
    null
  #ws: WebSocket | null = null

  constructor(client: ApiClient) {
    this.#client = client
  }

  get client(): ApiClient {
    return this.#client
  }

  async createSession(agentId: string, providerId?: string): Promise<TSessionInfo> {
    return this.#client.createSession(agentId, providerId)
  }

  async #ensureSession(agentId: string, providerId?: string): Promise<TSessionInfo> {
    if (
      this.#cachedSession &&
      this.#cachedSession.agentId === agentId &&
      this.#cachedSession.providerId === providerId
    ) {
      return this.#cachedSession.session
    }
    const session = await this.createSession(agentId, providerId)
    this.#cachedSession = { session, agentId, providerId }
    return session
  }

  clearSession(): void {
    this.#cachedSession = null
  }

  abort(): void {
    if (this.#ws) {
      this.#ws.close()
      this.#ws = null
    }
  }

  destroy(): void {
    this.abort()
    this.clearSession()
  }

  async run(opts: TExecRunOpts): Promise<TRunResult> {
    const { orgId, agentId, prompt, onEvent } = opts

    // 1. Get or reuse session
    const session = await this.#ensureSession(agentId, opts.providerId)

    // 2. Build WS URL with session token
    const baseUrl = this.#client.proxyUrl.replace(/^http/, 'ws')
    const wsUrl = `${baseUrl}/ai/ws?token=${session.sessionToken}`

    // 3. Connect and run
    return new Promise<TRunResult>((resolve, reject) => {
      let threadId = opts.threadId
      const ws = new WebSocket(wsUrl, {
        rejectUnauthorized: false,
      })
      this.#ws = ws

      ws.addEventListener('open', () => {
        // Send prompt message
        ws.send(
          JSON.stringify({
            type: EWSEventType.Prompt,
            prompt,
            threadId,
            maxSteps: opts.maxSteps,
          })
        )
      })

      ws.addEventListener('message', (event: any) => {
        try {
          const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString())

          switch (msg.type) {
            case EWSEventType.TextDelta:
              onEvent({ type: 'text', text: msg.delta } as any)
              break

            case EWSEventType.ToolExecutionStart:
              onEvent({
                type: 'tool_call_start',
                id: msg.toolCallId,
                name: msg.toolName,
              } as any)
              break

            case EWSEventType.ToolExecutionEnd:
              onEvent({
                type: 'tool_result',
                toolUseId: msg.toolCallId,
                content: msg.result,
                isError: msg.isError,
              } as any)
              break

            case EWSEventType.ThreadCreated:
              threadId = msg.threadId
              break

            case EWSEventType.TurnEnd:
              // Turn ended, more may come
              break

            case EWSEventType.Done:
              // Agent execution complete
              break

            case EWSEventType.Error:
              onEvent({ type: 'error', error: msg.message } as any)
              break

            case EWSEventType.FileRequest:
              // Phase 8: respond with file content
              break

            case EWSEventType.FileChanged:
              // Phase 8: stage file change locally
              break
          }
        } catch {
          // Skip malformed messages
        }
      })

      ws.addEventListener('close', () => {
        this.#ws = null
        resolve({ threadId: threadId || '' })
      })

      ws.addEventListener('error', (err: any) => {
        this.#ws = null
        reject(err instanceof Error ? err : new Error(String(err.message || err)))
      })
    })
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd repos/repl && pnpm test -- --reporter verbose executor`
Expected: PASS

**Step 5: Remove @tdsk/agent and @tdsk/sandbox dependencies from REPL**

The REPL no longer runs AgentRunner locally. Remove these workspace dependencies:

Run: `cd repos/repl && pnpm remove @tdsk/agent @tdsk/sandbox && pnpm add ws && pnpm add -D @types/ws`

Also remove the `DBProxy` import in executor.ts (no longer needed).

Check for any other files in `repos/repl` that import from `@tdsk/agent` or `@tdsk/sandbox`:

Run: `grep -r "@tdsk/agent\|@tdsk/sandbox" repos/repl/src/`

Remove or update each reference found.

**Step 6: Run all REPL tests**

Run: `cd repos/repl && pnpm test`
Expected: PASS (all tests)

**Step 7: Run type check**

Run: `cd repos/repl && pnpm types`
Expected: No errors

---

## Phase 7: Admin WebSocket Client

### Task 12: Add session creation to AgentsApi

**Files:**
- Modify: `repos/admin/src/services/agentsApi.ts`

**Step 1: Add createSession method**

In `repos/admin/src/services/agentsApi.ts`, add a `createSession` method:

```typescript
/**
 * Create a session for WebSocket agent execution
 * Returns session token + non-sensitive agent config
 */
async createSession(
  orgId: string,
  agentId: string
): Promise<TApiRes<{ sessionToken: string; model: string; provider: string; tools?: string[]; environment?: any }>> {
  const resp = await this.api.post<{
    sessionToken: string
    model: string
    provider: string
    tools?: string[]
    environment?: any
  }>({
    data: { agentId },
    path: `/ai/sessions`,
  })

  resp.error && (await this._onError(resp.error, 'Failed to create session'))

  return resp
}
```

---

### Task 13: Rewrite useAgentChat hook to use WebSocket

**Files:**
- Modify: `repos/admin/src/hooks/chat/useAgentChat.ts`

**Step 1: Rewrite the hook**

```typescript
// repos/admin/src/hooks/chat/useAgentChat.ts
import { useState, useRef, useCallback } from 'react'
import { agentsApi } from '@TAF/services/agentsApi'
import { EWSEventType } from '@tdsk/domain'
import { apiUrl } from '@TAF/utils/api/apiUrl'

export type TChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  toolCalls?: TChatToolCall[]
  timestamp: number
}

export type TChatToolCall = {
  id: string
  name: string
  args: string
  result?: string
  isError?: boolean
}

export type TUseAgentChatOpts = {
  orgId: string
  agentId: string
  threadId?: string
}

export const useAgentChat = (opts: TUseAgentChatOpts) => {
  const { orgId, agentId } = opts

  const [messages, setMessages] = useState<TChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [threadId, setThreadId] = useState<string | undefined>(opts.threadId)
  const [error, setError] = useState<string | undefined>()

  const wsRef = useRef<WebSocket | null>(null)
  const toolCallsRef = useRef<Map<string, TChatToolCall>>(new Map())

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (isStreaming || !prompt.trim()) return

      setError(undefined)
      setIsStreaming(true)

      const userMsg: TChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: prompt,
        timestamp: Date.now(),
      }

      const assistantMsg: TChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: '',
        toolCalls: [],
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      toolCallsRef.current = new Map()

      try {
        // 1. Create session (gets session token)
        const { data: sessionData, error: sessionErr } = await agentsApi.createSession(
          orgId,
          agentId
        )

        if (sessionErr || !sessionData) {
          setError(sessionErr?.message || 'Failed to create session')
          setIsStreaming(false)
          return
        }

        // 2. Connect WebSocket
        const base = apiUrl({}).replace(/\/$/, '').replace(/^http/, 'ws')
        const wsUrl = `${base}/ai/ws?token=${sessionData.sessionToken}`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: EWSEventType.Prompt,
              prompt,
              threadId,
            })
          )
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string)
            processWSEvent(msg, assistantMsg.id)
          } catch {
            // Skip malformed messages
          }
        }

        ws.onclose = () => {
          wsRef.current = null
          setIsStreaming(false)
        }

        ws.onerror = () => {
          setError('WebSocket connection error')
          setIsStreaming(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection error')
        setIsStreaming(false)
      }
    },
    [orgId, agentId, threadId, isStreaming]
  )

  const processWSEvent = (msg: any, msgId: string) => {
    switch (msg.type) {
      case EWSEventType.TextDelta:
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, text: m.text + msg.delta } : m))
        )
        break

      case EWSEventType.ToolExecutionStart: {
        const tc: TChatToolCall = { id: msg.toolCallId, name: msg.toolName, args: '' }
        toolCallsRef.current.set(msg.toolCallId, tc)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, toolCalls: [...(m.toolCalls || []), tc] } : m
          )
        )
        break
      }

      case EWSEventType.ToolExecutionEnd: {
        const tc = toolCallsRef.current.get(msg.toolCallId)
        if (tc) {
          tc.result = msg.result
          tc.isError = msg.isError
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    toolCalls: (m.toolCalls || []).map((t) =>
                      t.id === msg.toolCallId ? { ...tc } : t
                    ),
                  }
                : m
            )
          )
        }
        break
      }

      case EWSEventType.ThreadCreated:
        setThreadId(msg.threadId)
        break

      case EWSEventType.Error:
        setError(msg.message)
        break

      case EWSEventType.Done:
        // Agent execution complete — WS will close
        break
    }
  }

  const reset = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setMessages([])
    setThreadId(undefined)
    setError(undefined)
    toolCallsRef.current = new Map()
  }, [])

  return {
    messages,
    sendMessage,
    isStreaming,
    threadId,
    error,
    reset,
  }
}
```

**Step 2: Remove old run() from agentsApi (or keep for reference)**

The `run()` method in `agentsApi.ts` (lines 213-239) did `POST /_/orgs/:orgId/agents/:agentId/run` with SSE. This can be kept since `POST /_/agents/:id/run` is still an active endpoint — just no longer used by the admin chat UI. If desired, leave it for other uses.

**Step 3: Remove unused TStreamEvent import**

In `repos/admin/src/services/agentsApi.ts`, remove:
```typescript
import type { TStreamEvent } from '@tdsk/domain'
```
if no longer referenced.

**Step 4: Run type check**

Run: `cd repos/admin && pnpm types`
Expected: No errors

---

## Phase 8: Verification

### Task 14: Run all unit tests across repos

**Step 1: Run domain tests**

Run: `cd repos/domain && pnpm test`
Expected: All tests PASS

**Step 2: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All tests PASS (minus removed streamChat tests)

**Step 3: Run proxy tests**

Run: `cd repos/proxy && pnpm test`
Expected: All tests PASS

**Step 4: Run agent tests**

Run: `cd repos/agent && pnpm test`
Expected: All tests PASS (minus removed stream tests)

**Step 5: Run REPL tests**

Run: `cd repos/repl && pnpm test`
Expected: All tests PASS

---

### Task 15: Run full type checks

**Step 1: Run type checks across all repos**

Run: `pnpm types`
Expected: No errors across any repo

This will catch cross-repo type issues (e.g., REPL importing removed types from agent).

---

### Task 16: Integration testing against live K8s

K8s auto-syncs local files and auto-restarts services.

**Step 1: Verify backend health**

Run: `curl -sf https://px.local.threadedstack.app/_/health --insecure`
Expected: 200 OK

**Step 2: Create a session via API**

```bash
curl -s -X POST https://px.local.threadedstack.app/_/ai/sessions \
  -H "Authorization: Bearer tdsk_<API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"<AGENT_ID>"}' \
  --insecure
```

Expected: Response includes `sessionToken`, `tools`, `environment` (no `envVars`)

**Step 3: Connect WebSocket via wscat**

```bash
npx wscat -c "wss://px.local.threadedstack.app/ai/ws?token=<SESSION_TOKEN>" --no-check
```

Expected: Connection established

**Step 4: Send a prompt**

```json
{"type":"prompt","prompt":"Hello, what tools do you have?"}
```

Expected: Receive `text_delta` messages with agent response listing its tools

**Step 5: Verify REPL works**

```bash
tsa login <key> --insecure
tsa chat --agent <id>
```

Type a message and verify streaming works over WebSocket.

---

## Deferred: Phase 9 — Workspace File Sync

This phase is placeholder — the file sync protocol (file_request, file_upload, file_changed) is defined in the WS types and has placeholder handlers in the wsHandler. Full implementation is a separate task that includes:

- Sandbox integration with workspace-aware file system
- Client-side file staging (pending changes list)
- Real FS → InMemoryFs mapping with persist mechanism

This is tracked separately from the core WebSocket migration.

---

## Critical Files Summary

| File | Action | Phase |
|------|--------|-------|
| `repos/domain/src/types/ws.types.ts` | CREATE | 1 |
| `repos/domain/src/types/ws.types.test.ts` | CREATE | 1 |
| `repos/domain/src/types/index.ts` | MODIFY — add ws.types export | 1 |
| `repos/backend/src/services/sessionStore.ts` | MODIFY — extend TSession | 2 |
| `repos/backend/src/services/sessionStore.test.ts` | MODIFY — add extended field tests | 2 |
| `repos/backend/src/endpoints/ai/createSession.ts` | MODIFY — store+return new fields | 2 |
| `repos/backend/src/endpoints/ai/createSession.test.ts` | MODIFY — add new field tests | 2 |
| `repos/backend/package.json` | MODIFY — add ws dep | 3 |
| `repos/backend/src/endpoints/ai/wsHandler.ts` | CREATE | 3 |
| `repos/backend/src/endpoints/ai/wsHandler.test.ts` | CREATE | 3 |
| `repos/backend/src/server/wsServer.ts` | CREATE | 3 |
| `repos/backend/src/server/wsServer.test.ts` | CREATE | 3 |
| `repos/backend/src/server/server.ts` | MODIFY — attach WS upgrade | 3 |
| `repos/proxy/src/constants/values.ts` | MODIFY — add /ai/ws to SessionRoutes | 4 |
| `repos/proxy/src/services/auth.ts` | MODIFY — query param extraction | 4 |
| `repos/proxy/src/middleware/setupSessionAuth.test.ts` | MODIFY — add WS tests | 4 |
| `repos/proxy/src/services/auth.test.ts` | MODIFY — add query param tests | 4 |
| `repos/backend/src/endpoints/ai/streamChat.ts` | DELETE | 5 |
| `repos/backend/src/endpoints/ai/streamChat.test.ts` | DELETE | 5 |
| `repos/backend/src/endpoints/ai/stream.ts` | DELETE | 5 |
| `repos/backend/src/endpoints/ai/index.ts` | MODIFY — remove aiStream export | 5 |
| `repos/agent/src/stream/stream.ts` | DELETE | 5 |
| `repos/agent/src/stream/stream.test.ts` | DELETE | 5 |
| `repos/agent/src/index.ts` | MODIFY — remove stream export | 5 |
| `repos/agent/src/runner/runner.ts` | MODIFY — remove proxyConfig | 5 |
| `repos/agent/src/types/runner.types.ts` | MODIFY — remove TProxyConfig | 5 |
| `repos/repl/src/types/session.types.ts` | MODIFY — add tools/environment | 6 |
| `repos/repl/src/services/executor.ts` | REWRITE — WebSocket client | 6 |
| `repos/repl/src/services/executor.test.ts` | REWRITE — WebSocket tests | 6 |
| `repos/repl/package.json` | MODIFY — remove agent/sandbox, add ws | 6 |
| `repos/admin/src/services/agentsApi.ts` | MODIFY — add createSession | 7 |
| `repos/admin/src/hooks/chat/useAgentChat.ts` | REWRITE — WebSocket client | 7 |
