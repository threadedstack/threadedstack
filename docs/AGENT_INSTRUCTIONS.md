# AI Agent Instructions for Threaded Stack Development

You are an AI agent assigned to work on the **Threaded Stack** project. This document provides all the context and instructions you need to effectively pick up and complete development tasks.

---

## Project Overview

**Threaded Stack** is a developer platform that unifies authentication, serverless compute (FaaS), and secure API proxying for building AI agent applications. The platform consists of multiple services organized in a monorepo.

### Repository Structure

```
threaded-stask/
├── repos/
│   ├── admin/       # React SPA Dashboard (Vite, MUI, Jotai)
│   ├── backend/     # Core API Server (Express 5, WebSocket)
│   ├── proxy/       # Auth Gateway (Express, JWT, http-proxy)
│   ├── database/    # ORM & Migrations (Drizzle, PostgreSQL)
│   ├── domain/      # Shared Types, Models, Utilities
│   ├── components/  # Shared React Components
│   ├── logger/      # Winston-based Logging
│   └── cli/         # Developer CLI
├── deploy/          # Docker, Helm, DevSpace configs
├── configs/         # Root-level configs (biome.json, syncpack)
└── docs/
    └── epics/       # Development epic documentation
        ├── epic-1/  # Base Setup
        ├── epic-2/  # Proxy Feature
        ├── epic-3/  # FaaS
        ├── epic-4/  # AI Engine
        └── epic-5/  # Agents
```

### Tech Stack

- **Frontend**: React 18, Vite, MUI v6, Jotai, TypeScript
- **Backend**: Express 5, Node.js 20+, TypeScript
- **Database**: PostgreSQL (Neon.com), Drizzle ORM
- **Auth**: Neon Auth (@neondatabase/neon-js)
- **Build**: pnpm workspaces, tsup (backend), Vite (frontend), Biome (lint/format)
- **Testing**: Vitest

---

## Understanding the Epic System

The project is divided into 5 sequential epics, each building upon the previous:

| Epic | Name | Description |
|------|------|-------------|
| 1 | Base Setup | Monorepo, Database, Auth, Basic UI |
| 2 | Proxy Feature | Secret Injection, Body Transformation, M2M Auth |
| 3 | FaaS | WASM Sandbox, Function Execution |
| 4 | AI Engine | LLM Proxy, RAG, Streaming Chat, Tools |
| 5 | Agents | Container Sandbox, Git Integration, Browser Automation |

---

## Finding Tasks

### Task File Locations

Each epic has a dedicated `tasks.md` file that tracks all tasks:

- `docs/epics/epic-1/tasks.md` - Base Setup tasks
- `docs/epics/epic-2/tasks.md` - Proxy Feature tasks
- `docs/epics/epic-3/tasks.md` - FaaS tasks
- `docs/epics/epic-4/tasks.md` - AI Engine tasks
- `docs/epics/epic-5/tasks.md` - Agents tasks

### Task Status Legend

Tasks use the following status indicators:

- `[ ]` - **Not started** - Available for work
- `[~]` - **In progress** - Currently being worked on
- `[x]` - **Completed** - Done

### How to Find Available Tasks

1. **Start with Epic 1** - Work should progress sequentially through epics
2. **Read the tasks.md file** for the current epic
3. **Look for tasks marked `[ ]`** (not started)
4. **Check the Dependencies section** to ensure prerequisites are met
5. **Pick the first available task** in the current section

### Task Prioritization

Within each epic, complete tasks in this order:
1. Backend API tasks first (data layer)
2. Then middleware/engine tasks (business logic)
3. Then frontend/UI tasks last (presentation layer)

This ensures the API is ready when the UI needs it.

---

## Working on a Task

### Before Starting

1. **Verify prerequisites**: Check if dependent tasks are completed
2. **Read related code**: Understand existing patterns in the codebase
3. **Check CLAUDE.md**: Review project conventions and commands

### Task Execution Steps

1. **Mark the task as in-progress** by changing `[ ]` to `[~]` in the tasks.md file
2. **Implement the task** following project conventions
3. **Pre Task Implementation**
  1. Research the come up with a plan first.
  2. Once a plan is defined, ask another agent to review it
4. **Full Unit Test Coverage** is required for a task to be completed
5. **Run tests** with `pnpm test`
6. **Run linting** with `pnpm lint`
7. **Run formatting** with `pnpm format`
8. **Mark the task as completed** by changing `[~]` to `[x]` in the tasks.md file

### Updating Task Status

When updating a task's status in `tasks.md`, preserve the exact format:

```markdown
# Before (not started)
- [ ] **TASK-1.1.1**: Initialize pnpm workspace

# During (in progress)
- [~] **TASK-1.1.1**: Initialize pnpm workspace

# After (completed)
- [x] **TASK-1.1.1**: Initialize pnpm workspace
```

### TODOs are NOT Allowed

- A task can only be marked as completed if all the work related to that task is complete.
- It the work contains `TODO` or similar comments, then that task is incomplete
- Only mark a task as completed once all work related to the task is finished.

---

## Code Conventions

### File Structure

**Backend (`repos/backend/`):**
- `src/endpoints/<feature>.ts` - API endpoint definitions
- `src/endpoints/<feature>/` - Grouped endpoints (e.g., `auth/`, `base/`)
- `src/middleware/<name>.ts` - Express middleware
- `src/utils/<scope>/` - Utility functions (e.g., `auth/`, `proxy/`, `errors/`)
- `src/types/<name>.types.ts` - TypeScript types
- `src/constants/` - Environment variables and constants
- `src/server/` - Server configuration (app.ts, router.ts, server.ts)

**Admin (`repos/admin/`):**
- `src/pages/<Feature>/<Feature>.tsx` - Page components
- `src/components/<Component>/` - Reusable components
- `src/state/<entity>.ts` - Jotai atoms for state management
- `src/actions/<feature>/` - Business logic actions
- `src/services/<name>.ts` - API services and utilities
- `src/hooks/<scope>/` - Custom React hooks
- `src/types/<name>.types.ts` - TypeScript types
- `src/constants/` - Environment variables and constants
- `src/routes/` - React Router configuration
- `src/theme/` - MUI theme configuration

**Database (`repos/database/`):**
- `src/schemas/<table>.ts` - Drizzle table schemas
- `src/services/<service>.ts` - Service classes with CRUD operations
- `src/types/` - Database-specific types
- `src/utils/` - Database utilities
- `drizzle/` - Generated migrations

**Domain (`repos/domain/`):**
- `src/types/<feature>.types.ts` - Shared TypeScript types
- `src/models/<Model>.ts` - Shared model definitions
- `src/utils/` - Shared utility functions
- `src/api/` - Shared API utilities (CORS, router helpers)
- `src/environment/` - Environment loading utilities
- `src/error/` - Error handling utilities

### Naming Conventions

- **Files**: camelCase for utilities, PascalCase for components
- **React Components**: PascalCase (e.g., `Orgs.tsx`, `OrgList.tsx`)
- **Functions/Variables**: camelCase
- **Types**: PascalCase with `T` prefix (e.g., `TEndpointConfig`)
- **Interfaces**: PascalCase with `I` prefix (e.g., `IDBApi`)
- **Enums**: PascalCase with `E` prefix (e.g., `EPMethod`)
- **Test files**: `<name>.test.ts` co-located with source files

### Path Aliases

Each repo has path aliases configured in `configs/aliases.ts`:

| Repo | Alias | Maps To |
|------|-------|---------|
| Admin | `@TAF/*` | `repos/admin/src/*` |
| Backend | `@TBE/*` | `repos/backend/src/*` |
| Database | `@TDB/*` | `repos/database/src/*` |
| Domain | `@tdsk/domain` | `repos/domain/src/` |
| Logger | `@tdsk/logger` | `repos/logger/src/` |
| Components | `@tdsk/components` | `repos/components/src/` |

---

## Common Commands

### Root-Level Commands
```bash
pnpm install           # Install all dependencies
pnpm test              # Run tests across all repos
pnpm format            # Format all code with Biome
pnpm lint              # Lint all code with Biome
pnpm sync              # Sync package versions (syncpack)
pnpm clean:full        # Clean and reinstall all dependencies
```

### Per-Repo Commands

**Admin (`repos/admin/`):**
```bash
pnpm start             # Start Vite dev server
pnpm build             # Production build
pnpm test              # Run Vitest tests
```

**Backend (`repos/backend/`):**
```bash
pnpm start             # Dev server with watch (also watches domain/logger/database)
pnpm build             # Production build with tsup
pnpm serve             # Run built server
pnpm test              # Run Vitest tests
```

**Proxy (`repos/proxy/`):**
```bash
pnpm start             # Dev server with watch
pnpm build             # Production build
pnpm test              # Run Vitest tests
```

**Database (`repos/database/`):**
```bash
pnpm generate          # Generate Drizzle migrations
pnpm migrate           # Run migrations
pnpm push              # Push schema directly to DB
pnpm studio            # Open Drizzle Studio (DB browser)
```

---

## Code Patterns

### Backend Endpoint Pattern

Endpoints are defined using the `TEndpointConfig` type:

```typescript
// repos/backend/src/endpoints/<feature>.ts
import type { TEndpointConfig } from '@TBE/types'
import type { Request, Response } from 'express'
import { EPMethod } from '@TBE/types'

export const listItems: TEndpointConfig = {
  path: `/_/items`,
  method: EPMethod.Get,
  action: async (req: Request, res: Response): Promise<void> => {
    // Implementation
    res.json({ data: [] })
  },
}
```

Endpoints are registered in `repos/backend/src/endpoints/endpoints.ts`:

```typescript
import { items } from './items'
export const endpoints = { items }
```

### Database Model Pattern

Models extend the `Base` class which provides standard CRUD operations:

```typescript
// repos/database/src/services/<entity>.ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBEntitySelect, TDBEntityInsert } from '@TDB/types'
import { Base } from '@TDB/services/base'
import { entitySchema } from '@TDB/schemas/entity'

export type TEntityOpts = { db: NodePgDatabase }

export class Entity extends Base<typeof entitySchema, TDBEntitySelect, TDBEntityInsert> {
  constructor(opts: TEntityOpts) {
    super({ ...opts, schema: entitySchema })
  }
}
```

**Base Model Methods:**
- `create(data)` - Insert new record
- `get(id)` - Get record by ID
- `list(opts?)` - List all records
- `update(data)` - Update existing record
- `upsert(data)` - Insert or update record
- `delete(id)` - Delete record by ID

**Return Format:** All methods return `{ data }` on success or `{ error }` on failure.

### Admin State Pattern (Jotai)

State is managed with Jotai atoms:

```typescript
// repos/admin/src/state/<entity>.ts
import type { Entity } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const entitiesState = atomWithReset<Record<string, Entity>>(undefined)
export const activeEntityIdState = atomWithReset<string>(undefined)
```

### Admin Page Pattern

Pages follow this structure:

```typescript
// repos/admin/src/pages/<Feature>/<Feature>.tsx
import { Box, Typography } from '@mui/material'

export const Feature = () => {
  return (
    <Box>
      <Typography variant="h4">Feature Page</Typography>
      {/* Content */}
    </Box>
  )
}
```

### Async Router Pattern

Backend uses an async router wrapper that handles errors:

```typescript
import { router } from '@TBE/server/router'

// All handlers are automatically wrapped with asyncHandler
router.get('/path', async (req, res) => {
  // Errors are caught and passed to error handler
})
```

---

## Example: Completing a Task

Here's an example workflow for implementing a backend endpoint:

### Task: Implement `GET /_/orgs` endpoint

1. **Find the task** in `docs/epics/epic-1/tasks.md`:
   ```markdown
   - [ ] **TASK-4.4.1**: Implement `GET /_/orgs` - List orgs
   ```

2. **Mark as in-progress**:
   ```markdown
   - [~] **TASK-4.4.1**: Implement `GET /_/orgs` - List orgs
   ```

3. **Create the endpoint** in `repos/backend/src/endpoints/orgs.ts`:
   ```typescript
   import type { TEndpointConfig } from '@TBE/types'
   import type { Request, Response } from 'express'
   import { EPMethod } from '@TBE/types'

   export const listOrgs: TEndpointConfig = {
     path: `/_/orgs`,
     method: EPMethod.Get,
     action: async (req: Request, res: Response): Promise<void> => {
       const { db } = req.app?.locals
       const { data, error } = await db.services.org.list()

       if (error) {
         res.status(500).json({ error: error.message })
         return
       }

       res.json({ data })
     },
   }
   ```

4. **Register the endpoint** in `repos/backend/src/endpoints/endpoints.ts`:
   ```typescript
   import { listOrgs } from './orgs'
   export const endpoints = { listOrgs, /* other endpoints */ }
   ```

5. **Write tests** in `repos/backend/src/endpoints/orgs.test.ts`:
   ```typescript
   import { describe, it, expect, vi } from 'vitest'
   // Test implementation
   ```

6. **Run tests and lint**:
   ```bash
   pnpm test
   pnpm lint
   pnpm format
   ```

7. **Mark as completed**:
   ```markdown
   - [x] **TASK-4.4.1**: Implement `GET /_/orgs` - List orgs
   ```

---

## Testing

### Running Tests
```bash
# Run all tests from root
pnpm test

# Run tests for a specific repo
cd repos/backend && pnpm test
cd repos/admin && pnpm test
```

### Test File Location
Test files are co-located with source files using the `.test.ts` suffix:
- `repos/backend/src/utils/logger.test.ts`
- `repos/admin/src/utils/api/genFormData.test.ts`
- `repos/database/src/utils/database/getDialect.test.ts`

### Test Framework
All repos use **Vitest** with configuration in `configs/vitest.config.ts`.

---

## Environment Setup

### Environment Variables

Environment variables are loaded from `deploy/values.*.yml` files using `@keg-hub/parse-config`:

- `deploy/values.yaml` - Base/default values
- `deploy/values.local.yaml` - Local development overrides
- `deploy/values.production.yaml` - Production values

Each repo loads envs in `src/constants/envs.ts` or via scripts in `scripts/loadEnvs.ts`.

### Key Environment Variables

| Variable | Description |
|----------|-------------|
| `TDSK_AUTH_URL` | Neon Auth URL for authentication |
| `DATABASE_URL` | PostgreSQL connection string |
| `NODE_ENV` | Environment (local, development, production) |

---

## Key Dependencies

### Backend
| Package | Purpose |
|---------|---------|
| `express` | Web framework (v5) |
| `express-async-handler` | Async error handling |
| `http-proxy-middleware` | Proxy requests |
| `jsonwebtoken` | JWT handling |
| `cors` | CORS middleware |
| `winston` | Logging |

### Admin Frontend
| Package | Purpose |
|---------|---------|
| `@mui/material` | UI component library (v6) |
| `jotai` | State management |
| `react-router` | Client-side routing (v7) |
| `@neondatabase/neon-js` | Neon Auth integration |
| `sonner` | Toast notifications |

### Database
| Package | Purpose |
|---------|---------|
| `drizzle-orm` | ORM |
| `@neondatabase/serverless` | Neon PostgreSQL driver |

---

## Current Project State

### Completed Features (Epic 1 Progress)
- Monorepo structure with pnpm workspaces
- Database schemas for all entities (orgs, users, repos, etc.)
- Database models with CRUD operations
- Basic backend server structure with Express 5
- Admin UI skeleton with MUI theming and routing
- Login page with social auth buttons (GitHub, GitLab, Google, Vercel)
- Sidebar navigation structure

### In Progress / Not Started
- Auth flow integration with Neon Auth
- Backend API endpoints (Orgs, Users, Repos CRUD)
- Admin pages for Orgs and Repos management
- Proxy server forwarding logic
- Protected route wrappers

### Notes for Agents
- The proxy repo has a TODO stub in `repos/proxy/src/proxy.ts`
- Orgs and Repos pages in admin are placeholder stubs
- Database migrations exist but may need verification against Neon
- Some domain types (secrets, functions, threads) are not yet created

---

## Error Handling

If you encounter issues:

1. **Check dependencies**: Ensure prerequisite tasks are complete
2. **Review existing code**: Follow patterns from similar implementations
3. **Check Technical Notes**: Each tasks.md has a Technical Notes section at the bottom
4. **Read the CLAUDE.md file**: Contains additional project conventions

---

## Committing Changes

When committing, follow this format:

```bash
git commit -m "$(cat <<'EOF'
feat: implement GET /_/orgs endpoint

- Add orgs endpoint with list functionality
- Integrate with OrgModel from database repo
- Add pagination support

EOF
)"
```

---

## Important Reminders

1. **Always update tasks.md** when starting or completing a task
2. **Work sequentially** through epics (don't skip ahead)
3. **Run tests and lint** before marking a task complete
4. **Follow existing patterns** in the codebase
5. **Keep commits focused** on single tasks when possible
6. **Document complex logic** with inline comments

---

## Getting Started Prompt

Copy and use this prompt when starting a new AI agent session:

```
I am working on the Threaded Stack project. Please:

1. Read the file `docs/AGENT_INSTRUCTIONS.md` to understand the project
2. Read the `CLAUDE.md` file for project conventions
3. Check `docs/epics/epic-1/tasks.md` for available tasks
4. Find the first task marked [ ] (not started)
5. Pick up that task and begin implementation

If Epic 1 is complete, check Epic 2, and so on.

When you start a task:
- Mark it as [~] in the tasks.md file
- Implement the task following project conventions
- Run tests and lint
- Mark it as [x] when complete
- Move on to the next available task
```

---

## Quick Reference

| Action | Command/Location |
|--------|------------------|
| Find tasks | `docs/epics/epic-N/tasks.md` |
| Project conventions | `CLAUDE.md` |
| Run all tests | `pnpm test` |
| Format code | `pnpm format` |
| Lint code | `pnpm lint` |
| Start backend | `cd repos/backend && pnpm start` |
| Start admin | `cd repos/admin && pnpm start` |
| Start proxy | `cd repos/proxy && pnpm start` |
| Database migrations | `cd repos/database && pnpm migrate` |
| Database studio | `cd repos/database && pnpm studio` |
| Clean install | `pnpm clean:full` |

### Key File Locations

| Purpose | Location |
|---------|----------|
| Backend endpoints | `repos/backend/src/endpoints/` |
| Backend middleware | `repos/backend/src/middleware/` |
| Database schemas | `repos/database/src/schemas/` |
| Database services | `repos/database/src/services/` |
| Domain types | `repos/domain/src/types/` |
| Admin pages | `repos/admin/src/pages/` |
| Admin state | `repos/admin/src/state/` |
| Admin components | `repos/admin/src/components/` |
| Environment configs | `deploy/values.*.yaml` |
| Biome config | `configs/biome.json` (root) |

### Epic Task Files

| Epic | File | Description |
|------|------|-------------|
| 1 | `docs/epics/epic-1/tasks.md` | Base Setup - Monorepo, DB, Auth, Basic UI |
| 2 | `docs/epics/epic-2/tasks.md` | Proxy Feature - Secrets, Transformations |
| 3 | `docs/epics/epic-3/tasks.md` | FaaS - WASM Sandbox, Function Execution |
| 4 | `docs/epics/epic-4/tasks.md` | AI Engine - LLM Proxy, RAG, Streaming |
| 5 | `docs/epics/epic-5/tasks.md` | Agents - Containers, Git, Browser Automation |
