# Design Docs Strategy — Threaded Stack

**Date:** 2026-04-03
**Status:** Approved
**Goal:** Establish a modular documentation suite that serves contributors, beta users, and stakeholders — aligned with the current product direction and a ~1 month timeline to beta launch.

---

## Product Direction (Revised)

### What Threaded Stack Is

Threaded Stack is an **AI operations layer** for companies integrating AI agents into their workflows. It sits alongside existing tooling and solves the governance, security, and sharing problems that come with deploying AI agents across an organization.

### Core Problems Solved

1. **Secret exposure** — AI agents and users never see raw credential values. Secrets use placeholders that are replaced just-in-time outside the agent's context via the MITM proxy.
2. **Environment inconsistency** — Sandboxes provide secure, consistent, pre-configured containers where AI agents run. All traffic routes through the proxy for secret management.
3. **Siloed setups** — Shared entity model (org → projects → resources) eliminates per-engineer custom configurations. Agents, functions, tools, and secrets are configured once and shared across projects and teams.
4. **Access control** — Users are scoped to organizations and projects. Resources are only exposed to projects they've been assigned to. Roles and permissions govern who can do what.
5. **Maintenance burden** — Centralized configuration means agents, tools, and secrets are updated in one place and propagate to all connected projects.
6. **Onboarding friction** — Environment consistency and reuse of existing tools (Claude Code, Codex, OpenCode, etc.) reduce the learning curve.

### Key Differentiator

**"Bring your own AI tool, we make it secure and managed."** Sandboxes can host any off-the-shelf AI tool (Claude Code, Codex, OpenCode — anything that runs in a Docker container). Users connect directly to the sandbox (SSH or similar). All traffic goes through the MITM proxy, so the tool works normally but never sees real credentials. When the sandbox tears down, nothing leaks.

### Four Agent Interaction Surfaces

1. **REPL CLI** (`tsa`) — Terminal-native TUI for developers
2. **Threads web app** (`repos/threads`) — Browser-based interface for non-developer users
3. **API** (SSE/WebSocket) — Programmatic integration for existing codebases
4. **Sandbox direct connect** — SSH/similar into a container running any pre-configured AI tool

---

## Beta Launch Strategy

### Target

Beta/early access — invite-only, real billing (Stripe), controlled audience.

### Beta User Journey

Sign up → pick a plan (Stripe checkout) → create org → configure secrets and tools → create proxy endpoints AND FaaS functions → share across projects → add team members → configure and run AI agents in sandboxes.

### What Beta Validates

The full operational loop: security (secret injection), sharing (org → project propagation), team management (roles/permissions), all endpoint types (proxy, FaaS, agent), and sandbox agent hosting.

### Billing

Real billing from day one via Stripe (migration from Polar.sh in progress). "User pays, orgs consume" model with tiered plans and quota enforcement.

---

## Documentation Architecture

### Approach: Modular Doc Suite with Master Index

Structured set of focused docs organized by concern, each covering one domain deeply. A master index (`docs/index.md`) ties them together.

### Audiences

| Audience | Reads | Priority |
|----------|-------|----------|
| Contributors/Engineers | `architecture/`, `features/` | 1st (enables continued development) |
| Beta users | `user-guide/`, `features/` | 2nd (enables onboarding) |
| Investors/Stakeholders | `business/` | 3rd (enables fundraising/partnerships) |

### Directory Structure

```
docs/
  index.md                        — Master table of contents + system overview
  architecture/
    platform-overview.md           — Value prop, topology, repo map, shared entity model
    request-flow.md                — Full request lifecycle per endpoint type, auth flows
    data-model.md                  — All schemas, relationships, exclusive arc pattern
    security-model.md              — JIT secret injection, encryption, MITM proxy, scoping
    sandbox-architecture.md        — Providers, K8s pod lifecycle, MITM routing, agent hosting
  features/
    proxy-endpoints.md             — (update existing)
    faas-endpoints.md              — (update existing)
    agent-endpoints.md             — (new) Agent lifecycle, execution paths, tool attachment
    sandbox-connect.md             — (new) Direct-connect, pre-configured envs, MITM security
    threads.md                     — (new) Thread model, messages, branching, agent connection
    organizations.md               — (new) Shared entity model, members, roles, invitations
    secrets.md                     — (new) Lifecycle, scoping, template syntax, flow through system
    billing.md                     — (new) Stripe, tiers, quotas, subscription lifecycle
  user-guide/
    getting-started.md             — Zero to working API call
    admin-ui.md                    — Dashboard walkthrough
    repl-cli.md                    — tsa CLI usage
    threads-app.md                 — (new) Threads web app for non-developers
    sandbox-usage.md               — (new) Sandbox setup, configuration, connection, lifecycle
    api-reference.md               — REST endpoints, auth, request/response examples
  business/
    value-proposition.md           — Positioning, problems, differentiators, target market
    go-to-market.md                — Beta strategy, growth path, competitive landscape
    pricing.md                     — Tiers, quotas, billing model for non-technical audience
```

### Relationship to Existing Directories

- **`docs/superpowers/`** — Contains planning artifacts (specs and implementation plans). These are working documents for development sessions, not user-facing docs. They remain alongside the new structure and continue to be used for future planning work.
- **`docs/endpoints/images/`** — Visual assets referenced by proxy/faas docs. These migrate to `docs/features/images/` when the feature docs move.
- **`docs/meta/`** and **`docs/tech/`** — Operational docs (`local.md`, `ssl.md`, `environments.md`, `kube-setup.md`). These are internal reference for local development setup and are not part of the new doc suite. They remain in place unless they become stale.
- **`docs/simplify-loop.md`** — Internal process doc. Remains in place, not part of the new structure.

### Doc Conventions

- Each doc captures **what exists today** vs **what's planned** (clearly separated). Once a planned feature ships, its section moves to "current" in the next doc update.
- Architecture and feature docs are the source of truth — user guides reference them, don't duplicate
- Docs are living — updated as implementation progresses
- Existing docs (`proxy-endpoints.md`, `faas-endpoints.md`) are updated in place, not rewritten from scratch
- Outdated docs (`bussiness.md`, `tech-spec.md`, `highlevel.md`, `repo-layout.md`) are replaced by the new structure
- Skill files (`.claude/skills/`) contain substantial architectural knowledge per repo. These serve as source material when writing docs but are a separate concern (they're for Claude Code, not for humans).

### Build Order

Phase 0: **Scaffold** — Create `docs/index.md` skeleton with the directory structure and empty section links. This provides navigation scaffolding from day one.

1. **Architecture docs** — Platform overview, security model, sandbox architecture (unblocks development)
2. **Feature docs** — Agent endpoints, sandbox connect, threads, organizations, secrets, billing (unblocks user understanding)
3. **User guide** — Getting started, admin UI, REPL, threads app, sandbox usage (unblocks beta onboarding)
4. **Business docs** — Value prop, GTM, pricing (unblocks investor/stakeholder conversations)

---

## Current State of Existing Docs

| Doc | Status | Action |
|-----|--------|--------|
| `bussiness.md` | Outdated — wrong positioning, references Polar.sh | Replace with `business/value-proposition.md` and `business/go-to-market.md` |
| `tech-spec.md` | Outdated — missing 7 repos, wrong schema | Replace with `architecture/platform-overview.md` and `architecture/data-model.md` |
| `highlevel.md` | Empty (just "TODO") | Delete, replaced by `architecture/platform-overview.md` |
| `repo-layout.md` | Outdated — missing repos | Replace with section in `architecture/platform-overview.md` |
| `DATA-MODEL-ARCHITECTURE.md` | Large but potentially useful as reference | Consolidate into `architecture/data-model.md` |
| `proxy-endpoints.md` (root) | Implementation notes | Consolidate into `features/proxy-endpoints.md` |
| `endpoints/proxy.md` | Detailed and current | Move to `features/proxy-endpoints.md` |
| `endpoints/faas.md` | Detailed and current | Move to `features/faas-endpoints.md` |
| `payments/*.md` | References Polar.sh | Replace with `features/billing.md` |
| `AGENT_INSTRUCTIONS.md` | AI agent prompt doc | Review for relevance, may inform `features/agent-endpoints.md` |
| `AI_AGENT_PROMPT.md` | AI agent prompt doc | Review for relevance, may inform `features/agent-endpoints.md` |
| `meta/local.md` | Local dev setup notes | Keep in place — internal operational doc, not part of new structure |
| `meta/ssl.md` | SSL/cert setup notes | Keep in place — internal operational doc |
| `meta/environments.md` | Environment config notes | Keep in place — internal operational doc |
| `tech/kube-setup.md` | K8s setup guide | Keep in place — internal operational doc |
| `simplify-loop.md` | Internal process doc | Keep in place — not part of new structure |

---

## Implementation Work Required for Beta

Based on our discussion, the remaining engineering work alongside documentation:

1. **Stripe migration** — In progress (current git status shows active work)
2. **Sandbox direct-connect (SSH layer)** — New feature, core to beta
3. **Sandbox + MITM proxy hardening** — Cleanup and testing of existing implementation
4. **Threads web app** — Partially built (has routing, auth, state management, pages) — needs completion
5. **Pre-configured agent environments** — Configuring Claude Code, Codex, etc. to run in sandboxes
