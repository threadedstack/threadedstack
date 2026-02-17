---
name: "Threaded Stack - Domain Repo"
description: "Knowledge base for the shared types, models, and utilities repo"
version: "2.0.0"
tags: ["typescript", "types", "models", "domain", "shared", "utilities", "payments", "ai", "quotas", "subscriptions"]
---
# Domain Repo Skill

## Overview

The `@tdsk/domain` repo is the **shared foundation** for the Threaded Stack monorepo. It provides:

- **Type definitions** for Express APIs, authentication, providers, AI/LLM configs, sandboxes, and helpers
- **Model classes** for core entities (Organization, Project, ApiKey, Secret, Endpoint, Function, Role, Provider, User, Agent, Thread, Message, Asset, Domain, Certificate, Invitation, Quota, Subscription)
- **Utility functions** for crypto (encryption, hashing, key derivation), time, async handling, data manipulation, and permissions
- **API helpers** for Express router wrapping, CORS, auth headers, and error handling
- **Environment loading** utilities using `@keg-hub/parse-config`
- **Custom error handling** with the `Exception` class
- **Constants** including provider templates for quickstart flows

This repo is consumed by `backend`, `proxy`, `admin`, `agent`, `shell`, `repl`, and `sandbox` repos as the single source of truth for shared logic.

## Directory Structure

```
repos/domain/
├── src/
│   ├── api/              # Express API utilities
│   │   ├── adminPath.ts        # Admin path utilities
│   │   ├── authHeaders.ts      # Auth header extraction/forwarding
│   │   ├── behindLBProxy.ts    # Load balancer proxy detection
│   │   ├── checkAuthHeader.ts  # Auth header validation
│   │   └── inKube.ts           # Kubernetes environment detection
│   ├── constants/        # Constants
│   │   ├── providers.ts        # ProviderTemplates (anthropic, openai, google, zai, custom)
│   │   └── values.ts           # AuthHeaders, RoleHierarchy, PermissionMatrix
│   ├── crypto/           # Crypto utilities
│   │   ├── apiKey.ts           # hashApiKey() for API key storage/validation
│   │   ├── crypto.ts           # AES-256-GCM encryption/decryption (Node.js crypto)
│   │   ├── generateKey.ts      # Key generation (Web Crypto API - browser/edge only)
│   │   └── index.ts
│   ├── models/           # Domain model classes
│   │   ├── agent.ts            # Agent model (AI agent configuration)
│   │   ├── apiKey.ts           # API key model with scope validation
│   │   ├── asset.ts            # Asset model (files, images, uploads)
│   │   ├── base.ts             # Base class with id, createdAt, updatedAt
│   │   ├── certificate.ts      # Certificate model (SSL cert tree structure)
│   │   ├── domain.ts           # Domain model (custom domains for projects)
│   │   ├── endpoint.ts         # Endpoint model with Proxy/FaaS/Agent subclasses
│   │   ├── function.ts         # Function model (FaaS code storage)
│   │   ├── invitation.ts       # Invitation model (team invite flow)
│   │   ├── message.ts          # Message model (LLM chat messages)
│   │   ├── organization.ts     # Organization model
│   │   ├── plan.ts             # Plan model for payment plans
│   │   ├── project.ts          # Project model
│   │   ├── provider.ts         # Provider model (ai/git/auth/storage)
│   │   ├── quota.ts            # Quota model (resource usage tracking)
│   │   ├── role.ts             # Role model with permission helpers
│   │   ├── secret.ts           # Secret model with 4-way exclusive arc
│   │   ├── subscription.ts     # Subscription model (Polar.sh integration)
│   │   ├── thread.ts           # Thread model (LLM conversation threads)
│   │   └── user.ts             # User model with name parsing
│   ├── types/            # TypeScript type definitions
│   │   ├── ai.types.ts         # AI/LLM related types (TLLMAdapterConfig, ILLMAdapter, TStreamEvent, TAIMessage, TLLMToolDef)
│   │   ├── endpoint.types.ts   # Express types: TApp, TRequest, TResponse, TRouter
│   │   ├── epd.types.ts        # Endpoint data types
│   │   ├── functions.types.ts  # Function/FaaS types
│   │   ├── headers.types.ts    # HTTP header types
│   │   ├── helpers.types.ts    # Generic helpers: TAnyCB, TValueOf, EStatus, EContainerState
│   │   ├── http.types.ts       # HTTP method/request types
│   │   ├── invitation.types.ts # Invitation types
│   │   ├── payments.types.ts   # Payment plan types (TPayPlanMeta, TPayPlanRaw, TPayPlans)
│   │   ├── permissions.types.ts # Permission enums and types
│   │   ├── provider.types.ts   # EProvider enum (ai/git/auth/storage)
│   │   ├── quickstart.types.ts # TProviderModel, TProviderTemplate, TQuickstartRequest, TQuickstartResponse
│   │   ├── sandbox.types.ts    # ESandboxProvider, ISandbox, ISandboxProvider, TSandboxConfig
│   │   ├── scopes.types.ts     # EApiKeyScope, EApiKeyExpire
│   │   └── server.types.ts     # Server configuration types
│   ├── utils/            # Utility functions
│   │   ├── payments/           # Payment utilities
│   │   │   ├── parsePayPlans.ts    # Parse payment plan configs
│   │   │   ├── rawPlanToMeta.ts    # Convert raw to typed metadata
│   │   │   └── index.ts
│   │   ├── permissions/        # Permission utilities
│   │   │   ├── permissions.ts      # canPerform, hasMinRole, getRoleLevel, etc. (9 functions)
│   │   │   ├── permissions.test.ts
│   │   │   └── index.ts
│   │   ├── cleanSplit.ts       # String splitting utilities (splitBy, cleanSplit)
│   │   ├── isDomain.ts         # Domain name validation
│   │   ├── nextFrame.ts        # Animation frame utilities
│   │   ├── shortId.ts          # Short ID generation
│   │   └── time.ts             # Timestamp utility
│   ├── error/            # Error handling
│   │   ├── exception.ts        # Exception class with status codes
│   │   └── overrideErr.ts      # Error override utilities
│   ├── environment/      # Environment configuration
│   │   ├── loadEnvs.ts         # Load environment from deploy/values.*.yml
│   │   └── addToProcess.ts     # Add envs to process.env
│   ├── services/         # Services (empty placeholder)
│   ├── index.ts          # Main export (all modules)
│   └── web.ts            # Web-safe exports (excludes Node.js-specific code)
├── configs/
│   ├── aliases.ts        # Path alias setup using alias-hq
│   ├── biome.json        # Biome linting/formatting config
│   └── vitest.config.ts  # Vitest testing config
├── package.json          # Package metadata and scripts
└── tsconfig.json         # TypeScript configuration with path aliases
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main export barrel - exports all modules |
| `src/web.ts` | Web-safe exports (excludes Node.js code) |
| `src/types/endpoint.types.ts` | Express API type definitions (TApp, TRequest, TResponse, TRouter) |
| `src/types/ai.types.ts` | AI/LLM adapter types (TLLMAdapterConfig, ILLMAdapter, TStreamEvent) |
| `src/types/quickstart.types.ts` | Quickstart wizard types (TProviderTemplate, TQuickstartRequest) |
| `src/types/sandbox.types.ts` | Sandbox execution types (ISandbox, ISandboxProvider, ESandboxProvider) |
| `src/models/base.ts` | Base model class with id, createdAt, updatedAt |
| `src/crypto/crypto.ts` | AES-256-GCM encryption with HKDF key derivation |
| `src/crypto/apiKey.ts` | hashApiKey() for API key storage/validation |
| `src/constants/providers.ts` | ProviderTemplates (anthropic, openai, google, zai, custom) |
| `src/api/authHeaders.ts` | Auth header extraction and forwarding utilities |
| `src/error/exception.ts` | Custom Exception class for structured error handling |
| `src/environment/loadEnvs.ts` | Environment loading from deploy/values.*.yml files |
| `src/utils/permissions/permissions.ts` | Permission helpers (canPerform, hasMinRole, getRoleLevel, etc.) |

## Type Definitions

### Express API Types (`types/endpoint.types.ts`)

**Core Types:**
- `TApp<C, L>` - Express app with typed locals (config, db)
- `TRequest<ReqParams, ResBody, ReqBody, ReqQuery, Locals>` - Extended Express request with `auth` property
- `TResponse<ResBody, Locals>` - Extended Express response with typed locals
- `TRouter` - Type-safe Express router with `asyncWrap` integration
- `TReqHandler` - Request handler with optional error handler
- `TAsyncWrap` - Async wrapper utility type

**Auth Types:**
- `TTokenUser` - JWT decoded user: `{ user_id, token, subdomain, username?, status }`
- `TResLocals` - Response locals: `{ user?, subdomain? }`

### AI/LLM Types (`types/ai.types.ts`)

**TLLMAdapterConfig:**
```typescript
{
  model: string
  apiKey?: string          // Optional when using ProxyAdapter (session-based)
  maxTokens?: number
  temperature?: number
  topP?: number
  stream?: boolean
  systemPrompt?: string
  headers?: Record<string, string>      // Custom headers for LLM requests
  bodyParams?: Record<string, unknown>  // Extra LLM request parameters
}
```

**ILLMAdapter Interface:**
- `chat(messages: TAIMessage[], options?: TLLMAdapterConfig): AsyncIterable<TStreamEvent>`
- `chatCompletion(messages: TAIMessage[], options?: TLLMAdapterConfig): Promise<string>`

**TStreamEvent:**
- `{ type: 'content' | 'tool_use' | 'done' | 'error', ... }`

**TAIMessage:**
- `{ role: 'user' | 'assistant' | 'system', content: string | TLLMToolDef[], ... }`

**TLLMToolDef:**
- Tool definition for function calling

### Quickstart Types (`types/quickstart.types.ts`)

**TProviderModel:**
```typescript
{
  id: string        // 'anthropic' | 'openai' | 'google' | 'zai' | 'custom'
  name: string
  type: 'ai'
  apiUrl: string
  secretName: string
  secretValue: string
}
```

**TProviderTemplate:**
```typescript
{
  id: string
  name: string
  type: 'ai'
  apiUrl: string
  secretName: string
  secretPlaceholder: string
  models: string[]   // Available model IDs
}
```

**TQuickstartRequest:**
```typescript
{
  orgId: string
  providerId: string
  secretValue: string
  projectName: string
  agentName: string
  agentModel: string
}
```

**TQuickstartResponse:**
```typescript
{
  provider: TProvider
  secret: TSecret
  project: TProject
  agent: TAgent
  endpoint: TEndpoint
}
```

### Sandbox Types (`types/sandbox.types.ts`)

**ESandboxProvider:**
```typescript
enum ESandboxProvider {
  e2b = 'e2b',
  local = 'local'
}
```

**ISandbox Interface:**
- `execute(code: string, language: string, timeout?: number): Promise<{ stdout, stderr, exitCode }>`
- `cleanup(): Promise<void>`

**ISandboxProvider Interface:**
- `create(config: TSandboxConfig): Promise<ISandbox>`

**TSandboxConfig:**
```typescript
{
  provider: ESandboxProvider
  timeout?: number
  environment?: Record<string, string>
  workDir?: string
}
```

### Scopes Types (`types/scopes.types.ts`)

**EApiKeyScope:**
```typescript
enum EApiKeyScope {
  admin = 'admin',
  write = 'write',
  read = 'read'
}
```

**EApiKeyExpire:**
```typescript
enum EApiKeyExpire {
  never = 'never',
  days_30 = '30d',
  days_90 = '90d',
  days_180 = '180d',
  year_1 = '1y'
}
```

### Provider Types (`types/provider.types.ts`)

```typescript
enum EProvider {
  ai = 'ai',
  git = 'git',
  auth = 'auth',
  storage = 'storage'
}
type TProviderType = `${EProvider}`
```

### Helper Types (`types/helpers.types.ts`)

**Generic Utilities:**
- `TAnyCB` - Generic callback type
- `TValueOf<T>` - Extract value types from object
- `TCapKeys<T>` - Capitalize object keys
- `TUserHash` - User hash string type

**Enums:**
```typescript
enum EStatus {
  error, paused, waiting, unknown, pending,
  started, running, stopped, finished, initialized
}

enum EContainerState {
  Error, Missing, Running, Stopped,
  Creating, Succeeded, Terminated
}
```

### Error Types (`types/errors.types.ts`)

```typescript
type TErrorArgs = [number, string, string?]
type TErrorMethod = (...args: any[]) => TErrorArgs
type TErrorItems = Record<string, TErrorArgs | TErrorMethod>
type TThrowExceptions = Record<string, (...args: any) => void>
```

## Models

All models extend `Base` class with common fields: `id`, `createdAt`, `updatedAt`.

### User Model

```typescript
class User extends Base {
  first: string
  last: string
  email?: string
  image: string
  role?: string
  name?: string
  banned?: boolean
  provider?: string
  banReason?: string
  emailVerified?: boolean
  banExpires?: string | Date

  // Computed property
  get displayName(): string

  constructor(usr: Partial<User>) {
    // Auto-parses 'name' into 'first' and 'last' if needed
  }
}
```

### Organization Model

```typescript
class Organization extends Base {
  name: string
  description?: string
}
```

### Project Model

```typescript
class Project extends Base {
  name: string
  orgId: string         // Organization ID (renamed from teamId)
  gitUrl?: string
  branch: string = 'main'
  meta: Record<string, any> = {}
}
```

### ApiKey Model

```typescript
class ApiKey extends Base {
  name: string
  key?: string          // Only returned on creation (hashed in DB)
  orgId: string
  userId?: string       // Link to user who created the key
  scopes: string        // Comma-separated string (e.g., 'read,write,admin')
  keyHash: string       // SHA-256 hash of the full key
  keyPrefix: string     // First 8 chars for display (e.g., 'tdsk_abc')
  active: boolean = true
  rateLimit?: number    // Requests per minute
  expiresAt?: string | Date
  lastUsedAt?: string | Date

  // Methods
  hasScope(scope: string): boolean
  isExpired(): boolean
  isValid(): boolean
  getRateLimit(): number
  sanitize(): ApiKey    // Returns copy without sensitive fields
}
```

### Secret Model

```typescript
class Secret extends Base {
  name: string
  value?: string        // Decrypted value (only when requested)
  description?: string  // Human-readable description
  hashKey: string       // SHA-256 hash of name for lookup
  encryptedValue: string // Base64-encoded encrypted value
  orgId?: string        // Exclusive arc: orgId OR agentId OR projectId OR providerId
  agentId?: string
  projectId?: string
  providerId?: string
}
```

### Endpoint Model

```typescript
class Endpoint extends Base {
  projectId: string
  name: string
  type: 'proxy' | 'faas' | 'agent'
  path: string          // URL path (e.g., '/api/users')
  method: string = 'GET'
  public: boolean = false
  options: Record<string, any> = {}
  headers: Record<string, string> = {}
}

// Subclasses:
class ProxyEndpoint extends Endpoint {
  type = 'proxy'
  targetUrl: string
  // proxy-specific options
}

class FaaSEndpoint extends Endpoint {
  type = 'faas'
  functionId: string
  // faas-specific options
}

class AgentEndpoint extends Endpoint {
  type = 'agent'
  agentId: string
  // agent-specific options
}
```

### Function Model

```typescript
class Function extends Base {
  name: string
  projectId: string
  endpointId: string
  content?: string      // Function code (TypeScript/JavaScript)
  description?: string
  branch: string = 'main'
  defaultArgs: Record<string, any> = {}
  dependencies: Record<string, string> = {}
  language: string = 'typescript'
}
```

### Role Model

```typescript
class Role extends Base {
  userId: string
  orgId: string
  projectId?: string    // Optional project-specific role
  type: string = 'member'  // 'owner' | 'admin' | 'member' | 'viewer'

  // Methods
  hasMinRole(minRole: string): boolean
  isAdmin(): boolean
  isOwner(): boolean
  isSuperAdmin(): boolean
}
```

### Provider Model

```typescript
class Provider extends Base {
  orgId: string         // Org-scoped only (no longer userId/projectId)
  type: TProviderType   // 'ai' | 'git' | 'auth' | 'storage'
  name: string
  options: Record<string, any> = {}
  headers?: Record<string, string>      // Custom headers for provider requests
  bodyParams?: Record<string, any>      // Extra parameters for provider requests
}
```

### Agent Model

```typescript
class Agent extends Base {
  name: string
  model: string         // LLM model ID (e.g., 'claude-3-5-sonnet-20241022')
  maxTokens?: number
  orgId: string
  providerId: string
  provider?: Provider   // Populated provider object
  secrets?: Secret[]    // Array of linked secrets
  projects?: Project[]  // Array of linked projects
  tools?: any[]         // Tool definitions
  systemPrompt?: string
  envVars?: Record<string, string>
  environment?: Record<string, any>
}
```

### Thread Model

```typescript
class Thread extends Base {
  name: string
  userId: string
  orgId: string
  agentId: string
  projectId?: string
  providerId?: string
  public: boolean = false
  parentThreadId?: string      // For thread branching
  branchMessageId?: string     // Message where branch occurred
  meta: Record<string, any> = {}
}
```

### Message Model

```typescript
class Message extends Base {
  type: 'user' | 'assistant' | 'system'
  content: string
  threadId: string
  projectId?: string
  orgId?: string
  meta: Record<string, any> = {}
}
```

### Asset Model

```typescript
class Asset extends Base {
  url?: string
  content?: string      // For text-based assets
  name: string
  type: string          // MIME type or custom type
  orgId?: string
  userId?: string
  threadId?: string
  projectId?: string
  messageId?: string
  providerId?: string
  meta: Record<string, any> = {}
}
```

### Domain Model

```typescript
class Domain extends Base {
  domain: string        // e.g., 'api.example.com'
  orgId: string
  projectId?: string
  verified: boolean = false
  verifiedAt?: string | Date
  sslEnabled: boolean = false
  sslPrivateKey?: string
  sslCertificate?: string
  sslExpiresAt?: string | Date
  certificates?: Certificate[]  // SSL cert chain
}
```

### Certificate Model

```typescript
class Certificate {
  parent?: string       // Parent certificate ID (for chains)
  name: string
  isFile: boolean
  value: string
  modified: string | Date
}
```

### Invitation Model

```typescript
class Invitation extends Base {
  email: string
  orgId: string
  token: string         // Unique invitation token
  userId?: string       // User who was invited (after acceptance)
  roleType: string = 'member'
  invitedBy: string     // User ID of inviter
  revokedBy?: string    // User ID who revoked (if revoked)
  revokedAt?: string | Date
  expiresAt: string | Date
  acceptedAt?: string | Date
  status: 'pending' | 'accepted' | 'revoked' | 'expired'

  // Methods
  isExpired(): boolean
  isAccepted(): boolean
  isRevoked(): boolean
  isPending(): boolean
  canAccept(): boolean
}
```

### Quota Model

```typescript
class Quota extends Base {
  orgId: string
  // 12 resource usage fields:
  projects: number = 0
  members: number = 0
  endpoints: number = 0
  threads: number = 0
  messages: number = 0
  functionCalls: number = 0
  runtime: number = 0          // Seconds of FaaS runtime
  orgSecrets: number = 0
  projectSecrets: number = 0
  organizations: number = 0
  price: number = 0            // Total spend in cents
  retention: number = 0        // Data retention days
}
```

### Subscription Model

```typescript
class Subscription extends Base {
  tier: string          // 'free' | 'basic' | 'developer' | 'pro'
  status: string        // 'active' | 'canceled' | 'past_due' | 'trialing'
  userId: string
  polarId?: string      // Polar.sh subscription ID
  polarCustomerId?: string
  seats: number = 1
  currentPeriodStart?: string | Date
  currentPeriodEnd?: string | Date
  cancelAtPeriodEnd: boolean = false
  trialEnd?: string | Date
}
```

### Plan Model

```typescript
class Plan {
  id: string
  name: string
  description?: string
  recurring?: boolean
  metadata: TPayPlanMeta  // Typed metadata with numeric values

  constructor(opts: TPlanOpts) {
    // Auto-converts raw metadata to typed metadata
  }
}

// Usage:
const plan = new Plan({
  id: 'prod_123',
  name: 'pro',
  metadata: {
    price: '29',
    runtime: '3600',
    projects: '50'
  }
})
// plan.metadata = { price: 29, runtime: 3600, projects: 50 }
```

## Constants

### Provider Templates (`constants/providers.ts`)

```typescript
const ProviderTemplates = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'ai',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    secretName: 'ANTHROPIC_API_KEY',
    secretPlaceholder: 'sk-ant-...',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', ...]
  },
  openai: { ... },
  google: { ... },
  zai: { ... },
  custom: { ... }
}
```

### Values (`constants/values.ts`)

- `AuthHeaders` - Auth header name constants
- `RoleHierarchy` - Role priority levels
- `PermissionMatrix` - Role-to-permission mapping

## Utilities

### Crypto (`crypto/crypto.ts`)

**AES-256-GCM Encryption with HKDF:**

```typescript
// Key derivation from user ID + master key
deriveKey(ref_id: string): Promise<Buffer>

// Encrypt plaintext with derived key
encryptValue(derivedKey: Buffer, plaintextValue: string): Promise<TEncryptVal>
// Returns: { iv: Buffer, encrypted: Buffer, authTag: Buffer }

// Decrypt ciphertext
decryptValue(
  derivedKey: Buffer,
  ciphertext: Buffer,
  iv: Buffer,
  authTag: Buffer
): Promise<string>

// Base64 encoding of encrypted data
encodeEncrypted(encrypted: Buffer, iv: Buffer, authTag: Buffer): string

// PostgreSQL bytea conversion
bufferToBytea(buffer: Buffer): string  // => "\\x..."
byteaToBuffer(byteaString: string): Buffer
```

**Environment Variables:**
- `TDSK_MASTER_KEY` (required) - Hex-encoded master key for encryption

### Crypto (`crypto/apiKey.ts`)

**API Key Hashing:**

```typescript
// SHA-256 hash for API key storage/validation
hashApiKey(key: string): string

// Truncated SHA-256 hash for secret name lookup
createHashKey(name: string): string
```

### Permissions (`utils/permissions/permissions.ts`)

**9 Permission Helper Functions:**

```typescript
// Check if user can perform action on resource
canPerform(userRole: string, requiredPermission: string): boolean

// Check if user has minimum role level
hasMinRole(userRole: string, minRole: string): boolean

// Get numeric role level (owner=4, admin=3, member=2, viewer=1)
getRoleLevel(role: string): number

// Get all permissions for role
getPermissionsForRole(role: string): string[]

// Check if role has specific permission
hasPermission(role: string, permission: string): boolean

// Validate role type
isValidRole(role: string): boolean

// Get role from numeric level
getRoleFromLevel(level: number): string

// Compare two roles
compareRoles(role1: string, role2: string): number

// Get minimum required role for permission
getMinRoleForPermission(permission: string): string
```

### Time (`utils/time.ts`)

```typescript
timestamp(): number  // Date.now()
```

### Other Utilities

- `shortId(): string` - Generate short unique ID
- `nextFrame(callback: Function): void` - Schedule callback on next animation frame
- `throttleCBLast(callback: Function, delay: number): Function` - Throttle with last call guarantee
- `isDomain(domain: string): boolean` - Validate domain name format
- `splitBy(str: string, sep: string): string[]` - Split string by separator
- `cleanSplit(str: string, sep: string): string[]` - Split and trim whitespace

## API Helpers

### Admin Path (`api/adminPath.ts`)

```typescript
adminPath(config: { adminPath?: string }): string
// Returns the admin route prefix (default: "/_")
```

### Auth Headers (`api/authHeaders.ts`)

```typescript
// Forward auth headers from request to proxy request
setAuthHeaders(pxReq: TClientReq, req: Record<string, any>): void

// Extract auth header values from incoming request
fromAuthHeaders(req: TReq): Partial<TAuthHeaderObj>
```

### Load Balancer Detection (`api/behindLBProxy.ts`)

```typescript
behindLBProxy(): boolean
// Returns true if TDSK_WITH_LB_PROXY env is set (running behind load balancer in k8s)
```

### Auth Header Check (`api/checkAuthHeader.ts`)

```typescript
checkAuthHeader(authHeader?: string): { access_token: string | undefined }
// Extracts Bearer token from Authorization header
```

### Kubernetes Detection (`api/inKube.ts`)

```typescript
inKube(): boolean
// Returns true if running inside Kubernetes (checks TDSK_IN_KUBE or k8s service env vars)
```

## Error Handling

### Exception Class (`error/exception.ts`)

```typescript
class Exception extends Error {
  name: string = 'Exception'
  stack: string
  status: number        // HTTP status code
  message: string
  code?: string         // Error code
  details?: TErrDetails // Array of error details
  __isAuthError?: boolean = false

  constructor(
    status: number,
    message: string | Error,
    code?: string,
    details?: TErrDetails,
    stack?: string
  )

  static throw(
    status: number,
    message: string,
    code?: string,
    details?: TErrDetails,
    stack?: string
  ): never
}

// Usage:
Exception.throw(400, 'Invalid input', 'INVALID_INPUT', ['Missing field: email'])
```

## Environment Loading

### loadEnvs (`environment/loadEnvs.ts`)

Loads environment variables from `deploy/values.*.yml` files using `@keg-hub/parse-config`.

```typescript
loadEnvs(cfg: TLoadEnvs): Record<string, string>

// Options:
{
  env?: string           // 'local' | 'dev' | 'prod' (default: NODE_ENV or 'local')
  name?: string          // Config name (default: 'tdsk')
  force?: boolean        // Force reload (default: false)
  ignore?: string[]      // Keys to ignore
  override?: boolean     // Override existing process.env
  locations?: string[]   // Additional config locations
}

// Searches locations:
// 1. @ROOT (monorepo root)
// 2. @ROOT/deploy
// 3. ~/.config/tdsk
// 4. Custom locations
```

### addToProcess (`environment/addToProcess.ts`)

Adds loaded environment variables to `process.env` with optional overrides.

## Architecture

### Type Composition Pattern

All types use TypeScript generics for flexibility:
- `TApp<C, L>` allows custom config and locals
- `TRequest<Params, ResBody, ReqBody, Query, Locals>` for full type safety
- Model classes use `Partial<T>` in constructors for flexible initialization

### Exclusive Arc Pattern

Multiple models implement the exclusive arc pattern:
- `Provider`: `orgId` only (no longer userId/projectId)
- `Secret`: `orgId` XOR `agentId` XOR `projectId` XOR `providerId` (4-way arc)
- Database enforces this with constraints
- Matches the broader schema pattern used in `database` repo

### Export Strategy

- `src/index.ts` - Full exports (includes Node.js stdlib code)
- `src/web.ts` - Web-safe exports (excludes `api`, `environment`, `services`)
- Consumers choose based on runtime environment

### Barrel Exports

Each module has an `index.ts` that re-exports all sub-modules:
- `types/index.ts` exports all type files
- `models/index.ts` exports all model classes
- `utils/index.ts` exports all utilities
- Root `index.ts` exports everything

## Key Patterns

### 1. Type-Safe Express

Custom Express types provide full type safety:

```typescript
type TRequest<ReqParams, ResBody, ReqBody, ReqQuery, Locals> = {
  app: TApp            // Typed app with config/db
  auth?: TTokenUser    // Decoded JWT user
  params: ReqParams    // Route params
  body: ReqBody        // Request body
  query: ReqQuery      // Query params
  // ...Express Request
}
```

### 2. Model Inheritance

All models extend `Base` for consistent timestamps:

```typescript
class Base {
  id: string
  createdAt: string | Date
  updatedAt: string | Date
}

// All models get these fields automatically
class User extends Base { /* ... */ }
class Organization extends Base { /* ... */ }
```

### 3. Encryption Key Derivation

HKDF (HMAC-based Key Derivation Function) pattern:

```typescript
// Master key (hex) → HKDF with user ID → 32-byte derived key
const derivedKey = await deriveKey(userId)

// Each user gets unique encryption key
const encrypted = await encryptValue(derivedKey, secretValue)
```

### 4. API Key Hashing

SHA-256 hashing for API key storage:

```typescript
// Hash full key for database storage
const keyHash = hashApiKey('tdsk_abc123...')

// Validate key on auth
const inputHash = hashApiKey(req.headers.authorization)
const isValid = keyHash === inputHash
```

### 5. Environment Cascading

Environment loading follows precedence:
1. Project-specific: `@ROOT/deploy/values.<env>.yml`
2. User-specific: `~/.config/tdsk/values.<env>.yml`
3. Custom locations
4. Fallback to defaults

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| `@keg-hub/jsutils` | 10.0.0 | Utility functions (isStr, isObj, ensureArr, etc.) |
| `@keg-hub/parse-config` | 2.2.0 | YAML config loading and templating |
| `@tdsk/logger` | workspace:* | Winston-based logging (internal) |
| `alias-hq` | 6.2.4 | Path alias resolution for imports |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/express` | 5.0.0 | Express type definitions |
| `@types/node` | 22.12.0 | Node.js type definitions |
| `vite-tsconfig-paths` | ^4.3.1 | Vite tsconfig paths plugin |
| `vitest` | ^1.4.0 | Testing framework |

## Commands

All commands use PNPM:

```bash
# Testing (Vitest)
pnpm test               # Run tests

# Cleanup
pnpm clean              # Remove node_modules
```

### Commands Notes

* Linting and formatting are automatic, so `pnpm lint` and `pnpm format` commands should be ignored.

## Integration Points

### Consumed By

**Backend (`@tdsk/backend`)**:
- Uses full `index.ts` exports
- Imports: types, models, api helpers, error handling, environment loading, permissions
- Extends: `TApp`, `TRequest`, `TResponse`
- Uses: `adminPath`, `authHeaders`, `Exception`, `loadEnvs`, `canPerform`, `hasMinRole`

**Proxy (`@tdsk/proxy`)**:
- Uses full `index.ts` exports
- Imports: types, models, api helpers, crypto utilities
- Uses: `checkAuthHeader`, `behindLBProxy`, `inKube`, `hashApiKey`, encryption utilities

**Admin (`@tdsk/admin`)**:
- Uses `web.ts` exports (web-safe only)
- Imports: types, models, error handling
- Uses: `Exception`, model classes for client-side state, `ProviderTemplates`

**Database (`@tdsk/database`)**:
- Uses model classes for ORM type definitions
- Imports: All model classes (User, Organization, Project, Provider, Agent, Thread, Message, etc.)

**Agent (`@tdsk/agent`)**:
- Uses full `index.ts` exports
- Imports: AI types, models, error handling
- Uses: `TLLMAdapterConfig`, `ILLMAdapter`, `TStreamEvent`, `Agent`, `Thread`, `Message`

**REPL (`@tdsk/repl`)**:
- Uses full `index.ts` exports
- Imports: AI types, models
- Uses: `TLLMAdapterConfig`, `Agent`, `Thread`, `Message`, `User`

**Sandbox (`@tdsk/sandbox`)**:
- Uses sandbox types
- Imports: `ISandbox`, `ISandboxProvider`, `ESandboxProvider`, `TSandboxConfig`

### Path Aliases

All repos can import using these aliases:

```typescript
import { User, Organization } from '@TDM/models'
import { TRequest, TResponse } from '@TDM/types'
import { Exception } from '@TDM/error'
import { encryptValue, decryptValue, hashApiKey } from '@TDM/crypto'
import { canPerform, hasMinRole } from '@TDM/utils/permissions'
import { ProviderTemplates } from '@TDM/constants'
```

**Configured in:**
- `tsconfig.json` - `paths` mapping
- `configs/aliases.ts` - Runtime alias resolution via `alias-hq`

### Workspace Protocol

Uses PNPM workspace protocol for internal dependencies:

```json
{
  "dependencies": {
    "@tdsk/logger": "workspace:*"
  }
}
```

This ensures all internal packages use the local workspace version.

## Best Practices

1. **Always use web.ts for frontend** - Prevents Node.js stdlib code in browser bundles
2. **Use API helpers** - Leverage `adminPath`, `authHeaders`, `checkAuthHeader` utilities
3. **Extend Base model** - All domain models should inherit from Base
4. **Type-safe requests** - Use TRequest/TResponse with generics for full type safety
5. **Environment-specific configs** - Use loadEnvs for all environment configuration
6. **Secure encryption** - Always use HKDF key derivation, never share master key
7. **Hash API keys** - Use `hashApiKey()` for storage, never store plaintext keys
8. **Structured errors** - Use Exception class with status codes and details
9. **Path aliases** - Use @TDM/* imports for consistency across repos
10. **Permission checks** - Use `canPerform()` and `hasMinRole()` utilities
11. **Provider templates** - Use `ProviderTemplates` constant for quickstart flows

## Security Notes

### Master Key Management

- `TDSK_MASTER_KEY` must be 32 bytes (64 hex characters)
- Generate with: `openssl rand -hex 32`
- Store in `.env` files (never commit)
- Each user gets unique derived key via HKDF
- Keys are never logged or exposed in errors

### API Key Security

- API keys use `tdsk_` prefix for identification
- Full keys are SHA-256 hashed before storage
- Only prefix (first 8 chars) stored for display
- Validation compares hashes, not plaintext
- Keys have expiration and rate limits

### Encryption Algorithm

- **AES-256-GCM** - Authenticated encryption
- **HKDF-SHA256** - Key derivation function
- **12-byte IV** - Initialization vector (randomly generated)
- **16-byte Auth Tag** - GCM authentication tag
- Protects against tampering and replay attacks

### Permission Enforcement

- All protected endpoints validate user roles
- Permission matrix enforces least privilege
- Role hierarchy: viewer < member < admin < owner
- Project-specific roles override org roles

## Testing

**280 tests passing across 18 test files**

Tests use Vitest with config in `configs/vitest.config.ts`:

```bash
pnpm test               # Run all tests
pnpm test:watch         # Watch mode (if configured)
```

Example test structure:

```typescript
// src/utils/isDomain.test.ts
import { describe, it, expect } from 'vitest'
import { isDomain } from './isDomain'

describe(`isDomain`, () => {
  it(`should return true for valid domains`, () => {
    expect(isDomain(`example.com`)).toBe(true)
    expect(isDomain(`sub.domain.co.uk`)).toBe(true)
    expect(isDomain(`my-site.org`)).toBe(true)
    expect(isDomain(`a.bc`)).toBe(true)
  })

  it(`should return false for invalid domains`, () => {
    expect(isDomain(`not-a-domain`)).toBe(false)
    expect(isDomain(`.com`)).toBe(false)
    expect(isDomain(``)).toBe(false)
    expect(isDomain(`   `)).toBe(false)
    expect(isDomain(`-bad.com`)).toBe(false)
  })
})
```

---

**Last Updated**: 2026-02-15
**Version**: 2.0.0

## Changelog

### v2.0.0 (2026-02-15)
- **BREAKING**: Provider model now org-scoped only — removed `userId` and `projectId` fields
- **NEW**: Provider model adds `headers` and `bodyParams` for custom LLM request params
- **BREAKING**: ApiKey `scopes` is now `string` (comma-separated), not `string[]`
- **NEW**: ApiKey adds `userId`, `keyHash`, `keyPrefix`, `active` fields
- **NEW**: ApiKey adds methods: `hasScope()`, `isExpired()`, `isValid()`, `getRateLimit()`, `sanitize()`
- **NEW**: Secret model adds `agentId` to exclusive arc (4-way: orgId/agentId/projectId/providerId)
- **NEW**: Secret model adds `hashKey`, `encryptedValue`, `description` fields
- **BREAKING**: Endpoint model restructured with `type`, `path`, `method`, `public`, `options`, `headers`
- **NEW**: Endpoint subclasses: `ProxyEndpoint`, `FaaSEndpoint`, `AgentEndpoint`
- **BREAKING**: Function model restructured with `content`, `description`, `branch`, `defaultArgs`, `dependencies`, `language`
- **BREAKING**: Role model field renamed from `role` to `type`
- **NEW**: Role model adds `projectId` and methods: `hasMinRole()`, `isAdmin()`, `isOwner()`, `isSuperAdmin()`
- **REMOVED**: Config model (no longer exists)
- **NEW**: Agent model (name, model, maxTokens, orgId, providerId, provider, secrets, projects, tools, systemPrompt, envVars, environment)
- **NEW**: Asset model (url, content, name, type, orgId, userId, threadId, projectId, messageId, providerId, meta)
- **NEW**: Thread model (name, userId, orgId, agentId, projectId, providerId, public, parentThreadId, branchMessageId, meta)
- **NEW**: Message model (type, content, threadId, meta, projectId, orgId)
- **NEW**: Domain model (domain, orgId, projectId, verified, verifiedAt, sslEnabled, sslPrivateKey, sslCertificate, sslExpiresAt, certificates)
- **NEW**: Certificate model (parent, name, isFile, value, modified)
- **NEW**: Invitation model (email, orgId, token, userId, roleType, invitedBy, revokedBy, revokedAt, expiresAt, acceptedAt, status + methods)
- **NEW**: Quota model (12 resource fields: projects, members, endpoints, threads, messages, functionCalls, runtime, orgSecrets, projectSecrets, organizations, price, retention)
- **NEW**: Subscription model (tier, status, userId, polarId, seats, etc.)
- **NEW**: `types/quickstart.types.ts` — TProviderModel, TProviderTemplate, TQuickstartRequest, TQuickstartResponse
- **NEW**: `types/sandbox.types.ts` — ESandboxProvider, ISandbox, ISandboxProvider, TSandboxConfig
- **NEW**: `types/scopes.types.ts` — EApiKeyScope, EApiKeyExpire
- **NEW**: `constants/providers.ts` — ProviderTemplates (anthropic, openai, google, zai, custom)
- **NEW**: `crypto/apiKey.ts` — `hashApiKey()` and `createHashKey()` for API key hashing
- **NEW**: `crypto/crypto.ts` adds `encodeEncrypted()` for base64 encoding
- **NEW**: AI types `TLLMAdapterConfig` adds `headers` and `bodyParams` fields
- **NEW**: AI types document `ILLMAdapter`, `TStreamEvent`, `TAIMessage`, `TLLMToolDef`
- **NEW**: Permission utilities — 9 functions: `canPerform`, `hasMinRole`, `getRoleLevel`, etc.
- **NEW**: User model adds `displayName` getter
- **UPDATED**: Test count: 280 tests passing (18 files)

### v1.3.0 (2026-02-14)
- **Changed**: `apiKey` is now optional in `TLLMAdapterConfig` (`ai.types.ts` line 213)
- When using `ProxyAdapter` (session-based LLM proxy), no apiKey is passed from the client
- Server-side code that requires apiKey validates it before calling the LLM adapter

### v1.2.0 (2026-01-18)
- **New**: `Plan` model for payment plans with metadata conversion
- **New**: `payments.types.ts` - Payment plan types (TPayPlanRaw, TPayPlanMeta, TPayPlans)
- **New**: `utils/payments/` - Payment utilities (parsePayPlans, rawPlanToMeta)
- **Refactor**: Crypto utilities moved to `crypto/` subdirectory
- **Refactor**: Permissions utilities moved to `utils/permissions/` subdirectory
- **New**: `rawPlanToMeta()` - Converts raw string metadata to typed numbers

### v1.1.0 (Previous)
- Base models and types
- Crypto utilities
- Express API helpers

## Future Enhancements

Based on empty placeholder modules:

- `services/` - Planned for shared service layer logic (currently empty)
