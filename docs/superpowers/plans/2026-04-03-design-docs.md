# Design Docs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular documentation suite for Threaded Stack covering architecture, features, user guides, and business positioning — aligned with the beta launch strategy.

**Architecture:** Four-phase doc build (scaffold → architecture → features → user guide → business) with each document as an independent task. Existing docs and skill files serve as source material. Each doc follows the convention of separating "what exists today" from "what's planned."

**Tech Stack:** Markdown documentation, ASCII diagrams, references to codebase source files

**Spec:** `docs/superpowers/specs/2026-04-03-design-docs-strategy.md`

**Important rules for all tasks:**
- NEVER commit, amend, or change git history — user handles all commits manually
- NEVER leave TODO/FIXME comments in any doc — if something is unknown, mark it as "Planned" or ask the user
- Each doc must clearly separate **Current** (implemented) vs **Planned** (not yet built) sections
- Use ASCII diagrams for architecture visuals (no external image dependencies for new docs)
- Reference source files with exact paths (e.g., `repos/backend/src/services/proxy/egress.ts`)
- Read all listed source files BEFORE writing — do not speculate about implementation details
- Skill files (`.claude/skills/tdsk-*/SKILL.md`) are the richest source material for each repo

---

## Chunk 1: Scaffold + Architecture Docs

### Task 0: Create Directory Structure and Index

**Files:**
- Create: `docs/index.md`
- Create: `docs/architecture/` (directory)
- Create: `docs/features/` (directory)
- Create: `docs/user-guide/` (directory)
- Create: `docs/business/` (directory)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p docs/architecture docs/features docs/user-guide docs/business
```

- [ ] **Step 2: Write `docs/index.md` scaffold**

Write the master index with links to all planned docs. Mark unwritten docs with "(coming soon)". Structure:

```markdown
# Threaded Stack Documentation

## What is Threaded Stack?
[2-3 sentence summary from spec: AI operations layer, governance/security/sharing for AI agents]

## Documentation

### Architecture
- [Platform Overview](architecture/platform-overview.md)
- [Request Flow](architecture/request-flow.md)
- [Data Model](architecture/data-model.md)
- [Security Model](architecture/security-model.md)
- [Sandbox Architecture](architecture/sandbox-architecture.md)

### Features
- [Proxy Endpoints](features/proxy-endpoints.md)
- [FaaS Endpoints](features/faas-endpoints.md)
- [Agent Endpoints](features/agent-endpoints.md)
- [Sandbox Connect](features/sandbox-connect.md)
- [Threads](features/threads.md)
- [Organizations](features/organizations.md)
- [Secrets](features/secrets.md)
- [Billing](features/billing.md)

### User Guide
- [Getting Started](user-guide/getting-started.md)
- [Admin Dashboard](user-guide/admin-ui.md)
- [REPL CLI](user-guide/repl-cli.md)
- [Threads App](user-guide/threads-app.md)
- [Sandbox Usage](user-guide/sandbox-usage.md)
- [API Reference](user-guide/api-reference.md)

### Business
- [Value Proposition](business/value-proposition.md)
- [Go-To-Market](business/go-to-market.md)
- [Pricing](business/pricing.md)

### Internal Reference
- [Local Development](meta/local.md)
- [SSL Setup](meta/ssl.md)
- [Environments](meta/environments.md)
- [Kubernetes Setup](tech/kube-setup.md)
```

---

### Task 1: Platform Overview (`docs/architecture/platform-overview.md`)

**Source material to read:**
- `.claude/skills/tdsk-backend/SKILL.md` — backend architecture, endpoint type system
- `.claude/skills/tdsk-proxy/SKILL.md` — auth gateway architecture
- `.claude/skills/tdsk-sandbox/SKILL.md` — sandbox provider architecture
- `.claude/skills/tdsk-agent/SKILL.md` — agent runtime architecture
- `.claude/skills/tdsk-admin/SKILL.md` — admin SPA architecture
- `.claude/skills/tdsk-repl/SKILL.md` — REPL CLI architecture
- `.claude/skills/tdsk-database/SKILL.md` — database/ORM architecture
- `.claude/skills/tdsk-domain/SKILL.md` — shared types/models
- `docs/superpowers/specs/2026-04-03-design-docs-strategy.md` — product direction and value prop
- Root `CLAUDE.md` — workspace structure table and architecture overview

**Files:**
- Create: `docs/architecture/platform-overview.md`

- [ ] **Step 1: Read all source material listed above**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **What is Threaded Stack** — AI operations layer positioning (from spec). Core problems solved. Key differentiator ("bring your own AI tool, we make it secure and managed").

2. **System Topology** — ASCII diagram showing: Client → Caddy (TLS) → Auth Proxy (JWT/JWKS) → Backend (API) → External APIs/DB/Sandboxes. Include port numbers and service roles.

3. **Four Agent Interaction Surfaces** — REPL CLI, Threads web app, API (SSE/WS), Sandbox direct connect. One paragraph each explaining what it is, who it's for, and current implementation status.

4. **Workspace Structure** — Table of all 14 repos under `repos/` with package name, role, tech stack. Repos: admin, agent, backend, cli, components, database, domain, integration, logger, proxy, repl, sandbox, threads, website.

5. **Shared Entity Model** — How org-level configuration (secrets, providers, agents, functions) propagates to projects and users. ASCII diagram: Org → Projects → Endpoints/Functions/Secrets. Users scoped via Roles.

6. **Service Architecture** — How services run (K8s via DevSpace for dev, standalone for prod). Config loading order (values.yaml → values.local.yaml → ~/.config/tdsk/values.yaml).

7. **Tech Stack Summary** — Key technologies: Express 5, Drizzle ORM, PostgreSQL (Neon), React/Vite/MUI, Jotai, isolated-vm, K8s, Stripe.

- [ ] **Step 3: Cross-reference against codebase**

Verify repo list matches actual `repos/` directories. Verify port numbers match `deploy/values.yaml`. Verify tech stack claims match `package.json` files.

---

### Task 2: Request Flow (`docs/architecture/request-flow.md`)

**Source material to read:**
- `.claude/skills/tdsk-proxy/SKILL.md` — auth middleware, routing rules
- `.claude/skills/tdsk-backend/SKILL.md` — endpoint type system, middleware chain
- `repos/proxy/src/middleware/setupAuth.ts` — JWT/JWKS/API key validation logic
- `repos/backend/src/endpoints/endpoints.ts` — endpoint registration
- `repos/backend/src/endpoints/agents/runAgent.ts` — agent run route entry point
- `repos/backend/src/services/endpoints/agentEndpoint.ts` — AgentEndpoint service (SSE flow)
- `repos/backend/src/endpoints/proxy/endpoint.ts` — proxy route handler
- `repos/backend/src/services/endpoints/proxyEndpoint.ts` — ProxyEndpoint service (forwarding logic)
- `repos/backend/src/services/proxy/proxy.ts` — ProxyService (OAuth, secret resolution, options)
- `repos/backend/src/services/endpoints/faasEndpoint.ts` — FaaS execution (first 80 lines)

**Files:**
- Create: `docs/architecture/request-flow.md`

- [ ] **Step 1: Read all source material listed above**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **Overview** — All requests flow through Caddy → Proxy → Backend. The proxy is the single entry point for all external traffic.

2. **Authentication Flow** — Three auth mechanisms:
   - JWT (Neon Auth social login) — JWKS validation, user identity extraction
   - API Key (`tdsk_*` prefix) — hash-based lookup, skips JWT
   - Session Token (WebSocket only) — query param `?token=`, verified by backend
   - ASCII diagram showing each auth path

3. **Route Categories** — Table mapping URL patterns to handlers:
   - `/health` → Proxy health (public)
   - `/auth/*` → Auth endpoints
   - `/_/*` → Backend Admin API
   - `/proxy/*` → Backend Proxy Engine
   - `/faas/*` → Backend Compute Engine
   - `/ai/*` → Backend AI Engine

4. **Proxy Endpoint Request Lifecycle** — Step-by-step: auth → endpoint lookup → secret fetch → header injection → proxy to target URL → response. ASCII sequence diagram.

5. **FaaS Endpoint Request Lifecycle** — Step-by-step: auth → endpoint lookup → function load → sandbox creation → secret injection → execution → response. ASCII sequence diagram.

6. **Agent Endpoint Request Lifecycle** — Two paths:
   - SSE: `POST /agents/:id/run` → AgentRunner.run() → streaming events
   - WebSocket: `/ai/ws` → session token auth → persistent connection
   - ASCII sequence diagram for each.

7. **Middleware Chain** — Common middleware applied to all requests: CORS, logging, error handling, auth, quota checking.

- [ ] **Step 3: Cross-reference against codebase**

Verify route patterns match actual endpoint registrations. Verify middleware order matches actual Express middleware chain.

---

### Task 3: Data Model (`docs/architecture/data-model.md`)

**Source material to read:**
- `.claude/skills/tdsk-database/SKILL.md` — full schema documentation
- `repos/database/src/schemas/schemas.ts` — all exported schemas
- `repos/database/src/schemas/orgs.ts`, `repos/database/src/schemas/users.ts`, `repos/database/src/schemas/projects.ts` — core entity schemas
- `repos/database/src/schemas/secrets.ts` — exclusive arc example
- `repos/database/src/schemas/quotas.ts` — quota tracking schema
- `repos/database/src/schemas/subscriptions.ts` — subscription schema
- `repos/database/src/schemas/invoices.ts` — invoice schema
- `repos/database/src/schemas/agents.ts` — agent + junction tables
- `repos/database/src/schemas/threads.ts`, `repos/database/src/schemas/messages.ts` — thread/message schemas
- `repos/database/src/schemas/sandboxes.ts` — sandbox schema
- `docs/DATA-MODEL-ARCHITECTURE.md` — existing entity audit (reference, consolidate)
- `repos/domain/src/models/` — domain model classes

**Files:**
- Create: `docs/architecture/data-model.md`

- [ ] **Step 1: Read all source material listed above**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **Overview** — Drizzle ORM with PostgreSQL (Neon). 25 schemas (23 managed + 2 externally-managed: users, certificates). Exclusive Arc pattern for polymorphic relationships.

2. **Entity Relationship Diagram** — ASCII diagram showing core relationships:
   - Org → Projects, Users (via Roles), Secrets, Providers, Agents
   - Project → Endpoints → Functions
   - Agent → AgentProjects, AgentProviders, AgentSkills (junction tables)
   - Thread → Messages → Assets
   - User → Subscriptions (1:1)
   - Org → Quotas

3. **Exclusive Arc Pattern** — Explain with concrete example (secrets belong to exactly ONE of: Org, Project, Provider, Agent). Show how this is enforced in schema (nullable foreign keys with check constraint).

4. **Core Entities** — Table for each major entity group:
   - **Identity**: orgs, users, roles, invitations
   - **Resources**: projects, endpoints, functions, providers, secrets, apiKeys, skills
   - **AI**: agents, agentProjects, agentProviders, agentSkills, threads, messages
   - **Assets**: assets, domains, certificates
   - **Billing**: subscriptions, invoices, quotas
   - **Infrastructure**: sandboxes, schedules
   For each: key columns, relationships, purpose.

5. **Domain Models** — How database schemas map to domain model classes (`repos/domain/src/models/`). The converter pattern (schema row → domain model).

6. **Quota Tracking** — 12 resource types tracked per org per period. How usage increments and resets. How limits are enforced against subscription tier.

- [ ] **Step 3: Cross-reference against codebase**

Verify all 25 schemas (23 managed + 2 externally-managed: users, certificates) are accounted for. Verify exclusive arc columns match actual schema definitions. Verify quota resource types match `repos/domain/src/types/payments.types.ts`.

---

### Task 4: Security Model (`docs/architecture/security-model.md`)

**Source material to read:**
- `repos/domain/src/crypto/crypto.ts` — all crypto functions
- `repos/backend/src/services/proxy/egress.ts` — MITM proxy / egress proxy
- `repos/backend/src/services/secrets/secretResolver.ts` — secret placeholder resolution (SecretResolver service)
- `repos/backend/src/services/endpoints/proxyEndpoint.ts` — endpoint option application
- `repos/backend/src/services/proxy/proxy.ts` — ProxyService (secret resolution in proxy flow)
- `.claude/skills/tdsk-proxy/SKILL.md` — auth validation
- `.claude/skills/tdsk-domain/SKILL.md` — crypto utilities section
- `repos/proxy/src/middleware/setupAuth.ts` — JWT/API key validation
- `repos/backend/src/endpoints/secrets/createSecret.ts` — secret encryption flow

**Files:**
- Create: `docs/architecture/security-model.md`

- [ ] **Step 1: Read all source material listed above**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **Security Philosophy** — Defense in depth. AI agents and end users never see raw credentials. Secrets are encrypted at rest, decrypted only at point of use, and injected outside the agent's context.

2. **Encryption at Rest** — AES-256-GCM with HKDF key derivation. Master key (`TDSK_MASTER_KEY`, 32+ bytes hex). Per-entity derived keys using HKDF (RFC 5869) with entity ref_id as salt. 12-byte IVs, 16-byte auth tags. Base64 encoding for storage.

3. **API Key Security** — Key generation (32 bytes cryptographically random). SHA-256 hashing for storage (raw key never persisted). `tdsk_` prefix for identification. Hash-based lookup at auth time.

4. **JIT Secret Injection** — The core security pattern:
   - Secrets stored encrypted in database
   - When an endpoint/function/agent needs a secret, a placeholder (`{{secret-name}}`) is used in configuration
   - At execution time, placeholders are resolved: decrypt → inject → execute → discard
   - The AI agent or function code never sees the real value
   - ASCII diagram showing the injection flow

5. **MITM Proxy (Sandbox Egress)** — How sandbox traffic is secured:
   - All outbound HTTP/HTTPS from sandbox pods redirected via iptables DNAT
   - Protocol-sniffing TCP layer detects HTTP vs TLS (0x16 first byte)
   - TLS traffic: SNI extracted, converted to HTTP CONNECT tunnel
   - Requests intercepted, placeholder tokens (`tdsk_ph_*`) replaced with real secret values
   - Unresolvable secrets throw (prevent token leakage)
   - CA cert validation via OpenSSL
   - ASCII diagram showing sandbox → MITM proxy → external API flow

6. **Secret Scoping** — Four scoping levels (exclusive arc): Org, Project, Provider, Agent. How scope determines visibility. Users can use secrets but never see values.

7. **Auth Chain** — End-to-end: Client → Caddy (TLS termination) → Proxy (JWT/JWKS or API key validation) → Backend (user identity via X-User-* headers). Session tokens for WebSocket.

- [ ] **Step 3: Cross-reference against codebase**

Verify crypto function signatures match `repos/domain/src/crypto/crypto.ts`. Verify MITM proxy behavior matches `repos/backend/src/services/proxy/egress.ts`. Verify placeholder pattern matches actual code.

---

### Task 5: Sandbox Architecture (`docs/architecture/sandbox-architecture.md`)

**Source material to read:**
- `.claude/skills/tdsk-sandbox/SKILL.md` — full sandbox skill documentation
- `repos/sandbox/src/sandbox.ts` — factory pattern, provider types
- `repos/sandbox/src/kube/kubeSandboxProvider.ts` — K8s provider
- `repos/sandbox/src/kube/kubeClient.ts` — K8s API client
- `repos/sandbox/src/kube/podManifest.ts` — pod creation, naming
- `repos/sandbox/src/local/isolate.ts` — V8 isolate runner
- `repos/sandbox/src/local/shims/` — Node.js builtin shims (list files)
- `repos/backend/src/services/proxy/egress.ts` — MITM proxy (reference, detail in security-model.md)
- `repos/database/src/schemas/sandboxes.ts` — sandbox DB schema

**Files:**
- Create: `docs/architecture/sandbox-architecture.md`

- [ ] **Step 1: Read all source material listed above**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **Overview** — Pluggable sandbox execution layer with factory pattern. Two providers today (Local, Kubernetes), extensible for future providers.

2. **Provider Architecture** — ASCII diagram showing ISandbox interface → factory → providers. ISandbox interface contract (methods: exec, writeFile, readFile, close, etc.).

3. **Local Provider (V8 Isolate)** — How it works:
   - Uses `isolated-vm` for V8 isolate creation
   - IsolateRunner manages lifecycle
   - 14 Node.js builtin shims (fs, path, buffer, crypto, events, os, url, util, querystring, assert, console, process, child_process, fetch)
   - Shim registry pattern with dependency-ordered compilation
   - Use case: development, lightweight function execution

4. **Kubernetes Provider** — How it works:
   - Pods created via SandboxService using K8s API
   - Pod naming: RFC 1123 compliant via `buildPodName()` and `sanitizeLabel()`
   - Container lifecycle: create → run → teardown
   - MITM proxy sidecar for egress traffic interception
   - iptables DNAT for transparent traffic redirection
   - Use case: production, agent hosting, secure execution

5. **MITM Proxy Integration** — How the proxy sidecar works within a sandbox pod (reference `docs/architecture/security-model.md` for crypto details). Diagram showing pod internals: user container ↔ MITM proxy sidecar ↔ external network.

6. **Sandbox Direct Connect** *(Planned)* — The vision for SSH/similar access to sandbox containers. Pre-configured AI tool environments (Claude Code, Codex, OpenCode). How users would connect. How MITM proxy ensures zero credential exposure even with direct access. Mark this section clearly as "Planned — not yet implemented."

7. **Database Schema** — `sandboxes` table structure. How sandbox records track lifecycle state.

- [ ] **Step 3: Cross-reference against codebase**

Verify provider types match factory implementation. Verify shim list matches actual files in `repos/sandbox/src/local/shims/`. Verify pod manifest fields match `podManifest.ts`.

---

## Chunk 2: Feature Docs

### Task 6: Move and Update Proxy Endpoints (`docs/features/proxy-endpoints.md`)

**Source material to read:**
- `docs/endpoints/proxy.md` — existing doc (primary source, move and update)
- `docs/proxy-endpoints.md` — existing implementation notes (consolidate)
- `repos/backend/src/endpoints/proxy/endpoint.ts` — proxy route handler
- `repos/backend/src/services/endpoints/proxyEndpoint.ts` — ProxyEndpoint service (forwarding, options)
- `repos/backend/src/services/proxy/proxy.ts` — ProxyService (OAuth, secret resolution)

**Files:**
- Create: `docs/features/proxy-endpoints.md`
- Existing: `docs/endpoints/proxy.md` (source — content moves here)
- Existing: `docs/proxy-endpoints.md` (source — consolidate)

- [ ] **Step 1: Read both existing docs and source code**

- [ ] **Step 2: Create `docs/features/proxy-endpoints.md`**

Consolidate content from both existing docs into the new location. Update any outdated references. Ensure sections cover:
- What is a proxy endpoint
- Architecture / request flow
- Configuration options (headers, auth, OAuth 2.0, timeouts, domain whitelist, path regex, transformations)
- Secret injection via `{{secret-name}}` template syntax
- Creating a proxy endpoint (admin UI + API)
- Authentication & permissions
- Error handling
- Limits & constraints

- [ ] **Step 3: Move images**

```bash
cp -r docs/endpoints/images/ docs/features/images/ 2>/dev/null || true
```

Update any image references in the new doc to use `images/` relative paths.

- [ ] **Step 4: Verify no broken references**

Check that no other docs reference the old paths. If they do, note them for later cleanup.

---

### Task 7: Move and Update FaaS Endpoints (`docs/features/faas-endpoints.md`)

**Source material to read:**
- `docs/endpoints/faas.md` — existing doc (primary source, move and update)
- `repos/backend/src/services/endpoints/faasEndpoint.ts` — current FaaS handler
- `repos/sandbox/src/sandbox.ts` — sandbox factory used by FaaS
- `.claude/skills/tdsk-sandbox/SKILL.md` — isolate runner details

**Files:**
- Create: `docs/features/faas-endpoints.md`
- Existing: `docs/endpoints/faas.md` (source — content moves here)

- [ ] **Step 1: Read existing doc and source code**

- [ ] **Step 2: Create `docs/features/faas-endpoints.md`**

Move content from existing doc. Update any references to sandbox providers (E2B is now Kube provider). Ensure sections cover:
- What is FaaS
- Architecture / request flow
- Function code (TypeScript/JavaScript)
- Sandbox execution environment (V8 isolate for local, K8s pod for production)
- Node.js builtin shims (14 modules available)
- Secret injection in function context
- Creating functions and FaaS endpoints
- Error handling, limits

- [ ] **Step 3: Verify accuracy against current sandbox implementation**

The sandbox provider names may have changed (E2B → Kube). Verify against `repos/sandbox/src/sandbox.ts`.

---

### Task 8: Agent Endpoints (`docs/features/agent-endpoints.md`)

**Source material to read:**
- `.claude/skills/tdsk-agent/SKILL.md` — agent runtime architecture
- `.claude/skills/tdsk-backend/SKILL.md` — agent endpoint type, AgentEndpoint service
- `repos/agent/src/runner/runner.ts` — AgentRunner class (first 100 lines)
- `repos/agent/src/tools/tools.ts` — tool creation
- `repos/agent/src/adapters/eventBridge.ts` — event mapping
- `repos/agent/src/adapters/messageConverter.ts` — message conversion
- `repos/backend/src/endpoints/agents/` — agent CRUD endpoints (list files)
- `repos/database/src/schemas/agents.ts` — agent schema + junction tables
- `docs/AGENT_INSTRUCTIONS.md` — review for any useful content (mostly outdated)
- `docs/AI_AGENT_PROMPT.md` — review for any useful content (mostly outdated)

**Files:**
- Create: `docs/features/agent-endpoints.md`

- [ ] **Step 1: Read all source material listed above**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **What is an Agent Endpoint** — An endpoint type that runs an AI agent with LLM, tools, and context. Contrast with proxy (forwards requests) and FaaS (runs functions).

2. **Agent Lifecycle** — Configure → attach tools/functions → assign to project → run. ASCII diagram.

3. **Agent Configuration** — LLM provider selection, system prompt, tools attachment, function attachment, secret access. Junction tables: agentProjects, agentProviders, agentSkills.

4. **Execution Paths** — Two ways to run an agent:
   - SSE: `POST /_/agents/:id/run` → AgentRunner.run() → streaming events → auto-destroy
   - WebSocket: `/ai/ws?token=<session-token>` → persistent connection → multi-turn conversation
   - Differences, when to use each.

5. **AgentRunner** — How it works:
   - init(): creates sandbox, loads tools, loads history, creates pi-mono Agent
   - runTurn(): executes agent turn, saves messages to thread
   - destroy(): cleanup
   - Static run(): convenience one-shot method

6. **Tools** — How functions become tools. Tool adapters (web tools, sandbox tools, custom functions). How tools are registered with the agent.

7. **Message Flow** — How messages convert between LLM format and domain format. How thread history is loaded and saved.

8. **Admin UI** — How agents are configured in the dashboard (reference `docs/user-guide/admin-ui.md` for details).

- [ ] **Step 3: Cross-reference against codebase**

Verify AgentRunner methods match actual implementation. Verify junction table names match schema.

---

### Task 9: Sandbox Connect (`docs/features/sandbox-connect.md`)

**Source material to read:**
- `docs/superpowers/specs/2026-04-03-design-docs-strategy.md` — sandbox connect vision (section: Key Differentiator, Four Agent Interaction Surfaces)
- `.claude/skills/tdsk-sandbox/SKILL.md` — current sandbox architecture
- `repos/sandbox/src/kube/kubeSandboxProvider.ts` — K8s provider (what exists)
- `repos/backend/src/services/proxy/egress.ts` — MITM proxy (what exists)

**Files:**
- Create: `docs/features/sandbox-connect.md`

- [ ] **Step 1: Read all source material listed above**

- [ ] **Step 2: Write the document**

This doc has a larger "Planned" section since the SSH/connect layer is not yet built.

**Required sections:**

1. **What is Sandbox Connect** — The ability for users to SSH (or similar) directly into a sandbox container running a pre-configured AI tool. The MITM proxy ensures all traffic is secure.

2. **Vision** — "Bring your own AI tool, we make it secure and managed." Org admins configure environments. Users connect and work. Zero credential exposure.

3. **What Exists Today** *(Current)*:
   - K8s sandbox pods with MITM proxy sidecar
   - Egress traffic interception and secret replacement
   - Sandbox lifecycle management (create, run, teardown)
   - Pod manifest generation with proper naming

4. **What Needs to Be Built** *(Planned)*:
   - SSH/connection layer for direct user access to sandbox pods
   - Pre-configured agent environment images (Claude Code, Codex, OpenCode base images)
   - Admin UI for sandbox environment configuration
   - Session management for connected users
   - Sandbox persistence options (ephemeral vs. persistent volumes)

5. **Security Model** — How MITM proxy ensures security even with direct access. Reference `docs/architecture/security-model.md`.

6. **Use Cases** — Developer connecting to run Claude Code with org secrets. Team lead configuring a standard AI environment for all engineers. Onboarding new developers with pre-configured tooling.

- [ ] **Step 3: Cross-reference "Current" section against codebase**

Verify all claims about existing functionality are accurate.

---

### Task 10: Threads (`docs/features/threads.md`)

**Source material to read:**
- `repos/database/src/schemas/threads.ts` — thread schema
- `repos/database/src/schemas/messages.ts` — message schema
- `repos/backend/src/endpoints/threads/` — thread CRUD endpoints (list files, read key ones)
- `repos/domain/src/models/thread.ts` — thread domain model (if exists)
- `repos/domain/src/models/message.ts` — message domain model (if exists)
- `repos/threads/` — threads web app (list structure, read key files)

**Files:**
- Create: `docs/features/threads.md`

- [ ] **Step 1: Read all source material listed above**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **What are Threads** — Persistent conversation containers. A thread holds a sequence of messages between a user and an agent (or system). Threads belong to agents and projects.

2. **Thread Model** — Schema fields, relationships. Thread → Messages, Thread → Agent, Thread → Project.

3. **Message Types** — user, assistant, system, tool, action. What each type represents. Content format (JSONB).

4. **Thread Branching** — How threads can branch (if implemented). Parent/child thread relationships.

5. **Backend API** — CRUD operations:
   - Create thread, list threads, get thread
   - Create message, list messages
   - Thread history loading for agent context

6. **Threads Web App** *(Current state)* — What exists in `repos/threads/`: routing, auth, state management, pages. What still needs completion.

- [ ] **Step 3: Cross-reference against codebase**

Verify message types match schema enum. Verify API endpoints match backend routes.

---

### Task 11: Organizations (`docs/features/organizations.md`)

**Source material to read:**
- `repos/database/src/schemas/orgs.ts` — org schema
- `repos/database/src/schemas/roles.ts` — roles schema (if separate)
- `repos/database/src/schemas/invitations.ts` — invitation schema
- `repos/backend/src/endpoints/orgs/` — org CRUD endpoints (list files)
- `repos/backend/src/endpoints/invitations/` — invitation endpoints
- `repos/domain/src/models/org.ts` — org domain model
- `.claude/skills/tdsk-admin/SKILL.md` — admin UI org management

**Files:**
- Create: `docs/features/organizations.md`

- [ ] **Step 1: Read all source material listed above**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **The Shared Entity Model** — Orgs are the top-level container. Everything (projects, secrets, providers, agents) belongs to an org. Configuration set at org level propagates to projects.

2. **Org Lifecycle** — Create → configure → add members → create projects → manage. One user can own multiple orgs (based on subscription tier).

3. **Members and Roles** — Role types (super, admin, basic). What each role can do. How roles scope access to resources.

4. **Invitations** — How users are invited to orgs. Invitation lifecycle (create → send → accept/decline). Email notifications.

5. **Projects** — How projects relate to orgs. Project-level resource scoping. What a project contains (endpoints, functions, secrets).

6. **Resource Propagation** — How org-level secrets, providers, and agents are available to projects within the org. How project-level secrets are scoped only to that project.

7. **Quotas** — How resource usage is tracked per org. 12 resource types. Quota enforcement against subscription tier limits.

- [ ] **Step 3: Cross-reference against codebase**

Verify role types match schema enum. Verify invitation flow matches endpoint implementation.

---

### Task 12: Secrets (`docs/features/secrets.md`)

**Source material to read:**
- `repos/database/src/schemas/secrets.ts` — secrets schema
- `repos/backend/src/endpoints/secrets/createSecret.ts` — secret creation flow
- `repos/backend/src/endpoints/secrets/deleteSecret.ts` — secret deletion
- `repos/domain/src/crypto/crypto.ts` — encryption functions
- `repos/backend/src/services/secrets/secretResolver.ts` — SecretResolver service (placeholder resolution)
- `repos/backend/src/services/proxy/egress.ts` — MITM proxy egress token replacement (`tdsk_ph_*` tokens)
- `.claude/skills/tdsk-backend/SKILL.md` — SecretResolver service

**Files:**
- Create: `docs/features/secrets.md`

- [ ] **Step 1: Read all source material listed above**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **What are Secrets** — Encrypted key-value pairs. Scoped to orgs, projects, providers, or agents (exclusive arc). Users can reference secrets by name but never see raw values.

2. **Secret Lifecycle** — Create (encrypt + store) → use (reference via placeholder) → rotate (create new, delete old) → delete.

3. **Encryption** — AES-256-GCM, HKDF key derivation. Reference `docs/architecture/security-model.md` for full crypto details.

4. **Scoping Rules** — Four levels: org, project, provider, agent. How scope determines which endpoints/functions/agents can access which secrets. Exclusive arc pattern.

5. **Placeholder Mechanisms** — Two distinct systems:
   - **Config templates**: `{{secret-name}}` syntax in endpoint headers, proxy URLs, function arguments. Resolved by `SecretResolver` at request time.
   - **Egress tokens**: `tdsk_ph_*` placeholder tokens used in sandbox environments. Resolved by the MITM proxy (`egress.ts`) as traffic leaves the sandbox.
   Explain when each is used and why both exist.

6. **Secret Flow Through System** — How secrets are used in:
   - Proxy endpoints (header injection)
   - FaaS functions (context injection)
   - Agent sandboxes (MITM proxy replacement)
   - ASCII diagram showing each path.

7. **Access Control** — Who can create/read/delete secrets. Admins can create/delete. Users can reference by name. Raw values never exposed via API.

- [ ] **Step 3: Cross-reference against codebase**

Verify config template syntax matches `SecretResolver` implementation. Verify egress token pattern matches `egress.ts`. Verify scoping levels match schema columns.

---

### Task 13: Billing (`docs/features/billing.md`)

**Source material to read:**
- `repos/backend/src/endpoints/subscriptions/` — all subscription endpoints
- `repos/backend/src/endpoints/payments/` — payment webhook endpoints
- `repos/backend/src/services/payments/payments.ts` — PaymentsService
- `repos/backend/src/services/payments/strategies/stripe.ts` — Stripe strategy
- `repos/backend/src/services/payments/strategies/console.ts` — Console strategy
- `repos/backend/src/middleware/setupSubscription.ts` — subscription middleware
- `repos/backend/src/middleware/enforceQuota.ts` — quota enforcement middleware
- `repos/database/src/schemas/subscriptions.ts` — subscription schema
- `repos/database/src/schemas/quotas.ts` — quota schema
- `repos/database/src/schemas/invoices.ts` — invoice schema
- `repos/domain/src/constants/plans.ts` — plan definitions
- `repos/domain/src/models/subscription.ts` — subscription model
- `repos/domain/src/models/quota.ts` — quota model
- `repos/domain/src/models/invoice.ts` — invoice model

**Files:**
- Create: `docs/features/billing.md`

- [ ] **Step 1: Read all source material listed above**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **Billing Model** — "User pays, orgs consume." Subscriptions attached to users (1:1). Quotas enforced at org level. If a user owns multiple orgs, limits apply per org.

2. **Stripe Integration** — PaymentsService with strategy pattern. StripeService for production, ConsoleService for development. Checkout flow, customer portal, webhook handling.

3. **Subscription Tiers** — Table of tiers (free, solo, pro, team) with limits for each resource type. Tier fields: price, organizations, projects, compute, threads, messages, endpoints, secrets, retention, seats, additionalSeats.

4. **Subscription Lifecycle** — Checkout → active → portal management → upgrade/downgrade → cancel. Status types: active, canceled, past_due, incomplete, trialing.

5. **Quota Enforcement** — How the `enforceQuota` middleware works. 12 resource types tracked. How usage increments on resource creation. How limits are checked. What happens when a quota is exceeded.

6. **Webhooks** — Stripe webhook events handled: subscription.created, subscription.updated, subscription.deleted, invoice events. How webhooks sync state to the database.

7. **Invoice Tracking** — How invoices are stored and surfaced to users.

- [ ] **Step 3: Cross-reference against codebase**

Verify tier names match `repos/domain/src/constants/plans.ts`. Verify resource types match quota schema. Verify webhook events match `repos/backend/src/endpoints/payments/webhook.ts`.

---

## Chunk 3: User Guide + Business Docs

### Task 14: Getting Started (`docs/user-guide/getting-started.md`)

**Source material to read:**
- `docs/architecture/platform-overview.md` (written in Task 1)
- `docs/features/proxy-endpoints.md` (written in Task 6)
- `docs/features/billing.md` (written in Task 13)
- `.claude/skills/tdsk-admin/SKILL.md` — admin UI flows
- `repos/admin/src/pages/` — page structure for navigation reference

**Files:**
- Create: `docs/user-guide/getting-started.md`

- [ ] **Step 1: Read source material**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **Prerequisites** — Browser, internet connection. No local setup required for managed version.

2. **Sign Up** — Social login via Neon Auth (GitHub, GitLab, Google, Vercel). What happens on first login.

3. **Choose a Plan** — Stripe checkout flow. Tier overview (reference `docs/features/billing.md`). Free tier for getting started.

4. **Create Your Organization** — Name, description. What an org represents.

5. **Add Your First Secret** — Navigate to org secrets. Create a secret (e.g., an API key for an external service). Explain that the value is encrypted and hidden.

6. **Create a Project** — Name, assign to org. What a project represents.

7. **Create Your First Proxy Endpoint** — Step-by-step:
   - Set target URL
   - Add headers with secret references (`{{secret-name}}`)
   - Test the endpoint
   - See the secret injected without exposure

8. **Next Steps** — Links to FaaS docs, agent docs, team management.

- [ ] **Step 3: Review for clarity**

Read through as if you're a new user. Ensure no jargon is unexplained. Ensure steps are sequential and complete.

---

### Task 15: Admin Dashboard (`docs/user-guide/admin-ui.md`)

**Source material to read:**
- `.claude/skills/tdsk-admin/SKILL.md` — full admin skill documentation
- `repos/admin/src/pages/` — list all page files
- `repos/admin/src/components/` — key component directories
- `repos/admin/src/router.tsx` (or equivalent) — routing structure

**Files:**
- Create: `docs/user-guide/admin-ui.md`

- [ ] **Step 1: Read source material**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **Overview** — SPA dashboard built with React, Vite, MUI, Jotai. Access via browser after authentication.

2. **Navigation Structure** — Top-level routes and what each page does:
   - Organizations (list, create, manage members, settings)
   - Projects (list, create, endpoints, functions, secrets)
   - Agents (configure, attach tools, run)
   - Billing (current plan, usage, upgrade)
   - Profile (user settings)

3. **Organization Management** — How to create orgs, manage members, configure org-level resources.

4. **Project Management** — How to create projects, add endpoints, write functions, manage project secrets.

5. **Agent Configuration** — How to set up an agent: choose provider, write system prompt, attach tools/functions, assign to project.

6. **Billing & Quotas** — How to view current plan, see usage, manage subscription via Stripe portal.

- [ ] **Step 3: Review for accuracy**

Verify navigation matches actual router config. Verify page names match actual component names.

---

### Task 16: REPL CLI (`docs/user-guide/repl-cli.md`)

**Source material to read:**
- `.claude/skills/tdsk-repl/SKILL.md` — full REPL skill documentation
- `repos/repl/src/` — list key files

**Files:**
- Create: `docs/user-guide/repl-cli.md`

- [ ] **Step 1: Read source material**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **What is tsa** — Terminal REPL (Read-Eval-Print Loop) for interacting with Threaded Stack agents from the command line. Built with Bun + Ink (React TUI).

2. **Installation** — How to install the `tsa` binary.

3. **Authentication** — `tsa login <api-key> --insecure` for local dev. How credentials are stored (`~/.config/tdsk/repl-auth.json`).

4. **Key Commands** — Table of commands:
   - `login` / `logout` — auth management
   - `status` — connection state
   - `agents` — list available agents
   - `threads <agentId>` — list threads
   - `chat --org <id> --agent <id>` — start interactive chat
   - `chat --thread <id>` — resume existing thread

5. **Interactive Chat** — How the chat session works. Slash commands available within chat. Message flow: user input → backend → agent → streaming response.

6. **Configuration** — Config file locations, environment variables.

- [ ] **Step 3: Cross-reference against codebase**

Verify commands match actual CLI implementation. Verify config paths match code.

---

### Task 17: Threads App (`docs/user-guide/threads-app.md`)

**Source material to read:**
- `repos/threads/` — full directory structure
- `repos/threads/package.json` — dependencies and scripts
- `repos/threads/src/` — list key files, read main entry point and router

**Files:**
- Create: `docs/user-guide/threads-app.md`

- [ ] **Step 1: Read source material**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **What is the Threads App** — Browser-based interface for non-developer users to interact with AI agents. Separate from the admin dashboard. Focused on conversation, not configuration.

2. **Current State** — What's built (routing, auth, state, pages) and what's in progress. Mark incomplete features as "In Development."

3. **Access** — How to reach the threads app. Authentication flow.

4. **Features** *(document what exists, mark planned features)*:
   - Thread listing and navigation
   - Message display and sending
   - Agent interaction
   - Thread branching (if implemented)

5. **Relationship to Admin UI** — Admin configures agents/tools/secrets. Threads app is where end users interact with those configured agents. Different audiences, complementary apps.

- [ ] **Step 3: Verify current state against codebase**

Ensure "what's built" claims match actual code in `repos/threads/`.

---

### Task 18: Sandbox Usage (`docs/user-guide/sandbox-usage.md`)

**Source material to read:**
- `docs/architecture/sandbox-architecture.md` (written in Task 5)
- `docs/features/sandbox-connect.md` (written in Task 9)
- `.claude/skills/tdsk-sandbox/SKILL.md`
- `.claude/skills/tdsk-admin/SKILL.md` — sandbox configuration in admin UI

**Files:**
- Create: `docs/user-guide/sandbox-usage.md`

- [ ] **Step 1: Read source material**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **What are Sandboxes** — Secure, isolated containers where code and AI agents run. All traffic goes through the MITM proxy for secret management.

2. **Sandbox Providers** — Local (V8 isolate for dev) vs Kubernetes (pods for production). When each is used.

3. **Using Sandboxes for FaaS** — How functions execute in sandboxes. What's available in the sandbox environment (Node.js builtins, injected secrets).

4. **Using Sandboxes for Agents** — How agents run in K8s sandbox pods. MITM proxy integration.

5. **Sandbox Direct Connect** *(Planned)* — How users will connect to sandbox containers. Reference `docs/features/sandbox-connect.md` for details.

6. **Troubleshooting** — Common sandbox issues and solutions.

- [ ] **Step 3: Review for clarity**

Ensure practical, task-oriented tone. Link to architecture docs for deeper details.

---

### Task 19: API Reference (`docs/user-guide/api-reference.md`)

**Source material to read:**
- `.claude/skills/tdsk-backend/SKILL.md` — all endpoint categories
- `repos/backend/src/endpoints/` — list all endpoint directories
- `repos/proxy/src/middleware/setupAuth.ts` — auth requirements
- Root `CLAUDE.md` — request flow diagram with all route categories

**Files:**
- Create: `docs/user-guide/api-reference.md`

- [ ] **Step 1: Read source material**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **Base URL** — `https://<your-domain>` (managed) or `https://local.threadedstack.app` (local dev).

2. **Authentication** — How to authenticate: JWT Bearer token or API key (`tdsk_*` Bearer token). Which endpoints require auth. Public endpoints.

3. **Endpoints by Resource** — For each resource group, list endpoints with method, path, description, auth requirement:
   - Organizations: CRUD
   - Users: CRUD
   - Projects: CRUD
   - Endpoints: CRUD
   - Functions: CRUD
   - Secrets: CRUD
   - API Keys: CRUD
   - Providers: CRUD
   - Agents: CRUD + run
   - Threads: CRUD + messages
   - Subscriptions: plans, checkout, portal, cancel
   - Quotas: check, limits
   - Invitations: create, accept, list
   - Payments: webhook

4. **Streaming Endpoints** — SSE (agent run) and WebSocket (AI chat) — connection setup, event format.

5. **Error Format** — Standard error response shape. Common error codes.

- [ ] **Step 3: Cross-reference against codebase**

Verify endpoint paths match actual route registrations. Verify methods match. Spot-check 3-5 endpoints for accuracy.

---

### Task 20: Value Proposition (`docs/business/value-proposition.md`)

**Source material to read:**
- `docs/superpowers/specs/2026-04-03-design-docs-strategy.md` — product direction section
- `docs/bussiness.md` — old business doc (reference for competitive landscape, update positioning)

**Files:**
- Create: `docs/business/value-proposition.md`

- [ ] **Step 1: Read source material**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **What is Threaded Stack** — AI operations layer for companies integrating AI agents. Not infrastructure replacement — sits alongside existing tooling.

2. **The Problem** — Six core problems (from spec): secret exposure, environment inconsistency, siloed setups, access control gaps, maintenance burden, onboarding friction. One paragraph each with concrete examples.

3. **The Solution** — How Threaded Stack solves each problem. Map problem → feature.

4. **Key Differentiator** — "Bring your own AI tool, we make it secure and managed." Explain the sandbox + MITM proxy pattern in business terms.

5. **Target Market** — Companies adopting AI agents across engineering teams. Primary: startups/SMBs with 5-50 engineers. Secondary: enterprise engineering orgs needing governance.

6. **Competitive Landscape** — Updated table replacing old doc. Compare against:
   - AI frameworks (LangChain, CrewAI) — library vs. platform
   - Cloud providers (AWS Lambda, Azure Functions) — no AI context awareness
   - AI dev tools (Cursor, GitHub Copilot) — individual tools, not org-wide management
   - No-code AI (Zapier AI, Make) — ceiling for real engineering

7. **Why Now** — AI agent adoption is accelerating. Security/governance gap is widening. Teams need managed infrastructure.

- [ ] **Step 3: Review for clarity and persuasiveness**

Read as an investor or potential customer. Ensure value prop is clear without technical jargon overload.

---

### Task 21: Go-To-Market (`docs/business/go-to-market.md`)

**Source material to read:**
- `docs/superpowers/specs/2026-04-03-design-docs-strategy.md` — beta strategy section
- `docs/business/value-proposition.md` (written in Task 20)

**Files:**
- Create: `docs/business/go-to-market.md`

- [ ] **Step 1: Read source material**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **Beta Strategy** — Invite-only, real billing (Stripe), controlled audience. What beta validates (full operational loop).

2. **Beta User Journey** — Step-by-step: sign up → plan → org → secrets → endpoints → functions → team → agents. What the user experiences at each step.

3. **Success Criteria for Beta** — What needs to be true to move from beta to GA. User retention, feature stability, billing reliability.

4. **Post-Beta Growth Path** — Beta → public launch → growth. How the user base expands. Community building, content marketing, developer advocacy.

5. **Distribution Channels** — Developer communities, AI/ML meetups, technical content (blog, tutorials), open-source engagement.

6. **Partnerships** — Potential integration partners (AI tool vendors, cloud providers, DevOps platforms).

- [ ] **Step 3: Review for actionability**

Ensure each section has concrete next steps, not just strategy statements.

---

### Task 22: Pricing (`docs/business/pricing.md`)

**Source material to read:**
- `docs/features/billing.md` (written in Task 13)
- `repos/domain/src/constants/plans.ts` — plan definitions with actual limits
- `docs/payments/payment-plans.md` — old pricing doc (reference for structure)

**Files:**
- Create: `docs/business/pricing.md`

- [ ] **Step 1: Read source material**

- [ ] **Step 2: Write the document**

**Required sections:**

1. **Billing Model Overview** — "User pays, orgs consume." Simple explanation for non-technical readers.

2. **Tier Comparison** — Table with all tiers and their limits. Use actual values from `plans.ts`. Columns: tier name, price, target user, key limits (orgs, projects, members, endpoints, threads, compute time, secrets, retention).

3. **What Each Tier Unlocks** — Prose description of each tier. Who it's for, what they get, why they'd upgrade.

4. **Usage & Quotas** — How usage is tracked. What happens when limits are reached (soft block, not hard cutoff). How to check usage (admin UI, API).

5. **Billing FAQ** — Common questions: Can I change plans? What happens if I cancel? How are overages handled? Can I have multiple orgs on one plan?

- [ ] **Step 3: Verify pricing against codebase**

Ensure all tier names and limits match `repos/domain/src/constants/plans.ts` exactly.

---

### Task 23: Update Index and Cleanup

**Files:**
- Modify: `docs/index.md` (remove "coming soon" markers, verify all links)

- [ ] **Step 1: Update `docs/index.md`**

Remove any "(coming soon)" markers for completed docs. Verify all links point to correct files.

- [ ] **Step 2: Verify all cross-references**

Check that docs referencing other docs (e.g., security-model.md referenced from secrets.md) use correct relative paths.

- [ ] **Step 3: Final review**

Read through `docs/index.md` and click through to verify the doc suite is navigable and complete.
