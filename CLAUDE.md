# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Threaded Stack** is a developer platform that unifies authentication, serverless compute (FaaS), and secure API proxying for building AI agent applications. It acts as the "nervous system" between AI models and external APIs/databases, enabling teams to build autonomous software without managing complex cloud infrastructure.

The platform solves three key problems:
1. **Fragmented stacks** - Replaces stitching together Vercel + Lambda + LangChain + Vault
2. **Security gaps** - Secrets are injected server-side; AI never sees API keys
3. **Context management** - Built-in RAG and memory management for LLM applications

## Architecture

### Request Flow
```
Client → Auth-Proxy (repos/proxy) → Backend (repos/backend) → External APIs/DB
                ↓
         Auth: /auth/*
         Admin: /_/* → Backend Admin API
         Proxy: /proxy/* → Backend Proxy Engine
         FaaS: /faas/* → Backend Compute Engine
         AI: /ai/* → Backend AI Engine
```

### Workspace Structure (`repos/`)

| Directory | Role | Tech |
|-----------|------|------|
| `proxy/` | Auth Gateway - single entry point for all external traffic | Express, JWT, http-proxy |
| `backend/` | Core API - Admin CRUD, Proxy Engine, FaaS, AI orchestration | Express 5, WebSocket |
| `admin/` | SPA Dashboard | Vite, React, MUI, Jotai |
| `database/` | ORM & migrations | Drizzle, PostgreSQL |
| `domain/` | Shared types, models, utilities | TypeScript |
| `components/` | Shared React components/hooks | React, MUI |
| `logger/` | Winston-based logging service | Winston |
| `cli/` | Developer CLI for project management | Node.js |

### Database & Authentication

**Neon.com** is used as both the PostgreSQL database provider and for user authentication.

**Neon Auth** is integrated in the admin repo via `@neondatabase/neon-js`:
- `createAuthClient()` from `@neondatabase/neon-js/auth` - Auth client
- `NeonAuthUIProvider` from `@neondatabase/neon-js/auth/react` - React provider
- Social sign-in (GitHub, GitLab, Google, Vercel) for user authentication
- Auth URL configured via `TDSK_AUTH_URL` environment variable

### Database Schema (Exclusive Arc Pattern)

Key tables: `teams`, `users`, `repos`, `endpoints`, `functions`, `configs`, `providers`, `secrets`, `roles`, `threads`, `messages`, `assets`

Polymorphic relationships use "Exclusive Arc" - e.g., `secrets` belong to Team OR Repo (not both).

## Common Commands

```bash
# Install (PNPM required - enforced)
pnpm install

# Run developer CLI
pnpm tdsk   # or: pnpm ts

# Sync package versions
pnpm sync

# Clean reinstall
pnpm clean:full
```

### Per-Repo Commands

**Admin** (`repos/admin/`)
```bash
pnpm start          # Dev server
pnpm build          # Production build
pnpm lint           # Biome lint
pnpm format         # Biome format
```

**Backend** (`repos/backend/`)
```bash
pnpm start          # Dev with watch (watches domain/logger/database)
pnpm build          # Production build
pnpm lint           # Biome lint
pnpm format         # Biome format
```

**Proxy** (`repos/proxy/`)
```bash
pnpm start          # Dev with watch
pnpm test           # Vitest tests
pnpm lint           # Biome lint
pnpm format         # Biome format
```

**Database** (`repos/database/`)
```bash
pnpm generate       # Generate migrations
pnpm migrate        # Run migrations
pnpm push           # Push schema to DB
pnpm studio         # Open Drizzle Studio
```

## Development Phases

The project follows a phased rollout:

1. **Phase 1 (Base Setup)**: Monorepo, DB, Auth backbone, basic UI - Teams/Users CRUD
2. **Phase 2 (Proxy Feature)**: Secret injection, header/body transforms, M2M auth
3. **Phase 3 (FaaS)**: WASM sandbox execution, Monaco editor, TS/Python support
4. **Phase 4 (AI Engine)**: RAG-enabled LLM proxy, streaming chat, tool execution
5. **Phase 5 (Agents)**: Containerized agent sandbox, Git integration, browser automation

## Key Patterns

**Path Aliases**: Admin uses `@TAF/*` prefix via `alias-hq`. All repos have `configs/aliases.ts`.

**Configuration**: Each repo has `configs/` with build configs (vite/tsup/tsdown), linter configs (biome.json), and aliases.

**Environment Variables**: Loaded via `@keg-hub/parse-config` from `deploy/values.*.yml` (local, dev, prod).

**Linting**: All repos use Biome for linting and formatting.
