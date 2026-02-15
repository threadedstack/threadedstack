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

### 🔄 Sub-Agent Context Alignment

**USE SUB-AGENTS AGGRESSIVELY** to maintain context alignment and prevent drift:

1. **Decompose work into sub-agents** whenever a task touches 2+ repos or has 2+ independent steps
2. **Each sub-agent gets a focused scope** — one repo, one concern, one deliverable
3. **Provide full context in sub-agent prompts** — don't assume the sub-agent knows prior conversation; include file paths, patterns, and acceptance criteria
4. **Run review sub-agents after implementation** — always spawn a reviewer agent to validate changes before reporting completion
5. **Use the security-reviewer agent** (`.claude/agents/security-reviewer.md`) for any changes touching auth, secrets, payments, or proxy logic

**When to spawn sub-agents:**
- Exploring unfamiliar code → `Explore` agent with specific questions
- Implementing across repos → One `general-purpose` agent per repo
- Writing tests → Dedicated test-writing agent with repo patterns
- Code review → `feature-dev:code-reviewer` or security-reviewer agent
- Research → `Explore` agent to avoid polluting main context with search results

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
            ├── /_/ai/sessions  - Create LLM session (JWT/API key auth)
            └── /ai/chat        - LLM proxy SSE stream (session token auth)
```

**Authentication Flow**:
- Client-side auth via Neon Auth (social login)
- Proxy validates JWT using JWKS from Neon
- Protected routes require valid JWT token or API key (`tdsk_*` Bearer token)
- `/ai/chat` uses session token auth (`Authorization: Session <token>`) — skips JWT/API key

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
| `repl/` | Terminal REPL for AI agent interaction | Bun, readline, marked | `.claude/skills/repl/SKILL.md` |
| `sandbox/` | Pluggable sandbox execution layer | isolated-vm, E2B, just-bash | `.claude/skills/sandbox/SKILL.md` |

## Sub-Repo Skills

**IMPORTANT**: Before working on any sub-repo, load its corresponding skill file for comprehensive knowledge of the codebase structure, patterns, and best practices.

### How to Use Skills
Load the relevant skill when working on a specific repo:
- Working on admin UI? → Read `.claude/skills/admin/SKILL.md` first
- Adding API endpoints? → Read `.claude/skills/backend/SKILL.md` first
- Building AI agents? → Read `.claude/skills/agent/SKILL.md` first
- Building shell environments? → Read `.claude/skills/shell/SKILL.md` first
- Modifying database schema? → Read `.claude/skills/database/SKILL.md` first
- Working on the REPL CLI? → Read `.claude/skills/repl/SKILL.md` first
- Working on sandbox execution? → Read `.claude/skills/sandbox/SKILL.md` first

### Available Skills
| Skill File | Contents |
|------------|----------|
| `admin/SKILL.md` | React/Vite architecture, Jotai state, MUI theming, Orgs/Projects routing, API services, Billing pages/components, Quota tracking |
| `agent/SKILL.md` | AI Agent runtime, LLM adapters (Anthropic/OpenAI/Google/Proxy), ProxyAdapter for session-based LLM proxy, AgentRunner, ReAct loop, tool execution |
| `backend/SKILL.md` | Express 5 API, Orgs/Projects/ApiKeys/Secrets endpoints, auth middleware, AI session/chat proxy endpoints, Subscription/Quota/Payment endpoints, PaymentsService |
| `cli/SKILL.md` | CLI command structure, DevOps orchestration, Docker/K8s secrets, task system |
| `components/SKILL.md` | 30+ React components, 25+ hooks, Monaco editor, Confirm loading state |
| `database/SKILL.md` | Drizzle ORM, organizations/projects schemas, apiKeys table, model converters, quotas/subscriptions tables |
| `domain/SKILL.md` | Organization/Project/ApiKey/Secret/Endpoint/Function models, crypto utilities, Plan model, payment types (TPayPlanMeta) |
| `logger/SKILL.md` | Winston configuration, buildApiLogger factory, secret redaction, Express middleware |
| `proxy/SKILL.md` | JWKS auth validation, API key auth, session token auth for /ai/chat, http-proxy-middleware backend forwarding |
| `shell/SKILL.md` | Cross-platform virtual shell environment, Shell class API, just-bash integration, ZenFS backends (Node.js/Browser/Bun), StreamManager, Platform detection, cwd persistence pattern, Test suite (140/149 passing) |
| `repl/SKILL.md` | Terminal REPL CLI, AuthManager, ApiClient, session-based LLM proxy (ProxyAdapter), LocalAgentExecutor, AgentRepl interactive loop, Renderer, Bun binary |
| `sandbox/SKILL.md` | Pluggable sandbox factory, E2bSandboxProvider (Firecracker microVMs), LocalSandboxProvider (just-bash + V8 isolate), IsolateRunner (fs/path/subprocess shims), ISandbox interface |
| `gen-test/SKILL.md` | Vitest test generation following project conventions, co-located test files, mock patterns per repo type |

### Subagents

Custom subagents live in `.claude/agents/`:
| Agent File | Purpose |
|------------|---------|
| `security-reviewer.md` | Security-focused code review for auth, secrets, payments, proxy changes |

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
pnpm push           # Push schema to DB (INTERACTIVE - requires manual confirmation)
```
> **Note**: `pnpm push` runs `drizzle-kit push` which is interactive and requires manual confirmation for destructive changes. Claude cannot run this automatically. The user must run it manually from `repos/database/`.

## Service Management (`tdsk` CLI)

**IMPORTANT**: Always use the `tdsk` CLI for service management. Never call `devspace` directly — it won't have the correct env/context setup.

### Service Architecture
```
Client → Caddy (:443, TLS) → Proxy (:7118, JWT/JWKS) → Backend (:5885, API)
                                                              ↓
                                                         Neon PostgreSQL
```

| Service | Where | Port | Start Command |
|---|---|---|---|
| Caddy (TLS/LB) | K8s (`tdsk-caddy`) | 443, 8080, 2019 | `tdsk dev start --clean` |
| Proxy (Auth) | K8s (`tdsk-proxy`) | 7118 | `tdsk dev start --clean` |
| Backend (API) | K8s (`tdsk-backend`) | 5885 | `tdsk dev start --clean` |
| Admin (SPA) | **Local host** | 5887 | `cd repos/admin && pnpm start` |

> Admin runs locally (Vite dev server), NOT in K8s. Start it **after** k8s services are up.

### Start Services
```bash
# Start all K8s services (Caddy, Proxy, Backend)
tdsk dev start --clean

# Start Admin frontend (separate terminal, after k8s is up)
cd repos/admin && pnpm start
```

### Other `tdsk` Commands
```bash
tdsk dev log --context proxy --follow      # View proxy logs
tdsk dev log --context backend --follow    # View backend logs
tdsk dev enter --context backend --cmd "/bin/sh"  # Shell into pod
tdsk dev clean --images --cache            # Clean environment
tdsk dev render                            # Dry-run Helm templates
tdsk dev use                               # Set kube context/namespace
tdsk start --context proxy                 # Start repo locally (outside k8s)
tdsk kube secret database                  # Create DB k8s secret
tdsk kube secret payments                  # Create payments k8s secret
tdsk kube secret email                     # Create email k8s secret
tdsk kube secret docker                    # Create docker auth k8s secret
tdsk kube secret tdsk                      # Create master key k8s secret
```

### Config Loading Order
`@keg-hub/parse-config` merges (later overrides earlier):
1. `deploy/values.yaml` — Base config (ports, hosts, public settings)
2. `deploy/values.local.yaml` — Local overrides (`NODE_ENV=local`)
3. `~/.config/tdsk/values.yaml` — Secrets (DB creds, API keys, master key)

## Validation Workflows

### Health Checks
```bash
# Through Caddy SSL
curl -sf https://local.threadedstack.app/health         # Proxy
curl -sf https://local.threadedstack.app/_/health        # Backend

# Direct to K8s ports (bypass Caddy)
curl -sf http://localhost:7118/health                    # Proxy direct
curl -sf http://localhost:5885/_/health                  # Backend direct
```

### API Validation
```bash
# Direct backend (trusts X-User-* headers)
curl -s -H "X-User-Id: test-user" http://localhost:5885/_/orgs

# Through Caddy → Proxy (requires valid JWT)
curl -s -H "Authorization: Bearer <token>" https://local.threadedstack.app/_/orgs
```

### UI Validation (Playwright MCP)
```
1. ToolSearch("select:mcp__playwright__browser_navigate")
2. browser_navigate → http://localhost:5887
3. browser_snapshot → accessibility tree
4. browser_take_screenshot → visual check
5. browser_click / browser_fill_form → interact
6. browser_evaluate → check DOM / Jotai atom states
```

### Build Validation (dependency order)
```bash
pnpm --filter @tdsk/domain build
pnpm --filter @tdsk/database build
pnpm --filter @tdsk/logger build
pnpm --filter @tdsk/backend build    # depends on domain, database, logger
pnpm --filter @tdsk/proxy build      # depends on domain, database, logger
pnpm --filter @tdsk/admin build      # depends on domain, components
```

## Autonomous Development Loop

```
1. UNDERSTAND  — Load skill file, explore codebase
2. IMPLEMENT   — Write/Edit code
3. BUILD       — pnpm build (dependency order: domain → database → logger → rest)
4. TEST        — pnpm test (unit tests, no network needed)
5. DEPLOY      — tdsk dev start --clean (k8s services)
5b. FRONTEND   — cd repos/admin && pnpm start (local Vite)
6. VALIDATE    — curl health checks + Playwright UI
7. DEBUG       — tdsk dev log --context <svc> --follow
8. FIX         — Iterate on errors
9. COMMIT      — Only when user requests
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


## Compact Instructions

When compacting context, preserve:
- Current task goals and acceptance criteria
- Files modified and their paths
- Decisions made and rationale
- Errors encountered and fixes applied
- Test results (pass/fail counts)
- Which repos/skills have been loaded
- Any uncommitted work in progress
- Task list state (what's done, what's pending)

Before compaction, always write a progress checkpoint to auto memory (`~/.claude/projects/-Users-lancetipton-keg-hub-external-apps-threadedstack/memory/`) so work is never lost even if the session crashes.

## Key Patterns

**Path Aliases**: Admin uses `@TAF/*` prefix via `alias-hq`. All repos have `configs/aliases.ts`.

**Configuration**: Each repo has `configs/` with build configs (vite/tsup/tsdown), linter configs (biome.json), and aliases.

**Environment Variables**: Loaded via `@keg-hub/parse-config` from `deploy/values.*.yml` (local, dev, prod).

**Linting**: All repos use Biome for linting and formatting. It runs automatically and should NOT be run manually.
