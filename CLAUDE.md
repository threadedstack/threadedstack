# Claude Code Configuration

## 🚨🚨🚨 ABSOLUTE #1 RULE: NEVER COMMIT OR MODIFY GIT HISTORY 🚨🚨🚨

> Enforced by PreToolUse hook. Attempts to run blocked commands will be rejected.

- **ALLOWED**: `git add`, `git status`, `git diff`, `git log`, `git branch`, `git show`
- **BLOCKED**: `git commit`, `git push`, `git reset`, `git revert`, `git rebase`, `git cherry-pick`, `git stash`, `git merge`
- "write a commit message" / "commit this" = OUTPUT the message as text, never run `git commit`
- The user handles all commits manually. This rule applies to ALL subagents.

## 🚨🚨🚨 ABSOLUTE #2 RULE: ZERO LAZINESS, ZERO DEFERRAL, ZERO SILENT INCOMPLETION 🚨🚨🚨

> Deferral patterns in code are enforced by the `block-lazy-patterns.sh` PreToolUse hook.

- All requested and approved work MUST be completed. The ONLY alternative is telling the user you CANNOT do it (tool limitation, missing access) at the TOP of your response.
- NEVER use deferral language: "later", "follow-up", "for now", "out of scope", "can revisit", "low priority", "can be deferred"
- NEVER present assumptions as facts: "this should work", "I believe this will", "this is likely"
- NEVER add TODO/FIXME/HACK comments or write stub/placeholder implementations
- This applies to ALL subagents.

### Completion Means Verified
"Done" means ALL of:
1. Code written and saved
2. Type checks pass (`pnpm types` for affected repos)
3. Unit tests pass (`pnpm test` for affected repos)
4. Integration tests pass (if the change touches API behavior)
5. No silent gaps. If you skip a verification step, say which and why.

### Pre-Completion Self-Audit
Before reporting ANY task as complete:
1. **What was asked?** - enumerate every deliverable
2. **What was delivered?** - match each ask to what you did
3. **What was verified?** - which checks ran? paste output
4. **What's incomplete?** - say so at the TOP, not buried at the bottom
5. **What else did you notice?** - adjacent bugs, missing tests, wrong types

### Proactive Engineering
- See a bug adjacent to your task? **FIX IT** or **TELL THE USER**
- Know a better approach? **PROPOSE IT** before implementing the lesser version
- Missing test, wrong import, unhandled edge case? **FIX IT NOW**

## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save files to the root folder** (enforced by `block-root-files.sh` hook)
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
4. **Billing & Quotas** - Tiered subscription plans (free/solo/pro/team) via Stripe with usage quota tracking for 12 resource types

**Sandbox-First Architecture**: The platform is sandbox-first — managed sandboxes running third-party AI tools (Claude Code, Codex, OpenCode) are the primary feature.

### important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

### 🚨 Shared Types Belong in the Repo's Types Directory
- **Exported (shared) types** MUST go in the sub-repo's `types/` directory (e.g., `repos/backend/src/types/`)
- NEVER place shared types next to the files they relate to — even if they're closely related
- **Non-exported (private) types** used only within a single file CAN live in that file
- Rule of thumb: if a type is `export`ed, it goes in `types/`; if it's not exported, it stays local

### 🚨 NEVER Re-export — Always Update Callsites
When refactoring code to a shared location (e.g., moving a function from a repo to `@tdsk/domain`):
- **NEVER** leave a re-export in the original file (e.g., `export { foo } from '@tdsk/domain'`)
- **ALWAYS** update ALL callsites to import directly from the new location
- **DELETE** the original file entirely — no shims, no re-export wrappers
- Update barrel/index files to remove references to deleted files
- If a rename is involved, update all callsites to use the new name
- This applies to types, enums, classes, and functions — no exceptions

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
            ├── /_/agents/*    - Agents CRUD + run (SSE) + OpenAI-compatible chat completions
            ├── /_/threads/*   - Threads CRUD + messages + branching + file upload
            ├── /_/domains/*   - Domain verification
            ├── /_/invitations/* - Org invitation management
            ├── /_/subscriptions/* - Subscription management
            ├── /_/quotas/*    - Quota tracking
            ├── /_/payments/*  - Payment webhooks
            ├── /_/skills/*    - Skills CRUD + attach/detach to agents
            ├── /_/schedules/* - Schedules CRUD + trigger (cron-based agent execution)
            ├── /_/permission-overrides/* - Permission overrides CRUD
            └── /_/cli/*       - CLI integration endpoints
         Sandboxes: /_/sandboxes/*
            ├── /_/sandboxes/*     - Sandbox config CRUD (runtime, initScript, builtIn fields)
            ├── /_/sandboxes/:id/connect  - Start pod + SSH credentials
            ├── /_/sandboxes/:id/copy     - Deep-copy sandbox config (builtIn=false)
            ├── /_/sandboxes/:id/sessions - Active SSH sessions
            ├── /_/sandboxes/:id/exec     - Execute command in pod (K8s exec API)
            ├── /_/sandboxes/:id/tunnel   - WebSocket SSH tunnel (raw TCP)
            └── /_/sandboxes/:id/shell    - WebSocket interactive shell (parsed events + generative UI)
         Proxy: /proxy/* → Backend Proxy Engine (deferred auth — backend decides per-endpoint)
         FaaS: /faas/* → Backend Compute Engine
         AI: /ai/* → Backend AI Engine
            ├── /_/ai/sessions  - Create LLM session (JWT/API key auth)
            └── /ai/ws           - AI agent WebSocket (session token auth)
```

**Authentication Flow**:
- Client-side auth via Neon Auth (social login)
- Proxy validates JWT using JWKS from Neon
- Protected routes require valid JWT token or API key (`tdsk_*` Bearer token)
- `/ai/ws` uses session token auth (`?token=<session-token>` query param) — verified by backend, not proxy

### Workspace Structure (`repos/`)

| Directory | Role | Tech | Skill |
|-----------|------|------|-------|
| `proxy/` | Auth Gateway - JWT/JWKS validation, backend proxying | Express 5, jose, http-proxy-middleware | `.claude/skills/tdsk-proxy/SKILL.md` |
| `backend/` | Core API - Admin CRUD, Proxy Engine, FaaS, AI orchestration, Shell sessions, Generative UI | Express 5, WebSocket, K8s sandbox lifecycle | `.claude/skills/tdsk-backend/SKILL.md` |
| `admin/` | SPA Dashboard | Vite, React, MUI, Jotai | `.claude/skills/tdsk-admin/SKILL.md` |
| `agent/` | Headless AI Agent - instance-based multi-turn orchestration, skill resolution, web tools | TypeScript, pi-mono, streaming SSE/WS | `.claude/skills/tdsk-agent/SKILL.md` |
| `database/` | ORM & migrations | Drizzle, PostgreSQL | `.claude/skills/tdsk-database/SKILL.md` |
| `domain/` | Shared types, models, utilities | TypeScript | `.claude/skills/tdsk-domain/SKILL.md` |
| `components/` | Shared React components/hooks | React, MUI | `.claude/skills/tdsk-components/SKILL.md` |
| `logger/` | Winston-based logging service | Winston | `.claude/skills/tdsk-logger/SKILL.md` |
| `cli/` | Developer CLI for project management | Node.js | `.claude/skills/tdsk-cli/SKILL.md` |
| `tsa/` | Terminal TSA for AI agent interaction | Bun, Pi-TUI, @keg-hub/args-parse, Mutagen | `.claude/skills/tdsk-tsa/SKILL.md` |
| `sandbox/` | Pluggable sandbox execution layer + runtime-aware pod manifest | K8s pods, isolated-vm, just-bash, isomorphic-git, runtime presets | `.claude/skills/tdsk-sandbox/SKILL.md` |
| `integration/` | API & E2E integration tests | Vitest, Playwright | `.claude/skills/tdsk-integration/SKILL.md` |
| `website/` | Marketing site + docs portal | Vite, React, MUI, MDX, Shiki, docs from root `docs/` | `.claude/skills/tdsk-website/SKILL.md` |
| `threads/` | User-facing threads SPA — sandbox sessions, AST-based GUI engine, terminal | Vite, React, MUI, Jotai, Neon Auth, ghostty-web | `.claude/skills/tdsk-threads/SKILL.md` |

## Sub-Repo Skills

**IMPORTANT**: Before working on any sub-repo, load its corresponding skill file for comprehensive knowledge of the codebase structure, patterns, and best practices.

### How to Use Skills
Load the relevant skill when working on a specific repo:
- Working on admin UI? → Read `.claude/skills/tdsk-admin/SKILL.md` first
- Adding API endpoints? → Read `.claude/skills/tdsk-backend/SKILL.md` first
- Building AI agents? → Read `.claude/skills/tdsk-agent/SKILL.md` first
- Modifying database schema? → Read `.claude/skills/tdsk-database/SKILL.md` first
- Working on the tsa cli? → Read `.claude/skills/tdsk-tsa/SKILL.md` first
- Working on sandbox execution? → Read `.claude/skills/tdsk-sandbox/SKILL.md` first
- Working on the marketing site or docs? → Read `.claude/skills/tdsk-website/SKILL.md` first
- Working on the threads SPA? → Read `.claude/skills/tdsk-threads/SKILL.md` first

### Available Skills
| Skill File | Contents |
|------------|----------|
| `tdsk-admin/SKILL.md` | React/Vite architecture, Jotai state, MUI theming, React Router v7 loaders, components, actions, Skills/Schedules UI, Billing, Quota tracking |
| `tdsk-agent/SKILL.md` | Instance-based multi-turn agent orchestration (init/runTurn/updateConfig/destroy), skill resolver, context manager, web tools (Jina), artifact tool, thinking support, sandbox+web tools |
| `tdsk-backend/SKILL.md` | Express 5 API, Skills/Schedules/Shell/Monitor endpoints, OpenAI-compatible chat completions, InterpreterService (generative UI), Scheduler (cron), EgressProxy (MITM), enforceQuota/projectAccessGuard/projectMemberGuard/featureGate/rateLimit middleware, sandbox lifecycle |
| `tdsk-cli/SKILL.md` | CLI command structure, DevOps orchestration, Docker/K8s secrets (incl. egress CA), contexts (app/proxy/backend/admin/caddy/sandbox/init), task groups (db/deploy/devspace/docker/kube/web/npm) |
| `tdsk-components/SKILL.md` | React components (incl. ArtifactRenderer, ChatComponents, FeatureGate, Header, Avatar, Chip, NavRail), icons, hooks, Monaco editor, theming. See `repos/components/src/` |
| `tdsk-database/SKILL.md` | Drizzle ORM, schema files in `repos/database/src/schemas/`, services in `repos/database/src/services/`, quotas/subscriptions/sandboxes/invoices |
| `tdsk-domain/SKILL.md` | Model classes in `repos/domain/src/models/`, type files in `repos/domain/src/types/`, terminal parser module, GUI types, sync types, LLM provider brands, crypto, permissions, provider templates |
| `tdsk-logger/SKILL.md` | Winston configuration, buildApiLogger factory, secret redaction, stdio monkey-patching, loadEnvs scripts |
| `tdsk-proxy/SKILL.md` | JWKS auth validation, API key auth, deferred auth for /proxy, session token auth for /ai/ws, rate limiting (11 middleware), dual-proxy (backend + sandbox subdomain), WebSocket upgrade dispatch |
| `tdsk-tsa/SKILL.md` | Pi-TUI terminal CLI, tsa binary, 12 CLI tasks (incl. sandbox/sync/sessions/ssh) + 19 slash commands, Mutagen file sync, thread branching, config system, session-based LLM proxy |
| `tdsk-sandbox/SKILL.md` | Pluggable sandbox factory (Local + K8s), KubeSandbox (K8s exec API), LocalSandbox (just-bash + V8 isolate), IsolateRunner (14 Node.js shims), git integration (isomorphic-git, 22 subcommands), evaluate/reset methods |
| `tdsk-website/SKILL.md` | Vite + React + MUI marketing site, MDX docs portal from root `/docs`, Shiki code highlighting, MermaidBlock, DocsSidebar, remarkDocsLinks plugin, vitePluginDocsAssets, pricing tiers |
| `tdsk-threads/SKILL.md` | User-facing threads SPA, sandbox session management, WebSocket streaming, AST-based GUI engine (tokenizer/parser/AST/engine/visitors), ASTNodes (15), ActivityFeed, ghostty-web terminal, SmartInput, org/project-scoped routing, Neon Auth, Jotai state |
| `gen-test/SKILL.md` | Vitest test generation following project conventions, co-located test files, mock patterns per repo type |
| `tdsk-integration/SKILL.md` | Three-tier integration testing (API, Playwright UI, E2E flows), sandbox lifecycle tests, WebSocket tunnel tests |

### Workflow Skills
| Skill File | Purpose |
|------------|---------|
| `commit-message/SKILL.md` | Conventional commit message generation from staged changes |
| `react-dedup/SKILL.md` | Analyze and refactor duplicate React components |
| `runner/SKILL.md` | Pick and implement tasks from TASKS.md |
| `skill-builder/SKILL.md` | Create new Claude Code skills with proper structure |
| `task-validator/SKILL.md` | Validate completed TASKS.md implementations: completeness, code quality, test coverage, cross-repo impact |
| `todo-triage/SKILL.md` | Triage TODO.md items into detailed TASKS.md entries |
| `update-docs/SKILL.md` | Detect changes, compare against docs/ and repos/website, update/create documentation to stay in sync |
| `update-integration-tests/SKILL.md` | Detect changes, update/create integration tests, run full suite, fix all failures until green |
| `verify-completion/SKILL.md` | Mandatory pre-completion verification: enumerate deliverables, run type checks, run tests, scan for deferred work, audit adjacent issues |

### Subagents

Custom subagents live in `.claude/agents/`:
| Agent File | Purpose |
|------------|---------|
| `security-reviewer.md` | Security-focused code review for auth, secrets, payments, proxy changes |
| `task-reviewer.md` | Task implementation review for completeness, code quality, and test coverage validation |
| `accountability-reviewer.md` | Adversarial reviewer that catches skipped, deferred, or half-done work — run after every implementation |

### Database & Authentication

**Neon.com** is used as both the PostgreSQL database provider and for user authentication.

**Neon Auth** is integrated in the admin repo via `@neondatabase/neon-js`:
- `createAuthClient()` from `@neondatabase/neon-js/auth` - Auth client
- `NeonAuthUIProvider` from `@neondatabase/neon-js/auth/react` - React provider
- Social sign-in (GitHub, GitLab, Google, Vercel) for user authentication
- Auth URL configured via `TDSK_AUTH_URL` environment variable

### Database Schema (Exclusive Arc Pattern)

Key tables (32 Drizzle-managed, see `repos/database/src/schemas/`): `organizations`, `users`, `projects`, `endpoints`, `functions`, `providers`, `secrets`, `api_keys`, `roles`, `agents`, `threads`, `messages`, `assets`, `quotas`, `subscriptions`, `domains`, `certificates`, `invitations`, `sandboxes`, `invoices`, `skills`, `schedules`, `sandbox_sessions`, `schedule_runs`, `permission_overrides`

Junction tables: `agent_projects`, `agent_functions`, `agent_providers`, `agent_skills`, `sandbox_projects`, `sandbox_providers`, `sandbox_skills`, `project_providers`, `sandbox_project_providers`

Polymorphic relationships use "Exclusive Arc" - e.g., `secrets` belong to Org OR Agent OR Project OR Provider (exactly one of four, not multiple).
- `quotas` - Org resource usage tracking (6 resource types: projects, compute, threads, messages, endpoints, secrets)
- `subscriptions` - User payment plans and Stripe integration (tier, status, stripeCustomerId, stripeSubscriptionId)
- `skills` - Org-scoped AI agent skills (instructions, tools, triggerKeywords, alwaysActive)
- `schedules` - Cron-based agent execution (cronExpression, prompt, error tracking)

## Common Commands

```bash
# Install (PNPM required - enforced)
pnpm install

# Type-check all repos
pnpm types

# Run unit tests via vitest (excludes integration)
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
> **IMPORTANT**: Domain and database don't have build scripts (TypeScript source consumed directly via aliases). Backend and admin have build scripts. Let me run tests for domain/database, and builds for backend/admin.

**Integration** (`repos/integration/`)
```bash
pnpm test           # Vitest API integration tests (tier1/tier3, requires K8s)
pnpm test:all       # API tests + Playwright E2E tests
pnpm test:ui        # Playwright E2E tests only (tier2, requires admin UI)
```
> **Note**: Integration tests require K8s services running (`tdsk dev start --clean`). UI tests also require the admin dev server (`cd repos/admin && pnpm start`).

> **All repos** support `pnpm types` for type-checking and `pnpm test` for unit tests. Domain and database have no `build` script (TypeScript source consumed directly via aliases).

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
tdsk kube secret egress                    # Create egress proxy CA cert k8s secret
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

# Only be use for health checks, all other requests must go through the proxy
curl -sf http://localhost:5885/_/health                  # Backend direct

```

### API Validation
```bash
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
1.  UNDERSTAND  — Load skill file, explore codebase
2.  IMPLEMENT   — Write/Edit code
3.  BUILD       — pnpm build (dependency order: domain → database → logger → rest)
4.  TEST        — pnpm test (unit tests, no network needed)
5.  DEPLOY      — tdsk dev start --clean (k8s services)
5b. FRONTEND    — cd repos/admin && pnpm start (local Vite)
6.  VALIDATE    — curl health checks + Playwright UI
7.  DEBUG       — tdsk dev log --context <svc> --follow
8.  FIX         — Iterate on errors
9.  VERIFY      — Run verify-completion skill (MANDATORY before reporting done)
10. REVIEW      — Spawn accountability-reviewer agent (catches skipped/deferred work)
11. COMMIT      — Only when user requests
```

### Commands Notes

* Linting and formatting are automatic, so `lint` and `format` commands should be ignored.

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
