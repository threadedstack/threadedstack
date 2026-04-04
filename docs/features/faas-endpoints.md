# FaaS (Function as a Service) Endpoints

> **Last Updated**: April 2026

## Table of Contents

1. [What is FaaS?](#1-what-is-faas)
2. [Architecture Overview](#2-architecture-overview)
3. [Key Concepts](#3-key-concepts)
4. [How the Pieces Fit Together](#4-how-the-pieces-fit-together)
5. [Creating a Function](#5-creating-a-function)
6. [Creating a FaaS Endpoint](#6-creating-a-faas-endpoint)
7. [Calling a FaaS Endpoint](#7-calling-a-faas-endpoint)
8. [What Happens Under the Hood](#8-what-happens-under-the-hood)
9. [Writing Function Code](#9-writing-function-code)
10. [The Sandbox Execution Environment](#10-the-sandbox-execution-environment)
11. [Node.js Builtin Shims](#11-nodejs-builtin-shims)
12. [Secret Injection](#12-secret-injection)
13. [Error Handling](#13-error-handling)
14. [Limits and Constraints](#14-limits-and-constraints)
15. [Database Schema](#15-database-schema)
16. [Authentication and Permissions](#16-authentication-and-permissions)
17. [Code Reference](#17-code-reference)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. What is FaaS?

FaaS (Function as a Service) is one of three endpoint types in Threaded Stack. It lets users write small functions in TypeScript or JavaScript, deploy them instantly, and call them via HTTP without managing servers, containers, or infrastructure.

You write a function, attach it to an endpoint, and call it with an HTTP request. The platform handles everything else: routing, authentication, sandboxed execution, and response formatting.

```
+----------------+------------------+-----------------------+
|  Endpoint Types                                           |
+----------------+------------------+-----------------------+
|    Proxy       |      FaaS        |       Agent           |
|                |                  |                       |
|  Forwards      |  Executes your   |  Runs an AI agent     |
|  requests to   |  custom function |  with tools and       |
|  external      |  in a secure     |  LLM integration      |
|  URLs          |  sandbox         |                       |
+----------------+------------------+-----------------------+
```

**When to use FaaS:**
- Transform data between services
- Run custom business logic on demand
- Create lightweight APIs without a full backend
- Process webhooks with custom handlers

---

## 2. Architecture Overview

### Request Flow

A FaaS request flows through four layers before your function code runs:

```
                      +------------------+
                      |  Your Browser    |
                      |  or API Client   |
                      +--------+---------+
                               | HTTPS request
                               v
                 +-----------------------------+
                 |     Caddy (TLS/HTTPS)       |
                 |   Handles SSL certificates  |
                 |   Port 443                  |
                 +-------------+---------------+
                               | HTTP (internal)
                               v
               +--------------------------------+
               |   Auth Proxy (Port 7118)       |
               |                                |
               |  - Validates JWT tokens        |
               |  - Validates API keys (tdsk_*) |
               |  - Attaches user identity      |
               |  - Forwards to backend         |
               +---------------+----------------+
                               | + X-User-* headers
                               v
                 +-----------------------------+
                 |  Backend API (Port 5885)    |
                 |                             |
                 |  1. Looks up the endpoint   |
                 |  2. Loads the function      |
                 |  3. Runs it in a sandbox    |
                 |  4. Returns the result      |
                 +-------------+---------------+
                               |
                               v
                 +------------------------------+
                 |   Sandbox Execution           |
                 |                               |
                 |   Local: V8 Isolate           |
                 |     In-memory filesystem      |
                 |     Virtual shell (just-bash) |
                 |     14 Node.js builtin shims  |
                 |     Memory limited (128 MB)   |
                 |     Time limited (30 seconds) |
                 |                               |
                 |   Production: K8s Pod         |
                 |     Real filesystem           |
                 |     Real shell (sh)           |
                 |     Node.js runtime           |
                 |     Pod resource limits       |
                 +------------------------------+
```

### Repo Responsibilities

Each repository plays a specific role in the FaaS pipeline:

| Repo | Role in FaaS | Key Files |
|------|-------------|-----------|
| **proxy** | Authenticates requests, forwards to backend | `src/middleware/setupProxy.ts` |
| **backend** | Dispatches to FaaS service, runs executor | `src/services/endpoints/faasEndpoint.ts` |
| **sandbox** | Provides isolated execution environment | `src/local/local.ts`, `src/local/isolate.ts`, `src/kube/kubeSandboxProvider.ts` |
| **domain** | Defines shared types for Functions and Endpoints | `src/types/functions.types.ts` |
| **database** | Stores Functions and Endpoints in PostgreSQL | `src/schemas/functions.ts` |
| **admin** | UI for creating/managing functions and endpoints | `src/components/Endpoints/Faas/` |

---

## 3. Key Concepts

### Function

A piece of TypeScript or JavaScript code that you write. It takes a **request** and **context** as input and returns a **response**. Functions are stored in the database and can be reused across multiple endpoints.

```typescript
// A simple function - this is what you write
export default async function handler(request, context) {
  return {
    statusCode: 200,
    body: { message: "Hello from FaaS!" }
  }
}
```

### Endpoint

An HTTP route that maps to a function. When someone calls the endpoint URL, the platform loads the linked function and executes it. Endpoints define the HTTP method (GET, POST, etc.), the URL path, and configuration like environment variables.

### Sandbox

A secure, isolated execution environment where your function runs. The platform supports two sandbox providers:

- **Local** (V8 Isolate) -- Uses `isolated-vm` for memory-isolated JavaScript execution with an in-memory virtual filesystem and 14 Node.js builtin shims. Used in local development.
- **Kubernetes** (K8s Pod) -- Runs code inside a K8s pod with a real filesystem and shell. Used in production.

### Endpoint Options

Configuration attached to a FaaS endpoint that controls how the function executes. This includes the `functionId` (which function to run), environment variables, arguments, secrets, and resource limits.

---

## 4. How the Pieces Fit Together

```
+-------------------------------------------------------------+
|                       Organization                           |
|                                                              |
|  +-------------------------------------------------------+  |
|  |                     Project                            |  |
|  |                                                        |  |
|  |  +-----------------+      +----------------------+     |  |
|  |  |   Function A    |      |   FaaS Endpoint 1    |     |  |
|  |  |                 |<-----|                      |     |  |
|  |  |  name: "greet"  |      |   path: /api/greet   |     |  |
|  |  |  lang: TS       |      |   method: POST       |     |  |
|  |  |  content: ...   |      |   options:            |     |  |
|  |  +-----------------+      |    functionId: A      |     |  |
|  |                           |    envVars: {...}     |     |  |
|  |  +-----------------+      +----------------------+     |  |
|  |  |   Function B    |                                   |  |
|  |  |                 |      +---------------------+      |  |
|  |  |  name: "calc"   |<----|   FaaS Endpoint 2   |      |  |
|  |  |  lang: JS       |      |                     |      |  |
|  |  |  content: ...   |      |  path: /api/calc    |      |  |
|  |  +-----------------+      |  method: GET        |      |  |
|  |                           +---------------------+      |  |
|  |                                                        |  |
|  |  Functions can also be used by Agents as tools:        |  |
|  |                                                        |  |
|  |  +-----------------+      +----------------------+     |  |
|  |  |   Function A    |<-----|   Agent              |     |  |
|  |  |   (same one)    |      |   (uses as tool)     |     |  |
|  |  +-----------------+      +----------------------+     |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

**Key relationships:**
- A **Project** contains both Functions and Endpoints
- A **FaaS Endpoint** references exactly one Function (via `functionId`)
- A **Function** can be used by multiple Endpoints
- A **Function** can also be used by Agents as a tool (via the `agentFunctions` junction table)
- Both are scoped to a Project -- you cannot use a function from Project A in an endpoint in Project B

---

## 5. Creating a Function

### Via API

Functions are created through the backend admin API:

```bash
# Create a TypeScript function
curl -X POST \
  "https://local.threadedstack.app/_/orgs/{orgId}/projects/{projectId}/functions" \
  -H "Authorization: Bearer tdsk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hello World",
    "language": "typescript",
    "projectId": "{projectId}",
    "content": "export default async function handler(request: any, context: any) {\n  const name = request.body?.name || \"World\"\n  return {\n    statusCode: 200,\n    body: { message: `Hello, ${name}!` }\n  }\n}"
  }'
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "f7a1b2c3-d4e5-6789-abcd-ef0123456789",
    "name": "Hello World",
    "language": "typescript",
    "content": "export default async function handler(...) { ... }",
    "projectId": "proj-123",
    "branch": "main",
    "defaultArgs": {},
    "dependencies": {},
    "inputSchema": [],
    "createdAt": "2026-02-21T10:00:00.000Z",
    "updatedAt": "2026-02-21T10:00:00.000Z"
  }
}
```

### Function Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Human-readable name for the function |
| `content` | Yes | string | The actual source code |
| `projectId` | Yes | UUID | The project this function belongs to |
| `language` | No | `"typescript"` or `"javascript"` | Defaults to `"typescript"` |
| `description` | No | string | What the function does |
| `defaultArgs` | No | object | Default argument values |
| `inputSchema` | No | array | Parameter definitions for documentation |
| `dependencies` | No | object | NPM package dependencies |
| `branch` | No | string | Git branch reference (default: `"main"`) |
| `agentIds` | No | string[] | Link this function to agents as a tool |

---

## 6. Creating a FaaS Endpoint

Once you have a function, create an endpoint to make it callable via HTTP:

### Via API

```bash
# Create a FaaS endpoint that calls the function
curl -X POST \
  "https://local.threadedstack.app/_/orgs/{orgId}/projects/{projectId}/endpoints" \
  -H "Authorization: Bearer tdsk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hello Endpoint",
    "path": "/api/hello",
    "type": "faas",
    "method": "post",
    "projectId": "{projectId}",
    "public": false,
    "options": {
      "functionId": "f7a1b2c3-d4e5-6789-abcd-ef0123456789",
      "envVars": {
        "APP_ENV": "production"
      },
      "arguments": {
        "defaultGreeting": "Howdy"
      }
    }
  }'
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "e1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "name": "Hello Endpoint",
    "path": "/api/hello",
    "type": "faas",
    "method": "post",
    "projectId": "proj-123",
    "public": false,
    "options": {
      "functionId": "f7a1b2c3-d4e5-6789-abcd-ef0123456789",
      "envVars": { "APP_ENV": "production" },
      "arguments": { "defaultGreeting": "Howdy" }
    }
  }
}
```

### Endpoint Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Human-readable name |
| `path` | Yes | string | URL path (must start with `/`) |
| `type` | Yes | `"faas"` | Must be `"faas"` for function endpoints |
| `method` | Yes | string | HTTP method: `get`, `post`, `put`, `delete`, `patch`, `all` |
| `projectId` | Yes | UUID | The project this endpoint belongs to |
| `public` | No | boolean | If `true`, no auth required to call (default: `false`) |
| `options` | Yes | object | FaaS-specific configuration (see below) |

### FaaS Options

| Option | Required | Type | Description |
|--------|----------|------|-------------|
| `functionId` | **Yes** | UUID | The function to execute |
| `envVars` | No | object | Environment variables available to the function |
| `arguments` | No | object | Static arguments passed as `context.args` |
| `secrets` | No | string[] | Secret IDs to inject into function context |
| `memory` | No | number | Max memory in MB (default: 128) |
| `timeout` | No | number | Max execution time in ms (default: 30000) |

---

## 7. Calling a FaaS Endpoint

Once created, call the endpoint through the proxy route:

```
POST /proxy/{projectId}/{endpointId}
```

### Example Request

```bash
curl -X POST \
  "https://local.threadedstack.app/proxy/{projectId}/{endpointId}" \
  -H "Authorization: Bearer tdsk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice"
  }'
```

### Example Response

```json
{
  "message": "Hello, Alice!"
}
```

### What Gets Passed to Your Function

Your function receives two arguments -- `request` and `context`:

```
request:
{
  method: "POST",
  path: "/proxy/proj-123/ep-456",
  headers: {
    "content-type": "application/json",
    "authorization": "Bearer tdsk_..."
  },
  query: {
    "format": "json"
  },
  body: {
    "name": "Alice"
  }
}

context:
{
  args: {
    "defaultGreeting": "Howdy"
  },
  envVars: {
    "APP_ENV": "production"
  }
}
```

---

## 8. What Happens Under the Hood

Here is the complete journey of a FaaS request, step by step:

```
 1. Client sends HTTP request
    POST /proxy/proj-123/ep-456  { "name": "Alice" }
                |
                v
 2. Caddy terminates TLS
    Strips HTTPS, forwards as HTTP to proxy
                |
                v
 3. Auth Proxy validates credentials
    |- Checks JWT token (from browser login)
    |- OR checks API key (tdsk_* prefix)
    |- Attaches X-User-Id, X-User-Role, X-User-Email headers
    '- Forwards to backend
                |
                v
 4. Backend route handler: /proxy/:projectId/:endpointId/*
    Extracts projectId & endpointId from URL
                |
                v
 5. Endpoint dispatcher loads endpoint from database
    |- Fetches endpoint record by ID
    |- Checks endpoint.type -> "faas"
    |- Validates endpoint belongs to project
    |- Checks permissions (unless endpoint.public = true)
    '- Routes to FaaSEndpoint.execute()
                |
                v
 6. FaaSEndpoint service
    |- Reads functionId from endpoint.options
    |- Loads function record from database
    |- Builds TFunctionRequest (method, path, headers, query, body)
    |- Builds TFunctionContext (envVars, args from endpoint options)
    '- Calls FunctionExecutor.execute(function, { request, context })
                |
                v
 7. FunctionExecutor
    |- If TypeScript -> Transpile to JavaScript via esbuild
    |- Acquire a sandbox from pool (or create new)
    |- Build wrapper code that imports your function as a module
    |- Evaluate wrapper in V8 isolate with timeout enforcement
    |- Extract the result (default export from wrapper)
    '- Return sandbox to pool on success, close on error
                |
                v
 8. Response mapping
    |- Extract statusCode from function output (default: 200)
    |- Extract custom headers from function output
    |- Extract body from function output
    '- Send HTTP response to client
                |
                v
 9. Compute tracking (fire-and-forget)
    |- Look up the project that owns this endpoint
    |- Calculate compute units from invocation count and runtime ms
    '- Increment the org's compute quota for the billing period
                |
                v
10. Client receives response
    HTTP 200  { "message": "Hello, Alice!" }
```

### The Wrapper Code

The FunctionExecutor does not run your code directly. It creates a **wrapper module** that imports your function, calls it, and captures the result:

```javascript
// This is what actually runs in the V8 isolate
import handler from 'function';  // Your code is registered as the 'function' module

const request = JSON.parse('{"method":"POST","body":{"name":"Alice"}}');
const context = JSON.parse('{"args":{"defaultGreeting":"Howdy"},"envVars":{"APP_ENV":"production"}}');

let output;
try {
  const raw = await handler(request, context);
  output = { success: true, output: JSON.parse(JSON.stringify(raw ?? null)) };
} catch (err) {
  output = { success: false, error: err?.message || String(err) };
}

export default output;
```

This pattern ensures:
- Your function's errors are caught and returned cleanly
- The request and context are safely serialized/deserialized
- The result is always a structured object the platform can read
- Non-serializable values are stripped via the `JSON.parse(JSON.stringify())` round-trip

### Sandbox Pooling

Creating V8 isolates is expensive. The FunctionExecutor maintains a **sandbox pool** to reuse idle sandboxes across requests:

- **Pool max size**: 5 idle sandboxes
- **TTL**: 5 minutes -- idle sandboxes are evicted after 5 minutes of inactivity
- **Cleanup**: A background interval (every 60 seconds) evicts expired entries
- **On success**: The sandbox is reset (user modules released, filesystem cleared) and returned to the pool
- **On error**: The sandbox is closed and discarded

### TypeScript Support

If your function is written in TypeScript, the executor transpiles it to JavaScript before sandbox execution using **esbuild**:

```
Your TypeScript Code
        |
        v
  esbuild.transform(code, {
    loader: 'ts',       // Parse as TypeScript
    format: 'esm'       // Output as ES module
  })
        |
        v
  JavaScript (ES module)
        |
        v
  Registered as 'function' module in sandbox
```

Type annotations, interfaces, generics, and enums are supported in syntax, but types are **erased at runtime** -- they do not affect execution.

---

## 9. Writing Function Code

### Function Signature

Every FaaS function must export a **default async function** that accepts `request` and `context`:

```typescript
export default async function handler(
  request: TFunctionRequest,
  context: TFunctionContext
): Promise<TFunctionResponse> {
  // Your logic here
  return {
    statusCode: 200,
    body: { /* your response data */ }
  }
}
```

### The Request Object

```typescript
type TFunctionRequest = {
  path?: string                    // Full URL path
  body?: unknown                   // Parsed request body (JSON)
  method?: string                  // "GET", "POST", "PUT", etc.
  query?: Record<string, string>   // URL query parameters
  headers?: Record<string, string> // HTTP request headers
}
```

### The Context Object

```typescript
type TFunctionContext = {
  args?: Record<string, any>         // From endpoint options.arguments
  envVars?: Record<string, string>   // From endpoint options.envVars
  secrets?: Record<string, string>   // From endpoint options.secrets (injected at runtime)
}
```

### The Response Object

Your function should return an object with these optional fields:

```typescript
type TFunctionResponse = {
  statusCode?: number                // HTTP status code (default: 200)
  headers?: Record<string, string>   // Custom response headers
  body?: unknown                     // Response body (will be JSON-serialized)
}
```

### Examples

**Simple GET handler:**
```typescript
export default async function handler(request, context) {
  return {
    statusCode: 200,
    body: {
      timestamp: Date.now(),
      environment: context.envVars?.APP_ENV || "unknown"
    }
  }
}
```

**POST handler with input validation:**
```typescript
export default async function handler(request, context) {
  const { items, taxRate } = request.body || {}

  if (!items || !Array.isArray(items)) {
    return {
      statusCode: 400,
      body: { error: "items array is required" }
    }
  }

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0)
  const tax = subtotal * (taxRate || 0.08)
  const total = subtotal + tax

  return {
    statusCode: 200,
    body: { subtotal, tax, total, itemCount: items.length }
  }
}
```

**Custom headers and status codes:**
```typescript
export default async function handler(request, context) {
  const resource = {
    id: "abc-123",
    name: "New Item",
    createdAt: new Date().toISOString()
  }

  return {
    statusCode: 201,
    headers: {
      "X-Resource-Id": resource.id,
      "Cache-Control": "no-cache"
    },
    body: resource
  }
}
```

**Using fetch() to call external APIs:**
```typescript
export default async function handler(request, context) {
  const response = await fetch("https://api.example.com/data", {
    method: "GET",
    headers: { "Authorization": `Bearer ${context.envVars?.API_TOKEN}` }
  })
  const data = await response.json()

  return {
    statusCode: 200,
    body: { result: data }
  }
}
```

**TypeScript with full type annotations:**
```typescript
interface CartItem {
  name: string
  price: number
  quantity: number
}

interface CartResponse {
  items: CartItem[]
  total: number
}

export default async function handler(
  request: { body?: { items?: CartItem[] } },
  context: { args?: Record<string, any> }
): Promise<{ statusCode: number; body: CartResponse }> {
  const items: CartItem[] = request.body?.items || []
  const total: number = items.reduce(
    (sum: number, item: CartItem) => sum + item.price * item.quantity,
    0
  )

  return {
    statusCode: 200,
    body: { items, total }
  }
}
```

---

## 10. The Sandbox Execution Environment

Your function code does not run on the server directly. It runs inside a sandboxed environment that isolates it from the host system. The platform supports two sandbox providers, selected via the factory pattern in `createSandboxProvider()`.

### Sandbox Providers

```
createSandboxProvider(type: TSandboxType): ISandboxProvider
  |-- 'local'      -> LocalSandboxProvider  (V8 isolate + in-memory FS)
  '-- 'kubernetes'  -> KubeSandboxProvider   (K8s pod + real FS)
```

### Local Provider (V8 Isolate)

Used in local development and for the FunctionExecutor's default sandbox pool. Creates a lightweight, in-process sandbox:

```
LocalSandboxProvider.create(config)
  1. Create InMemoryFs (virtual filesystem via just-bash)
  2. Create Bash (virtual shell via just-bash)
  3. Create /workspace and /tmp directories
  4. Create IsolateRunner (V8 isolate via isolated-vm)
  5. Compile and register 14 Node.js builtin shims
  6. Return LocalSandbox instance
```

**Characteristics:**
- **Isolation**: V8 isolate with separate heap (configurable, default 128 MB)
- **Filesystem**: In-memory virtual filesystem, ephemeral per execution
- **Shell**: Virtual shell via just-bash
- **Module system**: ES modules with `import`/`export` syntax
- **Timeout**: Configurable, default 30 seconds for FaaS (5 seconds for raw `eval`)
- **Timer support**: `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `setImmediate`, `queueMicrotask` (max 100 concurrent timers, capped at `maxTimerMs`)
- **Graceful degradation**: If `isolated-vm` native addon is not available, the sandbox still works for shell/FS operations but cannot execute JavaScript in isolation

### Kubernetes Provider (K8s Pod)

Used in production. Executes code inside a running K8s pod via the Kubernetes Exec API:

```
KubeSandboxProvider.create(config)
  1. Requires options.podName (pod must already exist)
  2. Creates KubeClient with namespace config
  3. Returns KubeSandbox connected to the running pod
```

**Characteristics:**
- **Isolation**: Full container isolation via K8s pod
- **Filesystem**: Real filesystem inside the pod container
- **Shell**: Real `sh` shell inside the pod
- **Code evaluation**: Writes code to a temp file, runs with the configured runtime (default: `node`), captures stdout
- **Runtimes**: Configurable list of runtimes (each with a `name`, `command`, and file `extension`)
- **Cleanup**: Temp directories are cleaned after evaluation; `/workspace` and `/tmp` are cleared on reset
- **Pod lifecycle**: Managed separately by SandboxService -- `KubeSandbox.close()` disconnects but does not delete the pod

### ISandbox Interface

Both providers implement the same interface, defined in `@tdsk/domain`:

```typescript
interface ISandbox {
  exec(command: string, args?: string[]): Promise<TSandboxResult>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listDir(path: string): Promise<string[]>
  deleteFile(path: string): Promise<void>
  mkdir(path: string): Promise<void>
  fileExists(path: string): Promise<boolean>
  evaluate(code: string, opts?: TSandboxEvalOpts): Promise<TSandboxEvalResult>
  reset(): Promise<void>
  close(): Promise<void>
}
```

### How Code Evaluation Works (Local)

When `FunctionExecutor` calls `sandbox.evaluate()`, the `IsolateRunner` processes it as follows:

```
1. Register any provided modules (e.g., the 'function' module with user code)
   Each module is compiled as an ivm.Module and stored in the shim map

2. Compile wrapper code as an ES module ('user-code.js')

3. Resolve module imports:
   |- "function"      -> your transpiled function code
   |- "fs"/"node:fs"  -> virtual filesystem shim
   |- "path"          -> path manipulation shim
   |- "crypto"        -> crypto shim
   |- (14 builtins)   -> resolved from shim registry
   '- (unknown)       -> Error: "Module not found"

4. Execute with timeout enforcement
   |- V8 isolate runs the wrapper module
   |- Wrapper imports your handler from 'function'
   |- Wrapper calls handler(request, context)
   '- Result captured as default export

5. Extract result
   |- Try structured clone (fast path)
   |- Fall back to JSON bridge if structured clone fails
   '- Return { output: consoleOutput, result: exportedValue }

6. Release the user-code module
```

### How Code Evaluation Works (Kubernetes)

```
1. Create temp directory: /tmp/tdsk-eval-<nanoid>/

2. Write module files (if any)
   Each entry in opts.modules -> /tmp/tdsk-eval-xxx/<name>.js

3. Write main code -> /tmp/tdsk-eval-xxx/main.js

4. Execute: [timeout <sec>] node main.js

5. Capture stdout as output (result is undefined -- callers must print JSON to stdout)

6. Clean up temp directory
```

---

## 11. Node.js Builtin Shims

The Local sandbox (V8 Isolate) provides 14 Node.js builtin module shims. These give function code a familiar Node.js-like environment while remaining fully sandboxed. Each shim is available via both bare and `node:` prefixed imports (e.g., `import fs from 'fs'` or `import fs from 'node:fs'`).

**Compilation order matters** -- shims are compiled in the order listed below. Console and fetch are first (they set up global callbacks), and shims that define `globalThis` values (e.g., Buffer) must appear before shims that depend on them (e.g., crypto).

| # | Module | Key APIs | Implementation |
|---|--------|----------|----------------|
| 1 | `console` | `log`, `error`, `warn`, `info` | Output captured via `_log` host callback; collected in output array |
| 2 | `fetch` | `fetch(url, opts)` | Bridged to host-side `fetch()` via `_fetch` callback |
| 3 | `buffer` | `Buffer` | Sets `globalThis.Buffer`; used by crypto and other shims |
| 4 | `path` | `join`, `resolve`, `dirname`, `basename`, `extname`, `normalize`, `sep`, `posix` | Pure JS path manipulation (no host callbacks) |
| 5 | `fs` | `readFile`, `writeFile`, `mkdir`, `readdir`, `unlink`, `stat`, `exists` + sync variants (`readFileSync`, `writeFileSync`, `mkdirSync`, `readdirSync`, `unlinkSync`, `statSync`, `existsSync`) | Bridged to just-bash `IFileSystem` via `_fs*` host callbacks |
| 6 | `child_process` | `execSync` | Routes to virtual shell via `_shellRun` host callback |
| 7 | `url` | URL utilities | Standard URL parsing |
| 8 | `querystring` | `parse`, `stringify` | Query string encoding/decoding |
| 9 | `events` | `EventEmitter` | In-isolate event system |
| 10 | `os` | `platform`, `arch`, `tmpdir`, `homedir`, `hostname` | Returns sandboxed values |
| 11 | `assert` | `ok`, `equal`, `deepEqual`, `throws` | Assertion utilities |
| 12 | `util` | `promisify`, `inspect`, `format`, `types` | Utility functions |
| 13 | `crypto` | Crypto operations | Uses `globalThis.Buffer` from the buffer shim |
| 14 | `process` | `env`, `cwd`, `exit`, `platform`, `version` | Sandboxed process info; `env` populated from sandbox config |

**What is NOT available:**
- `net` / TCP / UDP sockets
- `http` / `https` server creation (use `fetch()` for outbound HTTP)
- `require()` -- only ES module `import` syntax is supported
- NPM packages at runtime -- code must be self-contained
- Direct `process.env` access to the host environment (the `process` shim provides only env vars configured in the endpoint options)

---

## 12. Secret Injection

FaaS endpoints support injecting secrets into the function execution context. This allows functions to access sensitive values (API keys, database credentials, tokens) without exposing them in source code or environment variable configuration.

### How It Works

1. **Create secrets** at the org or project level via the Secrets API
2. **Reference secret IDs** in the endpoint's `options.secrets` array
3. At execution time, the platform resolves the secret values server-side
4. Secrets are injected into `context.secrets` as key-value pairs
5. The function accesses them via `context.secrets?.SECRET_NAME`

### Usage in Function Code

```typescript
export default async function handler(request, context) {
  const apiKey = context.secrets?.EXTERNAL_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: { error: "Missing API key" } }
  }

  const response = await fetch("https://api.example.com/data", {
    headers: { "Authorization": `Bearer ${apiKey}` }
  })

  return {
    statusCode: 200,
    body: await response.json()
  }
}
```

### Secret References in Arguments

The admin UI supports referencing secrets in function arguments using `{{SECRET_NAME}}` syntax. These are resolved before the function receives the context.

### Security

- Secrets are stored encrypted (AES-256-GCM) in the database
- Secrets are decrypted server-side and injected only at execution time
- Function code never has access to the encryption keys
- Secret values are not logged or included in error messages

---

## 13. Error Handling

### Common Errors

| Status | Error | Cause |
|--------|-------|-------|
| **400** | `FaaS endpoint requires a functionId in options` | Endpoint created without `options.functionId` |
| **400** | `FaaS endpoint has no functionId configured` | Endpoint exists but functionId is missing/null |
| **401** | `No authentication token provided` | Request has no Authorization header |
| **401** | `Invalid API key` | API key is revoked, expired, or wrong |
| **404** | `Function not found: {id}` | Function was deleted or ID is wrong |
| **404** | `Endpoint not found` | Invalid endpointId in the URL |
| **500** | `Function execution failed: ...` | Your function threw an error |
| **500** | `Function output exceeded maximum size of 1048576 bytes` | Output larger than 1 MB |
| **500** | `Function produced no result` | Function did not return a value (missing `export default`) |
| **500** | V8 isolate timeout | Function took longer than 30 seconds |
| **502** | `Backend service unavailable` | Backend pod is down or unreachable |

### How Errors Propagate

```
Your function throws an error
        |
        v
Wrapper catches it -> { success: false, error: "TypeError: ..." }
        |
        v
FunctionExecutor returns -> { success: false, output: null, error: "...", duration: ms }
        |
        v
FaaSEndpoint throws -> Exception(500, "Function execution failed: TypeError: ...")
        |
        v
Express error handler -> HTTP 500 { error: "Function execution failed: ..." }
        |
        v
Client receives 500 response
```

### Writing Error-Safe Functions

```typescript
export default async function handler(request, context) {
  // Validate inputs early
  if (!request.body?.email) {
    return {
      statusCode: 400,
      body: { error: "email is required" }
    }
  }

  // Use try/catch for operations that might fail
  try {
    const result = processEmail(request.body.email)
    return {
      statusCode: 200,
      body: { result }
    }
  } catch (err) {
    // Return a clean error response instead of crashing
    return {
      statusCode: 500,
      body: { error: "Failed to process email", detail: err.message }
    }
  }
}
```

---

## 14. Limits and Constraints

| Limit | Value | Notes |
|-------|-------|-------|
| Max execution time | 30 seconds | Configurable via `options.timeout` (`DefaultTimeoutMS = 30_000`) |
| Max memory | 128 MB | Configurable via `options.memory` (V8 isolate heap limit) |
| Max output size | 1 MB | Total serialized JSON response (`MaxOutputBytes = 1_048_576`) |
| Max request body | 1 MB | Inbound request body limit (`RequestBodyMaxSize = 1_048_576`) |
| Languages | TypeScript, JavaScript | TypeScript transpiled via esbuild before execution |
| Network access | `fetch()` only | HTTP requests via host-bridged fetch shim |
| File system | In-memory virtual FS (local) | fs shim via just-bash; lost after execution |
| Shell access | Virtual shell (local) | `child_process` shim via just-bash |
| NPM packages | Not available at runtime | Code must be self-contained |
| Unique routes | Per project | Same project cannot have duplicate path+method combinations |
| Sandbox pool | 5 max idle | Idle sandboxes evicted after 5 minutes (`PoolTtlMS`) |
| Concurrent timers | 100 max | `setTimeout`/`setInterval` within isolate |
| Timer max duration | 30 seconds | Capped at `maxTimerMs` (matches default timeout) |

### Compute Tracking

FaaS executions are metered. After each successful execution, the platform calculates compute units based on invocation count and runtime duration, then increments the org's `compute` quota for the current billing period. This runs fire-and-forget and does not affect response latency.

---

## 15. Database Schema

### Endpoints Table

```sql
CREATE TABLE endpoints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  path        TEXT NOT NULL,
  method      VARCHAR(10) DEFAULT 'GET',
  type        VARCHAR(10) NOT NULL DEFAULT 'proxy',   -- 'proxy' | 'faas' | 'agent'
  public      BOOLEAN DEFAULT false,
  options     JSONB,                                   -- Type-specific config
  headers     JSONB,                                   -- Custom HTTP headers
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP NOT NULL DEFAULT now(),

  UNIQUE (project_id, path, method)
);
```

### Functions Table

```sql
CREATE TABLE functions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  content       TEXT NOT NULL,                          -- Source code
  language      VARCHAR(50) DEFAULT 'typescript',       -- 'typescript' | 'javascript'
  description   TEXT,
  branch        TEXT DEFAULT 'main',
  default_args  JSONB DEFAULT '{}',
  dependencies  JSONB DEFAULT '{}',
  input_schema  JSONB DEFAULT '[]',                     -- Parameter definitions
  endpoint_id   UUID REFERENCES endpoints(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX ON functions (project_id);
CREATE INDEX ON functions (endpoint_id);
```

### Agent-Functions Junction Table

```sql
CREATE TABLE agent_functions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  function_id  UUID NOT NULL REFERENCES functions(id) ON DELETE CASCADE,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now(),

  UNIQUE (agent_id, function_id)
);
```

### Entity Relationships

```
projects -< endpoints (project_id FK)
projects -< functions (project_id FK)
endpoints -- functions (endpoint_id FK, optional 1:1)
endpoints.options.functionId -> functions.id (logical reference in JSONB)
agents -< agent_functions >- functions (many-to-many junction)
```

---

## 16. Authentication and Permissions

### Permission Matrix

| Operation | Minimum Role | Notes |
|-----------|--------------|-------|
| Create function | member | Must be org member |
| Read/list functions | viewer | View-only access |
| Update function | member | |
| Delete function | admin | Admin only |
| Create endpoint | member | |
| Read/list endpoints | viewer | |
| Update endpoint | member | |
| Delete endpoint | admin | Admin only |
| Call endpoint (private) | member | Requires auth token |
| Call endpoint (public) | (none) | No auth needed |

### Authentication Methods

When calling a FaaS endpoint, authenticate in one of these ways:

**JWT Token** (from browser/Neon Auth login):
```bash
curl -H "Authorization: Bearer eyJhbGciOi..." \
  https://local.threadedstack.app/proxy/{projectId}/{endpointId}
```

**API Key** (for programmatic access):
```bash
curl -H "Authorization: Bearer tdsk_your_api_key_here" \
  https://local.threadedstack.app/proxy/{projectId}/{endpointId}
```

**Public endpoints** (no auth needed):
```bash
# If the endpoint was created with "public": true
curl https://local.threadedstack.app/proxy/{projectId}/{endpointId}
```

---

## 17. Code Reference

### Key Files by Layer

**Backend (Request Handling and Execution):**

| File | Purpose |
|------|---------|
| `repos/backend/src/endpoints/proxy/endpoint.ts` | Route dispatcher for `/proxy/:projectId/:endpointId/*` |
| `repos/backend/src/services/endpoints/faasEndpoint.ts` | FaaS endpoint service -- loads function, builds request/context, tracks compute |
| `repos/backend/src/services/endpoints/base.ts` | Base endpoint class -- permission checks, validation |
| `repos/backend/src/services/functions/functionExecutor.ts` | Orchestrates transpilation, sandbox pooling, and V8 execution |
| `repos/backend/src/constants/values.ts` | Limits: `DefaultTimeoutMS`, `MaxOutputBytes`, `PoolMaxSize`, `PoolTtlMS` |

**Sandbox (Isolated Execution):**

| File | Purpose |
|------|---------|
| `repos/sandbox/src/sandbox.ts` | Factory -- `createSandboxProvider()` with `local` and `kubernetes` providers |
| `repos/sandbox/src/local/local.ts` | `LocalSandbox` + `LocalSandboxProvider` -- virtual shell/FS + V8 isolate |
| `repos/sandbox/src/local/isolate.ts` | `IsolateRunner` -- V8 isolate wrapper with shim compilation and module system |
| `repos/sandbox/src/local/shims/registry.ts` | Ordered shim registry (14 builtin modules) |
| `repos/sandbox/src/local/shims/*.ts` | Individual shim implementations (fs, path, crypto, fetch, etc.) |
| `repos/sandbox/src/kube/kubeSandboxProvider.ts` | `KubeSandboxProvider` -- creates sandboxes backed by K8s pods |
| `repos/sandbox/src/kube/kubeSandbox.ts` | `KubeSandbox` -- ISandbox implementation using K8s Exec API |
| `repos/sandbox/src/kube/kubeClient.ts` | K8s API client for pod exec and file operations |

**Domain (Shared Types):**

| File | Purpose |
|------|---------|
| `repos/domain/src/types/functions.types.ts` | `TFunctionRequest`, `TFunctionContext`, `TFunctionResponse` |
| `repos/domain/src/types/epd.types.ts` | `TFaaSEndpointConfig`, `EEndpointType` |
| `repos/domain/src/types/sandbox.types.ts` | `ISandbox`, `ISandboxProvider`, `TSandboxEvalOpts`, `TSandboxConfig` |

**Database (Storage):**

| File | Purpose |
|------|---------|
| `repos/database/src/schemas/endpoints.ts` | Endpoints table schema |
| `repos/database/src/schemas/functions.ts` | Functions table schema |
| `repos/database/src/schemas/agentFunctions.ts` | Agent-Function junction table |
| `repos/database/src/services/endpoint.ts` | Endpoint CRUD database service |
| `repos/database/src/services/function.ts` | Function CRUD database service |

---

## 18. Troubleshooting

### "Function not found" when calling endpoint

**Symptom:** 404 or 500 error mentioning function not found.

**Checks:**
1. Verify the function still exists: `GET /_/orgs/{orgId}/projects/{projectId}/functions/{functionId}`
2. Verify the endpoint's `options.functionId` matches the function's ID
3. Verify both the function and endpoint belong to the same project

### "FaaS endpoint requires a functionId"

**Symptom:** 400 error when creating or calling an endpoint.

**Fix:** Include `functionId` in the `options` object:
```json
{
  "type": "faas",
  "options": {
    "functionId": "your-function-uuid-here"
  }
}
```

### Function execution times out

**Symptom:** 500 error after ~30 seconds.

**Checks:**
1. Your function may have an infinite loop or unbounded recursion
2. A very large computation may exceed the time limit
3. Increase timeout via endpoint `options.timeout` (max varies by plan)
4. Check if `fetch()` calls to external services are hanging

### Function returns unexpected output

**Symptom:** Response body does not match what you expected.

**Checks:**
1. Make sure you are returning `{ statusCode, headers, body }` -- if you return a plain value, it becomes the entire response body
2. Check that your function has `export default` -- without it, the sandbox cannot find your handler
3. Verify the request body is being sent as JSON with `Content-Type: application/json`
4. Non-serializable values (functions, circular refs) are silently dropped during the JSON round-trip

### "Function produced no result"

**Symptom:** 500 error saying the function produced no result.

**Checks:**
1. Ensure your function has an `export default` statement
2. Ensure the function returns a value (not `undefined`)
3. If using TypeScript, ensure the export is not type-only

### 401 Unauthorized

**Symptom:** Auth error when calling the endpoint.

**Checks:**
1. If the endpoint is private, include `Authorization: Bearer <token>` header
2. API keys must start with `tdsk_`
3. Verify the API key has not been revoked
4. For public endpoints, set `"public": true` when creating the endpoint

### TypeScript compilation errors

**Symptom:** 500 error mentioning esbuild or transform failure.

**Checks:**
1. Ensure your TypeScript is valid syntax
2. Type-only features (declaration files, namespaces) may not be supported
3. Use `"language": "javascript"` if TypeScript is not needed

### "Code execution not available"

**Symptom:** Error saying isolated-vm is required but not loaded.

**Cause:** The `isolated-vm` native addon failed to compile or load. This can happen on platforms where native compilation is not supported (some Alpine Linux variants, certain ARM architectures).

**Checks:**
1. Verify `isolated-vm` is installed: check `node_modules/isolated-vm`
2. Try rebuilding: `npm rebuild isolated-vm`
3. Check platform compatibility -- `isolated-vm` requires node-gyp and a compatible C++ compiler
