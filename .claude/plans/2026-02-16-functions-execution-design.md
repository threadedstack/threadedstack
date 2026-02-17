# Functions Execution Feature — Design Document

**Date**: 2026-02-16
**Status**: Approved
**Scope**: Database, Domain, Backend, Agent, Sandbox, Admin

## Problem

Users can create functions (JS/TS code) via the admin dashboard and backend API, but there is no way to execute them. Two execution paths are needed:

1. **FaaS Endpoints** — An HTTP request hits a FaaS-type endpoint, the associated function runs in a sandbox, and the result is returned as an HTTP response.
2. **Agent Tools** — An agent can call user-defined functions as tools during its ReAct loop, alongside built-in tools like `shellExec` and `readFile`.

## Current State

### What Exists

| Layer | Status | Details |
|-------|--------|---------|
| Database schema | Complete | `functions` table with name, content, language, defaultArgs, dependencies, projectId (required FK), endpointId (optional FK) |
| Domain model | Complete | `Function` class, `EFunLanguage` enum (typescript, javascript, python) |
| Backend CRUD | Complete | 5 endpoints: list, get, create, update, delete — all tested |
| Endpoint types | Complete | `EEndpointType.faas` defined, `TFaaSEndpointConfig` with `functionId`, `arguments`, `envVars`, `secrets`, `memory` |
| Proxy handler | Proxy-only | `endpoint.ts` casts everything to `ProxyEndpoint`, requires `opts.url` — no FaaS codepath |
| Agent runner | Complete | ReAct loop with 8 hardcoded tools, sandbox integration, streaming SSE |
| Agent tools | Hardcoded | Switch statement in `executeTool()` — no custom tool mechanism |
| Sandbox | Complete | ISandbox interface, LocalSandboxProvider (just-bash + IsolateRunner), E2bSandboxProvider |
| Admin UI | Complete | Functions CRUD with Monaco editor, FaaS endpoint function selector, agent tools selector (built-in only) |

### What's Missing

1. No `agentId` FK on functions — functions cannot be attached to agents
2. No function execution service — no code to load a function, spin up a sandbox, run it, return results
3. No FaaS endpoint handler — proxy handler only supports `type: 'proxy'`
4. No custom tool injection in agent runner — tools are a hardcoded switch statement
5. No admin UI for attaching functions to agents
6. No function execution types in domain

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sandbox provider | Local-first | Fast iteration, no external deps. ISandbox abstraction allows E2B later. |
| Agent tool naming | Function's own `name` field | No synthetic prefixes — brittle convention. Functions use their actual names. Collision with built-in tools prevented by validation. |
| Function handler interface | `(request, context) => response` | Standard handler pattern (like Lambda/Vercel). `request` = HTTP data, `context` = platform-injected env/secrets/args. |
| TypeScript handling | Strip types via esbuild | `esbuild.transform(code, { loader: 'ts' })` produces clean JS. No type-checking at runtime. |
| Python support | Deferred | Focus on JS/TS. Python can be added later via `sandbox.exec('python3 ...')`. |
| Dependencies (npm) | Deferred | Functions run with built-in Node.js APIs + sandbox shims only. Package installation adds significant complexity. |
| Architecture | Unified FunctionExecutor | Single service used by both FaaS endpoints and agent tool execution. Avoids duplicating sandbox lifecycle logic. |
| Function-agent binding | `agentId` FK on functions table | Mirrors existing `endpointId` pattern. A function can be attached to an endpoint, an agent, or neither. |

## Architecture

### Execution Flow

```
FaaS Endpoint Request                    Agent Tool Call
         |                                      |
         v                                      v
handleFaaSEndpoint()              AgentRunner.executeTool()
         |                                      |
         |    +----------------------------+    |
         +--->|    FunctionExecutor         |<---+
              |                            |
              |  1. Load function from DB  |
              |  2. Resolve secrets        |
              |  3. Strip TS types (esbuild)|
              |  4. Create local sandbox   |
              |  5. Write function + runner |
              |  6. Run in sandbox         |
              |  7. Parse output           |
              |  8. Close sandbox          |
              +----------------------------+
                          |
                          v
                  TFunctionExecResult
```

### Function Handler Contract

User-written functions must export a default async function:

```typescript
export default async function handler(
  request: {
    method?: string
    path?: string
    headers?: Record<string, string>
    query?: Record<string, string>
    body?: unknown
  },
  context: {
    envVars?: Record<string, string>
    secrets?: Record<string, string>
    args?: Record<string, any>
  }
) {
  // For FaaS: return { statusCode, headers, body }
  // For agent tools: return any value (serialized as output)
  return { statusCode: 200, body: { message: 'Hello' } }
}
```

### Agent Custom Tool Flow

```
Agent model (DB)
  tools: ['shellExec', 'readFile']     <- built-in tool names
  agentId -> functions (FK)            <- custom functions attached

                    | at runtime

AgentRunner.run()
  1. getToolDefs(agent.tools)           -> built-in TLLMToolDef[]
  2. buildFunctionToolDefs(functions)   -> custom TLLMToolDef[]
  3. Merge both arrays -> send to LLM

  4. LLM calls tool by name
     - Built-in name? -> switch statement -> sandbox method
     - Custom function name? -> onExecuteFunction(functionId, input) -> FunctionExecutor
```

## Changes by Repo

### 1. Database (`repos/database`)

**`src/schemas/functions.ts`** — Add `agentId` FK:

- Add column: `agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' })`
- Add index: `functions_agent_id_idx`
- Add relation: `agent: one(agents, { fields: [functions.agentId], references: [agents.id] })`

**`src/schemas/agents.ts`** — Add inverse relation:

- Add: `functions: many(functions)` to `agentsRelations`

### 2. Domain (`repos/domain`)

**`src/models/function.ts`** — Add property:

- `agentId?: string`

**`src/types/functions.types.ts`** — Add execution types:

- `TFunctionRequest` — HTTP request data for FaaS invocation (method, path, headers, query, body)
- `TFunctionContext` — Platform-injected context (envVars, secrets, args)
- `TFunctionResponse` — Function return value for FaaS HTTP mapping (statusCode, headers, body)
- `TFunctionExecResult` — Internal execution result (success, output, duration, error)

### 3. Backend (`repos/backend`)

**New: `src/services/functions/functionExecutor.ts`**

`FunctionExecutor.execute(db, functionId, request?, context?)`:

1. Load function record from DB
2. If TypeScript: strip types via `esbuild.transform(content, { loader: 'ts', format: 'esm' })`
3. Resolve secrets: load secret records, decrypt values, build `Record<string, string>`
4. Create sandbox: `createSandboxProvider('local')` then `provider.create(config)`
5. Write function code to `/workspace/function.mjs`
6. Write runner wrapper to `/workspace/runner.mjs` that imports the function, parses input from env var, calls the handler, and writes JSON result to stdout
7. Set `__FUNCTION_INPUT__` env var with serialized `{ request, context }`
8. Run: `sandbox.exec('node', ['runner.mjs'])`
9. Parse stdout JSON into `TFunctionExecResult`
10. Close sandbox

**Modified: `src/endpoints/proxy/endpoint.ts`**

Add type check before existing proxy logic:

```
if (endpoint.type === EEndpointType.faas) {
  return handleFaaSEndpoint(req, res, endpoint, db)
}
// existing proxy logic unchanged...
```

**New: `handleFaaSEndpoint()`**:

1. Extract `functionId` from `endpoint.options`
2. Build `TFunctionRequest` from Express req (method, path, headers, query, body)
3. Build `TFunctionContext` from endpoint options (envVars, secrets, arguments)
4. Call `FunctionExecutor.execute()`
5. Parse output as `TFunctionResponse`, map to HTTP response (status, headers, body)

**Modified: `src/endpoints/agents/runAgent.ts`**

After loading agent, load attached functions:

```
const { data: agentFunctions } = await db.services.function.list({
  where: { agentId: agent.id }
})
```

Pass to runner with execution callback:

```
await AgentRunner.run({
  ...existingOpts,
  customFunctions: agentFunctions,
  onExecuteFunction: (functionId, input) =>
    FunctionExecutor.execute(db, functionId, undefined, { args: input }),
})
```

### 4. Agent (`repos/agent`)

**`src/tools/definitions/definitions.ts`** — Add `buildFunctionToolDefs()`:

Converts `Function[]` into `TLLMToolDef[]` using `function.name` as tool name, `function.description` as description, and an input schema with an `input` object property.

**`src/types/runner.types.ts`** — Add to `TAgentRunOpts`:

- `customFunctions?: Function[]`
- `onExecuteFunction?: (functionId: string, input: unknown) => Promise<TFunctionExecResult>`

**`src/runner/runner.ts`** — Changes:

1. In `run()`, merge built-in + custom tool defs before sending to LLM
2. In `executeTool()` default case, look up custom function by name and call `onExecuteFunction(fn.id, parsedArgs)` if found

### 5. Admin (`repos/admin`)

**`src/components/Functions/FunctionDrawer.tsx`** — Add agent selector:

- Load agents for the current project (same pattern as endpoint loading)
- Add `SelectInput` dropdown for agent selection (mirrors the existing endpoint selector)
- On save, include `agentId` in function data

**`src/components/Agents/AgentDrawer.tsx`** — Add functions display:

- Load functions attached to this agent (where `agentId = agent.id`)
- Show a read-only list of attached functions below the tools selector
- Link to function editor for management

**`src/constants/tools.ts`** — Remove or update the `executeCustomTool` placeholder entry since custom tools now use their function names directly.

## Out of Scope

- Python function execution
- Dependency installation (npm/pip)
- E2B as primary sandbox target (works via abstraction)
- Function versioning UI beyond the `branch` field
- Function execution logs/history dashboard
- Agent endpoint type (`type: 'agent'`) handler
- Web search tool implementation
- Function code validation/linting

## Task Breakdown

| # | Task | Repo | Depends On |
|---|------|------|------------|
| 1 | Add `agentId` FK, index, relation to functions schema; add inverse relation on agents | database | — |
| 2 | Add `agentId` to Function model; add execution types | domain | — |
| 3 | Create FunctionExecutor service with esbuild TS stripping, sandbox lifecycle, and tests | backend | 1, 2 |
| 4 | Add FaaS handler branch in proxy endpoint.ts with handleFaaSEndpoint and tests | backend | 3 |
| 5 | Add buildFunctionToolDefs(), onExecuteFunction callback, customFunctions to runner types | agent | 2 |
| 6 | Extend AgentRunner.executeTool() to handle custom function tools and tests | agent | 5 |
| 7 | Wire custom functions into runAgent.ts — load agent functions, pass to runner with callback | backend | 3, 6 |
| 8 | Add agent selector to FunctionDrawer (mirrors endpoint selector) | admin | 1 |
| 9 | Add attached functions display in AgentDrawer | admin | 1 |
| 10 | End-to-end validation: FaaS endpoint execution + agent tool execution | all | 4, 7, 8, 9 |

Tasks 1-2 can run in parallel. Tasks 5-6 can run in parallel with 3-4. Tasks 8-9 can run in parallel.

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Function name collides with built-in tool name | Validate on function create/update that name doesn't match any `EAgentTool` value |
| Sandbox hangs on infinite loop | Sandbox has configurable timeout (default 300s); function-level timeout from endpoint config |
| esbuild not available in backend | Add `esbuild` as dependency — lightweight, no native addons |
| Large function output overflows memory | Cap output size in FunctionExecutor (e.g., 1MB) before parsing |
| Secrets leaked in function output | Secrets injected via context, not env vars visible in logs. Same trust model as existing proxy secret injection. |
