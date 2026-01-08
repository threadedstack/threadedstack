# TASK-4.3.1 Research Report: Implement `GET /_/users` - List Users

**Date**: 2026-01-07
**Worker Agent**: Implementation Agent
**Status**: Research Complete - Ready for Implementation

---

## 1. Endpoint Pattern Summary

### Structure
Endpoints in the backend follow a configuration-driven pattern where each endpoint is defined as a `TEndpointConfig` object:

```typescript
export const endpointName: TEndpointConfig = {
  path: `/endpoint-path`,
  method: EPMethod.Get,  // or Post, Put, Patch, Delete, Use, All
  action: async (req: Request, res: Response): Promise<void> => {
    // Handler implementation
  }
}
```

### Key Characteristics
- **Static Configuration**: Endpoints are defined declaratively, not imperatively
- **Async Handlers**: All handlers are async functions automatically wrapped with `express-async-handler`
- **Type Safety**: Full TypeScript typing with `TEndpointConfig` interface
- **Auto-Registration**: Endpoints are dynamically registered via `setupEndpoints` middleware
- **Nested Routing**: Endpoints can have nested endpoints via the `endpoints` property

### Existing Examples
1. **Base Endpoint** (`/repos/backend/src/endpoints/base/base.ts`):
   ```typescript
   export const base: TEndpointConfig = {
     path: `/`,
     method: EPMethod.Get,
     action: async (req: Request, res: Response): Promise<void> => {
       res.status(200).json({ message: `Backend Base Endpoint!` })
     },
   }
   ```

2. **Health Endpoint** (`/repos/backend/src/endpoints/base/health.ts`):
   ```typescript
   export const health: TEndpointConfig = {
     path: `/health`,
     method: EPMethod.Get,
     action: async (req: Request, res: Response): Promise<void> => {
       res.status(200).json({ message: `Backend Server is Running!` })
     },
   }
   ```

3. **Nested Endpoint** (`/repos/backend/src/endpoints/accounts.ts`):
   ```typescript
   export const accounts: TEndpointBuilder = (config) => {
     return {
       method: EPMethod.Use,
       path: adminPath(config),  // e.g., /_
       middleware: [express.json(), authenticate],
       endpoints: {
         auth,
         base,
         health,
       },
     }
   }
   ```

---

## 2. Type Definitions

### Core Types Used

#### `TEndpointConfig`
Located in `/repos/backend/src/types/endpoints.types.ts`:

```typescript
export type TEndpointConfig = {
  path: string                        // Route path (e.g., '/users')
  public?: boolean                    // If true, bypasses authentication
  proxy?: TConfigProxy                // Proxy configuration (optional)
  originHeader?: boolean              // Add origin header (optional)
  action?: TEndpointMethod            // Handler function
  endpoints?: TEndpointsConfig        // Nested endpoints (for EPMethod.Use)
  middleware?: TRequestHandler[]      // Middleware array
  method: keyof Pick<typeof router, 'get' | 'put' | 'post' | 'patch' | 'delete' | 'all' | 'use'> | EPMethod
}
```

#### `EPMethod` Enum
Standard HTTP methods:
```typescript
export enum EPMethod {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  PATCH = 'patch',
  DELETE = 'delete',
  ALL = 'all',
  USE = 'use',  // For nested routers
}
```

#### `TEndpointMethod`
Handler function signature:
```typescript
export type TEndpointMethod = (req?: Request, res?: Response, next?: NextFunction) => void
```

#### `TEndpointBuilder`
Builder function for dynamic endpoints:
```typescript
export type TEndpointBuilder = (config: TABConfig) => TEndpointConfig
```

---

## 3. Database Access Pattern

### Database Structure
The database is initialized in `setupServer` middleware and stored on `app.locals.db`:

```typescript
// From src/middleware/setupServer.ts
export const setupServer = (app: TApp, router: Router) => {
  app.locals.db = database(app.locals.config.database)
  // ...
}
```

### Database Type
```typescript
// From repos/database/src/types/db.types.ts
export type TDatabase = NodePgDatabase & {
  services: TDBServices
}

export type TDBServices = {
  user: User,
  team: Team,
  role: Role,
  repo: Repo,
  asset: Asset,
  config: Config,
  thread: Thread,
  message: Message,
  endpoint: Endpoint,
  function: Function,
  provider: Provider,
  secret: Secret,
  base: Base
}
```

### Accessing Database in Endpoints
```typescript
// Access database instance
const db = req.app.locals.db

// Access user service
const userService = db.services.user

// Call service methods
const result = await userService.list()
```

### User Service Interface
Located in `/repos/database/src/services/user.ts`:

```typescript
export class User extends Base<typeof users, TDBUserSelect, TDBUserInsert> {
  constructor(opts: TUserOpts) {
    super({ ...opts, schema: users })
  }
}
```

Inherits from `Base` class which provides:
- `list(opts?: TDBSelectOpts): Promise<TDBApiRes<S[]>>` - List all records
- `get(id: string, opts?: TDBSelectOpts): Promise<TDBApiRes<S>>` - Get by ID
- `create(data: I, opts?: TDBSelectOpts): Promise<TDBApiRes<S>>` - Create record
- `update(data: I, opts?: TDBSelectOpts): Promise<TDBApiRes<S>>` - Update record
- `upsert(data: I, opts?: TDBSelectOpts): Promise<TDBApiRes<S>>` - Upsert record
- `delete(id: string, opts?: TDBSelectOpts): Promise<TDBApiRes<S>>` - Delete record

### Database Response Format
All database methods return `TDBApiRes<T>`:

```typescript
type TDBApiRes<T> = {
  data?: T     // Successful result
  error?: any  // Error object if failed
}
```

---

## 4. Response Format

### Success Response
```typescript
res.status(200).json({ data: result })
```

### Error Response
Errors are handled by the global error handler. The pattern is:
1. Throw an `Exception` with status code and message
2. Global error handler catches and formats as:
```typescript
res.status(status).json({
  status,
  message,
  errorCode
})
```

### Response Examples

**Success**:
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "first": "John",
      "last": "Doe",
      "displayName": "John Doe",
      "provider": "github",
      "photoUrl": "https://...",
      "altEmail": null,
      "createdAt": "2026-01-07T...",
      "updatedAt": "2026-01-07T..."
    }
  ]
}
```

**Error**:
```json
{
  "status": 500,
  "message": "Failed to retrieve users",
  "errorCode": "DATABASE_ERROR"
}
```

---

## 5. Error Handling Pattern

### Exception Class
Located in `/repos/backend/src/utils/errors/exception.ts`:

```typescript
throw new Exception(statusCode, message, errorCode)
```

### Async Error Handling
All route handlers are automatically wrapped with `express-async-handler`, so:
- Thrown errors are automatically caught
- No need for explicit try/catch in handlers
- Errors propagate to global error handler

### Pattern in Endpoint
```typescript
action: async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db
  const result = await db.services.user.list()

  // Check for database error
  if (result.error) {
    throw new Exception(500, 'Failed to retrieve users', 'DATABASE_ERROR')
  }

  // Success response
  res.status(200).json({ data: result.data })
}
```

---

## 6. Registration Pattern

### Registration Flow
1. Define endpoint in its own file (e.g., `users.ts`)
2. Export endpoint configuration
3. Import endpoint in parent endpoint file
4. Add to `endpoints` object

### Example Registration

**Step 1**: Create endpoint file:
```typescript
// repos/backend/src/endpoints/users.ts
export const users: TEndpointConfig = {
  path: `/users`,
  method: EPMethod.Get,
  action: async (req, res) => { /* ... */ }
}
```

**Step 2**: Register in accounts endpoint:
```typescript
// repos/backend/src/endpoints/accounts.ts
import { users } from './users'

export const accounts: TEndpointBuilder = (config) => {
  return {
    method: EPMethod.Use,
    path: adminPath(config),  // /_
    middleware: [express.json(), authenticate],
    endpoints: {
      auth,
      base,
      health,
      teams,
      users, // Add endpoints
    },
  }
}
```

### URL Structure
With this registration:
- Admin path: `/_` (from `TDSK_BE_API_ADMIN_PATH`)
- Users path: `/users`
- **Final URL**: `GET /_/users`

---

## 7. User Schema Structure

From `/repos/database/src/schemas/users.ts`:

```typescript
export const users = pgTable(
  'users',
  {
    ...base,  // id, createdAt, updatedAt
    first: varchar({ length: 255 }).notNull(),
    last: varchar({ length: 255 }).notNull(),
    photoUrl: varchar({ length: 255 }),
    provider: varchar({ length: 255 }).notNull(),
    altEmail: varchar('alt_email', { length: 255 }),
    email: varchar('email', { length: 255 }).notNull().unique(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
  }
)
```

**Fields**:
- `id`: UUID (from base)
- `email`: Unique email address (required)
- `first`: First name (required)
- `last`: Last name (required)
- `displayName`: Display name (required)
- `provider`: Auth provider (required)
- `photoUrl`: Profile photo URL (optional)
- `altEmail`: Alternative email (optional)
- `createdAt`: Timestamp (from base)
- `updatedAt`: Timestamp (from base)

---

## 8. Implementation Plan for TASK-4.3.1

### File Structure

#### New Files to Create
1. `/repos/backend/src/endpoints/users/users.ts` - Users endpoint implementation
2. `/repos/backend/src/endpoints/users/index.ts` - API exports
3. `/repos/backend/src/endpoints/users/users.test.ts` - Unit tests

#### Files to Modify
1. `/repos/backend/src/endpoints/accounts.ts` - Add API endpoint to registration

### Implementation Code

#### 1. Users Endpoint (`/repos/backend/src/endpoints/users/users.ts`)

```typescript
import type { TEndpointConfig } from '@TBE/types'
import type { Request, Response } from 'express'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'

export const users: TEndpointConfig = {
  path: `/users`,
  method: EPMethod.Get,
  action: async (req: Request, res: Response): Promise<void> => {
    const db = req.app.locals.db
    const result = await db.services.user.list()

    if (result.error) {
      throw new Exception(500, 'Failed to retrieve users', 'DATABASE_ERROR')
    }

    res.status(200).json({ data: result.data })
  },
}
```

#### 2. Users API Exports (`/repos/backend/src/endpoints/users/index.ts`)

```typescript
export { users } from './users'
```

#### 4. Update Accounts Registration (`/repos/backend/src/endpoints/accounts.ts`)

```typescript
import type { TEndpointBuilder } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { users } from '@TBE/endpoints/users/users'  // Add import
import { base } from '@TBE/endpoints/base/base'
import { auth } from '@TBE/endpoints/auth/auth'
import { health } from '@TBE/endpoints/base/health'
import { adminPath } from '@TBE/utils/auth/adminPath'
import { authenticate } from '@TBE/middleware/setupAuth'

export const accounts: TEndpointBuilder = (config) => {
  return {
    method: EPMethod.Use,
    path: adminPath(config),
    middleware: [express.json(), authenticate],
    endpoints: {
      auth,
      base,
      health,
      users,  // Add Users endpoints
    },
  }
}
```

---

## 9. Test Plan

### Test File Location
`/repos/backend/src/endpoints/users/users.test.ts`

### Test Cases

#### 1. **Success Case: List Users**
- **Description**: Should return list of users when database call succeeds
- **Setup**: Mock database service to return successful response with user data
- **Expected**: 200 status code with `{ data: [users] }` response

#### 2. **Error Case: Database Error**
- **Description**: Should throw exception when database call fails
- **Setup**: Mock database service to return error response
- **Expected**: Exception thrown with status 500 and error code 'DATABASE_ERROR'

#### 3. **Empty List Case: No Users**
- **Description**: Should return empty array when no users exist
- **Setup**: Mock database service to return empty array
- **Expected**: 200 status code with `{ data: [] }` response

#### 4. **Authentication Check**
- **Description**: Endpoint should require authentication (not in public routes)
- **Setup**: Verify endpoint is not marked as public
- **Expected**: Endpoint requires JWT authentication

### Test Implementation

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
import { users } from './users'
import { Exception } from '@TBE/utils/errors/exception'

describe('GET /_/api/users', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn().mockReturnValue({ json: mockJson })

    mockRes = {
      status: mockStatus,
      json: mockJson,
    }
  })

  it('should return list of users when database call succeeds', async () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'user1@example.com',
        first: 'John',
        last: 'Doe',
        displayName: 'John Doe',
        provider: 'github',
        photoUrl: null,
        altEmail: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    mockReq = {
      app: {
        locals: {
          db: {
            services: {
              user: {
                list: vi.fn().mockResolvedValue({ data: mockUsers }),
              },
            },
          },
        },
      } as any,
    }

    await users.action!(mockReq as Request, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: mockUsers })
  })

  it('should throw exception when database call fails', async () => {
    const mockError = new Error('Database connection failed')

    mockReq = {
      app: {
        locals: {
          db: {
            services: {
              user: {
                list: vi.fn().mockResolvedValue({ error: mockError }),
              },
            },
          },
        },
      } as any,
    }

    await expect(
      users.action!(mockReq as Request, mockRes as Response)
    ).rejects.toThrow(Exception)

    await expect(
      users.action!(mockReq as Request, mockRes as Response)
    ).rejects.toMatchObject({
      status: 500,
      message: 'Failed to retrieve users',
      errorCode: 'DATABASE_ERROR',
    })
  })

  it('should return empty array when no users exist', async () => {
    mockReq = {
      app: {
        locals: {
          db: {
            services: {
              user: {
                list: vi.fn().mockResolvedValue({ data: [] }),
              },
            },
          },
        },
      } as any,
    }

    await users.action!(mockReq as Request, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: [] })
  })

  it('should require authentication (not be public)', () => {
    expect(users.public).toBe(undefined)
  })
})
```

---

## 10. Verification Checklist

Before submitting for review, verify:

- [ ] Endpoint file created in correct location
- [ ] TypeScript types imported correctly
- [ ] Database service accessed via `req.app.locals.db`
- [ ] Error handling follows Exception pattern
- [ ] Response format matches `{ data }` pattern
- [ ] Endpoint registered in parent API endpoint
- [ ] API endpoint added to accounts registration
- [ ] Path aliases (@TBE, @TDB) used correctly
- [ ] Test file created with comprehensive test cases
- [ ] Tests cover success, error, and edge cases
- [ ] Endpoint requires authentication (not public)
- [ ] Code follows existing patterns and style

---

## 11. Expected API Behavior

### Request
```http
GET /_/api/users HTTP/1.1
Host: localhost:3000
Authorization: Bearer <jwt-token>
```

### Response (Success)
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john.doe@example.com",
      "first": "John",
      "last": "Doe",
      "displayName": "John Doe",
      "provider": "github",
      "photoUrl": "https://avatars.githubusercontent.com/u/123456",
      "altEmail": null,
      "createdAt": "2026-01-07T10:00:00Z",
      "updatedAt": "2026-01-07T10:00:00Z"
    },
    {
      "id": "660e9500-f30c-52e5-b827-557766551111",
      "email": "jane.smith@example.com",
      "first": "Jane",
      "last": "Smith",
      "displayName": "Jane Smith",
      "provider": "google",
      "photoUrl": "https://lh3.googleusercontent.com/...",
      "altEmail": "jane@work.com",
      "createdAt": "2026-01-06T09:30:00Z",
      "updatedAt": "2026-01-06T09:30:00Z"
    }
  ]
}
```

### Response (Error)
```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "status": 500,
  "message": "Failed to retrieve users",
  "errorCode": "DATABASE_ERROR"
}
```

### Response (Unauthorized)
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "status": 401,
  "message": "Unauthorized",
  "errorCode": "AUTH_ERROR"
}
```

---

## 12. Next Steps

1. **Review Phase**: Submit this research report to Reviewer Agent for approval
2. **Implementation Phase**: Upon approval, implement the files according to this plan
3. **Testing Phase**: Write and run unit tests
4. **Integration Phase**: Test with running backend server
5. **Documentation Phase**: Update API documentation if needed

---

## Summary

This research has identified all the patterns and requirements needed to implement `GET /_/api/users`:

✅ **Endpoint Pattern**: Configuration-driven with `TEndpointConfig`
✅ **Database Access**: Via `req.app.locals.db.services.user.list()`
✅ **Response Format**: `{ data: [...] }` for success
✅ **Error Handling**: Exception class with status codes
✅ **Registration**: Nested under `/_/api/users` via accounts endpoint
✅ **Testing**: Vitest with mocked database service
✅ **Authentication**: Protected by JWT middleware (not public)

The implementation plan is ready for review and subsequent implementation.
