---
name: "Threaded Stack - Domain Repo"
description: "Knowledge base for the shared types, models, and utilities repo"
version: "1.3.0"
tags: ["typescript", "types", "models", "domain", "shared", "utilities", "payments", "ai"]
---
# Domain Repo Skill

## Overview

The `@tdsk/domain` repo is the **shared foundation** for the Threaded Stack monorepo. It provides:

- **Type definitions** for Express APIs, authentication, providers, and helpers
- **Model classes** for core entities (Organization, Project, ApiKey, Secret, Endpoint, Function, Role, Provider, User)
- **Utility functions** for crypto, time, async handling, and data manipulation
- **API helpers** for Express router wrapping, CORS, auth headers, and error handling
- **Environment loading** utilities using `@keg-hub/parse-config`
- **Custom error handling** with the `Exception` class


This repo is consumed by `backend`, `proxy`, and `admin` repos as the single source of truth for shared logic.

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
│   ├── crypto/                 # Crypto utilities
│   │   ├── crypto.ts           # AES-256-GCM encryption/decryption (Node.js crypto)
│   │   ├── generateKey.ts.     # Key generation (Web Crypto API - browser/edge only)
│   │   └── index.ts
│   ├── models/           # Domain model classes
│   │   ├── base.ts             # Base class with id, createdAt, updatedAt
│   │   ├── user.ts             # User model with name parsing
│   │   ├── agent.ts            # Agent model
│   │   ├── apiKey.ts           # API key model
│   │   ├── asset.ts            # Asset model
│   │   ├── certificate.ts      # Certificate model
│   │   ├── config.ts           # Config model
│   │   ├── domain.ts           # Domain model
│   │   ├── endpoint.ts         # Endpoint model
│   │   ├── function.ts         # Function model
│   │   ├── invitation.ts       # Invitation model
│   │   ├── message.ts          # Message model
│   │   ├── organization.ts     # Organization model
│   │   ├── plan.ts             # Plan model for payment plans
│   │   ├── project.ts          # Project model
│   │   ├── provider.ts         # Provider model (ai/git/auth/storage)
│   │   ├── quota.ts            # Quota model
│   │   ├── role.ts             # Role model
│   │   ├── secret.ts           # Secret model
│   │   ├── subscription.ts     # Subscription model
│   │   └── thread.ts           # Thread model
│   ├── types/            # TypeScript type definitions
│   │   ├── ai.types.ts         # AI/LLM related types (TLLMAdapterConfig, TStreamEvent, etc.)
│   │   ├── endpoint.types.ts   # Express types: TApp, TRequest, TResponse, TRouter
│   │   ├── epd.types.ts        # Endpoint data types
│   │   ├── functions.types.ts  # Function/FaaS types
│   │   ├── headers.types.ts    # HTTP header types
│   │   ├── helpers.types.ts    # Generic helpers: TAnyCB, TValueOf, EStatus, EContainerState
│   │   ├── http.types.ts       # HTTP method/request types
│   │   ├── invitation.types.ts # Invitation types
│   │   ├── payments.types.ts   # Payment plan types
│   │   ├── permissions.types.ts # Permission enums and types
│   │   ├── provider.types.ts   # EProvider enum (ai/git/auth/storage)
│   │   ├── scopes.types.ts     # API scope types
│   │   └── server.types.ts     # Server configuration types
│   ├── utils/            # Utility functions
│   │   ├── payments/           # Payment utilities
│   │   │   ├── parsePayPlans.ts    # Parse payment plan configs
│   │   │   ├── rawPlanToMeta.ts    # Convert raw to typed metadata
│   │   │   └── index.ts
│   │   ├── permissions/        # Permission utilities (reorganized v1.2)
│   │   │   ├── permissions.ts
│   │   │   ├── permissions.test.ts
│   │   │   └── index.ts
│   │   ├── time.ts             # Timestamp utility
│   │   ├── shortId.ts          # Short ID generation
│   │   ├── cleanSplit.ts       # String splitting utilities (splitBy, cleanSplit)
│   │   ├── isDomain.ts         # Domain name validation
│   │   └── nextFrame.ts        # Animation frame utilities
│   ├── error/            # Error handling
│   │   ├── exception.ts        # Exception class with status codes
│   │   └── overrideErr.ts      # Error override utilities
│   ├── environment/      # Environment configuration
│   │   ├── loadEnvs.ts         # Load environment from deploy/values.*.yml
│   │   └── addToProcess.ts     # Add envs to process.env
│   ├── constants/        # Constants
│   │   └── values.ts          # AuthHeaders, RoleHierarchy, PermissionMatrix
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
| `src/models/base.ts` | Base model class with id, createdAt, updatedAt |
| `src/utils/crypto/crypto.ts` | AES-256-GCM encryption with HKDF key derivation |
| `src/api/authHeaders.ts` | Auth header extraction and forwarding utilities |
| `src/error/exception.ts` | Custom Exception class for structured error handling |
| `src/environment/loadEnvs.ts` | Environment loading from deploy/values.*.yml files |

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
  scopes: string[] = [] // Permission scopes (e.g., ['read:secrets', 'write:endpoints'])
  rateLimit?: number    // Requests per minute
  expiresAt?: string | Date
  lastUsedAt?: string | Date
}
```

### Secret Model

```typescript
class Secret extends Base {
  name: string
  value?: string        // Decrypted value (only when requested)
  orgId?: string        // Exclusive arc: org OR project OR provider
  projectId?: string
  providerId?: string
}
```

### Endpoint Model

```typescript
class Endpoint extends Base {
  projectId: string
  name: string
  proxyUrl?: string
  proxyMethod: string = 'GET'
  proxyHeaders: Record<string, string> = {}
  proxyOptions: Record<string, any> = {}
  public: boolean = false
}
```

### Function Model

```typescript
class Function extends Base {
  endpointId: string
  name: string
  code?: string
  runtime: string = 'typescript'
  configuration: Record<string, any> = {}
}
```

### Role Model

```typescript
class Role extends Base {
  userId: string
  orgId: string
  role: string = 'member'  // 'owner' | 'admin' | 'member' | 'viewer'
}
```

### Provider Model

```typescript
class Provider extends Base {
  orgId?: string        // Exclusive arc: org OR user OR project
  userId?: string
  projectId?: string
  type: TProviderType   // 'ai' | 'git' | 'auth' | 'storage'
  name: string
  options: Record<string, any> = {}
}
```

### Plan Model

```typescript
class Plan {
  id: string
  name: string
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

## Utilities

### Crypto (`utils/crypto.ts`)

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

// PostgreSQL bytea conversion
bufferToBytea(buffer: Buffer): string  // => "\\x..."
byteaToBuffer(byteaString: string): Buffer
```

**Environment Variables:**
- `TDSK_MASTER_KEY` (required) - Hex-encoded master key for encryption

### Time (`utils/time.ts`)

```typescript
timestamp(): number  // Date.now()
```

### Other Utilities

- `shortId(): string` - Generate short unique ID
- `nextFrame(callback: Function): void` - Schedule callback on next animation frame
- `throttleCBLast(callback: Function, delay: number): Function` - Throttle with last call guarantee

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
- `Provider`: `orgId` XOR `userId` XOR `projectId`
- `Secret`: `orgId` XOR `projectId` XOR `providerId`
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

### 4. Environment Cascading

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

* Linting and formatting are automatically, so `pnpm lint` and `pnpm format` commands should be ignored.

## Integration Points

### Consumed By

**Backend (`@tdsk/backend`)**:
- Uses full `index.ts` exports
- Imports: types, models, api helpers, error handling, environment loading
- Extends: `TApp`, `TRequest`, `TResponse`
- Uses: `adminPath`, `authHeaders`, `Exception`, `loadEnvs`

**Proxy (`@tdsk/proxy`)**:
- Uses full `index.ts` exports
- Imports: types, models, api helpers, crypto utilities
- Uses: `checkAuthHeader`, `behindLBProxy`, `inKube`, encryption utilities

**Admin (`@tdsk/admin`)**:
- Uses `web.ts` exports (web-safe only)
- Imports: types, models, error handling
- Uses: `Exception`, model classes for client-side state

**Database (`@tdsk/database`)**:
- Uses model classes for ORM type definitions
- Imports: `User`, `Organization`, `Project`, `Provider` models

### Path Aliases

All repos can import using these aliases:

```typescript
import { User, Organization } from '@TDM/models'
import { TRequest, TResponse } from '@TDM/types'
import { Exception } from '@TDM/error'
import { encryptValue, decryptValue } from '@TDM/utils/crypto'
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
7. **Structured errors** - Use Exception class with status codes and details
8. **Path aliases** - Use @TDM/* imports for consistency across repos

## Security Notes

### Master Key Management

- `TDSK_MASTER_KEY` must be 32 bytes (64 hex characters)
- Generate with: `openssl rand -hex 32`
- Store in `.env` files (never commit)
- Each user gets unique derived key via HKDF
- Keys are never logged or exposed in errors

### Encryption Algorithm

- **AES-256-GCM** - Authenticated encryption
- **HKDF-SHA256** - Key derivation function
- **12-byte IV** - Initialization vector (randomly generated)
- **16-byte Auth Tag** - GCM authentication tag
- Protects against tampering and replay attacks

## Testing

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

**Last Updated**: 2026-02-14
**Version**: 1.3.0

## Changelog

### v1.3.0 (2026-02-14)
- **Changed**: `apiKey` is now optional in `TLLMAdapterConfig` (`ai.types.ts` line 213)
- When using `ProxyAdapter` (session-based LLM proxy), no apiKey is passed from the client
- Server-side code that requires apiKey validates it before calling the LLM adapter

### v1.2.0 (2026-01-18)
- **New**: `Plan` model for payment plans with metadata conversion
- **New**: `payments.types.ts` - Payment plan types (TPayPlanRaw, TPayPlanMeta, TPayPlans)
- **New**: `utils/payments/` - Payment utilities (parsePayPlans, rawPlanToMeta)
- **Refactor**: Crypto utilities moved to `utils/crypto/` subdirectory
- **Refactor**: Permissions utilities moved to `utils/permissions/` subdirectory
- **New**: `rawPlanToMeta()` - Converts raw string metadata to typed numbers

### v1.1.0 (Previous)
- Base models and types
- Crypto utilities
- Express API helpers

## Future Enhancements

Based on empty placeholder modules:

- `services/` - Planned for shared service layer logic (currently empty)
