---
name: "Threaded Stack - Domain Repo"
description: "Knowledge base for the shared types, models, and utilities repo"
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

This repo is consumed by `backend`, `proxy`, `admin`, `agent`, `repl`, and `sandbox` repos as the single source of truth for shared logic.

## Directory Structure

```
repos/domain/
+-- src/
|   +-- api/              # Express API utilities
|   |   +-- adminPath.ts        # Admin path utilities
|   |   +-- authHeaders.ts      # Auth header extraction/forwarding
|   |   +-- behindLBProxy.ts    # Load balancer proxy detection
|   |   +-- checkAuthHeader.ts  # Auth header validation
|   |   +-- inKube.ts           # Kubernetes environment detection
|   +-- constants/        # Constants
|   |   +-- providers.ts        # ProviderTemplates (anthropic, openai, google, zai, custom)
|   |   +-- values.ts           # ApiKeyPrefix, AuthHeaders, RoleHierarchy, PermissionMatrix
|   +-- crypto/           # Crypto utilities
|   |   +-- crypto.ts           # AES-256-GCM encryption/decryption, hashKey, generateApiKey, createHashKey
|   |   +-- generateKey.ts      # Key generation (Web Crypto API - browser/edge only, NOT USED)
|   |   +-- index.ts
|   +-- models/           # Domain model classes
|   |   +-- agent.ts            # Agent model (AI agent configuration)
|   |   +-- apiKey.ts           # API key model with scope validation
|   |   +-- asset.ts            # Asset model (files, images, uploads)
|   |   +-- base.ts             # Base class with id, createdAt, updatedAt
|   |   +-- certificate.ts      # Certificate model (SSL cert tree structure)
|   |   +-- domain.ts           # Domain model (custom domains for projects)
|   |   +-- endpoint.ts         # Endpoint model with Proxy/FaaS/Agent subclasses
|   |   +-- function.ts         # Function model (FaaS code storage)
|   |   +-- invitation.ts       # Invitation model (team invite flow)
|   |   +-- message.ts          # Message model (LLM chat messages)
|   |   +-- organization.ts     # Organization model
|   |   +-- plan.ts             # Plan model for payment plans
|   |   +-- project.ts          # Project model
|   |   +-- provider.ts         # Provider model (ai/git/auth/storage with brand)
|   |   +-- quota.ts            # Quota model (resource usage tracking)
|   |   +-- role.ts             # Role model with permission helpers
|   |   +-- secret.ts           # Secret model with 4-way exclusive arc
|   |   +-- subscription.ts     # Subscription model (Polar.sh integration)
|   |   +-- thread.ts           # Thread model (LLM conversation threads)
|   |   +-- user.ts             # User model with name parsing
|   +-- types/            # TypeScript type definitions
|   |   +-- ai.types.ts         # AI/LLM types (EMsgType, EAgentTool, ELLMProviderBrand, TLLMAdapterConfig, ILLMAdapter, TStreamEvent, TAIMessage, TLLMToolDef, TAgentRunRequest)
|   |   +-- endpoint.types.ts   # Express types: TApp, TRequest, TResponse, TRouter
|   |   +-- epd.types.ts        # Endpoint data types (EEndpointType, TEndpointOpts, TProxyEndpointConfig, TFaaSEndpointConfig, TAgentEndpointConfig)
|   |   +-- functions.types.ts  # Function/FaaS types (EFunLanguage, TFunctionParam, TFunctionRequest, TFunctionContext, TFunctionResponse)
|   |   +-- git.types.ts        # Git provider types (EGitProvider, TGitBrand)
|   |   +-- headers.types.ts    # HTTP header types (TAuthHeaderObj)
|   |   +-- helpers.types.ts    # Generic helpers: TAnyCB, TValueOf, TAnyObj, TKeyLike, TCapKeys
|   |   +-- http.types.ts       # HTTP method types (EHttpMethod)
|   |   +-- invitation.types.ts # Invitation types (EInviteStatus, TCreateInvitationInput)
|   |   +-- payments.types.ts   # Payment plan types (TPayPlanMeta, TPayPlanRaw, TPayPlans, ESubscriptionTier, ESubscriptionStatus)
|   |   +-- permissions.types.ts # Permission enums and types (ERoleType, EPermAction, EPermResource, EPermScope)
|   |   +-- provider.types.ts   # EProvider enum (ai/git/auth/storage), TProviderBrand
|   |   +-- quickstart.types.ts # TProviderModel, TProviderTemplate, TQuickstartRequest, TQuickstartResponse
|   |   +-- sandbox.types.ts    # ESandboxProvider, ISandbox, ISandboxProvider, TSandboxConfig
|   |   +-- scopes.types.ts     # EApiKeyScope, EApiKeyExpire, TKeyHash, TApiKeyScope
|   |   +-- server.types.ts     # Server configuration types (TSSLCreds)
|   +-- utils/            # Utility functions
|   |   +-- payments/           # Payment utilities
|   |   |   +-- parsePayPlans.ts    # Parse payment plan configs
|   |   |   +-- rawPlanToMeta.ts    # Convert raw to typed metadata
|   |   |   +-- index.ts
|   |   +-- permissions/        # Permission utilities
|   |   |   +-- permissions.ts      # canPerform, hasMinRole, getRoleLevel, canAccessSecretValue, isSuperAdmin, getHighestRole, canManageRole, getAllowedActions, isValidRoleType
|   |   |   +-- permissions.test.ts
|   |   |   +-- index.ts
|   |   +-- cleanSplit.ts       # String splitting utilities (splitBy, cleanSplit)
|   |   +-- isDomain.ts         # Domain name validation
|   |   +-- nextFrame.ts        # Animation frame utilities
|   |   +-- shortId.ts          # Short ID generation
|   |   +-- time.ts             # Timestamp utility
|   +-- error/            # Error handling
|   |   +-- exception.ts        # Exception class with status codes
|   |   +-- overrideErr.ts      # Error override utilities
|   +-- environment/      # Environment configuration
|   |   +-- loadEnvs.ts         # Load environment from deploy/values.*.yml
|   |   +-- addToProcess.ts     # Add envs to process.env
|   +-- services/         # Services (empty placeholder)
|   +-- index.ts          # Main export (all modules)
|   +-- web.ts            # Web-safe exports (excludes Node.js-specific code)
+-- configs/
|   +-- aliases.ts        # Path alias setup using alias-hq
|   +-- biome.json        # Biome linting/formatting config
|   +-- vitest.config.ts  # Vitest testing config
+-- package.json          # Package metadata and scripts
+-- tsconfig.json         # TypeScript configuration with path aliases
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main export barrel - exports all modules |
| `src/web.ts` | Web-safe exports (excludes Node.js code: api, environment, services, crypto) |
| `src/types/endpoint.types.ts` | Express API type definitions (TApp, TRequest, TResponse, TRouter) |
| `src/types/ai.types.ts` | AI/LLM adapter types (TLLMAdapterConfig, ILLMAdapter, TStreamEvent, ELLMProviderBrand) |
| `src/types/epd.types.ts` | Endpoint configuration types (EEndpointType, TProxyEndpointConfig, TFaaSEndpointConfig, TAgentEndpointConfig) |
| `src/types/quickstart.types.ts` | Quickstart wizard types (TProviderTemplate, TQuickstartRequest) |
| `src/types/sandbox.types.ts` | Sandbox execution types (ISandbox, ISandboxProvider, ESandboxProvider) |
| `src/types/permissions.types.ts` | RBAC types (ERoleType, EPermAction, EPermResource, EPermScope) |
| `src/types/git.types.ts` | Git provider types (EGitProvider, TGitBrand) |
| `src/models/base.ts` | Base model class with id, createdAt, updatedAt |
| `src/crypto/crypto.ts` | AES-256-GCM encryption with HKDF key derivation, hashKey, generateApiKey, createHashKey |
| `src/constants/providers.ts` | ProviderTemplates (anthropic, openai, google, zai, custom) |
| `src/constants/values.ts` | ApiKeyPrefix, AuthHeaders, RoleHierarchy, PermissionMatrix |
| `src/api/authHeaders.ts` | Auth header extraction and forwarding utilities |
| `src/error/exception.ts` | Custom Exception class for structured error handling |
| `src/environment/loadEnvs.ts` | Environment loading from deploy/values.*.yml files |
| `src/utils/permissions/permissions.ts` | Permission helpers (canPerform, hasMinRole, getRoleLevel, etc.) |

## Type Definitions

### Express API Types (`types/endpoint.types.ts`)

**Core Types:**
- `TApp<C, D, P, E, A, L>` - Express app with typed locals (config, db, payments, email, auth)
- `TRequest<App, ReqParams, ResBody, ReqBody, ReqQuery, Locals>` - Extended Express request with `user` property
- `TResponse<ResBody, Locals>` - Extended Express response with typed locals
- `TRouter` - Type-safe Express router with all HTTP methods typed
- `TReqHandler` - Request handler with optional error handler
- `TAsyncWrap` - Async wrapper utility type

**Auth Types:**
- `TResLocals` - Response locals: `{ user?, subdomain? }`

### AI/LLM Types (`types/ai.types.ts`)

**EMsgType:**
```typescript
enum EMsgType {
  user = 'user',
  tool = 'tool',
  system = 'system',
  action = 'action',
  assistant = 'assistant',
}
```

**EAgentTool:**
```typescript
enum EAgentTool {
  mkdir = 'mkdir',
  listDir = 'listDir',
  readFile = 'readFile',
  shellExec = 'shellExec',
  webSearch = 'webSearch',
  writeFile = 'writeFile',
  deleteFile = 'deleteFile',
  fileExists = 'fileExists',
}
```

**ELLMProviderBrand:**
```typescript
enum ELLMProviderBrand {
  zai = 'zai',
  openai = 'openai',
  google = 'google',
  custom = 'custom',
  anthropic = 'anthropic',
}
```

**TAgentRunRequest:**
```typescript
{
  orgId: string
  prompt: string
  agentId: string
  threadId?: string
  projectId?: string
  providerId?: string
  overrides?: TAgentRunOverrides
}
```

**TLLMAdapterConfig:**
```typescript
{
  model: string
  apiKey?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  provider: TLLMProviderBrand
  options?: Record<string, unknown>
  headers?: Record<string, string>
  bodyParams?: Record<string, unknown>
}
```

**ILLMAdapter Interface:**
```typescript
interface ILLMAdapter {
  readonly provider: TLLMProviderBrand
  stream(
    messages: TAIMessage[],
    tools: TLLMToolDef[],
    config: TLLMAdapterConfig
  ): AsyncIterable<TStreamEvent>
}
```

**TAIMessage:**
- `{ role: TMessageRole, content: TMessageContent[] }`
- Content is an array of `TTextContent | TToolUseContent | TToolResultContent`

**TStreamEvent:**
- Union of: `TStreamTextEvent`, `TStreamToolCallStartEvent`, `TStreamToolCallArgsEvent`, `TStreamToolResultEvent`, `TStreamToolExecutionUpdateEvent`, `TStreamErrorEvent`, `TStreamDoneEvent`
- Event types: `text`, `tool_call_start`, `tool_call_args`, `tool_result`, `tool_execution_update`, `error`, `done`

**TLLMToolDef:**
- Tool definition with `name`, `description`, and `inputSchema` (JSON Schema format)

### Endpoint Data Types (`types/epd.types.ts`)

**EEndpointType:**
```typescript
enum EEndpointType {
  proxy = 'proxy',
  faas = 'faas',
  agent = 'agent',
}
```

**TEndpointOpts<T>** - Discriminated union based on endpoint type:
- `TProxyEndpointConfig`: `{ url, transform?, ...shared }`
- `TFaaSEndpointConfig`: `{ functionId, arguments?, envVars?, secrets?, memory?, ...shared }`
- `TAgentEndpointConfig`: `{ agentId, overrides?, ...shared }`
- Shared options include: `timeout`, `pathRegex`, `oauth`, `auth`, `headers`, `retries`, `domainWhitelist`

### Quickstart Types (`types/quickstart.types.ts`)

**TProviderModel:**
```typescript
{
  id: string
  name: string
  maxTokens: number
  description?: string
}
```

**TProviderTemplate:**
```typescript
{
  name: string
  baseUrl: string
  defaultModel: string
  id: TLLMProviderBrand
  apiKeyPattern?: string
  defaultSecretName: string
  apiKeyPlaceholder: string
  models: TProviderModel[]
}
```

**TQuickstartRequest:**
```typescript
{
  apiKey: string
  projectName: string
  agentName: string
  agentDescription?: string
  model?: string
  maxTokens?: number
  systemPrompt?: string
  providerUrl?: string
  providerName?: string
  providerBrand: TLLMProviderBrand
}
```

**TQuickstartResponse:**
```typescript
{
  provider: Record<string, any>
  secret: Record<string, any>
  project: Record<string, any>
  agent: Record<string, any>
  endpoint: Record<string, any>
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
- `exec(command: string, args?: string[]): Promise<TSandboxResult>`
- `readFile(path: string): Promise<string>`
- `writeFile(path: string, content: string): Promise<void>`
- `listDir(path: string): Promise<string[]>`
- `deleteFile(path: string): Promise<void>`
- `mkdir(path: string): Promise<void>`
- `fileExists(path: string): Promise<boolean>`
- `close(): Promise<void>`

**ISandboxProvider Interface:**
- `readonly type: TSandboxProviderType`
- `create(config: TSandboxConfig): Promise<ISandbox>`

**TSandboxConfig:**
```typescript
{
  provider: TSandboxProviderType
  apiKey?: string
  template?: string
  timeout?: number
  envVars?: Record<string, string>
  options?: Record<string, unknown>
}
```

### Scopes Types (`types/scopes.types.ts`)

**EApiKeyScope:**
```typescript
enum EApiKeyScope {
  read = 'read',
  write = 'write',
  admin = 'admin'
}
```

**EApiKeyExpire:**
```typescript
enum EApiKeyExpire {
  d7 = 7,
  d30 = 30,
  d90 = 90,
  d180 = 180,
  y1 = 365,
  never = 'none'
}
```

**TKeyHash:**
```typescript
{ key: string, hash: string, prefix: string }
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
type TProviderBrand = TLLMProviderBrand | TGitBrand
```

### Git Types (`types/git.types.ts`)

```typescript
enum EGitProvider {
  github = 'github',
  gitlab = 'gitlab'
}
type TGitBrand = `${EGitProvider}`
```

### Permission Types (`types/permissions.types.ts`)

```typescript
enum ERoleType {
  super = 'super',   // Platform admin
  owner = 'owner',   // Org/Project creator
  admin = 'admin',   // Can manage members, settings, secrets
  member = 'member', // Can create/edit resources
  viewer = 'viewer'  // Read-only access
}

enum EPermAction { create, read, update, delete, manage }
enum EPermResource { org, project, user, role, secret, apiKey, endpoint, provider, domain, function, agent, subscription, quota, invitation, thread, message, asset }
enum EPermScope { global, org, project }
```

### Helper Types (`types/helpers.types.ts`)

**Generic Utilities:**
- `TAnyCB` - Generic callback type
- `TValueOf<T>` - Extract value types from object
- `TCapKeys<T>` - Capitalize object keys
- `TAnyObj` - `Record<string, any>`
- `TKeyLike` - `string | number | symbol`

### Functions Types (`types/functions.types.ts`)

```typescript
enum EFunLanguage { python, typescript, javascript }

type TFunctionParam = {
  name: string
  default?: unknown
  required?: boolean
  type: TFunParamType  // 'array' | 'string' | 'object' | 'number' | 'boolean'
  description?: string
}

type TFunctionRequest = { path?, body?, method?, query?, headers? }
type TFunctionContext = { args?, envVars?, secrets? }
type TFunctionResponse = { body?, statusCode?, headers? }
type TFunctionExecResult = { error?, output, duration, success }
```

## Models

All models extend `Base` class with common fields: `id`, `createdAt?`, `updatedAt?`.

### Base Model

```typescript
class Base {
  id: string
  createdAt?: string | Date
  updatedAt?: string | Date
  /** Used only during test, should not be used at runtime */
  _isModel?: boolean
}
```

### User Model

```typescript
class User extends Base {
  first?: string
  last?: string
  image?: string
  name?: string
  email?: string
  banned?: boolean
  provider?: string       // Runtime-only field from auth provider, not persisted
  banReason?: string
  emailVerified?: boolean
  role?: TRoleType | string
  banExpires?: string | Date

  get displayName(): string  // Computed from name or first+last
  constructor(usr: Partial<User>)  // Auto-parses 'name' into 'first' and 'last'
}
```

### Organization Model

```typescript
class Organization extends Base {
  name: string
  ownerId: string
  description?: string
}
```

### Project Model

```typescript
class Project extends Base {
  name: string
  orgId: string
  gitUrl?: string
  description?: string
  branch: string = 'main'
  meta: Record<string, any> = {}
}
```

### ApiKey Model

```typescript
class ApiKey extends Base {
  key?: string           // Only returned on creation (hashed in DB)
  name: string
  orgId?: string
  userId?: string        // Link to user who created the key
  keyHash: string        // SHA-256 hash of the full key
  scopes?: string        // Comma-separated string (e.g., 'read,write,admin')
  active: boolean
  keyPrefix: string      // First 12 chars for display (e.g., 'tdsk_abc12345')
  rateLimit?: number
  projectId?: string
  expiresAt?: Date | string
  lastUsedAt?: Date | string

  // Methods
  hasScope(scope: TApiKeyScope): boolean
  isExpired(): boolean
  isValid(): boolean
  getRateLimit(): number
  sanitize(): ApiKey     // Returns copy without key and keyHash
}
```

### Secret Model

```typescript
class Secret extends Base {
  name: string
  value?: string          // Decrypted value (only when requested)
  description?: string
  hashKey: string         // Truncated SHA-256 hash of name for lookup
  encryptedValue: string  // Base64-encoded encrypted value
  orgId?: string          // Exclusive arc: orgId OR agentId OR projectId OR providerId
  agentId?: string
  projectId?: string
  providerId?: string

  sanitize(): Secret      // Returns copy without value and encryptedValue
}
```

### Endpoint Model

```typescript
class Endpoint<T extends TEndpointType = TEndpointType> extends Base {
  type: T
  path: string
  name?: string
  projectId: string
  method: string = 'GET'
  public?: boolean = false
  options?: TEndpointOpts<T>    // Typed options based on endpoint type
  headers?: Record<string, string>
}

// Subclasses:
class ProxyEndpoint extends Endpoint<EEndpointType.proxy> {}
class FaaSEndpoint extends Endpoint<EEndpointType.faas> {}
class AgentEndpoint extends Endpoint<EEndpointType.agent> {}
```

### Function Model

```typescript
class Function extends Base {
  name: string
  content: string
  projectId: string
  endpointId?: string
  description?: string
  agentIds?: string[]            // Agents that can use this function
  branch: string = 'main'
  inputSchema?: TFunctionParam[]
  defaultArgs?: Record<string, any>
  dependencies?: Record<string, any>
  language: string = EFunLanguage.typescript
}
```

### Role Model

```typescript
class Role extends Base {
  name?: string
  type: ERoleType           // ERoleType enum (not string)
  userId: string
  orgId?: string
  projectId?: string

  // Methods
  hasMinRole(required: ERoleType): boolean
  isAdmin(): boolean
  isOwner(): boolean
  isSuperAdmin(): boolean
}
```

### Provider Model

```typescript
class Provider extends Base {
  name?: string
  orgId: string
  type: TProviderType          // 'ai' | 'git' | 'auth' | 'storage'
  brand: TProviderBrand        // TLLMProviderBrand | TGitBrand (e.g., 'anthropic', 'openai', 'github')
  options: Record<string, any> = {}
  headers?: Record<string, string>
  bodyParams?: Record<string, any>
  secretId?: string            // Link to associated secret
}
```

### Agent Model

```typescript
class Agent extends Base {
  name: string
  orgId: string
  model?: string              // LLM model ID (e.g., 'claude-sonnet-4-20250514')
  maxTokens?: number
  description?: string
  tools: string[] = []        // Tool names (EAgentTool values)
  systemPrompt?: string
  active: boolean = true
  secrets: Secret[] = []      // Populated secret objects
  projects: Project[] = []    // Populated project objects
  providers: Provider[] = []  // Populated provider objects (replaces single providerId)
  envVars: TAgentEnvVars = {}
  functions: FunctionModel[] = []  // Populated function objects
  environment: TAgentEnvironment = {}

  get primaryProvider(): Provider | undefined  // First provider in array
  sanitize(): Agent                            // Returns copy with sanitized secrets
}
```

### Thread Model

```typescript
class Thread extends Base {
  name?: string
  userId: string
  orgId?: string
  agentId?: string
  projectId?: string
  providerId?: string
  public: boolean = false
  parentThreadId?: string      // For thread branching
  branchMessageId?: string     // Message where branch occurred
  meta?: Record<string, any>
}
```

### Message Model

```typescript
class Message extends Base {
  type: TMsgType                // EMsgType: 'user' | 'tool' | 'system' | 'action' | 'assistant'
  content: TMessageContent[]    // Array of TTextContent | TToolUseContent | TToolResultContent
  threadId: string
  projectId?: string
  orgId?: string
  meta?: Record<string, any>
}
```

### Asset Model

```typescript
class Asset extends Base {
  url?: string
  content?: any
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
  domain: string          // e.g., 'api.example.com'
  orgId?: string          // Exclusive arc: orgId OR projectId
  projectId?: string
  verified: boolean = false
  verifiedAt?: string | Date
  sslEnabled: boolean = false
  sslPrivateKey?: string
  sslCertificate?: string
  sslExpiresAt?: string | Date
  certificates?: Certificate[] = []

  get certificate(): string | undefined  // First found certificate content
}
```

### Certificate Model

```typescript
class Certificate {
  _isModel?: boolean           // Test-only field
  parent: string               // Parent directory/path
  name: string
  isFile: boolean              // True for file, false for directory
  value: Buffer | null         // File content (null for directories)
  modified: string | Date
}
```

Note: Certificate does NOT extend Base.

### Invitation Model

```typescript
class Invitation extends Base {
  email: string
  orgId: string
  token: string
  userId?: string
  roleType: string
  invitedBy?: string
  revokedBy?: string
  revokedAt?: string | Date
  expiresAt: string | Date
  acceptedAt?: string | Date
  status: TInviteStatus | string   // 'pending' | 'accepted' | 'expired' | 'revoked'

  // Methods
  sanitize(): Invitation     // Returns copy without token
  isPending(): boolean
  isExpired(): boolean
  isAccepted(): boolean
  isRevoked(): boolean
  daysUntilExpiration(): number
}
```

### Quota Model

```typescript
class Quota extends Base {
  orgId: string
  period: string
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
  tier: string = ESubscriptionTier.free    // 'free' | 'basic' | 'developer' | 'pro'
  status: string = ESubscriptionStatus.active  // 'active' | 'canceled' | 'past_due' | 'incomplete'
  userId: string
  polarId?: string
  seats: number = 0
  polarPriceId?: string
  polarCustomerId?: string
  currentPeriodEnd?: string
  currentPeriodStart?: string
  cancelAtPeriodEnd?: boolean
}
```

### Plan Model

```typescript
class Plan {
  id: string
  name: string
  description?: string
  recurring?: { count?: number, active?: boolean, interval?: string }
  metadata: TPayPlanMeta

  constructor(opts: TPlanOpts) {
    // Auto-converts raw metadata to typed metadata via rawPlanToMeta()
  }
}
```

Note: Plan does NOT extend Base.

## Constants

### Provider Templates (`constants/providers.ts`)

```typescript
const ProviderTemplates: Record<ELLMProviderBrand, TProviderTemplate> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-20250514',
    defaultSecretName: 'ANTHROPIC_API_KEY',
    apiKeyPlaceholder: 'sk-ant-api03-...',
    apiKeyPattern: '^sk-ant-',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', maxTokens: 64000 },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', maxTokens: 32000 },
      { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', maxTokens: 8192 },
    ]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', maxTokens: 16384 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', maxTokens: 16384 },
      { id: 'o3-mini', name: 'o3 Mini', maxTokens: 100000 },
    ]
  },
  google: {
    id: 'google',
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', maxTokens: 8192 },
      { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', maxTokens: 8192 },
    ]
  },
  zai: {
    id: 'zai',
    name: 'Z.AI',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    defaultModel: 'glm-5',
    models: [
      { id: 'glm-5', name: 'GLM-5', maxTokens: 131072 },
      { id: 'glm-4.7', name: 'GLM-4.7', maxTokens: 131072 },
      { id: 'glm-4.6', name: 'GLM-4.6', maxTokens: 131072 },
      { id: 'glm-4.5', name: 'GLM-4.5', maxTokens: 131072 },
    ]
  },
  custom: {
    id: 'custom',
    name: 'Custom Provider',
    baseUrl: '',
    defaultModel: '',
    models: []
  }
}
```

### Values (`constants/values.ts`)

- `ApiKeyPrefix` - `tdsk_` prefix for API keys
- `AuthHeaders` - Auth header name constants (X-User-Id, X-User-Role, X-User-Email)
- `RoleHierarchy` - Role priority levels: `[viewer, member, admin, owner, super]`
- `PermissionMatrix` - Role-to-permission mapping for 17 resource types

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

// Base64 encoding of encrypted data (iv + authTag + encrypted)
encodeEncrypted(iv: Buffer, authTag: Buffer, encrypted: Buffer): string

// PostgreSQL bytea conversion
bufferToBytea(buffer: Buffer): string  // => "\\x..."
byteaToBuffer(byteaString: string): Buffer

// Truncated SHA-256 hash for secret name lookup (16 hex chars)
createHashKey(name: string): string

// SHA-256 hash for API key storage/validation
hashKey(key: string): string

// Generate a new API key with tdsk_ prefix, hash, and prefix
generateApiKey(): TKeyHash  // { key, hash, prefix }
```

**Environment Variables:**
- `TDSK_MASTER_KEY` (required) - Hex-encoded master key for encryption (minimum 64 hex characters / 32 bytes)

### Permissions (`utils/permissions/permissions.ts`)

**9 Permission Helper Functions:**

```typescript
// Get numeric role level (viewer=0, member=1, admin=2, owner=3, super=4)
getRoleLevel(role: ERoleType): number

// Check if user has minimum role level
hasMinRole(userRole: ERoleType, requiredRole: ERoleType): boolean

// Check if user can perform action on resource (main permission check)
canPerform(userRole: ERoleType, action: EPermAction, resource: EPermResource): TPermCheckResult

// Check if user can access secret values (requires admin+)
canAccessSecretValue(userRole: ERoleType): boolean

// Check if user is super admin
isSuperAdmin(userRole: ERoleType): boolean

// Get highest role from multiple role assignments
getHighestRole(roles: ERoleType[]): ERoleType

// Check if a role can manage another role (must be strictly higher level)
canManageRole(managerRole: ERoleType, targetRole: ERoleType): boolean

// Get all actions allowed for a role on a resource
getAllowedActions(userRole: ERoleType, resource: EPermResource): EPermAction[]

// Validate role type string
isValidRoleType(role: string): role is ERoleType
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
- `TApp<C, D, P, E, A, L>` allows custom config, db, payments, email, auth, and locals
- `TRequest<App, ReqParams, ResBody, ReqBody, ReqQuery, Locals>` for full type safety
- `Endpoint<T>` uses discriminated generics for type-specific options
- Model classes use `Partial<T>` in constructors for flexible initialization

### Exclusive Arc Pattern

Multiple models implement the exclusive arc pattern:
- `Provider`: `orgId` only (org-scoped)
- `Secret`: `orgId` XOR `agentId` XOR `projectId` XOR `providerId` (4-way arc)
- `Domain`: `orgId` XOR `projectId` (2-way arc)
- Database enforces this with constraints
- Matches the broader schema pattern used in `database` repo

### Export Strategy

- `src/index.ts` - Full exports (includes Node.js stdlib code: api, environment, services, crypto)
- `src/web.ts` - Web-safe exports (types, utils, models, constants, error)
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
type TRequest<
  App extends TApp = TApp,
  ReqParams extends Record<string, any> = Record<string, any>,
  ResBody = any,
  ReqBody = any,
  ReqQuery extends Record<string, any> = Record<string, any>,
  Locals extends Record<string, any> = Record<string, any>,
> = Omit<Request<ReqParams, ResBody, ReqBody, ReqQuery, Locals>, 'app'> & {
  app: App
  user?: User
}
```

### 2. Model Inheritance

All models extend `Base` for consistent timestamps:

```typescript
class Base {
  id: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

// All models get these fields automatically
class User extends Base { /* ... */ }
class Organization extends Base { /* ... */ }
```

### 3. Encryption Key Derivation

HKDF (HMAC-based Key Derivation Function) pattern:

```typescript
// Master key (hex) -> HKDF with user ID -> 32-byte derived key
const derivedKey = await deriveKey(userId)

// Each user gets unique encryption key
const encrypted = await encryptValue(derivedKey, secretValue)
```

### 4. API Key Hashing

SHA-256 hashing for API key storage:

```typescript
// Generate new API key
const { key, hash, prefix } = generateApiKey()
// key = "tdsk_abc123...", hash = SHA-256 hex, prefix = first 12 chars

// Validate key on auth
const inputHash = hashKey(req.headers.authorization)
const isValid = storedHash === inputHash
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
| `typescript` | 5.7.3 | TypeScript compiler |
| `vite-tsconfig-paths` | 4.3.2 | Vite tsconfig paths plugin |
| `vitest` | 1.6.1 | Testing framework |

## Commands

All commands use PNPM:

```bash
# Testing (Vitest)
pnpm test               # Run tests

# Type checking
pnpm types              # tsc --noEmit --pretty

# Cleanup
pnpm clean              # Remove node_modules
```

### Commands Notes

* Linting and formatting are automatic, so `pnpm lint` and `pnpm format` commands should be ignored.

## Integration Points

### Consumed By

**Backend (`@tdsk/backend`)**:
- Uses full `index.ts` exports
- Imports: types, models, api helpers, error handling, environment loading, permissions, crypto
- Extends: `TApp`, `TRequest`, `TResponse`
- Uses: `adminPath`, `authHeaders`, `Exception`, `loadEnvs`, `canPerform`, `hasMinRole`, `hashKey`, `generateApiKey`

**Proxy (`@tdsk/proxy`)**:
- Uses full `index.ts` exports
- Imports: types, models, api helpers, crypto utilities
- Uses: `checkAuthHeader`, `behindLBProxy`, `inKube`, `hashKey`, encryption utilities

**Admin (`@tdsk/admin`)**:
- Uses `web.ts` exports (web-safe only)
- Imports: types, models, error handling, constants
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
import { encryptValue, decryptValue, hashKey } from '@TDM/crypto'
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
7. **Hash API keys** - Use `hashKey()` for storage, never store plaintext keys
8. **Structured errors** - Use Exception class with status codes and details
9. **Path aliases** - Use @TDM/* imports for consistency across repos
10. **Permission checks** - Use `canPerform()` and `hasMinRole()` utilities
11. **Provider templates** - Use `ProviderTemplates` constant for quickstart flows

## Security Notes

### Master Key Management

- `TDSK_MASTER_KEY` must be at least 32 bytes (64 hex characters)
- Generate with: `openssl rand -hex 32`
- Store in `.env` files (never commit)
- Each user gets unique derived key via HKDF
- Keys are never logged or exposed in errors

### API Key Security

- API keys use `tdsk_` prefix for identification (`ApiKeyPrefix` constant)
- Full keys are SHA-256 hashed before storage via `hashKey()`
- Only prefix (first 12 chars) stored for display
- Validation compares hashes, not plaintext
- Keys have expiration and rate limits
- New keys generated via `generateApiKey()` which returns `{ key, hash, prefix }`

### Encryption Algorithm

- **AES-256-GCM** - Authenticated encryption
- **HKDF-SHA256** - Key derivation function
- **12-byte IV** - Initialization vector (randomly generated)
- **16-byte Auth Tag** - GCM authentication tag
- Protects against tampering and replay attacks

### Permission Enforcement

- All protected endpoints validate user roles
- Permission matrix enforces least privilege across 17 resource types
- Role hierarchy: viewer < member < admin < owner < super
- Project-specific roles override org roles

## Testing

**281 tests passing across 18 test files**

Tests use Vitest with config in `configs/vitest.config.ts`:

```bash
pnpm test               # Run all tests
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
