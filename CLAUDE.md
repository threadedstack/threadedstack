# Claude Code Configuration

## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories
4. **USE CLAUDE CODE'S TASK TOOL** for spawning agents concurrently

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool (Claude Code)**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message

### 🎯 CRITICAL: Claude Code Task Tool for Agent Execution

**Claude Code's Task tool is the PRIMARY way to spawn agents:**
```javascript
// ✅ CORRECT: Use Claude Code's Task tool for parallel agent execution
[Single Message]:
  Task("Research agent", "Analyze requirements and patterns...", "researcher")
  Task("Coder agent", "Implement core features...", "coder")
  Task("Tester agent", "Create comprehensive tests...", "tester")
  Task("Reviewer agent", "Review code quality...", "reviewer")
  Task("Architect agent", "Design system architecture...", "system-architect")
```

## Project Overview


### 📁 File Organization Rules

**Threaded Stack** is a developer platform that unifies authentication, serverless compute (FaaS), and secure API proxying for building AI agent applications. It acts as the "nervous system" between AI models and external APIs/databases, enabling orgs to build autonomous software without managing complex cloud infrastructure.

The platform solves three key problems:
1. **Fragmented stacks** - Replaces stitching together Vercel + Lambda + LangChain + Vault
2. **Security gaps** - Secrets are injected server-side; AI never sees API keys
3. **Context management** - Built-in RAG and memory management for LLM applications
4, **Billing & Quotas** - Tiered subscription plans (free/basic/developer/pro) via Polar.sh with usage quota tracking for 12 resource types

### important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Never save working files, text/mds and tests to the root folder.

## Architecture

### Request Flow
```
Client → Auth-Proxy (repos/proxy) → Backend (repos/backend) → External APIs/DB
                ↓
         Health: /health (public)
         Auth: /auth/me, /auth/logout
         Admin: /_/* → Backend Admin API
            ├── /_/orgs/*      - Organizations CRUD
            ├── /_/users/*     - Users CRUD
            ├── /_/projects/*  - Projects CRUD
            ├── /_/api-keys/*  - API Keys CRUD
            ├── /_/secrets/*   - Secrets CRUD (encrypted)
            ├── /_/endpoints/* - Endpoints CRUD
            ├── /_/providers/* - Providers CRUD
            ├── /_/subscriptions/* - Subscription management
            ├── /_/quotas/*    - Quota tracking
            └── /_/payments/*  - Payment webhooks
         Proxy: /proxy/* → Backend Proxy Engine
         FaaS: /faas/* → Backend Compute Engine
         AI: /ai/* → Backend AI Engine
```

**Authentication Flow**:
- Client-side auth via Neon Auth (social login)
- Proxy validates JWT using JWKS from Neon
- Protected routes require valid JWT token

### Workspace Structure (`repos/`)

| Directory | Role | Tech | Skill |
|-----------|------|------|-------|
| `proxy/` | Auth Gateway - JWT/JWKS validation, backend proxying | Express 5, jose, http-proxy-middleware | `.claude/skills/proxy/SKILL.md` |
| `backend/` | Core API - Admin CRUD, Proxy Engine, FaaS, AI orchestration | Express 5, WebSocket | `.claude/skills/backend/SKILL.md` |
| `admin/` | SPA Dashboard | Vite, React, MUI, Jotai | `.claude/skills/admin/SKILL.md` |
| `agent/` | AI Agent Backend - WASM isolation, LLM orchestration | TypeScript, WebAssembly, componentize-js | `.claude/skills/agent/SKILL.md` |
| `shell/` | Cross-Platform Virtual Shell - bash execution, filesystem abstraction | TypeScript, just-bash, ZenFS | `.claude/skills/shell/SKILL.md` |
| `database/` | ORM & migrations | Drizzle, PostgreSQL | `.claude/skills/database/SKILL.md` |
| `domain/` | Shared types, models, utilities | TypeScript | `.claude/skills/domain/SKILL.md` |
| `components/` | Shared React components/hooks | React, MUI | `.claude/skills/components/SKILL.md` |
| `logger/` | Winston-based logging service | Winston | `.claude/skills/logger/SKILL.md` |
| `cli/` | Developer CLI for project management | Node.js | `.claude/skills/cli/SKILL.md` |

## Sub-Repo Skills

**IMPORTANT**: Before working on any sub-repo, load its corresponding skill file for comprehensive knowledge of the codebase structure, patterns, and best practices.

### How to Use Skills
Load the relevant skill when working on a specific repo:
- Working on admin UI? → Read `.claude/skills/admin/SKILL.md` first
- Adding API endpoints? → Read `.claude/skills/backend/SKILL.md` first
- Building AI agents? → Read `.claude/skills/agent/SKILL.md` first
- Building shell environments? → Read `.claude/skills/shell/SKILL.md` first
- Modifying database schema? → Read `.claude/skills/database/SKILL.md` first

### Available Skills
| Skill File | Contents |
|------------|----------|
| `admin/SKILL.md` | React/Vite architecture, Jotai state, MUI theming, Orgs/Projects routing, API services, Billing pages/components, Quota tracking |
| `agent/SKILL.md` | WASM AI agent, Host-Guest architecture, WasmBridge, TSAgent, Mutex, Executor, Provider abstraction, ReAct loop, Security layers, Build pipeline |
| `backend/SKILL.md` | Express 5 API, Orgs/Projects/ApiKeys/Secrets endpoints, auth middleware, Subscription/Quota/Payment endpoints, PaymentsService |
| `cli/SKILL.md` | CLI command structure, DevOps orchestration, Docker/K8s secrets, task system |
| `components/SKILL.md` | 30+ React components, 25+ hooks, Monaco editor, Confirm loading state |
| `database/SKILL.md` | Drizzle ORM, organizations/projects schemas, apiKeys table, model converters, quotas/subscriptions tables |
| `domain/SKILL.md` | Organization/Project/ApiKey/Secret/Endpoint/Function models, crypto utilities, Plan model, payment types (TPayPlanMeta) |
| `logger/SKILL.md` | Winston configuration, buildApiLogger factory, secret redaction, Express middleware |
| `proxy/SKILL.md` | JWKS auth validation, http-proxy-middleware backend forwarding, full implementation |
| `shell/SKILL.md` | Cross-platform virtual shell environment, Shell class API, just-bash integration, ZenFS backends (Node.js/Browser/Bun), StreamManager, Platform detection, cwd persistence pattern, Test suite (140/149 passing) |

### Database & Authentication

**Neon.com** is used as both the PostgreSQL database provider and for user authentication.

**Neon Auth** is integrated in the admin repo via `@neondatabase/neon-js`:
- `createAuthClient()` from `@neondatabase/neon-js/auth` - Auth client
- `NeonAuthUIProvider` from `@neondatabase/neon-js/auth/react` - React provider
- Social sign-in (GitHub, GitLab, Google, Vercel) for user authentication
- Auth URL configured via `TDSK_AUTH_URL` environment variable

### Database Schema (Exclusive Arc Pattern)

Key tables: `organizations`, `users`, `projects`, `endpoints`, `functions`, `configs`, `providers`, `secrets`, `api_keys`, `roles`, `threads`, `messages`, `assets`, `quotas`, `subscriptions`

Polymorphic relationships use "Exclusive Arc" - e.g., `secrets` belong to Org OR Project OR Provider (exactly one, not multiple).
- `quotas` - Org resource usage tracking (12 resource types: projects, members, endpoints, threads, messages, functionCalls, runtime, orgSecrets, projectSecrets, organizations, price, retention)
- `subscriptions` - User payment plans and Polar.sh integration (tier, status, polarId, polarCustomerId)

## Common Commands

```bash
# Install (PNPM required - enforced)
pnpm install

# Run unit tests via vitest
pnpm test

# Sync package versions
pnpm sync

# Clean reinstall of node_modules
pnpm clean:full
```

### Per-Repo Commands

**Admin** (`repos/admin/`)
```bash
pnpm start          # Dev server
pnpm build          # Production build
pnpm test           # Vitest tests
```

**Backend** (`repos/backend/`)
```bash
pnpm start          # Dev with watch (watches domain/logger/database)
pnpm build          # Production build
pnpm test           # Vitest tests
```

**Proxy** (`repos/proxy/`)
```bash
pnpm start          # Dev with watch
pnpm test           # Vitest tests
```

**Database** (`repos/database/`)
```bash
pnpm test           # Vitest tests
```

### Commands Notes

* Linting and formatting are automatically, so `lint` and `format` command should be ignored.
* **NEVER save to root folder. Use these directories:**
  - `/src` - Source code files
  - `/tests` - Test files
  - `/docs` - Documentation and markdown files
  - `/config` - Configuration files
  - `/scripts` - Utility scripts
  - `/examples` - Example code


## Key Patterns

**Path Aliases**: Admin uses `@TAF/*` prefix via `alias-hq`. All repos have `configs/aliases.ts`.

**Configuration**: Each repo has `configs/` with build configs (vite/tsup/tsdown), linter configs (biome.json), and aliases.

**Environment Variables**: Loaded via `@keg-hub/parse-config` from `deploy/values.*.yml` (local, dev, prod).

**Linting**: All repos use Biome for linting and formatting. It runs automatically and should NOT be run manually.
