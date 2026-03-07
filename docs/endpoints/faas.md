# FaaS (Function as a Service) - Complete Guide

> **Prerequisites**: Basic understanding of REST APIs, TypeScript, and how HTTP requests work
> **Last Updated**: February 2026

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
11. [Admin UI Walkthrough](#11-admin-ui-walkthrough)
12. [Database Schema](#12-database-schema)
13. [Authentication & Permissions](#13-authentication--permissions)
14. [Error Handling](#14-error-handling)
15. [Limits & Constraints](#15-limits--constraints)
16. [Code Reference](#16-code-reference)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. What is FaaS?

FaaS (Function as a Service) is one of three endpoint types in Threaded Stack. It lets users write small functions in TypeScript or JavaScript, deploy them instantly, and call them via HTTP — without managing servers, containers, or infrastructure.

Think of it like a "mini Lambda" built into the platform. You write a function, attach it to an endpoint, and call it with an HTTP request. The platform handles everything else: routing, authentication, sandboxed execution, and response formatting.

```
┌─────────────────────────────────────────────────────────┐
│                 Threaded Stack Endpoint Types            │
├──────────────┬──────────────────┬───────────────────────┤
│    Proxy     │      FaaS        │       Agent           │
│              │                  │                       │
│  Forwards    │  Executes your   │  Runs an AI agent     │
│  requests to │  custom function │  with tools &         │
│  external    │  in a secure     │  LLM integration      │
│  URLs        │  sandbox         │                       │
└──────────────┴──────────────────┴───────────────────────┘
```

**When to use FaaS:**
- Transform data between services
- Run custom business logic on demand
- Create lightweight APIs without a full backend
- Process webhooks with custom handlers

---

## 2. Architecture Overview

### The Big Picture

A FaaS request flows through four main layers before your function code runs:

```
                         ┌──────────────────┐
                         │   Your Browser   │
                         │   or API Client  │
                         └────────┬─────────┘
                                  │ HTTPS request
                                  ▼
                    ┌─────────────────────────────┐
                    │       Caddy (TLS/HTTPS)     │
                    │   Handles SSL certificates  │
                    │   Port 443                  │
                    └─────────────┬───────────────┘
                                  │ HTTP (internal)
                                  ▼
                  ┌────────────────────────────────┐
                  │    Auth Proxy (Port 7118)      │
                  │                                │
                  │  - Validates JWT tokens        │
                  │  - Validates API keys (tdsk_*) │
                  │  - Attaches user identity      │
                  │  - Forwards to backend         │
                  └───────────────┬────────────────┘
                                  │ + X-User-* headers
                                  ▼
                    ┌─────────────────────────────┐
                    │   Backend API (Port 5885)   │
                    │                             │
                    │  1. Looks up the endpoint   │
                    │  2. Loads the function      │
                    │  3. Runs it in a sandbox    │
                    │  4. Returns the result      │
                    └─────────────┬───────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────────┐
                    │     V8 Isolate Sandbox       │
                    │                              │
                    │  Your function runs here,    │
                    │  isolated from the host      │
                    │  system.                     │
                    │                              │
                    │  - In-memory filesystem (fs) │
                    │  - Shell via just-bash       │
                    │  - fetch() for HTTP requests │
                    │  - Memory limited (128 MB)   │
                    │  - Time limited (30 seconds) │
                    └──────────────────────────────┘
```

### Repo Responsibilities

Each repository plays a specific role in the FaaS pipeline:

| Repo | Role in FaaS | Key Files |
|------|-------------|-----------|
| **proxy** | Authenticates requests, forwards to backend | `src/middleware/setupProxy.ts` |
| **backend** | Dispatches to FaaS service, runs executor | `src/services/endpoints/faasEndpoint.ts` |
| **sandbox** | Provides isolated V8 execution environment | `src/local.ts`, `src/isolate.ts` |
| **domain** | Defines shared types for Functions & Endpoints | `src/types/functions.types.ts` |
| **database** | Stores Functions & Endpoints in PostgreSQL | `src/schemas/functions.ts` |
| **admin** | UI for creating/managing functions & endpoints | `src/components/Endpoints/Faas/` |

---

## 3. Key Concepts

Before diving in, here are the core concepts you'll encounter:

### Function
A piece of TypeScript or JavaScript code that you write. It takes a **request** and **context** as input and returns a **response**. Functions are stored in the database and can be reused across multiple endpoints.

```typescript
// A simple function - this is what YOU write
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
A secure, isolated execution environment where your function runs. It uses **V8 isolates** (the same engine that powers Chrome and Node.js) with an in-memory virtual filesystem (`fs` shim via just-bash), a virtual shell (`child_process` shim via just-bash), `fetch()` for HTTP requests, and `path` utilities — all within bounded memory and time limits.

### Endpoint Options
Configuration attached to a FaaS endpoint that controls how the function executes. This includes the `functionId` (which function to run), environment variables, arguments, secrets, and resource limits.

---

## 4. How the Pieces Fit Together

Here's how Functions, Endpoints, and Projects relate to each other:

```
┌─────────────────────────────────────────────────────────────┐
│                       Organization                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     Project                           │  │
│  │                                                       │  │
│  │  ┌─────────────────┐      ┌──────────────────────┐    │  │
│  │  │   Function A    │      │   FaaS Endpoint 1    │    │  │
│  │  │                 │◄─────│                      │    │  │
│  │  │  name: "greet"  │      │   path: /api/greet   │    │  │
│  │  │  lang: TS       │      │   method: POST       │    │  │
│  │  │  content: ...   │      │   options:           │    │  │
│  │  └─────────────────┘      │    functionId: A     │    │  │
│  │                           │     envVars: {...}   │    │  │
│  │  ┌─────────────────┐      └──────────────────────┘    │  │
│  │  │   Function B    │                                  │  │
│  │  │                 │       ┌─────────────────────┐    │  │
│  │  │  name: "calc"   │◄──────│   FaaS Endpoint 2   │    │  │
│  │  │  lang: JS       │       │                     │    │  │
│  │  │  content: ...   │       │  path: /api/calc    │    │  │
│  │  └─────────────────┘       │  method: GET        │    │  │
│  │                            └─────────────────────┘    │  │
│  │                                                       │  │
│  │  Functions can also be used by Agents as tools:       │  │
│  │                                                       │  │
│  │  ┌─────────────────┐      ┌──────────────────────┐    │  │
│  │  │   Function A    │◄─────│   Agent              │    │  │
│  │  │   (same one)    │      │   (uses as tool)     │    │  │
│  │  └─────────────────┘      └──────────────────────┘    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```


**Key relationships:**
- A **Project** contains both Functions and Endpoints
- A **FaaS Endpoint** references exactly one Function (via `functionId`)
- A **Function** can be used by multiple Endpoints
- A **Function** can also be used by Agents as a tool (via the `agentFunctions` junction table)
- Both are scoped to a Project — you can't use a function from Project A in an endpoint in Project B

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
| `language` | No | `"typescript"` \| `"javascript"` | Defaults to `"typescript"` |
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

### What gets passed to your function

Your function receives two arguments — `request` and `context`:

```
┌──────────────────────────────────────────────────────────┐
│                    request                               │
│                                                          │
│ {                                                        │
│   method: "POST",              <- HTTP method            │
│   path: "/proxy/proj-123/ep-456",  <- Full request path  │
│   headers: {                   <- HTTP headers           │
│     "content-type": "application/json",                  │
│     "authorization": "Bearer tdsk_..."                   │
│   },                                                     │
│   query: {                     <- URL query parameters   │
│     "format": "json"          <- from ?format=json       │
│   },                                                     │
│   body: {                      <- Parsed request body    │
│     "name": "Alice"                                      │
│   }                                                      │
│ }                                                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    context                               │
│                                                          │
│ {                                                        │
│   args: {                      <- From endpoint options  │
│     "defaultGreeting": "Howdy"    .arguments             │
│   },                                                     │
│   envVars: {                   <- From endpoint options  │
│     "APP_ENV": "production"       .envVars               │
│   }                                                      │
│ }                                                        │
└──────────────────────────────────────────────────────────┘
```

---

## 8. What Happens Under the Hood

Here's the complete journey of a FaaS request, step by step:

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
    |- Parses the HTTP request body
    |- Builds TFunctionRequest (method, path, headers, query, body)
    |- Builds TFunctionContext (envVars, args from endpoint options)
    '- Calls FunctionExecutor.execute(function, { request, context })
                |
                v
 7. FunctionExecutor
    |- If TypeScript -> Transpile to JavaScript via esbuild
    |- Create a LocalSandbox (V8 isolate + in-memory filesystem)
    |- Build wrapper code that imports your function as a module
    |- Evaluate wrapper in V8 isolate with 30s timeout
    |- Extract the result (default export from wrapper)
    '- Close sandbox (always, even on error)
                |
                v
 8. Response mapping
    |- Extract statusCode from function output (default: 200)
    |- Extract custom headers from function output
    |- Extract body from function output
    '- Send HTTP response to client
                |
                v
 9. Client receives response
    HTTP 200  { "message": "Hello, Alice!" }
```

### The Wrapper Code

The FunctionExecutor doesn't run your code directly. It creates a **wrapper module** that imports your function, calls it, and captures the result:

```javascript
// This is what actually runs in the V8 isolate
import handler from 'function';  // <- Your code is registered as the 'function' module

const request = JSON.parse('{"method":"POST","body":{"name":"Alice"}}');
const context = JSON.parse('{"args":{"defaultGreeting":"Howdy"},"envVars":{"APP_ENV":"production"}}');

let output;
try {
  output = { success: true, output: await handler(request, context) };
} catch (err) {
  output = { success: false, error: err?.message || String(err) };
}

export default output;
```

This pattern ensures:
- Your function's errors are caught and returned cleanly
- The request and context are safely serialized/deserialized
- The result is always a structured object the platform can read

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
  secrets?: Record<string, string>   // From endpoint options.secrets (future)
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

**POST handler with input processing:**
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

**Using context arguments:**
```typescript
export default async function handler(request, context) {
  // context.args comes from the endpoint's options.arguments
  const greeting = context.args?.defaultGreeting || "Hello"
  const name = request.body?.name || "World"

  return {
    statusCode: 200,
    body: { message: `${greeting}, ${name}!` }
  }
}
```

**TypeScript with type annotations:**
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

### What is a Sandbox?

Your function code doesn't run on the server directly. Instead, it runs inside a **V8 isolate** — a lightweight, secure virtual machine. Think of it as a tiny, locked-down JavaScript engine with no access to the outside world.

```
┌───────────────────────────────────────────────────┐
│               Host (Backend Server)               │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │             V8 Isolate Sandbox               │ │
│  │                                              │ │
│  │  ┌────────────┐  ┌─────────────────────────┐ │ │
│  │  │ Your Code  │  │   Available APIs        │ │ │
│  │  │            │  │                         │ │ │
│  │  │ handler()  │  │  Available APIs:        │ │ │
│  │  │            │  │  - console.log/error    │ │ │
│  │  └────────────┘  │  - JSON.parse/stringify │ │ │
│  │                  │  - Date, Math, String   │ │ │
│  │                  │  - Promise, async/await │ │ │
│  │                  │  - fs (virtual shim)    │ │ │
│  │                  │  - path (shim)          │ │ │
│  │                  │  - child_process (shim) │ │ │
│  │                  │  - fetch() (HTTP)       │ │ │
│  │                  │                         │ │ │
│  │                  │  NOT available:         │ │ │
│  │                  │   - net / TCP / UDP     │ │ │
│  │                  │   - process.env         │ │ │
│  │                  │   - require / npm       │ │ │
│  │                  └─────────────────────────┘ │ │
│  │                                              │ │
│  │  Memory: 128 MB max                          │ │
│  │  Timeout: 30 seconds max                     │ │
│  │  Filesystem: In-memory (virtual, per-exec)   │ │
│  └──────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

### Sandbox Architecture

The sandbox layer uses a **factory pattern** with pluggable providers:

```
┌────────────────────────────────────────────────┐
│           createSandboxProvider('local')       │
│                    Factory                     │
└───────────────────┬────────────────────────────┘
                    │
                    v
┌────────────────────────────────────────────────┐
│           LocalSandboxProvider                 │
│                                                │
│  create(config) ->                             │
│    1. Create InMemoryFs (virtual filesystem)   │
│    2. Create Bash (virtual shell)              │
│    3. Create IsolateRunner (V8 isolate)        │
│    4. Return LocalSandbox instance             │
└───────────────────┬────────────────────────────┘
                    │
                    v
┌──────────────────────────────────────────────────┐
│              LocalSandbox                        │
│                                                  │
│ Methods:                                         │
│  evaluate(code, opts)  -> Run JS in V8 isolate   │
│  readFile(path)        -> Read from virtual FS   │
│  writeFile(path, data) -> Write to virtual FS    │
│  listDir(path)         -> List virtual directory │
│  close()               -> Cleanup resources      │
└──────────────────────────────────────────────────┘
```

### How Code Evaluation Works

When `FunctionExecutor` calls `sandbox.evaluate()`, here's what happens inside the `IsolateRunner`:

```
1. Compile wrapper code as an ES module
           |
           v
2. Resolve module imports:
   |- "function" -> your transpiled function code
   |- "fs"       -> virtual filesystem shim
   |- "path"     -> path manipulation shim
   '- (others)   -> Error: "Module not found"
           |
           v
3. Execute with timeout enforcement
   |- V8 isolate runs the wrapper
   |- Wrapper imports your handler
   |- Wrapper calls handler(request, context)
   '- Result captured as default export
           |
           v
4. Extract result
   |- Read the module's default export
   |- Copy result from isolate to host
   '- Return { output: consoleOutput, result: exportedValue }
```

### TypeScript Support

If your function is written in TypeScript, the executor **transpiles it to JavaScript** before sandbox execution using **esbuild**:

```
Your TypeScript Code
        |
        v
  esbuild.transform(code, {
    loader: 'ts',        <- Parse as TypeScript
    format: 'esm'        <- Output as ES module
  })
        |
        v
  JavaScript (ES module)
        |
        v
  Registered as 'function' module in sandbox
```

This means you get full TypeScript type-checking syntax support (interfaces, type annotations, generics, enums), but types are **erased at runtime** — they don't affect execution.

---

## 11. Admin UI Walkthrough

The admin dashboard provides a visual interface for managing functions and endpoints. Below are real screenshots from the admin UI.

### Viewing Endpoints

Navigate to: **Organization -> Project -> Endpoints**

The endpoints table shows all endpoints in the project with their method, path, visibility status, and action buttons for editing or deleting:

![Endpoints table showing FaaS endpoints with name, method, path, public status, and action columns](images/faas-endpoints-table.png)

Key features:
- **Search bar** to filter endpoints by name or URL
- **Method filter** dropdown (All Methods, GET, POST, PUT, DELETE)
- **Visibility filter** (All, Public, Private)
- Each row shows the endpoint name, HTTP method badge, URL path, public/private lock icon, and edit/delete action buttons

### Creating a FaaS Endpoint via the UI

Navigate to: **Organization -> Project -> Endpoints -> Create Endpoint**

Select **"Faas"** as the endpoint type to reveal FaaS-specific options:

![Create New Endpoint drawer showing FaaS type selected with endpoint name, type, path, and public toggle](images/faas-create-endpoint-drawer.png)

The top section contains shared fields:
- **Endpoint Name** - Human-readable name for the endpoint
- **Endpoint Type** - Select "Faas" to create a FaaS endpoint
- **Endpoint Path** - The URL path (e.g., `/api/hello`)
- **Public Endpoint** - Toggle to allow unauthenticated access

Scrolling down reveals the FaaS-specific configuration:

![Bottom of Create Endpoint drawer showing function selection, arguments, environment variables, timeout, and memory settings](images/faas-create-endpoint-drawer-bottom.png)

FaaS-specific fields:
- **Select Function** - Choose which function to execute when the endpoint is called
- **Function Arguments** - Key-value pairs passed as `context.args` to the function. Supports secret references using `{{SECRET_NAME}}` syntax
- **Environment Variables** - Key-value pairs available as `context.envVars`
- **Timeout (ms)** - Maximum execution time (default: 30,000ms / 30 seconds)
- **Memory (MB)** - Maximum memory allocation (default: 256MB)

### Editing an Existing FaaS Endpoint

Clicking the edit (pencil) icon on an endpoint row opens the Edit Endpoint drawer with all fields populated:

![Edit Endpoint drawer showing a populated FaaS endpoint with name, type, path, function selection, and arguments](images/faas-edit-endpoint-drawer.png)

The edit view shows the same fields as creation, pre-filled with the endpoint's current configuration. Notice the **Delete** button (red) at the bottom-left for removing the endpoint, alongside **Cancel** and **Save** buttons.

### Viewing Functions

Navigate to: **Organization -> Project -> Functions**

The functions table lists all functions in the project:

![Functions table showing two functions with name, language badge, endpoint association, creation date, and delete action](images/faas-functions-table.png)

The table columns show:
- **Name** - Function name with a code icon
- **Language** - Badge showing "javascript" or "typescript"
- **Endpoint** - Associated endpoint (or "--" if not linked)
- **Created** - Creation date
- **Actions** - Delete button

### Creating a Function via the UI

Navigate to: **Organization -> Project -> Functions -> Create Function**

The Create Function drawer contains metadata fields at the top and a code editor at the bottom:

![Create New Function drawer showing function name, language selector, description, endpoint association, agents, and branch fields](images/faas-create-function-drawer.png)

Top section fields:
- **Function Name** - Human-readable name
- **Language** - TypeScript or JavaScript
- **Description** - Optional description of what the function does
- **Endpoint** - Optionally link to a FaaS endpoint
- **Agents** - Optionally attach this function as a tool for AI agents
- **Branch** - Git branch reference (default: "main")

Scrolling down reveals the code section:

![Bottom of Create Function drawer showing input parameters, dependencies key-value pairs, and the code editor](images/faas-create-function-drawer-bottom.png)

Bottom section:
- **Input Parameters** - Define parameter name, type, required flag, and defaults
- **Dependencies** - Key-value pairs for NPM package dependencies
- **Content** - Code editor where you write your function code

### Editing an Existing Function

Clicking a function row opens the Edit Function drawer with the code editor populated:

![Edit Function drawer showing populated function name, language set to Javascript, and all configuration fields](images/faas-edit-function-drawer.png)

Scrolling to the bottom shows the actual function code in the editor with syntax highlighting:

![Edit Function drawer scrolled to show the code editor with syntax-highlighted function code](images/faas-edit-function-code.png)

The code editor shows the function's source code with line numbers and syntax highlighting. The function follows the standard handler pattern: `export default async function handler(request, context) { ... }`

---

## 12. Database Schema

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

  -- No duplicate routes within a project
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

-- Indexes for efficient queries
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

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│   projects   │       │    endpoints     │       │  functions   │
│──────────────│       │──────────────────│       │──────────────│
│ id        PK │<--+   │ id           PK  │       │ id        PK │
│ name         │   |   │ name             │       │ name         │
│ ...          │   +---│ project_id   FK  │   +--│ endpoint_id FK│
│              │   |   │ type = 'faas'    │   |   │ project_id FK│--+
│              │   |   │ method           │   |   │ content      │  |
│              │   |   │ path             │   |   │ language     │  |
│              │   |   │ options (JSONB)  │---+   │ ...          │  |
│              │   |   │   '- functionId  │       │              │  |
│              │   |   └──────────────────┘       └──────┬───────┘  |
│              │   |                                     |          |
│              │   +-------------------------------------+          |
│              │                                                    |
│              │<---------------------------------------------------+
└──────────────┘
                          ┌──────────────────┐
                          │ agent_functions  │
                          │──────────────────│
┌──────────────┐          │ id            PK │
│   agents     │          │ agent_id     FK  │--+
│──────────────│<---------│ function_id  FK  │--+--> functions
│ id        PK │          └──────────────────┘  |
│ name         │                                |
│ ...          │<-------------------------------+
└──────────────┘
```

---

## 13. Authentication & Permissions

### Who Can Do What

FaaS operations require authentication and specific roles:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Permission Matrix                                │
│                                                                     │
│  Operation              | Minimum Role | Notes                      │
│─────────────────────────|──────────────|────────────────────────────│
│  Create function        | member       | Must be org member         │
│  Read/list functions    | viewer       | View-only access           │
│  Update function        | member       |                            │
│  Delete function        | admin        | Admin only                 │
│  Create endpoint        | member       |                            │
│  Read/list endpoints    | viewer       |                            │
│  Update endpoint        | member       |                            │
│  Delete endpoint        | admin        | Admin only                 │
│  Call endpoint (private)| member       | Requires auth token        │
│  Call endpoint (public) | (none)       | No auth needed             │
└─────────────────────────────────────────────────────────────────────┘
```

### Authentication Methods

When calling a FaaS endpoint, you authenticate in one of two ways:

**1. JWT Token** (from browser/Neon Auth login):
```bash
curl -H "Authorization: Bearer eyJhbGciOi..." \
  https://local.threadedstack.app/proxy/{projectId}/{endpointId}
```

**2. API Key** (for programmatic access):
```bash
curl -H "Authorization: Bearer tdsk_your_api_key_here" \
  https://local.threadedstack.app/proxy/{projectId}/{endpointId}
```

**3. Public endpoints** (no auth needed):
```bash
# If the endpoint was created with "public": true
curl https://local.threadedstack.app/proxy/{projectId}/{endpointId}
```

### How Auth Flows Through the System

```
Client sends request with Bearer token
        |
        v
+-- Proxy Auth Chain -----------------------------------------------+
|                                                                   |
|  Step 1: Is this a public route? (/health, etc.)                  |
|          YES -> skip auth, forward to backend                     |
|          NO  -> continue                                          |
|                                                                   |
|  Step 2: Extract token from Authorization header                  |
|          No token? -> continue to API key check                   |
|          Token starts with "tdsk_"? -> skip to Step 4             |
|                                                                   |
|  Step 3: Validate JWT via JWKS                                    |
|          Valid?   -> attach user info to request                  |
|          Invalid? -> continue to API key check                    |
|                                                                   |
|  Step 4: Validate API key                                         |
|          Hash key, lookup in database                             |
|          Valid?   -> map scope to role, attach user info          |
|          Invalid? -> return 401 Unauthorized                      |
|                                                                   |
|  Step 5: Forward to backend with X-User-* headers                 |
|          X-User-Id: user's UUID                                   |
|          X-User-Role: admin | member | viewer                     |
|          X-User-Email: user's email (if JWT)                      |
+-------------------------------------------------------------------+
        |
        v
Backend uses X-User-* headers for permission checks
```

---

## 14. Error Handling

### Common Errors and What Causes Them

| Status | Error | Cause |
|--------|-------|-------|
| **400** | `FaaS endpoint requires a functionId in options` | Endpoint created without `options.functionId` |
| **400** | `FaaS endpoint has no functionId configured` | Endpoint exists but functionId is missing/null |
| **401** | `No authentication token provided` | Request has no Authorization header |
| **401** | `Invalid API key` | API key is revoked, expired, or wrong |
| **404** | `Function not found: {id}` | Function was deleted or ID is wrong |
| **404** | `Endpoint not found` | Invalid endpointId in the URL |
| **500** | `Function execution failed: ...` | Your function threw an error |
| **500** | `Function output exceeded maximum size` | Output larger than 1 MB |
| **500** | `V8 isolate timeout` | Function took longer than 30 seconds |
| **502** | `Backend service unavailable` | Backend pod is down or unreachable |

### How Errors Propagate

```
Your function throws an error
        |
        v
Wrapper catches it -> { success: false, error: "TypeError: ..." }
        |
        v
FunctionExecutor returns -> { success: false, output: null, error: "..." }
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

## 15. Limits & Constraints

| Limit | Value | Notes |
|-------|-------|-------|
| Max execution time | 30 seconds | Configurable via `options.timeout` |
| Max memory | 128 MB | Configurable via `options.memory` |
| Max output size | 1 MB | Total serialized JSON response |
| Languages | TypeScript, JavaScript | Python defined but not implemented |
| Network access | fetch() only | HTTP requests via host-bridged fetch shim |
| File system | In-memory virtual FS | fs shim (read/write/mkdir/stat/etc.), lost after execution |
| Shell access | Virtual shell | child_process shim via just-bash |
| NPM packages | Not available at runtime | Code must be self-contained |
| Unique routes | Per project | Same project can't have duplicate path+method |

---

## 16. Code Reference

### Key Files by Layer

**Backend (Request Handling & Execution):**

| File | Purpose |
|------|---------|
| `repos/backend/src/endpoints/proxy/endpoint.ts` | Route dispatcher - routes `/proxy/:projectId/:endpointId/*` |
| `repos/backend/src/services/endpoints/faasEndpoint.ts` | FaaS endpoint service - loads function, builds request/context |
| `repos/backend/src/services/endpoints/base.ts` | Base endpoint class - permission checks, validation |
| `repos/backend/src/services/endpoints/getEPService.ts` | Service registry - maps endpoint type to service |
| `repos/backend/src/services/functions/functionExecutor.ts` | Orchestrates transpilation + sandbox execution |
| `repos/backend/src/endpoints/endpoints/createEndpoint.ts` | Endpoint creation API handler |
| `repos/backend/src/endpoints/functions/createFunction.ts` | Function creation API handler |

**Sandbox (Isolated Execution):**

| File | Purpose |
|------|---------|
| `repos/sandbox/src/factory.ts` | Factory - creates sandbox provider by type |
| `repos/sandbox/src/local.ts` | LocalSandbox - virtual shell + filesystem + isolate |
| `repos/sandbox/src/isolate.ts` | IsolateRunner - V8 isolate wrapper with Node.js shims |

**Domain (Shared Types):**

| File | Purpose |
|------|---------|
| `repos/domain/src/types/functions.types.ts` | TFunctionRequest, TFunctionContext, TFunctionResponse |
| `repos/domain/src/types/epd.types.ts` | TFaaSEndpointConfig, EEndpointType |
| `repos/domain/src/types/sandbox.types.ts` | ISandbox, ISandboxProvider, TSandboxEvalOpts |
| `repos/domain/src/models/endpoint.ts` | Endpoint model class |
| `repos/domain/src/models/function.ts` | Function model class |

**Database (Storage):**

| File | Purpose |
|------|---------|
| `repos/database/src/schemas/endpoints.ts` | Endpoints table schema |
| `repos/database/src/schemas/functions.ts` | Functions table schema |
| `repos/database/src/schemas/agentFunctions.ts` | Agent-Function junction table |
| `repos/database/src/services/endpoint.ts` | Endpoint CRUD database service |
| `repos/database/src/services/function.ts` | Function CRUD database service |

**Admin UI (Frontend):**

| File | Purpose |
|------|---------|
| `repos/admin/src/components/Endpoints/EndpointDrawer.tsx` | Create/edit endpoint drawer |
| `repos/admin/src/components/Endpoints/Faas/EndpointFass.tsx` | FaaS-specific form wrapper |
| `repos/admin/src/components/Endpoints/Faas/FaasInputs.tsx` | FaaS configuration inputs |
| `repos/admin/src/components/Functions/FunctionDrawer.tsx` | Create/edit function drawer |
| `repos/admin/src/services/endpointsApi.ts` | Endpoints API client |
| `repos/admin/src/services/functionsApi.ts` | Functions API client |

**Proxy (Auth & Forwarding):**

| File | Purpose |
|------|---------|
| `repos/proxy/src/middleware/setupProxy.ts` | Proxy middleware - forwards to backend |
| `repos/proxy/src/middleware/setupAuth.ts` | JWT authentication |
| `repos/proxy/src/middleware/setupApiKeyAuth.ts` | API key authentication |

---

## 17. Troubleshooting

### "Function not found" when calling endpoint

**Symptom:** 404 or 500 error mentioning function not found.

**Checks:**
1. Verify the function still exists: `GET /_/orgs/{orgId}/projects/{projectId}/functions/{functionId}`
2. Verify the endpoint's `options.functionId` matches the function's ID
3. Verify both the function and endpoint belong to the same project

### "FaaS endpoint requires a functionId"

**Symptom:** 400 error when creating an endpoint.

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
1. Your function may have an infinite loop
2. A very large computation may exceed the time limit
3. Increase timeout via endpoint `options.timeout` (max varies by plan)

### Function returns unexpected output

**Symptom:** Response body doesn't match what you expected.

**Checks:**
1. Make sure you're returning `{ statusCode, headers, body }` — if you return a plain value, it becomes the entire response body
2. Check that your function has `export default` — without it, the sandbox can't find your handler
3. Verify the request body is being sent as JSON with `Content-Type: application/json`

### 401 Unauthorized

**Symptom:** Auth error when calling the endpoint.

**Checks:**
1. If the endpoint is private, include `Authorization: Bearer <token>` header
2. API keys must start with `tdsk_`
3. Verify the API key hasn't been revoked
4. For public endpoints, set `"public": true` when creating the endpoint

### TypeScript compilation errors

**Symptom:** 500 error mentioning esbuild or transform failure.

**Checks:**
1. Ensure your TypeScript is valid syntax
2. Note: type-only features (declaration files, namespaces) may not be supported
3. Use `"language": "javascript"` if TypeScript isn't needed

---

## Quick Reference Card

```
┌──────────────────────────────────────────────────────────────┐
│                  FaaS Quick Reference                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  CREATE FUNCTION                                             │
│  POST /_/orgs/{orgId}/projects/{projectId}/functions         │
│  Body: { name, content, language, projectId }                │
│                                                              │
│  CREATE FAAS ENDPOINT                                        │
│  POST /_/orgs/{orgId}/projects/{projectId}/endpoints         │
│  Body: { name, path, type: "faas", method, projectId,        │
│          options: { functionId } }                           │
│                                                              │
│  CALL ENDPOINT                                               │
│  {METHOD} /proxy/{projectId}/{endpointId}                    │
│  Auth: Bearer tdsk_xxx or JWT                                │
│                                                              │
│  FUNCTION SIGNATURE                                          │
│  export default async function handler(request, context) {   │
│    return { statusCode: 200, body: { ... } }                 │
│  }                                                           │
│                                                              │
│  LIMITS                                                      │
│  Timeout: 30s | Memory: 128MB | Output: 1MB | fetch() only   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```
