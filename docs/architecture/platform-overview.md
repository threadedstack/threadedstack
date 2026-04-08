# Platform Overview

**Last updated:** 2026-04-03

---

## What is Threaded Stack

Threaded Stack is an **AI operations layer** for companies integrating AI agents into their workflows. It sits alongside existing tooling and solves the governance, security, and sharing problems that come with deploying AI agents across an organization.

### Core Problems Solved

1. **Secret exposure** -- AI agents and users never see raw credential values. Secrets use `{{PLACEHOLDER}}` references that are replaced just-in-time outside the agent's context via the MITM proxy. Encryption uses AES-256-GCM with HKDF key derivation from a master key (`repos/domain/src/crypto/crypto.ts`).

2. **Environment inconsistency** -- Sandboxes provide secure, consistent, pre-configured containers where AI agents run. All traffic routes through the proxy for secret management, so every execution environment behaves identically regardless of where or how the agent is invoked.

3. **Siloed setups** -- A shared entity model (org -> projects -> resources) eliminates per-engineer custom configurations. Agents, functions, tools, and secrets are configured once at the org level and shared across projects and teams.

4. **Access control** -- Users are scoped to organizations and projects via a role-based permission system (viewer, member, admin, owner, super). Resources are only exposed to projects they have been assigned to. A 17-resource permission matrix (`repos/domain/src/constants/values.ts`) governs who can do what.

5. **Maintenance burden** -- Centralized configuration means agents, tools, and secrets are updated in one place and propagate to all connected projects. Provider configuration, model selection, and secret rotation happen at the org level.

6. **Onboarding friction** -- Environment consistency and reuse of existing tools (Claude Code, Codex, OpenCode, or any Docker-compatible AI tool) reduce the learning curve. New team members join an org and immediately have access to configured agents and environments.

### Key Differentiator

**"Bring your own AI tool, we make it secure and managed."** Sandboxes can host any off-the-shelf AI tool -- anything that runs in a Docker container. Users connect directly to the sandbox (SSH or similar). All traffic goes through the MITM proxy, so the tool works normally but never sees real credentials. When the sandbox tears down, nothing leaks.

---

## System Topology

```
                                    +---------------------------+
                                    |      External APIs        |
                                    |  (LLM providers, user     |
                                    |   APIs, webhooks, etc.)   |
                                    +----------+----------------+
                                               ^
                                               |
+--------+     +-------------------+     +-----+-------+     +-----------+
|        |     |                   |     |             |     |           |
| Client +---->+  Caddy (TLS/LB)  +---->+ Auth Proxy  +---->+  Backend  |
|        |     |  :443, :8080     |     |  :7118      |     |  :5885    |
+--------+     +-------------------+     +------+------+     +-----+-----+
                                                |                   |
                                                |                   +----> Neon PostgreSQL
                                                |                   |
                                                |                   +----> Sandboxes
                                                |                          (E2B / Local / K8s)
                                                |
                                         (WebSocket upgrade
                                          for /ai/ws)
```

### Service Roles

| Service | Port | Role |
|---------|------|------|
| **Caddy** | :443 (HTTPS), :8080 (HTTP), :2019 (admin) | TLS termination, load balancing, automatic certificate management via certmagic (backed by PostgreSQL storage). Single external entry point. |
| **Auth Proxy** | :7118 | Triple-auth gateway: JWT validation via JWKS (Neon Auth), API key validation (`tdsk_*` Bearer tokens), and session token validation (`Authorization: Session <token>` for `/ai/ws`). Forwards authenticated requests to Backend with `X-User-Id`, `X-User-Role`, `X-User-Email` headers. |
| **Backend** | :5885 | Core API server. Admin CRUD (`/_/*`), proxy engine (`/proxy/*`), AI engine (`/ai/*`), payment webhooks, email service. Orchestrates agent execution, secret injection, and sandbox lifecycle. |
| **Neon PostgreSQL** | (cloud) | Database provider and user authentication (Neon Auth). 23 tables managed via Drizzle ORM. |

### Auth Flow

Each route gets exactly one auth mechanism -- never multiple:

- **Public routes** (`/health`, `/domains/validate`) -- Skip all auth.
- **Session routes** (`/ai/ws`) -- Skip JWT and API key auth. Require session token (ephemeral, created via `POST /_/ai/sessions`, validated by backend).
- **All other routes** (`/_/*`, `/proxy/*`, other `/ai/*`) -- JWT or API key required. API key auth is a fallback if JWT does not set `req.user`.

Source: `repos/proxy/src/middleware/setupAuth.ts`, `repos/proxy/src/middleware/setupApiKeyAuth.ts`, `repos/proxy/src/middleware/setupSessionAuth.ts`

---

## Interaction Surfaces

### 1. Sandbox Connect (Primary)

The recommended way to use Threaded Stack. Developers run `tsa run <sandbox-id>` to start a managed sandbox, sync files, and launch their AI tool of choice (Claude Code, Codex, OpenCode, or custom). Every new organization is seeded with four built-in sandbox presets that are immediately startable. `tsa ssh <sandbox-id>` provides plain SSH access without launching a runtime. All sandbox traffic routes through the MITM proxy for transparent secret injection.

Source: `repos/repl/src/tasks/run.ts`, `repos/sandbox/`, `repos/backend/src/services/sandboxes/`

### 2. REPL CLI (`tsa chat`)

A terminal-native TUI built with Ink (React for CLIs) and compiled to a standalone binary via Bun. Developers authenticate with an API key (`tsa login <key>`), browse agents and threads, then enter an interactive chat session. The REPL runs the agent ReAct loop locally but proxies all LLM calls through the backend WebSocket (`/ai/ws`) so API keys never leave the server. Supports context injection from `AGENTS.md` and `.tdsk/context/` files, 16 slash commands, lifecycle hooks, and YAML-based two-layer configuration (global + project).

Source: `repos/repl/` -- binary name `tsa`, package `@tdsk/repl`

### 3. Threads Web App (`repos/threads`)

A browser-based interface for non-developer users to interact with AI agents through a conversation-oriented UI. Built as a separate Vite SPA (package `@tdsk/threads`). Shares authentication infrastructure with the admin dashboard via Neon Auth.

**Status:** Partially built -- has routing, auth, state management, and page scaffolding. Completion is in progress for beta launch.

Source: `repos/threads/` -- package `@tdsk/threads`

### 4. API (SSE / WebSocket)

Programmatic integration for embedding agent execution into existing codebases. Two paths:

- **SSE** -- `POST /_/agents/:id/run` streams agent events (text, tool calls, tool results, errors, done) as server-sent events. Authenticated via JWT or API key.
- **WebSocket** -- `WS /ai/ws?token=<session-token>` provides bidirectional streaming with session-token auth. The session token is obtained from `POST /_/ai/sessions` which resolves the API key server-side.

Source: `repos/backend/src/endpoints/agents/runAgent.ts`, `repos/backend/src/endpoints/ai/`


---

## Workspace Structure

The monorepo contains 14 sub-repositories under `repos/`, managed with PNPM workspaces.

| Directory | Package | Role | Key Technologies |
|-----------|---------|------|-----------------|
| `admin/` | `@tdsk/admin` | SPA dashboard -- org/project/agent management, billing, quota tracking, AI chat | Vite, React, MUI, Jotai, TanStack React Query, Emotion, Neon Auth |
| `agent/` | `@tdsk/agent` | Headless AI agent orchestration library -- ReAct loop, streaming, tool execution | TypeScript, pi-mono (`@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`), SSE, WebSocket |
| `backend/` | `@tdsk/backend` | Core API server -- admin CRUD, proxy engine, FaaS, AI orchestration, payments, email | Express 5, tsup, Stripe, Resend/Mailgun |
| `cli/` | `@tdsk/cli` | Developer CLI -- DevOps orchestration, Docker/K8s management, service lifecycle | Node.js, `@keg-hub/args-parse` |
| `components/` | `@tdsk/components` | Shared React component library -- 30+ components, 8 hook categories, Monaco editor | React, MUI, tsup |
| `database/` | `@tdsk/database` | ORM layer and migration system -- 23 schemas, 17 services, connection pooling | Drizzle ORM, PostgreSQL (Neon), `pg` |
| `domain/` | `@tdsk/domain` | Shared foundation -- 19 model classes, types, crypto, permissions, constants | TypeScript (consumed as source, no build step) |
| `integration/` | `@tdsk/integration` | API and E2E integration tests -- three-tier strategy | Vitest, Playwright |
| `logger/` | `@tdsk/logger` | Winston-based logging service -- `buildApiLogger` factory, secret redaction | Winston |
| `proxy/` | `@tdsk/proxy` | Auth gateway -- JWT/JWKS validation, API key auth, session auth, request forwarding | Express 5, jose, http-proxy-middleware |
| `repl/` | `@tdsk/repl` | Terminal REPL for AI agent interaction -- `tsa` binary | Bun, Ink (React TUI), `@keg-hub/args-parse` |
| `sandbox/` | `@tdsk/sandbox` | Pluggable sandbox execution layer -- isolated environments for agent code | isolated-vm, E2B SDK, just-bash (consumed as source, no build step) |
| `threads/` | `@tdsk/threads` | Threads web app -- browser-based AI chat for non-developers | Vite, React |
| `website/` | `@tdsk/website` | Marketing website and pricing page | Vite, React |

### Dependency Graph (Build Order)

```
domain (no build)
  |
  +---> database (no build)
  |       |
  +---> logger (no build)
  |       |
  +-------+---> backend (tsup -> dist/index.cjs)
  |       |
  +-------+---> proxy (tsup -> dist/index.cjs)
  |
  +---> sandbox (no build)
  |       |
  +-------+---> agent (tsup -> dist/index.cjs)
  |
  +---> components (tsup)
  |       |
  +-------+---> admin (vite -> dist/)
  |
  +---> threads (vite -> dist/)
  +---> website (vite -> dist/)
```

Domain, database, logger, and sandbox have no build step -- their TypeScript source is consumed directly via path aliases.

---

## Shared Entity Model

Resources in Threaded Stack are organized in a hierarchical ownership model. Org-level configuration propagates to projects, which scope the resources available to endpoints, agents, and users.

```
+-------------------+
|   Organization    |  (top-level container)
|                   |
|  - Owner (User)   |
|  - Members (Roles)|
|  - Subscription   |
|  - Quota tracking |
+--------+----------+
         |
         |  owns
         |
    +----+----+----+----+----+----+
    |         |         |         |
    v         v         v         v
+-------+ +-------+ +-------+ +-----------+
|Secrets| |Provid-| |Agents | |Invitations|
|(org-  | | ers   | |       | |           |
|scoped)| |(org-  | |       | +-----------+
+-------+ |scoped)| +---+---+
          +-------+     |
                        |  assigned to (via junction tables)
                        |
    +-------------------+-------------------+
    |                   |                   |
    v                   v                   v
+--------+       +----------+       +----------+
|Projects|       |Functions |       |Providers |
|        |       |(agent-   |       |(agent-   |
|        |       | scoped)  |       | scoped,  |
|        |       +----------+       | priority)|
+---+----+                          +----------+
    |
    |  contains
    |
    +----+----+----+----+
    |         |         |
    v         v         v
+-------+ +-------+ +-------+
|End-   | |Funct- | |Secrets|
|points | |ions   | |(proj- |
|(proxy,| |       | |scoped)|
| faas, | +-------+ +-------+
| agent)|
+-------+
```

### Key Relationships

- **Organizations** own providers, secrets, agents, projects, and invitations. One user can own multiple orgs (limited by subscription tier).
- **Agents** are org-scoped but connect to projects, functions, and providers via many-to-many junction tables (`agent_projects`, `agent_functions`, `agent_providers`). Providers on an agent have priority ordering.
- **Secrets** use a 4-way exclusive arc pattern: each secret belongs to exactly one of org, project, provider, or agent (with one additional valid combo: org + provider). Encryption uses AES-256-GCM with HKDF key derivation.
- **Endpoints** are project-scoped and come in three types: proxy (HTTP forwarding with transforms), FaaS (sandboxed function execution), and agent (AI agent execution with SSE streaming).
- **Threads** belong to an org and optionally to an agent and project. They support branching (creating a new thread from a specific message in an existing thread).
- **Roles** use a 2-way exclusive arc: each role is scoped to either an org or a project, with a unique constraint on `(userId, orgId)` and `(userId, projectId)`.

Source: `repos/database/src/schemas/` (23 table definitions), `repos/domain/src/models/` (19 model classes)

---

## Service Architecture

### Development Environment

Development uses **Kubernetes via DevSpace** for the backend services (Caddy, Proxy, Backend), while the admin SPA runs locally via Vite dev server.

```
+-------------------------------------------+
|  Kubernetes Cluster (DevSpace)            |
|                                           |
|  +-------+  +--------+  +---------+      |
|  | Caddy |  | Proxy  |  | Backend |      |
|  | :443  |->| :7118  |->| :5885   |---+  |
|  +-------+  +--------+  +---------+   |  |
|                                        |  |
+----------------------------------------+--+
                                         |
                              Neon PostgreSQL (cloud)

+-----------------+
| Local Host      |
|                 |
|  Admin SPA      |
|  :5887 (Vite)   |
+-----------------+
```

K8s auto-syncs local files and auto-restarts services -- code on disk is always the running code. The `tdsk` CLI (`repos/cli/`) manages all service lifecycle operations (start, stop, logs, enter pods, render Helm templates).

### Configuration Loading Order

Configuration is loaded by `@keg-hub/parse-config` with later sources overriding earlier ones:

| Priority | Source | Purpose |
|----------|--------|---------|
| 1 (lowest) | `deploy/values.yaml` | Base config: ports, hosts, public settings |
| 2 | `deploy/values.local.yaml` | Local overrides for `NODE_ENV=local` |
| 3 (highest) | `~/.config/tdsk/values.yaml` | Secrets: DB credentials, API keys, master key, payment keys |

Each repo has a config loader in `configs/` that reads from environment variables populated by this merge chain. For example, `repos/backend/configs/backend.config.ts` builds sections for `server`, `proxy`, `database`, `logger`, `email`, and `payments`.

### Kubernetes Secrets

Sensitive values are injected into K8s pods via secrets managed by the `tdsk` CLI:

```
tdsk kube secret database    # DB connection string
tdsk kube secret payments    # Stripe keys
tdsk kube secret email       # Email provider keys
tdsk kube secret docker      # Docker registry auth
tdsk kube secret tdsk        # Master encryption key
```

---

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **API Framework** | Express 5 | Backend and proxy HTTP servers |
| **ORM** | Drizzle ORM | Type-safe PostgreSQL queries, migrations, schema management |
| **Database** | PostgreSQL (Neon) | Primary data store + user authentication (Neon Auth) |
| **Frontend** | React, Vite, MUI (Material UI) | Admin dashboard, threads app, website |
| **State Management** | Jotai | Lightweight atomic state for admin SPA |
| **API Caching** | TanStack React Query | Client-side request caching with stale-while-revalidate |
| **Authentication** | Neon Auth (JWKS/JWT), API keys (`tdsk_*`) | Social OAuth, programmatic access |
| **AI Agent Runtime** | pi-mono (`@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`) | Multi-provider LLM streaming (Anthropic, OpenAI, Google), ReAct agent loop |
| **Sandbox Isolation** | isolated-vm (V8), E2B (Firecracker microVMs), just-bash | Code execution isolation with graceful degradation |
| **Payments** | Stripe | Subscription billing, checkout sessions, customer portal, webhooks |
| **Email** | Resend, Mailgun (strategy pattern) | Invitation and notification emails |
| **Logging** | Winston | Structured logging with secret redaction |
| **CLI Runtime** | Bun | REPL binary compilation and execution |
| **Terminal UI** | Ink (React for CLIs) | REPL interactive chat interface |
| **Build Tools** | tsup, Vite, Bun | Backend/library bundling, frontend dev/build, binary compilation |
| **Infrastructure** | Kubernetes, DevSpace, Caddy, Helm | Container orchestration, dev environment, TLS/load balancing |
| **Monorepo** | PNPM workspaces | Package management, workspace linking |
| **Testing** | Vitest, Playwright | Unit tests, API integration tests, E2E browser tests |

### Subscription Tiers (Current)

Defined in `repos/domain/src/constants/plans.ts`:

| Tier | Orgs | Projects | Compute Units | Threads | Messages | Endpoints | Secrets | Retention | Seats |
|------|------|----------|--------------|---------|----------|-----------|---------|-----------|-------|
| **Free** | 1 | 2 | 1,000 | 100 | 500 | 3 | 5 | 7 days | 1 |
| **Solo** | 2 | 10 | 10,000 | 1,000 | 10,000 | 20 | 25 | 30 days | 1 |
| **Pro** | 5 | 50 | 100,000 | unlimited | unlimited | unlimited | unlimited | 90 days | 3 |
| **Team** | unlimited | unlimited | unlimited | unlimited | unlimited | unlimited | unlimited | 365 days | 10 |

Quota tracking uses atomic SQL increments (`INSERT ... ON CONFLICT DO UPDATE`) to prevent race conditions. Source: `repos/database/src/services/quota.ts`
