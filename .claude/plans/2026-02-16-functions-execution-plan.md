# Functions Execution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable execution of user-written JS/TS functions via FaaS endpoints and as agent tools, using the existing sandbox infrastructure.

**Architecture:** A unified `FunctionExecutor` service handles both FaaS endpoint requests and agent tool calls. Functions are loaded from DB, TypeScript types are stripped via esbuild, code runs in a local sandbox, and results are returned as structured output. Functions attach to agents via an `agentId` FK on the functions table.

**Tech Stack:** TypeScript, esbuild, Drizzle ORM, Express 5, Vitest, ISandbox (local provider)

**Design Doc:** `docs/plans/2026-02-16-functions-execution-design.md`

---

## Dependency Graph

```
Task 1 (domain) ──┬──> Task 3 (FunctionExecutor) ──> Task 4 (FaaS handler)
                  │                                         │
Task 2 (database) ┘                                         │
                                                            ├──> Task 10 (validation)
Task 1 (domain) ──> Task 5 (agent types) ──> Task 6 (agent runner) ──┤
                                                            │
Task 3 ──────────────────> Task 7 (wire runAgent) ──────────┤
                                                            │
Task 2 (database) ──> Task 8 (admin FunctionDrawer) ────────┤
                  └──> Task 9 (admin AgentDrawer) ──────────┘
```

Tasks 1+2 run in parallel. Tasks 3+5 run in parallel. Tasks 4+6+8+9 run in parallel.

---

## Task 1: Domain — Add execution types and agentId to Function model

**Files:**
- Modify: `repos/domain/src/models/function.ts:8` (add `agentId` property)
- Modify: `repos/domain/src/types/functions.types.ts` (add 4 new types)
- Test: `repos/domain/src/models/__tests__/function.test.ts` (may need creation)

**Step 1: Add `agentId` to Function model**

In `repos/domain/src/models/function.ts`, add after line 8 (`endpointId`):

```typescript
agentId?: string
```

**Step 2: Add execution types to `repos/domain/src/types/functions.types.ts`**

Append after the existing `TFunLanguage` type (line 7):

```typescript
/** HTTP request data passed to FaaS function handler */
export type TFunctionRequest = {
  method?: string
  path?: string
  headers?: Record<string, string>
  query?: Record<string, string>
  body?: unknown
}

/** Platform-injected context available to function handler */
export type TFunctionContext = {
  envVars?: Record<string, string>
  secrets?: Record<string, string>
  args?: Record<string, any>
}

/** Return value from a FaaS function handler (maps to HTTP response) */
export type TFunctionResponse = {
  statusCode?: number
  headers?: Record<string, string>
  body?: unknown
}

/** Internal execution result from FunctionExecutor */
export type TFunctionExecResult = {
  success: boolean
  output: unknown
  duration: number
  error?: string
}
```

**Step 3: Verify domain types are exported**

Check that `repos/domain/src/types/index.ts` re-exports from `functions.types.ts`. If it already does (via `export * from './functions.types'`), no change needed. If not, add the export.

**Step 4: Run domain tests**

Run: `pnpm --filter @tdsk/domain test`
Expected: All existing tests pass (303 tests)

**Step 5: Commit**

```
feat(domain): add agentId to Function model and execution types
```

---

## Task 2: Database — Add agentId FK to functions schema

**Files:**
- Modify: `repos/database/src/schemas/functions.ts:6,18-29,32-41` (add import, column, index, relation)
- Modify: `repos/database/src/schemas/agents.ts` (add inverse relation)

**Step 1: Add `agentId` column to functions table**

In `repos/database/src/schemas/functions.ts`:

1. Add import for `agents` schema (after line 4):
```typescript
import { agents } from '@TDB/schemas/agents'
```

2. Add `agentId` column after `endpointId` (after line 21):
```typescript
    agentId: uuid(`agent_id`).references(() => agents.id, {
      onDelete: `cascade`,
    }),
```

3. Add index in the table config array (after line 28):
```typescript
    index(`functions_agent_id_idx`).on(table.agentId),
```

4. Add agent relation to `functionsRelations` (after the endpoint relation, line 34):
```typescript
  agent: one(agents, {
    fields: [functions.agentId],
    references: [agents.id],
  }),
```

**Step 2: Add inverse relation on agents**

In `repos/database/src/schemas/agents.ts`, add `functions` import and `many(functions)` to `agentsRelations`:

1. Add import at top:
```typescript
import { functions } from '@TDB/schemas/functions'
```

2. Add to the relations object:
```typescript
  functions: many(functions),
```

**Step 3: Run database tests**

Run: `pnpm --filter @tdsk/database test`
Expected: All existing tests pass

**Step 4: Push schema to DB**

> **MANUAL STEP**: User must run `pnpm push` from `repos/database/` and confirm the migration.

**Step 5: Commit**

```
feat(database): add agentId FK to functions schema with agent inverse relation
```

---

## Task 3: Backend — Create FunctionExecutor service

**Files:**
- Create: `repos/backend/src/services/functions/functionExecutor.ts`
- Create: `repos/backend/src/services/functions/functionExecutor.test.ts`

**Prerequisite:** Tasks 1 and 2 must be complete.

**Step 1: Install esbuild in backend**

Run: `pnpm --filter @tdsk/backend add esbuild`

**Step 2: Write failing test for FunctionExecutor**

Create `repos/backend/src/services/functions/functionExecutor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionExecutor } from './functionExecutor'
import { EFunLanguage } from '@tdsk/domain'

// Mock sandbox provider
const mockSandbox = {
  writeFile: vi.fn().mockResolvedValue(undefined),
  exec: vi.fn().mockResolvedValue({
    success: true,
    output: JSON.stringify({
      success: true,
      output: { statusCode: 200, body: { message: 'Hello' } },
    }),
    error: '',
  }),
  close: vi.fn().mockResolvedValue(undefined),
}

const mockProvider = {
  create: vi.fn().mockResolvedValue(mockSandbox),
}

vi.mock('@tdsk/sandbox', () => ({
  createSandboxProvider: () => mockProvider,
}))

// Mock esbuild
vi.mock('esbuild', () => ({
  transform: vi.fn().mockResolvedValue({
    code: 'export default async function handler(req, ctx) { return { statusCode: 200, body: { message: "Hello" } } }',
  }),
}))

describe('FunctionExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseFunction = {
    id: 'func-1',
    name: 'testFunc',
    content: 'export default async function handler(req: Request, ctx: Context) { return { statusCode: 200, body: { message: "Hello" } } }',
    language: EFunLanguage.typescript,
    projectId: 'proj-1',
  }

  it('should execute a TypeScript function and return result', async () => {
    const result = await FunctionExecutor.execute(baseFunction, {
      request: { method: 'GET', path: '/' },
    })

    expect(result.success).toBe(true)
    expect(result.output).toBeDefined()
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(mockSandbox.writeFile).toHaveBeenCalledTimes(2) // function.mjs + runner.mjs
    expect(mockSandbox.exec).toHaveBeenCalledOnce()
    expect(mockSandbox.close).toHaveBeenCalledOnce()
  })

  it('should skip esbuild for JavaScript functions', async () => {
    const { transform } = await import('esbuild')

    await FunctionExecutor.execute({
      ...baseFunction,
      language: EFunLanguage.javascript,
      content: 'export default async function handler(req, ctx) { return { body: "ok" } }',
    })

    expect(transform).not.toHaveBeenCalled()
  })

  it('should return error result when sandbox exec fails', async () => {
    mockSandbox.exec.mockResolvedValueOnce({
      success: false,
      output: '',
      error: 'ReferenceError: x is not defined',
    })

    const result = await FunctionExecutor.execute(baseFunction)

    expect(result.success).toBe(false)
    expect(result.error).toContain('ReferenceError')
  })

  it('should always close sandbox even on error', async () => {
    mockSandbox.writeFile.mockRejectedValueOnce(new Error('write failed'))

    const result = await FunctionExecutor.execute(baseFunction)

    expect(result.success).toBe(false)
    expect(mockSandbox.close).toHaveBeenCalledOnce()
  })

  it('should pass request and context to sandbox via env var', async () => {
    const request = { method: 'POST', body: { data: 'test' } }
    const context = { args: { key: 'value' } }

    await FunctionExecutor.execute(baseFunction, { request, context })

    // Check that exec was called — the env var is set in the runner
    expect(mockSandbox.exec).toHaveBeenCalledWith(
      'node',
      expect.arrayContaining(['runner.mjs']),
      expect.any(Object)
    )
  })
})
```

**Step 3: Run test to verify it fails**

Run: `pnpm --filter @tdsk/backend test -- src/services/functions/functionExecutor.test.ts`
Expected: FAIL — module not found

**Step 4: Write FunctionExecutor implementation**

Create `repos/backend/src/services/functions/functionExecutor.ts`:

```typescript
import type {
  TFunctionRequest,
  TFunctionContext,
  TFunctionExecResult,
} from '@tdsk/domain'

import { EFunLanguage } from '@tdsk/domain'
import { buildApiLogger } from '@tdsk/logger'
import { createSandboxProvider } from '@tdsk/sandbox'

const logger = buildApiLogger('function-executor')

const MAX_OUTPUT_SIZE = 1024 * 1024 // 1MB

type TFunctionRecord = {
  id: string
  name: string
  content: string
  language: string
  projectId: string
}

type TExecuteOpts = {
  request?: TFunctionRequest
  context?: TFunctionContext
  timeout?: number
}

/**
 * Runner wrapper code that imports the user function, parses input,
 * calls the handler, and writes JSON result to stdout.
 */
const buildRunnerCode = (): string => `
import handler from './function.mjs';
const input = JSON.parse(process.env.__FUNCTION_INPUT__ || '{}');
try {
  const result = await handler(input.request || {}, input.context || {});
  process.stdout.write(JSON.stringify({ success: true, output: result }));
} catch (err) {
  process.stdout.write(JSON.stringify({
    success: false,
    error: err instanceof Error ? err.message : String(err),
  }));
}
`

export class FunctionExecutor {
  /**
   * Execute a function in a sandbox
   * Used by both FaaS endpoint handler and agent tool execution
   */
  static execute = async (
    func: TFunctionRecord,
    opts: TExecuteOpts = {}
  ): Promise<TFunctionExecResult> => {
    const start = Date.now()
    const provider = createSandboxProvider('local' as any)
    const sandbox = await provider.create({
      provider: 'local' as any,
      timeout: opts.timeout ?? 300000,
    })

    try {
      // 1. Strip TypeScript types if needed
      let code = func.content
      if (func.language === EFunLanguage.typescript) {
        const { transform } = await import('esbuild')
        const result = await transform(code, {
          loader: 'ts',
          format: 'esm',
        })
        code = result.code
      }

      // 2. Write function code to sandbox
      await sandbox.writeFile('/workspace/function.mjs', code)

      // 3. Write runner wrapper
      await sandbox.writeFile('/workspace/runner.mjs', buildRunnerCode())

      // 4. Serialize input as env var
      const input = JSON.stringify({
        request: opts.request || {},
        context: opts.context || {},
      })

      // 5. Run in sandbox
      const execResult = await sandbox.exec('node', ['runner.mjs'], {
        cwd: '/workspace',
        env: { __FUNCTION_INPUT__: input },
      })

      // 6. Parse output
      if (!execResult.success) {
        return {
          success: false,
          output: null,
          error: execResult.error || 'Function execution failed',
          duration: Date.now() - start,
        }
      }

      const output = execResult.output || ''
      if (output.length > MAX_OUTPUT_SIZE) {
        return {
          success: false,
          output: null,
          error: `Function output exceeds maximum size (${MAX_OUTPUT_SIZE} bytes)`,
          duration: Date.now() - start,
        }
      }

      try {
        const parsed = JSON.parse(output)
        return {
          success: parsed.success ?? true,
          output: parsed.output ?? parsed,
          error: parsed.error,
          duration: Date.now() - start,
        }
      } catch {
        // Non-JSON output — return raw
        return {
          success: true,
          output,
          duration: Date.now() - start,
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`FunctionExecutor error: ${message}`)
      return {
        success: false,
        output: null,
        error: message,
        duration: Date.now() - start,
      }
    } finally {
      try {
        await sandbox.close()
      } catch (e) {
        logger.error(`Failed to close function sandbox: ${e}`)
      }
    }
  }
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter @tdsk/backend test -- src/services/functions/functionExecutor.test.ts`
Expected: PASS (5/5 tests)

**Step 6: Commit**

```
feat(backend): add FunctionExecutor service with esbuild TS stripping and sandbox lifecycle
```

---

## Task 4: Backend — Add FaaS endpoint handler

**Files:**
- Modify: `repos/backend/src/endpoints/proxy/endpoint.ts:36,47-53` (add FaaS branch)
- Create: `repos/backend/src/endpoints/proxy/faas.ts` (FaaS handler)
- Create: `repos/backend/src/endpoints/proxy/faas.test.ts` (tests)

**Prerequisite:** Task 3 must be complete.

**Step 1: Write failing test for FaaS handler**

Create `repos/backend/src/endpoints/proxy/faas.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleFaaSEndpoint } from './faas'
import { EEndpointType, EFunLanguage } from '@tdsk/domain'

// Mock FunctionExecutor
vi.mock('@TBE/services/functions/functionExecutor', () => ({
  FunctionExecutor: {
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: { statusCode: 200, headers: {}, body: { message: 'Hello' } },
      duration: 42,
    }),
  },
}))

const mockDb = {
  services: {
    function: {
      get: vi.fn().mockResolvedValue({
        data: {
          id: 'func-1',
          name: 'testFunc',
          content: 'export default async function handler() { return { statusCode: 200, body: { message: "Hello" } } }',
          language: EFunLanguage.typescript,
          projectId: 'proj-1',
        },
      }),
    },
    secret: {
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
  },
}

describe('handleFaaSEndpoint', () => {
  let mockReq: any
  let mockRes: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockReq = {
      method: 'POST',
      path: '/test',
      headers: { 'content-type': 'application/json' },
      query: {},
      body: { data: 'test' },
    }
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
      end: vi.fn(),
    }
  })

  it('should execute function and return HTTP response', async () => {
    const endpoint = {
      id: 'ep-1',
      type: EEndpointType.faas,
      options: { functionId: 'func-1' },
      projectId: 'proj-1',
    }

    await handleFaaSEndpoint(mockReq, mockRes, endpoint as any, mockDb as any)

    expect(mockDb.services.function.get).toHaveBeenCalledWith('func-1')
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Hello' })
  })

  it('should return 404 when function not found', async () => {
    mockDb.services.function.get.mockResolvedValueOnce({ data: null })

    const endpoint = {
      id: 'ep-1',
      type: EEndpointType.faas,
      options: { functionId: 'missing' },
      projectId: 'proj-1',
    }

    await expect(
      handleFaaSEndpoint(mockReq, mockRes, endpoint as any, mockDb as any)
    ).rejects.toThrow('Function not found')
  })

  it('should return 500 when function execution fails', async () => {
    const { FunctionExecutor } = await import('@TBE/services/functions/functionExecutor')
    vi.mocked(FunctionExecutor.execute).mockResolvedValueOnce({
      success: false,
      output: null,
      error: 'ReferenceError: x is not defined',
      duration: 10,
    })

    const endpoint = {
      id: 'ep-1',
      type: EEndpointType.faas,
      options: { functionId: 'func-1' },
      projectId: 'proj-1',
    }

    await expect(
      handleFaaSEndpoint(mockReq, mockRes, endpoint as any, mockDb as any)
    ).rejects.toThrow('Function execution failed')
  })

  it('should use default 200 status when function returns no statusCode', async () => {
    const { FunctionExecutor } = await import('@TBE/services/functions/functionExecutor')
    vi.mocked(FunctionExecutor.execute).mockResolvedValueOnce({
      success: true,
      output: { body: 'no status code' },
      duration: 5,
    })

    const endpoint = {
      id: 'ep-1',
      type: EEndpointType.faas,
      options: { functionId: 'func-1' },
      projectId: 'proj-1',
    }

    await handleFaaSEndpoint(mockReq, mockRes, endpoint as any, mockDb as any)
    expect(mockRes.status).toHaveBeenCalledWith(200)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @tdsk/backend test -- src/endpoints/proxy/faas.test.ts`
Expected: FAIL — module not found

**Step 3: Write FaaS handler**

Create `repos/backend/src/endpoints/proxy/faas.ts`:

```typescript
import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import type { TFunctionResponse, TFaaSEndpointConfig } from '@tdsk/domain'

import { Exception } from '@TBE/utils/errors/exception'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'

/**
 * Handle a FaaS endpoint request:
 * 1. Load the function from DB
 * 2. Build request/context from Express req + endpoint config
 * 3. Execute via FunctionExecutor
 * 4. Map function output to HTTP response
 */
export const handleFaaSEndpoint = async (
  req: TRequest,
  res: Response,
  endpoint: { options: TFaaSEndpointConfig; projectId: string },
  db: any
): Promise<void> => {
  const opts = endpoint.options
  const functionId = opts?.functionId
  if (!functionId) throw new Exception(400, 'Endpoint has no function configured')

  // Load function
  const { data: func, error } = await db.services.function.get(functionId)
  if (error || !func) throw new Exception(404, 'Function not found')

  // Build request from Express req
  const request = {
    method: req.method,
    path: req.path,
    headers: req.headers as Record<string, string>,
    query: req.query as Record<string, string>,
    body: req.body,
  }

  // Build context from endpoint config
  const context = {
    envVars: opts.envVars,
    args: opts.arguments,
  }

  // Execute
  const result = await FunctionExecutor.execute(func, { request, context })

  if (!result.success) {
    throw new Exception(500, `Function execution failed: ${result.error}`)
  }

  // Map output to HTTP response
  const output = result.output as TFunctionResponse | undefined
  const statusCode = output?.statusCode || 200
  const headers = output?.headers || {}
  const body = output?.body ?? output

  // Set response headers
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }

  res.status(statusCode).json(body)
}
```

**Step 4: Wire FaaS handler into endpoint.ts**

In `repos/backend/src/endpoints/proxy/endpoint.ts`, add at line 2 (imports):

```typescript
import { EEndpointType } from '@tdsk/domain'
import { handleFaaSEndpoint } from './faas'
```

Then in the `action` function, add a FaaS type check right after the endpoint is fetched (after line 50, before the `opts` cast):

```typescript
    // Handle FaaS endpoints
    if (ep?.type === EEndpointType.faas) {
      return handleFaaSEndpoint(req, res, ep as any, db)
    }
```

This must come BEFORE the existing `const opts = endpoint.options as TProxyEndpointConfig` line.

**Step 5: Run tests**

Run: `pnpm --filter @tdsk/backend test -- src/endpoints/proxy/faas.test.ts`
Expected: PASS (4/4 tests)

Run: `pnpm --filter @tdsk/backend test`
Expected: All existing tests pass

**Step 6: Commit**

```
feat(backend): add FaaS endpoint handler with function execution
```

---

## Task 5: Agent — Add custom function tool definitions and runner types

**Files:**
- Modify: `repos/agent/src/types/runner.types.ts:1,29` (add imports and new fields)
- Modify: `repos/agent/src/tools/definitions/definitions.ts` (add `buildFunctionToolDefs`)

**Prerequisite:** Task 1 must be complete.

**Step 1: Add custom function types to runner.types.ts**

In `repos/agent/src/types/runner.types.ts`:

1. Add import (line 1-7):
```typescript
import type {
  ILLMAdapter,
  TStreamEvent,
  TMessageContent,
  TLLMAdapterConfig,
  TAgentEnvironment,
  TFunctionExecResult,
} from '@tdsk/domain'
import type { Function as TDFunction } from '@tdsk/domain'
```

2. Add to `TAgentRunOpts` (after `onEvent` at line 56):
```typescript
  /** Custom functions attached to this agent */
  customFunctions?: TDFunction[]
  /** Callback to execute a custom function (provided by backend) */
  onExecuteFunction?: (functionId: string, input: unknown) => Promise<TFunctionExecResult>
```

**Step 2: Add `buildFunctionToolDefs` to definitions.ts**

In `repos/agent/src/tools/definitions/definitions.ts`, add after the existing exports:

```typescript
import type { Function as TDFunction } from '@tdsk/domain'

/**
 * Convert user-defined functions into LLM tool definitions.
 * Each function becomes a tool the LLM can call by its name.
 */
export const buildFunctionToolDefs = (functions: TDFunction[]): TLLMToolDef[] => {
  return functions.map((fn) => ({
    name: fn.name,
    description: fn.description || `Custom function: ${fn.name}`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        input: {
          type: 'object' as const,
          description: 'Input data passed to the function',
        },
      },
    },
  }))
}
```

**Step 3: Run agent tests**

Run: `pnpm --filter @tdsk/agent test`
Expected: Existing tests pass

**Step 4: Commit**

```
feat(agent): add custom function tool definitions and onExecuteFunction callback type
```

---

## Task 6: Agent — Extend AgentRunner to handle custom function tools

**Files:**
- Modify: `repos/agent/src/runner/runner.ts:4,29,73,270` (import, merge defs, default case)
- Create: `repos/agent/src/runner/customFunctions.test.ts` (tests)

**Prerequisite:** Task 5 must be complete.

**Step 1: Write failing test for custom function tool execution**

Create `repos/agent/src/runner/customFunctions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildFunctionToolDefs } from '@TAG/tools'
import type { Function as TDFunction } from '@tdsk/domain'

describe('buildFunctionToolDefs', () => {
  it('should convert functions to tool definitions', () => {
    const functions: Partial<TDFunction>[] = [
      { id: 'f1', name: 'fetchWeather', description: 'Get weather data for a city' },
      { id: 'f2', name: 'summarize', description: 'Summarize text content' },
    ]

    const defs = buildFunctionToolDefs(functions as TDFunction[])

    expect(defs).toHaveLength(2)
    expect(defs[0].name).toBe('fetchWeather')
    expect(defs[0].description).toBe('Get weather data for a city')
    expect(defs[0].inputSchema.type).toBe('object')
    expect(defs[1].name).toBe('summarize')
  })

  it('should use fallback description when none provided', () => {
    const functions: Partial<TDFunction>[] = [
      { id: 'f1', name: 'myTool' },
    ]

    const defs = buildFunctionToolDefs(functions as TDFunction[])
    expect(defs[0].description).toContain('myTool')
  })

  it('should return empty array for empty input', () => {
    expect(buildFunctionToolDefs([])).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @tdsk/agent test -- src/runner/customFunctions.test.ts`
Expected: FAIL (buildFunctionToolDefs not yet exported or wired)

**Step 3: Modify AgentRunner to merge custom tool defs**

In `repos/agent/src/runner/runner.ts`:

1. Add import for `buildFunctionToolDefs` (line 4):
```typescript
import { getToolDefs, buildFunctionToolDefs } from '@TAG//tools'
```

2. In `run()`, after line 73 (`const toolDefs = getToolDefs(tools)`), add merging logic:
```typescript
      // Merge custom function tool definitions
      const customToolDefs = opts.customFunctions?.length
        ? buildFunctionToolDefs(opts.customFunctions)
        : []
      const allToolDefs = [...toolDefs, ...customToolDefs]
```

3. Replace all subsequent uses of `toolDefs` in the method with `allToolDefs`:
   - Line 79: `if (allToolDefs.length > 0 && sandboxConfig?.provider) {`
   - Line 100: `for await (const event of adapter.stream(history, allToolDefs, llmConfig)) {`

4. In `executeTool()`, modify the `default` case (line 270-271):

Change:
```typescript
        default:
          return { success: false, output: `Unknown tool: ${name}` }
```

To:
```typescript
        default: {
          // Check if this is a custom function tool
          const customFn = opts?.customFunctions?.find((fn) => fn.name === name)
          if (customFn && opts?.onExecuteFunction) {
            const result = await opts.onExecuteFunction(customFn.id, args)
            return {
              success: result.success,
              output: result.success
                ? (typeof result.output === 'string' ? result.output : JSON.stringify(result.output))
                : (result.error || 'Function execution failed'),
            }
          }
          return { success: false, output: `Unknown tool: ${name}` }
        }
```

Note: `executeTool` needs access to `opts` for `customFunctions` and `onExecuteFunction`. The method signature needs to be updated to accept `opts` or the relevant fields need to be passed through. The simplest approach: change `executeTool` to accept the opts as an additional parameter, and pass them from the call site at line 153.

At line 153, change:
```typescript
const result = await AgentRunner.executeTool(sandbox, tc.name, tc.args)
```
To:
```typescript
const result = await AgentRunner.executeTool(sandbox, tc.name, tc.args, opts)
```

And update the `executeTool` signature (line 221-224):
```typescript
  private static executeTool = async (
    sandbox: ISandbox,
    name: string,
    argsJson: string,
    opts?: TAgentRunOpts
  ): Promise<{ success: boolean; output: string }> => {
```

**Step 4: Run tests**

Run: `pnpm --filter @tdsk/agent test -- src/runner/customFunctions.test.ts`
Expected: PASS (3/3 tests)

Run: `pnpm --filter @tdsk/agent test`
Expected: All tests pass

**Step 5: Commit**

```
feat(agent): extend AgentRunner to handle custom function tools via onExecuteFunction callback
```

---

## Task 7: Backend — Wire custom functions into runAgent.ts

**Files:**
- Modify: `repos/backend/src/endpoints/agents/runAgent.ts:6,134-151` (import, load functions, pass to runner)

**Prerequisite:** Tasks 3 and 6 must be complete.

**Step 1: Add FunctionExecutor import**

In `repos/backend/src/endpoints/agents/runAgent.ts`, add import (after line 6):

```typescript
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'
```

**Step 2: Load agent's custom functions**

After the secrets resolution block (after line 78), add:

```typescript
    // Load custom functions attached to this agent
    const { data: agentFunctions } = await db.services.function.list({
      where: { agentId: agent.id },
    })
```

**Step 3: Pass custom functions and callback to AgentRunner.run()**

In the `AgentRunner.run()` call (lines 135-151), add the new fields:

```typescript
      await AgentRunner.run({
        prompt,
        userId,
        agentId,
        threadId,
        llmConfig,
        maxSteps: 10,
        sandboxConfig,
        orgId: agent.orgId,
        db: createDBAdapter(db),
        environment: agent.environment,
        tools: agent.tools as string[] | undefined,
        customFunctions: agentFunctions || [],
        onExecuteFunction: (functionId, input) =>
          FunctionExecutor.execute(
            { id: functionId, name: '', content: '', language: '', projectId: '' },
            { context: { args: input as Record<string, any> } }
          ),
        onEvent: (event) => {
          if (aborted) return
          res.write(`data: ${JSON.stringify(event)}\n\n`)
        },
      })
```

Note: The `onExecuteFunction` callback needs the full function record. A better approach is to create a lookup map:

```typescript
    // Build function lookup for the callback
    const functionMap = new Map(
      (agentFunctions || []).map((fn) => [fn.id, fn])
    )

    // ... in AgentRunner.run():
    onExecuteFunction: async (functionId, input) => {
      const func = functionMap.get(functionId)
      if (!func) return { success: false, output: null, error: 'Function not found', duration: 0 }
      return FunctionExecutor.execute(func, { context: { args: input as Record<string, any> } })
    },
```

**Step 4: Run backend tests**

Run: `pnpm --filter @tdsk/backend test`
Expected: All existing tests pass (may need to update runAgent test mocks)

**Step 5: Commit**

```
feat(backend): wire custom functions into agent runner with FunctionExecutor callback
```

---

## Task 8: Admin — Add agent selector to FunctionDrawer

**Files:**
- Modify: `repos/admin/src/components/Functions/FunctionDrawer.tsx:52,59-61,165,283-295` (add agent state, load agents, include agentId, add selector)
- Modify: `repos/backend/src/endpoints/functions/createFunction.ts:19-27,40-48` (accept agentId)
- Modify: `repos/backend/src/endpoints/functions/updateFunction.ts:19,30-38` (accept agentId)

**Prerequisite:** Task 2 must be complete.

**Step 1: Update backend to accept agentId**

In `repos/backend/src/endpoints/functions/createFunction.ts`, add `agentId` to the destructured body (line 23, after `endpointId`):

```typescript
      agentId,
```

And add to the Function constructor (line 44, after `endpointId`):

```typescript
        agentId,
```

In `repos/backend/src/endpoints/functions/updateFunction.ts`, add `agentId` to the destructured body (line 19):

```typescript
    const { name, content, language, description, defaultArgs, dependencies, agentId, endpointId } = req.body
```

And add to the spread (line 37, after dependencies):

```typescript
      ...(agentId !== undefined && { agentId }),
      ...(endpointId !== undefined && { endpointId }),
```

**Step 2: Add agent selector to FunctionDrawer**

In `repos/admin/src/components/Functions/FunctionDrawer.tsx`:

1. Add imports (after line 11):
```typescript
import { fetchAgents } from '@TAF/actions/agents/api/fetchAgents'
```

2. Add state for agents and agentId (after line 52, the `endpointId` state):
```typescript
  const [agentId, setAgentId] = useState(func?.agentId || '')
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([])
```

3. In the `useEffect` that fetches endpoints (lines 59-61), also fetch agents:
```typescript
  useEffect(() => {
    if (open && orgId && projectId) {
      fetchEndpoints({ orgId, projectId })
      // Fetch agents for this project
      fetchAgents({ orgId, projectId }).then((result) => {
        if (result?.data) {
          const agentList = (Array.isArray(result.data) ? result.data : Object.values(result.data))
            .map((a: any) => ({ id: a.id, name: a.name || a.id }))
          setAgents(agentList)
        }
      })
    }
  }, [open, orgId, projectId])
```

4. In the form reset `useEffect` (the one starting with `if (!func || loaded)`), add:
```typescript
    setAgentId(func?.agentId || '')
```
And in `onClose`, add:
```typescript
    setAgentId('')
```

5. Add `agentId` to the `functionData` object (after line 172):
```typescript
      agentId: agentId || undefined,
```

6. Add the agent SelectInput after the endpoint SelectInput (after line 295). Create `agentOptions`:
```typescript
  const agentOptions = useMemo(() => {
    return agents.map((a) => ({ label: a.name, value: a.id }))
  }, [agents])
```

Then in the JSX, after the endpoint `SelectInput`:
```jsx
          <SelectInput
            id='function-agent'
            label='Agent'
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            items={[{ label: 'No agent', value: '' }, ...agentOptions]}
            disabled={loading || agentOptions.length === 0}
            description={
              agentOptions.length === 0
                ? 'No agents available. Create an agent first.'
                : 'Select an agent to attach this function as a tool'
            }
          />
```

**Step 3: Run admin build**

Run: `pnpm --filter @tdsk/admin build`
Expected: Build succeeds

**Step 4: Commit**

```
feat(admin): add agent selector to FunctionDrawer for attaching functions to agents
```

---

## Task 9: Admin — Add attached functions display in AgentDrawer

**Files:**
- Modify: `repos/admin/src/components/Agents/AgentDrawer.tsx:7-8,49,67-88,301-306` (load functions, display list)

**Prerequisite:** Task 2 must be complete.

**Step 1: Add functions loading to AgentDrawer**

In `repos/admin/src/components/Agents/AgentDrawer.tsx`:

1. Add import (after line 8):
```typescript
import { fetchFunctions } from '@TAF/actions/functions/fetchFunctions'
import type { Function as TDFunction } from '@tdsk/domain'
```

2. Add state (after line 50):
```typescript
  const [agentFunctions, setAgentFunctions] = useState<TDFunction[]>([])
```

3. In the `loadData` async function inside the first `useEffect` (lines 68-87), add after loading providers:
```typescript
      // Load functions for this project (to find ones attached to this agent)
      if (agent?.id) {
        const functionsResult = await fetchFunctions({ orgId, projectId })
        if (functionsResult.functions) {
          const attached = Object.values(functionsResult.functions)
            .filter((fn) => fn.agentId === agent.id)
          setAgentFunctions(attached)
        }
      }
```

4. In the JSX, after the `ToolsSelector` (after line 305), add:
```jsx
          {agentFunctions.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant='subtitle2' sx={{ fontWeight: 600, mb: 2 }}>
                  Custom Functions
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                  Functions attached to this agent as tools. Manage in the Functions section.
                </Typography>
                {agentFunctions.map((fn) => (
                  <Box
                    key={fn.id}
                    sx={{
                      p: 1.5,
                      mb: 1,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant='body2' sx={{ fontWeight: 500 }}>
                      {fn.name}
                    </Typography>
                    {fn.description && (
                      <Typography variant='caption' color='text.secondary'>
                        {fn.description}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </>
          )}
```

**Step 2: Remove `executeCustomTool` placeholder from tools.ts**

In `repos/admin/src/constants/tools.ts`, remove lines 42-45:
```typescript
  {
    value: `executeCustomTool`,
    label: `Custom Tool`,
    description: `Execute custom user-defined tool`,
  },
```

**Step 3: Run admin build**

Run: `pnpm --filter @tdsk/admin build`
Expected: Build succeeds

**Step 4: Commit**

```
feat(admin): show attached custom functions in AgentDrawer, remove executeCustomTool placeholder
```

---

## Task 10: Validation — Run all test suites and verify builds

**Files:** None (validation only)

**Prerequisite:** All previous tasks must be complete.

**Step 1: Run domain tests**

Run: `pnpm --filter @tdsk/domain test`
Expected: PASS (303+ tests)

**Step 2: Run database tests**

Run: `pnpm --filter @tdsk/database test`
Expected: PASS (305+ tests)

**Step 3: Run backend tests**

Run: `pnpm --filter @tdsk/backend test`
Expected: PASS (584+ tests, plus new FunctionExecutor and FaaS tests)

**Step 4: Run agent tests**

Run: `pnpm --filter @tdsk/agent test`
Expected: PASS (existing + new custom function tests)

**Step 5: Run builds**

Run: `pnpm --filter @tdsk/backend build && pnpm --filter @tdsk/admin build`
Expected: Both succeed

**Step 6: Commit (if any fixes needed)**

```
fix: address test/build issues from functions execution feature
```
