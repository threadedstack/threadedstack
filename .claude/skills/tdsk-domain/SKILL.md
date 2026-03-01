---
name: "tdsk-domain"
description: "Knowledge base for the shared types, models, and utilities repo"
tags: ["typescript", "types", "models", "domain", "shared", "utilities", "payments", "ai", "quotas", "subscriptions"]
---
# Domain Repo Skill

## Overview

The `@tdsk/domain` repo is the **shared foundation** for the Threaded Stack monorepo. It provides:

- **Type definitions** for Express APIs, authentication, providers, AI/LLM configs, sandboxes, and helpers
- **Model classes** for core entities (Organization, Project, ApiKey, Secret, Endpoint, Function, Role, Provider, User, Agent, Thread, Message, Asset, Domain, Certificate, Invitation, Quota, Subscription)
- **Utility functions** for crypto (encryption, hashing, key derivation), permissions, time, async handling, data manipulation
- **API helpers** for Express router wrapping, CORS, auth headers, and error handling
- **Custom error handling** with the `Exception` class
- **Constants** including provider templates for quickstart flows

This repo is consumed by `backend`, `proxy`, `admin`, `agent`, `repl`, and `sandbox` repos as the single source of truth for shared logic.

## Directory Structure

```
repos/domain/src/
+-- api/              # Express API utilities (adminPath, authHeaders, behindLBProxy, checkAuthHeader, inKube)
+-- constants/        # ProviderTemplates, ApiKeyPrefix, AuthHeaders, RoleHierarchy, PermissionMatrix
+-- crypto/           # AES-256-GCM encryption/decryption, hashKey, generateApiKey, createHashKey
+-- models/           # Domain model classes (19 models)
+-- types/            # TypeScript type definitions (14 type files)
+-- utils/            # Utility functions (permissions, payments, cleanSplit, isDomain, shortId, time)
+-- error/            # Exception class with status codes
+-- environment/      # loadEnvs, addToProcess
+-- index.ts          # Main export barrel (all modules)
+-- web.ts            # Web-safe exports (excludes Node.js-specific: api, environment, services, crypto)
```

## Type Definitions

### Express API Types (`types/endpoint.types.ts`)

- `TApp<C, D, P, E, A, L>` - Express app with typed locals (config, db, payments, email, auth)
- `TRequest<App, ReqParams, ResBody, ReqBody, ReqQuery, Locals>` - Extended Express request with `user` property
- `TResponse<ResBody, Locals>` - Extended Express response with typed locals
- `TRouter` - Type-safe Express router with all HTTP methods typed
- `TResLocals` - Response locals: `{ user?, subdomain? }`

### AI/LLM Types (`types/ai.types.ts`)

```typescript
enum EMsgType { user, tool, system, action, assistant }

enum EAgentTool { mkdir, listDir, readFile, shellExec, webSearch, writeFile, deleteFile, fileExists }

enum ELLMProviderBrand { zai, openai, google, custom, anthropic }
```

**TAgentRunRequest:**
```typescript
{ orgId, prompt, agentId, threadId?, projectId?, providerId?, overrides? }
```

**TLLMAdapterConfig:**
```typescript
{ model, apiKey?, maxTokens?, temperature?, systemPrompt?, provider: TLLMProviderBrand, options?, headers?, bodyParams? }
```

**ILLMAdapter Interface:**
```typescript
interface ILLMAdapter {
  readonly provider: TLLMProviderBrand
  stream(messages: TAIMessage[], tools: TLLMToolDef[], config: TLLMAdapterConfig): AsyncIterable<TStreamEvent>
}
```

- **TAIMessage**: `{ role: TMessageRole, content: TMessageContent[] }` — content is array of `TTextContent | TToolUseContent | TToolResultContent`
- **TStreamEvent**: Union of `text`, `tool_call_start`, `tool_call_args`, `tool_result`, `tool_execution_update`, `error`, `done` events
- **TLLMToolDef**: Tool definition with `name`, `description`, and `inputSchema` (JSON Schema format)

### Endpoint Data Types (`types/epd.types.ts`)

```typescript
enum EEndpointType { proxy, faas, agent }
```

**TEndpointOpts<T>** - Discriminated union based on endpoint type:
- `TProxyEndpointConfig`: `{ url, transform?, ...shared }`
- `TFaaSEndpointConfig`: `{ functionId, arguments?, envVars?, secrets?, memory?, ...shared }`
- `TAgentEndpointConfig`: `{ agentId, overrides?, ...shared }`
- Shared options: `timeout`, `pathRegex`, `oauth`, `auth`, `headers`, `retries`, `domainWhitelist`

### Quickstart Types (`types/quickstart.types.ts`)

| Type | Fields |
|------|--------|
| `TProviderModel` | `id, name, maxTokens, description?` |
| `TProviderTemplate` | `id: TLLMProviderBrand, name, baseUrl, defaultModel, defaultSecretName, apiKeyPlaceholder, apiKeyPattern?, models: TProviderModel[]` |
| `TQuickstartRequest` | `apiKey, projectName, agentName, agentDescription?, model?, maxTokens?, systemPrompt?, providerUrl?, providerName?, providerBrand: TLLMProviderBrand` |
| `TQuickstartResponse` | `provider, secret, project, agent, endpoint` (all `Record<string, any>`) |

### Sandbox Types (`types/sandbox.types.ts`)

```typescript
enum ESandboxProvider { e2b, local }
```

| Interface | Methods/Fields |
|-----------|---------------|
| `ISandbox` | `exec(command, args?)`, `readFile(path)`, `writeFile(path, content)`, `listDir(path)`, `deleteFile(path)`, `mkdir(path)`, `fileExists(path)`, `close()` |
| `ISandboxProvider` | `readonly type`, `create(config): Promise<ISandbox>` |
| `TSandboxConfig` | `provider, apiKey?, template?, timeout?, envVars?, options?` |

### Scopes Types (`types/scopes.types.ts`)

```typescript
enum EApiKeyScope { read, write, admin }
enum EApiKeyExpire { d7 = 7, d30 = 30, d90 = 90, d180 = 180, y1 = 365, never = 'none' }
type TKeyHash = { key: string, hash: string, prefix: string }
```

### Provider Types (`types/provider.types.ts`)

```typescript
enum EProvider { ai, git, auth, storage }
type TProviderBrand = TLLMProviderBrand | TGitBrand
```

### Git Types (`types/git.types.ts`)

```typescript
enum EGitProvider { github, gitlab }
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

### Functions Types (`types/functions.types.ts`)

```typescript
enum EFunLanguage { python, typescript, javascript }

type TFunctionParam = { name, default?, required?, type: TFunParamType, description? }
type TFunctionRequest = { path?, body?, method?, query?, headers? }
type TFunctionContext = { args?, envVars?, secrets? }
type TFunctionResponse = { body?, statusCode?, headers? }
type TFunctionExecResult = { error?, output, duration, success }
```

### Payment Types (`types/payments.types.ts`)

```typescript
enum ESubscriptionTier { free, basic, developer, pro }
enum ESubscriptionStatus { active, canceled, past_due, incomplete }
```

### Invitation Types (`types/invitation.types.ts`)

```typescript
enum EInviteStatus { pending, accepted, expired, revoked }
```

### HTTP Types (`types/http.types.ts`)

```typescript
enum EHttpMethod { GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD }
```

### Helper Types (`types/helpers.types.ts`)

- `TAnyCB` - Generic callback type
- `TValueOf<T>` - Extract value types from object
- `TAnyObj` - `Record<string, any>`
- `TKeyLike` - `string | number | symbol`

## Models

All models extend `Base` class: `{ id: string, createdAt?: string|Date, updatedAt?: string|Date }`.

### User

| Field | Type | Notes |
|-------|------|-------|
| `first`, `last`, `name` | `string?` | Constructor auto-parses `name` into `first`/`last` |
| `email` | `string?` | |
| `image` | `string?` | |
| `banned` | `boolean?` | |
| `provider` | `string?` | Runtime-only, from auth provider, not persisted |
| `banReason` | `string?` | |
| `emailVerified` | `boolean?` | |
| `role` | `TRoleType?` | |
| `banExpires` | `string\|Date?` | |
| **Computed** | `displayName` | From name or first+last |

### Organization

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string` | Required |
| `ownerId` | `string` | Required |
| `description` | `string?` | |

### Project

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string` | Required |
| `orgId` | `string` | Required |
| `gitUrl` | `string?` | |
| `description` | `string?` | |
| `branch` | `string` | Default: `'main'` |
| `meta` | `Record<string, any>` | Default: `{}` |

### ApiKey

| Field | Type | Notes |
|-------|------|-------|
| `key` | `string?` | Only returned on creation (hashed in DB) |
| `name` | `string` | Required |
| `orgId`, `userId`, `projectId` | `string?` | |
| `keyHash` | `string` | SHA-256 hash of full key |
| `scopes` | `string?` | Comma-separated (e.g., `'read,write,admin'`) |
| `active` | `boolean` | |
| `keyPrefix` | `string` | First 12 chars (e.g., `'tdsk_abc12345'`) |
| `rateLimit` | `number?` | |
| `expiresAt`, `lastUsedAt` | `Date\|string?` | |
| **Methods** | `hasScope(scope)`, `isExpired()`, `isValid()`, `getRateLimit()`, `sanitize()` | sanitize removes key+keyHash |

### Secret

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string` | Required |
| `value` | `string?` | Decrypted value (only when requested) |
| `description` | `string?` | |
| `hashKey` | `string` | Truncated SHA-256 hash of name for lookup |
| `encryptedValue` | `string` | Base64-encoded encrypted value |
| `orgId`, `agentId`, `projectId`, `providerId` | `string?` | **Exclusive arc**: exactly one must be set |
| **Methods** | `sanitize()` | Removes value + encryptedValue |

### Endpoint

| Field | Type | Notes |
|-------|------|-------|
| `type` | `T extends TEndpointType` | `'proxy' \| 'faas' \| 'agent'` |
| `path` | `string` | Required |
| `name` | `string?` | |
| `projectId` | `string` | Required |
| `method` | `string` | Default: `'GET'` |
| `public` | `boolean?` | Default: `false` |
| `options` | `TEndpointOpts<T>?` | Typed by endpoint type |
| `headers` | `Record<string, string>?` | |
| **Subclasses** | `ProxyEndpoint`, `FaaSEndpoint`, `AgentEndpoint` | |

### Function

| Field | Type | Notes |
|-------|------|-------|
| `name`, `content` | `string` | Required |
| `projectId` | `string` | Required |
| `endpointId` | `string?` | |
| `description` | `string?` | |
| `agentIds` | `string[]?` | Agents that can use this function |
| `branch` | `string` | Default: `'main'` |
| `inputSchema` | `TFunctionParam[]?` | |
| `defaultArgs`, `dependencies` | `Record<string, any>?` | |
| `language` | `string` | Default: `EFunLanguage.typescript` |

### Role

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string?` | |
| `type` | `ERoleType` | Not string — uses enum |
| `userId` | `string` | Required |
| `orgId`, `projectId` | `string?` | |
| **Methods** | `hasMinRole(required)`, `isAdmin()`, `isOwner()`, `isSuperAdmin()` | |

### Provider

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string?` | |
| `orgId` | `string` | Required |
| `type` | `TProviderType` | `'ai' \| 'git' \| 'auth' \| 'storage'` |
| `brand` | `TProviderBrand` | e.g., `'anthropic'`, `'openai'`, `'github'` |
| `options` | `Record<string, any>` | Default: `{}` |
| `headers`, `bodyParams` | `Record<string, string\|any>?` | |
| `secretId` | `string?` | Link to associated secret |

### Agent

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string` | Required |
| `orgId` | `string` | Required |
| `model` | `string?` | LLM model ID (e.g., `'claude-sonnet-4-20250514'`) |
| `maxTokens` | `number?` | |
| `description` | `string?` | |
| `tools` | `string[]` | EAgentTool values. Default: `[]` |
| `systemPrompt` | `string?` | |
| `active` | `boolean` | Default: `true` |
| `secrets` | `Secret[]` | Populated objects. Default: `[]` |
| `projects` | `Project[]` | Populated objects. Default: `[]` |
| `providers` | `Provider[]` | Populated objects (replaces single providerId). Default: `[]` |
| `functions` | `FunctionModel[]` | Populated objects. Default: `[]` |
| `envVars` | `TAgentEnvVars` | Default: `{}` |
| `environment` | `TAgentEnvironment` | Default: `{}` |
| **Computed** | `primaryProvider` | First provider in array |
| **Methods** | `sanitize()` | Returns copy with sanitized secrets |

### Thread

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string?` | |
| `userId` | `string` | Required |
| `orgId`, `agentId`, `projectId`, `providerId` | `string?` | |
| `public` | `boolean` | Default: `false` |
| `parentThreadId` | `string?` | For thread branching |
| `branchMessageId` | `string?` | Message where branch occurred |
| `meta` | `Record<string, any>?` | |

### Message

| Field | Type | Notes |
|-------|------|-------|
| `type` | `TMsgType` | `'user' \| 'tool' \| 'system' \| 'action' \| 'assistant'` |
| `content` | `TMessageContent[]` | Array of text/tool-use/tool-result content |
| `threadId` | `string` | Required |
| `projectId`, `orgId` | `string?` | |
| `meta` | `Record<string, any>?` | |

### Asset

| Field | Type | Notes |
|-------|------|-------|
| `name`, `type` | `string` | Required. type = MIME or custom |
| `url` | `string?` | |
| `content` | `any?` | |
| `orgId`, `userId`, `threadId`, `projectId`, `messageId`, `providerId` | `string?` | |
| `meta` | `Record<string, any>` | Default: `{}` |

### Domain

| Field | Type | Notes |
|-------|------|-------|
| `domain` | `string` | Required (e.g., `'api.example.com'`) |
| `orgId`, `projectId` | `string?` | **Exclusive arc**: orgId XOR projectId |
| `verified` | `boolean` | Default: `false` |
| `verifiedAt` | `string\|Date?` | |
| `sslEnabled` | `boolean` | Default: `false` |
| `sslPrivateKey`, `sslCertificate` | `string?` | |
| `sslExpiresAt` | `string\|Date?` | |
| `certificates` | `Certificate[]?` | Default: `[]` |
| **Computed** | `certificate` | First found certificate content |

### Certificate

Does NOT extend Base. Fields: `parent, name, isFile, value: Buffer|null, modified`.

### Invitation

| Field | Type | Notes |
|-------|------|-------|
| `email`, `orgId`, `token` | `string` | Required |
| `userId`, `invitedBy`, `revokedBy` | `string?` | |
| `roleType` | `string` | |
| `status` | `TInviteStatus` | `'pending' \| 'accepted' \| 'expired' \| 'revoked'` |
| `expiresAt` | `string\|Date` | Required |
| `acceptedAt`, `revokedAt` | `string\|Date?` | |
| **Methods** | `sanitize()` (removes token), `isPending()`, `isExpired()`, `isAccepted()`, `isRevoked()`, `daysUntilExpiration()` | |

### Quota

| Field | Type | Notes |
|-------|------|-------|
| `orgId`, `period` | `string` | Required |
| `projects`, `members`, `endpoints`, `threads`, `messages`, `functionCalls` | `number` | Default: `0` |
| `runtime` | `number` | Seconds of FaaS runtime. Default: `0` |
| `orgSecrets`, `projectSecrets`, `organizations` | `number` | Default: `0` |
| `price` | `number` | Total spend in cents. Default: `0` |
| `retention` | `number` | Data retention days. Default: `0` |

### Subscription

| Field | Type | Notes |
|-------|------|-------|
| `tier` | `string` | Default: `ESubscriptionTier.free` (`'free' \| 'basic' \| 'developer' \| 'pro'`) |
| `status` | `string` | Default: `ESubscriptionStatus.active` (`'active' \| 'canceled' \| 'past_due' \| 'incomplete'`) |
| `userId` | `string` | Required |
| `polarId`, `polarPriceId`, `polarCustomerId` | `string?` | Polar.sh integration |
| `seats` | `number` | Default: `0` |
| `currentPeriodEnd`, `currentPeriodStart` | `string?` | |
| `cancelAtPeriodEnd` | `boolean?` | |

### Plan

Does NOT extend Base. Fields: `id, name, description?, recurring?: { count?, active?, interval? }, metadata: TPayPlanMeta`. Constructor auto-converts raw metadata via `rawPlanToMeta()`.

## Constants

### Provider Templates (`constants/providers.ts`)

`ProviderTemplates: Record<ELLMProviderBrand, TProviderTemplate>` — contains pre-configured templates for `anthropic`, `openai`, `google`, `zai`, and `custom` providers with model lists, base URLs, default models, and API key patterns. See `src/constants/providers.ts` for current values (model IDs and URLs change frequently).

### Values (`constants/values.ts`)

- `ApiKeyPrefix` - `tdsk_` prefix for API keys
- `AuthHeaders` - Auth header name constants (`X-User-Id`, `X-User-Role`, `X-User-Email`)
- `RoleHierarchy` - Role priority levels: `[viewer, member, admin, owner, super]`
- `PermissionMatrix` - Role-to-permission mapping for 17 resource types

## Utilities

### Crypto (`crypto/crypto.ts`)

```typescript
// Key derivation from user ID + master key (HKDF-SHA256)
deriveKey(ref_id: string): Promise<Buffer>

// Encrypt plaintext with derived key (AES-256-GCM, 12-byte IV, 16-byte auth tag)
encryptValue(derivedKey: Buffer, plaintextValue: string): Promise<TEncryptVal>
// Returns: { iv: Buffer, encrypted: Buffer, authTag: Buffer }

// Decrypt ciphertext
decryptValue(derivedKey: Buffer, ciphertext: Buffer, iv: Buffer, authTag: Buffer): Promise<string>

// Base64 encoding of encrypted data (iv + authTag + encrypted)
encodeEncrypted(iv: Buffer, authTag: Buffer, encrypted: Buffer): string

// PostgreSQL bytea conversion
bufferToBytea(buffer: Buffer): string   // => "\\x..."
byteaToBuffer(byteaString: string): Buffer

// Truncated SHA-256 hash for secret name lookup (16 hex chars)
createHashKey(name: string): string

// SHA-256 hash for API key storage/validation
hashKey(key: string): string

// Generate a new API key with tdsk_ prefix, hash, and prefix
generateApiKey(): TKeyHash  // { key, hash, prefix }
```

**Required env**: `TDSK_MASTER_KEY` — hex-encoded master key (minimum 64 hex chars / 32 bytes)

### Permissions (`utils/permissions/permissions.ts`)

```typescript
getRoleLevel(role: ERoleType): number           // viewer=0, member=1, admin=2, owner=3, super=4
hasMinRole(userRole, requiredRole): boolean      // Check minimum role level
canPerform(userRole, action, resource): TPermCheckResult  // Main permission check
canAccessSecretValue(userRole): boolean          // Requires admin+
isSuperAdmin(userRole): boolean
getHighestRole(roles: ERoleType[]): ERoleType
canManageRole(managerRole, targetRole): boolean  // Must be strictly higher
getAllowedActions(userRole, resource): EPermAction[]
isValidRoleType(role: string): role is ERoleType
```

### Other Utilities

- `shortId(): string` - Generate short unique ID
- `isDomain(domain: string): boolean` - Validate domain name format
- `splitBy(str, sep): string[]` / `cleanSplit(str, sep): string[]` - String splitting
- `timestamp(): number` - `Date.now()`
- `nextFrame(callback): void` - Schedule on next animation frame
- `throttleCBLast(callback, delay): Function` - Throttle with last call guarantee

## API Helpers

```typescript
// Admin route prefix (default: "/_")
adminPath(config: { adminPath?: string }): string

// Forward auth headers from request to proxy request
setAuthHeaders(pxReq: TClientReq, req: Record<string, any>): void

// Extract auth header values from incoming request
fromAuthHeaders(req: TReq): Partial<TAuthHeaderObj>

// Extract Bearer token from Authorization header
checkAuthHeader(authHeader?: string): { access_token: string | undefined }

// Returns true if behind load balancer (TDSK_WITH_LB_PROXY env set)
behindLBProxy(): boolean

// Returns true if running inside Kubernetes
inKube(): boolean
```

## Error Handling

```typescript
class Exception extends Error {
  status: number         // HTTP status code
  code?: string          // Error code
  details?: TErrDetails  // Array of error details
  __isAuthError?: boolean

  static throw(status, message, code?, details?, stack?): never
}

// Usage:
Exception.throw(400, 'Invalid input', 'INVALID_INPUT', ['Missing field: email'])
```

## Architecture

### Exclusive Arc Pattern

Multiple models implement the exclusive arc pattern:
- `Secret`: `orgId` XOR `agentId` XOR `projectId` XOR `providerId` (4-way arc)
- `Domain`: `orgId` XOR `projectId` (2-way arc)
- `Provider`: `orgId` only (org-scoped)
- Database enforces this with constraints (matches `database` repo schema)

### Export Strategy

- `src/index.ts` - Full exports (includes Node.js code: api, environment, services, crypto)
- `src/web.ts` - Web-safe exports (types, utils, models, constants, error) — **use this for frontend/admin**

### Import Aliases

All repos can import via `@TDM/*`:
```typescript
import { User, Organization } from '@TDM/models'
import { TRequest, TResponse } from '@TDM/types'
import { Exception } from '@TDM/error'
import { encryptValue, decryptValue, hashKey } from '@TDM/crypto'
import { canPerform, hasMinRole } from '@TDM/utils/permissions'
import { ProviderTemplates } from '@TDM/constants'
```

## Integration Points

| Consumer | Import | Key Usage |
|----------|--------|-----------|
| **Backend** | Full `index.ts` | `TApp`, `TRequest`, `adminPath`, `authHeaders`, `Exception`, `loadEnvs`, `canPerform`, `hashKey`, `generateApiKey` |
| **Proxy** | Full `index.ts` | `checkAuthHeader`, `behindLBProxy`, `inKube`, `hashKey`, encryption |
| **Admin** | `web.ts` only | `Exception`, model classes, `ProviderTemplates`, constants |
| **Database** | Model classes | All model classes for ORM type definitions |
| **Agent** | Full `index.ts` | `TLLMAdapterConfig`, `ILLMAdapter`, `TStreamEvent`, `Agent`, `Thread`, `Message` |
| **REPL** | Full `index.ts` | AI types, `Agent`, `Thread`, `Message`, `User` |
| **Sandbox** | Sandbox types | `ISandbox`, `ISandboxProvider`, `ESandboxProvider`, `TSandboxConfig` |
