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
10. [Secret Injection](#10-secret-injection)
11. [Error Handling](#11-error-handling)
12. [Limits and Constraints](#12-limits-and-constraints)
13. [Authentication and Permissions](#13-authentication-and-permissions)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. What is FaaS?

FaaS (Function as a Service) is one of three endpoint types in Threaded Stack. It lets users write small functions in TypeScript or JavaScript, deploy them instantly, and call them via HTTP without managing servers, containers, or infrastructure.

You write a function, attach it to an endpoint, and call it with an HTTP request. The platform handles everything else: routing, authentication, sandboxed execution, and response formatting.

```mermaid
flowchart LR
  subgraph Types["<b>Endpoint Types</b>"]
    direction LR
    Proxy["<b>Proxy</b><br/>Forwards requests to external URLs"]
    FaaS["<b>FaaS</b><br/>Executes your custom function in a secure sandbox"]
    Agent["<b>Agent</b><br/>Runs an AI agent with tools and LLM integration"]
  end
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

```mermaid
flowchart TD
  Client["Your Browser or API Client"]
  Caddy["Caddy (TLS/HTTPS) Handles SSL certificates Port 443"]
  Auth["Auth Proxy (Port 7118) Validates JWT tokens Validates API keys (tdsk_*) Attaches user identity Forwards to backend"]
  Backend["Backend API (Port 5885) 1. Looks up the endpoint 2. Loads the function 3. Runs it in a sandbox 4. Returns the result"]

  Client -->|"HTTPS request"| Caddy
  Caddy -->|"HTTP (internal)"| Auth
  Auth -->|"+ X-User-* headers"| Backend

  Backend --> Sandbox

  subgraph Sandbox["Sandbox Execution"]
    Local["Local: V8 Isolate In-memory filesystem Virtual shell 14 Node.js builtin shims Memory limited (128 MB) Time limited (30 seconds)"]
    Prod["Production: K8s Pod Real filesystem Real shell (sh) Node.js runtime Pod resource limits"]
  end
```

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

- **Local** (V8 Isolate) -- Memory-isolated JavaScript execution with an in-memory virtual filesystem and 14 Node.js builtin shims. Used in local development.
- **Kubernetes** (K8s Pod) -- Runs code inside a K8s pod with a real filesystem and shell. Used in production.

### Endpoint Options

Configuration attached to a FaaS endpoint that controls how the function executes. This includes the `functionId` (which function to run), environment variables, arguments, secrets, and resource limits.

---

## 4. How the Pieces Fit Together

```mermaid
flowchart TD
  subgraph Org["Organization"]
    subgraph Proj["Project"]
      FuncA["Function A name: greet lang: TS"]
      FuncB["Function B name: calc lang: JS"]
      EP1["FaaS Endpoint 1 path: /api/greet method: POST"]
      EP2["FaaS Endpoint 2 path: /api/calc method: GET"]
      Agent["Agent (uses Function A as tool)"]

      EP1 -->|"references"| FuncA
      EP2 -->|"references"| FuncB
      Agent -->|"uses as tool"| FuncA
    end
  end
```

**Key relationships:**
- A **Project** contains both Functions and Endpoints
- A **FaaS Endpoint** references exactly one Function (via `functionId`)
- A **Function** can be used by multiple Endpoints
- A **Function** can also be used by Agents as a tool
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

```http
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

```json
{
  "request": {
    "method": "POST",
    "path": "/proxy/proj-123/ep-456",
    "headers": {
      "content-type": "application/json",
      "authorization": "Bearer tdsk_..."
    },
    "query": {
      "format": "json"
    },
    "body": {
      "name": "Alice"
    }
  },
  "context": {
    "args": {
      "defaultGreeting": "Howdy"
    },
    "envVars": {
      "APP_ENV": "production"
    }
  }
}
```

---

## 8. What Happens Under the Hood

Here is the complete journey of a FaaS request, step by step:

```mermaid
flowchart TD
  Client["1. Client sends HTTP request POST /proxy/proj-123/ep-456"]
  Caddy["2. Caddy terminates TLS Forwards as HTTP to proxy"]
  Auth["3. Auth Proxy validates credentials JWT or API key (tdsk_*) Attaches X-User-* headers"]
  Route["4. Route to backend /proxy/:projectId/:endpointId/*"]
  Dispatch["5. Load endpoint Check type -> faas Validate project, check permissions"]
  FaaS["6. Load function Load function from DB Build request + context"]
  Executor["7. Execute in sandbox Transpile TS -> JS Acquire sandbox Evaluate code"]
  Response["8. Map response Extract statusCode, headers, body"]
  Compute["9. Track compute (fire-and-forget quota increment)"]
  Result["10. Client receives response HTTP 200 { message: Hello, Alice! }"]

  Client --> Caddy --> Auth --> Route --> Dispatch --> FaaS --> Executor --> Response --> Compute --> Result
```

### TypeScript Support

TypeScript functions are fully supported. TypeScript is transpiled to JavaScript before sandbox execution. Type annotations, interfaces, generics, and enums are supported in syntax, but types are **erased at runtime** -- they do not affect execution.

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

## 10. Secret Injection

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

## 11. Error Handling

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

```mermaid
flowchart TD
  Throw["Your function throws an error"]
  Wrapper["Sandbox catches it { success: false, error: 'TypeError: ...' }"]
  Executor["Executor returns error { success: false, error: '...' }"]
  Service["Platform wraps error HTTP 500: 'Function execution failed: TypeError: ...'"]
  Client["Client receives 500 response"]

  Throw --> Wrapper --> Executor --> Service --> Client
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

## 12. Limits and Constraints

| Limit | Value | Notes |
|-------|-------|-------|
| Max execution time | 30 seconds | Configurable via `options.timeout` |
| Max memory | 128 MB | Configurable via `options.memory` |
| Max output size | 1 MB | Total serialized JSON response |
| Max request body | 1 MB | Inbound request body limit |
| Languages | TypeScript, JavaScript | TypeScript transpiled before execution |
| Network access | `fetch()` only | Outbound HTTP requests only |
| File system | In-memory virtual FS (local) | Ephemeral; lost after execution |
| Shell access | Virtual shell (local) | Via `child_process` module |
| NPM packages | Not available at runtime | Code must be self-contained |
| Unique routes | Per project | Same project cannot have duplicate path+method combinations |
| Concurrent timers | 100 max | `setTimeout`/`setInterval` within sandbox |
| Timer max duration | 30 seconds | Matches default execution timeout |

### Compute Tracking

FaaS executions are metered. After each successful execution, the platform calculates compute units based on invocation count and runtime duration, then increments the org's `compute` quota for the current billing period. This runs fire-and-forget and does not affect response latency.

---

## 13. Authentication and Permissions

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

## 14. Troubleshooting

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
