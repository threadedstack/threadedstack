---
name: "tdsk-domain"
description: "Knowledge base for the shared types, models, and utilities repo"
tags: ["typescript", "types", "models", "domain", "shared", "utilities", "payments", "ai", "quotas", "subscriptions"]
---
# Domain Repo Skill

## Overview

The `@tdsk/domain` repo (`repos/domain`) is the shared foundation for the Threaded Stack monorepo.

- **Type definitions** for Express APIs, auth, providers, AI/LLM configs, sandboxes, permissions, payments, and helpers
- **19 model classes** for core entities (all extend `Base` with `id`, `createdAt?`, `updatedAt?`)
- **Utility functions** for crypto (AES-256-GCM encryption, hashing, key derivation), permissions, time, async, data manipulation
- **API helpers** for Express routing, CORS, auth headers, and error handling via `Exception` class
- **Two export entry points**: `index.ts` (full, includes Node.js code) and `web.ts` (frontend-safe, excludes api/environment/services/crypto)

## Directory Structure

```
repos/domain/src/
├── api/           # Express utilities: adminPath, authHeaders, behindLBProxy, checkAuthHeader, inKube
├── constants/     # ProviderTemplates, ApiKeyPrefix, AuthHeaders, RoleHierarchy, PermissionMatrix, SandboxPresets, SandboxRuntimeConfigs
├── crypto/        # AES-256-GCM encryption/decryption, hashing, key generation
├── models/        # 19 domain model classes
├── types/         # 14 type definition files
├── utils/         # Permissions, payments, cleanSplit, isDomain, shortId, time
├── error/         # Exception class with HTTP status codes
├── environment/   # loadEnvs, addToProcess
├── parser/        # Terminal output parser (AST nodes, GUI types)
├── index.ts       # Full barrel export (Node.js)
└── web.ts         # Web-safe barrel export (frontend)
```

Import alias: `@TDM/*` (e.g., `import { User } from '@TDM/models'`)

## Type Definitions

Types are in `src/types/`. Key files and their exports:

### Enums

| Enum | File | Purpose |
|------|------|---------|
| `EMsgType` | ai.types.ts | user, tool, system, action, assistant |
| `EAgentTool` | ai.types.ts | mkdir, listDir, readFile, shellExec, webSearch, writeFile, deleteFile, fileExists |
| `ELLMProviderBrand` | ai.types.ts | zai, openai, google, custom, anthropic |
| `EEndpointType` | epd.types.ts | proxy, faas, agent |
| `ESandboxType` | sandbox.types.ts | local, kubernetes |
| `EContainerState` | sandbox.types.ts | Failed, Pending, Running, Unknown, Succeeded |
| `ESBState` | sandbox.types.ts | Error, Running, Stopped, Starting |
| `ESandboxRuntime` | sandbox.types.ts | claude-code, codex, opencode, gemini-cli, custom |
| `EApiKeyScope` | scopes.types.ts | read, write, admin |
| `EApiKeyExpire` | scopes.types.ts | d7, d30, d90, d180, y1, never |
| `EProvider` | provider.types.ts | ai, git, auth, storage |
| `EGitProvider` | git.types.ts | github, gitlab |
| `ERoleType` | permissions.types.ts | super, owner, admin, member, viewer |
| `EPermAction` | permissions.types.ts | create, read, update, delete, manage |
| `EPermResource` | permissions.types.ts | org, project, user, role, secret, apiKey, endpoint, provider, domain, function, agent, subscription, quota, invitation, thread, message, asset |
| `EPermScope` | permissions.types.ts | global, org, project |
| `EFunLanguage` | functions.types.ts | python, typescript, javascript |
| `ESubscriptionTier` | payments.types.ts | free, basic, developer, pro |
| `ESubscriptionStatus` | payments.types.ts | active, canceled, past_due, incomplete |
| `EInviteStatus` | invitation.types.ts | pending, accepted, expired, revoked |
| `EHttpMethod` | http.types.ts | GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD |

### Key Interfaces & Types

- **Express**: `TApp` (typed Express app with locals), `TRequest` (extended with `user`), `TResponse` (typed locals), `TRouter`, `TResLocals`
- **AI/LLM**: `TLLMAdapterConfig` (model, apiKey, provider, systemPrompt, temperature, maxTokens, headers, bodyParams), `ILLMAdapter` (provider, stream method), `TAIMessage` (role + TMessageContent[]), `TStreamEvent` (union: text, tool_call_start/args, tool_result, tool_execution_update, error, done), `TLLMToolDef` (name, description, inputSchema), `TAgentRunRequest`, `TAgentEnvironment`, `TAgentConfigFields`
- **Endpoint**: `TEndpointOpts<T>` (discriminated union: TProxyEndpointConfig, TFaaSEndpointConfig, TAgentEndpointConfig)
- **Sandbox**: `ISandbox` (reset, close, mkdir, readFile, deleteFile, listDir, fileExists, writeFile, exec, evaluate), `ISandboxProvider`, `TSandboxConfig`, `TKubeSandboxConfig` (image, args, gitRepo, workdir, sshEnabled, runtimes, initScript, etc.), `TSandboxSession`, `TSandboxConnectResponse`, `TContainerMeta`, `TRouteEntry`, `TRouteMapEntry`, `TSandboxRuntimeId`
- **Quickstart**: `TProviderTemplate` (id, name, baseUrl, models, defaultModel, apiKeyPattern), `TQuickstartRequest`, `TQuickstartResponse`
- **Scopes**: `TKeyHash` (key, hash, prefix)
- **Functions**: `TFunctionParam`, `TFunctionRequest`, `TFunctionContext`, `TFunctionResponse`, `TFunctionExecResult`
- **Helpers**: `TAnyCB`, `TValueOf<T>`, `TAnyObj`, `TKeyLike`

## Models

All extend `Base { id, createdAt?, updatedAt? }`. Key fields and methods for each:

- **User** -- first, last, name, email, image, banned, banReason, emailVerified, role, provider. Computed: `displayName`
- **Organization** -- name (required), ownerId (required), description
- **Project** -- name, orgId, gitUrl, description, branch (default 'main'), meta
- **ApiKey** -- key, name, orgId, userId, projectId, keyHash, scopes, active, keyPrefix, rateLimit, expiresAt, lastUsedAt. Methods: `hasScope()`, `isExpired()`, `isValid()`, `getRateLimit()`, `sanitize()`
- **Secret** -- name, value, description, hashKey, encryptedValue, orgId/agentId/projectId/providerId (exclusive arc). Methods: `sanitize()`
- **Endpoint** -- type, path, name, projectId, method, public, options, headers. Subclasses: ProxyEndpoint, FaaSEndpoint, AgentEndpoint
- **Function** -- name, content, projectId, endpointId, description, agentIds, branch, inputSchema, defaultArgs, dependencies, language
- **Role** -- name, type (ERoleType), userId, orgId, projectId. Methods: `hasMinRole()`, `isAdmin()`, `isOwner()`, `isSuperAdmin()`
- **Provider** -- name, orgId, type, brand, options, headers, bodyParams, secretId
- **Agent** -- name, orgId, model, maxTokens, description, tools, systemPrompt, active, secrets[], projects[], providers[], functions[], envVars, environment. Computed: `primaryProvider`. Methods: `sanitize()`
- **Thread** -- name, userId, orgId, agentId, projectId, providerId, public, parentThreadId, branchMessageId, meta
- **Message** -- type (TMsgType), content (TMessageContent[]), threadId, projectId, orgId, meta
- **Asset** -- name, type, url, content, orgId, userId, threadId, projectId, messageId, providerId, meta
- **Domain** -- domain, orgId/projectId (exclusive arc), verified, verifiedAt, sslEnabled, sslPrivateKey, sslCertificate, sslExpiresAt, certificates[]. Computed: `certificate`
- **Certificate** -- does NOT extend Base. Fields: parent, name, isFile, value, modified
- **Invitation** -- email, orgId, token, userId, invitedBy, revokedBy, roleType, status, expiresAt, acceptedAt, revokedAt. Methods: `sanitize()`, `isPending()`, `isExpired()`, `isAccepted()`, `isRevoked()`, `daysUntilExpiration()`
- **Quota** -- orgId, period, projects, members, endpoints, threads, messages, functionCalls, runtime, orgSecrets, projectSecrets, organizations, price, retention
- **Subscription** -- tier, status, userId, stripeCustomerId, stripeSubscriptionId, stripePriceId, seats, currentPeriodEnd, currentPeriodStart, cancelAtPeriodEnd
- **Sandbox** -- name, orgId, userId, projectId, config (TKubeSandboxConfig), builtIn
- **Plan** -- does NOT extend Base. Fields: id, name, description, recurring, metadata (auto-converted via `rawPlanToMeta()`)

## Constants

- **ProviderTemplates** (`constants/providers.ts`) -- `Record<ELLMProviderBrand, TProviderTemplate>` with model lists, base URLs, API key patterns for anthropic, openai, google, zai, custom
- **ApiKeyPrefix** -- `tdsk_`
- **AuthHeaders** -- `X-User-Id`, `X-User-Role`, `X-User-Email`
- **RoleHierarchy** -- `[viewer, member, admin, owner, super]`
- **PermissionMatrix** -- role-to-permission mapping for 17 resource types
- **SandboxRuntimeConfigs** -- `Record<TSandboxRuntimeId, { command, args, runtimeCommand }>` for each runtime
- **SandboxPresets** -- full seed configs per runtime, used by backend to seed 4 default sandboxes on org creation
- **SBImagePresets** -- image preset buttons: Claude Code, Codex, OpenCode

## Crypto Functions

All in `src/crypto/crypto.ts`. Requires `TDSK_MASTER_KEY` env (hex-encoded, min 64 hex chars).

- `deriveKey(ref_id)` -- HKDF-SHA256 key derivation from user ID + master key
- `encryptValue(derivedKey, plaintext)` -- AES-256-GCM encrypt (12-byte IV, 16-byte auth tag)
- `decryptValue(derivedKey, ciphertext, iv, authTag)` -- decrypt
- `encodeEncrypted(iv, authTag, encrypted)` -- base64 encode for storage
- `bufferToBytea(buffer)` / `byteaToBuffer(byteaString)` -- PostgreSQL bytea conversion
- `createHashKey(name)` -- truncated SHA-256 hash (16 hex chars) for secret name lookup
- `hashKey(key)` -- SHA-256 hash for API key storage/validation
- `generateApiKey()` -- generate new API key with `tdsk_` prefix, returns `{ key, hash, prefix }`

## Permissions Functions

All in `src/utils/permissions/permissions.ts`:

- `getRoleLevel(role)` -- viewer=0 through super=4
- `hasMinRole(userRole, requiredRole)` -- check minimum role level
- `canPerform(userRole, action, resource)` -- main permission check
- `canAccessSecretValue(userRole)` -- requires admin+
- `isSuperAdmin(userRole)`
- `getHighestRole(roles)`
- `canManageRole(managerRole, targetRole)` -- must be strictly higher
- `getAllowedActions(userRole, resource)`
- `isValidRoleType(role)`

## Other Utilities

- `shortId()` -- generate short unique ID
- `isDomain(domain)` -- validate domain name format
- `splitBy(str, sep)` / `cleanSplit(str, sep)` -- string splitting
- `timestamp()` -- `Date.now()`
- `nextFrame(callback)` -- schedule on next animation frame
- `throttleCBLast(callback, delay)` -- throttle with last call guarantee

## API Helpers

In `src/api/`: `adminPath(config)` (default `/_`), `setAuthHeaders(pxReq, req)`, `fromAuthHeaders(req)`, `checkAuthHeader(authHeader)` (extract Bearer token), `behindLBProxy()`, `inKube()`

## Error Handling

`Exception` extends `Error` with `status` (HTTP code), `code?`, `details?` (array), `__isAuthError?`. Static method: `Exception.throw(status, message, code?, details?)`.

## Integration Points

- **Backend** -- full `index.ts`: TApp, TRequest, adminPath, authHeaders, Exception, loadEnvs, canPerform, hashKey, generateApiKey
- **Proxy** -- full `index.ts`: checkAuthHeader, behindLBProxy, inKube, hashKey, encryption
- **Admin** -- `web.ts` only: Exception, model classes, ProviderTemplates, constants
- **Agent** -- full `index.ts`: TLLMAdapterConfig, ILLMAdapter, TStreamEvent, model classes
- **TSA** -- full `index.ts`: AI types, model classes
- **Sandbox** -- sandbox types: ISandbox, ISandboxProvider, TSandboxConfig, TKubeSandboxConfig, ESandboxRuntime, SandboxRuntimeConfigs, SandboxPresets
- **Database** -- model classes for ORM type definitions

## Build & Test

```bash
cd repos/domain
pnpm test     # Vitest
# No build script -- TypeScript source consumed directly via aliases
```
