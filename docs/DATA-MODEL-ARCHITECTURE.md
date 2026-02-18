# ThreadedStack Data Model Architecture

## Purpose of This Document

This document provides a comprehensive analysis of every data model in the ThreadedStack platform — **why** each exists, how they relate to each other, where the current implementation diverges from intent, and specific recommendations for improvement. It is the result of a full-stack audit across all 11 repos: database, domain, backend, proxy, admin, agent, sandbox, repl, cli, components, and logger.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Entity Catalog — Why Each Model Exists](#2-entity-catalog--why-each-model-exists)
3. [Relationship Architecture](#3-relationship-architecture)
4. [Exclusive Arc Pattern Analysis](#4-exclusive-arc-pattern-analysis)
5. [Data Flow Through the Stack](#5-data-flow-through-the-stack)
6. [Relationship Gap Analysis & Recommendations](#6-relationship-gap-analysis--recommendations)
7. [Cross-Cutting Concerns](#7-cross-cutting-concerns)
8. [Summary of Recommendations](#8-summary-of-recommendations)

---

## 1. Platform Overview

ThreadedStack is a multi-tenant developer platform that unifies authentication, AI agent orchestration, serverless compute (FaaS), and secure API proxying. The data model serves three primary workflows:

1. **Resource Provisioning** — Orgs → Projects → Endpoints/Functions/Agents
2. **AI Agent Execution** — Agent → Provider → Secrets → LLM → Thread/Messages
3. **Billing & Access Control** — Users → Roles → Subscriptions → Quotas

### Entity Count
- **19 database tables** (17 Drizzle-managed, 2 external)
- **20 domain model classes** (TypeScript)
- **2 junction tables** (agent↔project, agent↔function)
- **4 exclusive arc implementations** (secrets, assets, roles, domains)

---

## 2. Entity Catalog — Why Each Model Exists

### 2.1 Organization

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Multi-tenancy isolation boundary. Every billable resource is scoped to an org. |
| **Why It Exists** | Teams need workspaces. Orgs are the root container for all resources — projects, agents, providers, secrets, domains, quotas. Without orgs, there's no way to isolate one customer's data from another. |
| **Fields** | `id`, `name`, `description`, `createdAt`, `updatedAt` |
| **Key Relationships** | Parent of: Projects, Agents, Providers, Roles, Secrets, Quotas, Invitations, Threads, Domains, Assets, API Keys |
| **Used By** | Every repo. Backend scopes all queries by orgId. Admin displays org as primary navigation. Proxy doesn't directly use orgs but passes orgId via headers. |

**Assessment**: Correctly implemented. Lean model with appropriate relationships. The org is a pure container — it holds no configuration itself, which is the right design for a multi-tenant platform.

---

### 2.2 User

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Human identity. Represents a person who can authenticate and interact with the platform. |
| **Why It Exists** | Authentication requires identity. Users own subscriptions, create threads, receive invitations, and are assigned roles within orgs/projects. |
| **Fields** | `id`, `name`, `email`, `image`, `role`, `banned`, `banReason`, `banExpires`, `emailVerified`, `createdAt`, `updatedAt` |
| **Key Relationships** | Has: Roles, Threads, Subscriptions (1:1), API Keys, Invitations, Assets |
| **Managed By** | Neon Auth (external). The `users` table is in the `neon_auth` schema — ThreadedStack reads it but never writes to it. |

**Assessment**: Correctly implemented as a read-only reference. The domain model adds computed properties (`displayName`, `first`/`last`) that don't exist in the DB, which is fine for UI convenience. The `role` field on User is the Neon Auth platform role, NOT the ThreadedStack org/project role — this distinction is important and could be confusing.

**Recommendation**: Consider renaming the User model's `role` field to `platformRole` or `authRole` to distinguish it from the RBAC Role entity. Currently, `user.role` from Neon Auth and `role.type` from the Roles table can be confused.

---

### 2.3 Role

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | RBAC binding. Connects a user to an org OR project with a specific permission level. |
| **Why It Exists** | Users need different access levels in different orgs/projects. A user might be an admin in Org A but a viewer in Org B. Roles are the mechanism for this. |
| **Fields** | `id`, `type` (admin/member/viewer), `userId`, `orgId`, `projectId`, `name`, `createdAt`, `updatedAt` |
| **Exclusive Arc** | Exactly ONE of `orgId` or `projectId` is set (never both, never neither) |
| **Key Relationships** | Belongs to: User, Org OR Project |
| **Used By** | Backend (permission checks on every protected endpoint), Admin (member management UI), Proxy (derives role from API key scope) |

**Assessment**: The exclusive arc is correct — a role grants access to one scope. The hierarchy (viewer < member < admin < owner < super) is well-defined in the domain constants.

**Issue — Owner/Super Roles Are Phantom**: The `ERoleType` enum includes `owner` and `super`, but the Roles table stores `type` as plain text with no CHECK constraint. The `owner` role is conceptual (the user who created the org) but never stored as a role record. The `super` role is a platform concept that bypasses org-level RBAC. Neither is enforced at the database level.

**Recommendation**:
- Add a DB CHECK constraint on `roles.type` to restrict to valid values: `admin`, `member`, `viewer`.
- Document that `owner` and `super` are computed roles, not stored roles. The org creator's ownership should be tracked explicitly (e.g., `organizations.ownerId` FK to users).
- Currently there's no way to determine who owns an org from the database alone. This matters for subscription-driven quota limits (the owner's subscription determines the org's limits).

---

### 2.4 Project

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Logical workspace within an org. Groups related endpoints, functions, and agent configurations. |
| **Why It Exists** | Teams working on multiple products need isolation within an org. A "payments" project shouldn't mix endpoints with a "chatbot" project. Projects also enable project-level RBAC (a dev might have access to one project but not another). |
| **Fields** | `id`, `name`, `description`, `gitUrl`, `branch`, `meta` (JSONB), `orgId`, `createdAt`, `updatedAt` |
| **Key Relationships** | Parent of: Endpoints, Functions, Secrets, Roles, Domains, Threads, Messages. Many-to-many with Agents. |
| **Used By** | Backend (CRUD + scoping), Admin (project navigation, resource container), Agent (project context for threads) |

**Assessment**: Correctly implemented. The `gitUrl` and `branch` fields suggest a future git-based deployment workflow but aren't currently used by any runtime code. The `meta` JSONB field provides extensibility.

**Issue — Projects Don't Own Agents**: Agents belong to the org (`agents.orgId`), not to projects. The many-to-many junction (`agent_projects`) lets agents serve multiple projects, but this creates ambiguity about which project's secrets/endpoints an agent should use at runtime.

**Recommendation**: This is analyzed in detail in the Relationships section below.

---

### 2.5 Agent

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | AI agent configuration. Defines an LLM-powered assistant with specific capabilities, tools, and behavior. |
| **Why It Exists** | The core product. An agent wraps an LLM provider with a system prompt, tool whitelist, and execution environment. Users configure agents, then interact with them via threads. |
| **Fields** | `id`, `name`, `description`, `orgId`, `providerId`, `systemPrompt`, `model`, `maxTokens`, `tools` (JSONB), `envVars` (JSONB), `environment` (JSONB), `active`, `createdAt`, `updatedAt` |
| **Key Relationships** | Belongs to: Org, Provider. Has: Secrets, Threads. Many-to-many: Projects, Functions. |
| **Used By** | Backend (CRUD + run endpoint), Admin (agent configuration UI), Agent runtime (AgentRunner consumes agent config), REPL (chat command targets an agent) |

**Assessment**: The agent model is the most complex entity and the lynchpin of the platform. It's reasonably well-designed but has several relationship concerns.

**Issue 1 — Provider is Hard-Linked**: `agents.providerId` is `NOT NULL` with `ON DELETE CASCADE`. If a provider is deleted, all agents using it are also deleted. This is too aggressive — users likely want to reassign agents to a different provider, not lose them.

**Issue 2 — No Quick Provider Switching**: Changing an agent's provider requires updating `providerId` AND ensuring the new provider has the right secrets. There's no UI or API flow for "switch this agent from OpenAI to Anthropic" that handles secret migration.

**Issue 3 — Tools Are a JSONB Array of Strings**: `tools: ["shellExec", "readFile", ...]` references tool names, not database entities. There's no FK integrity — a typo in the tools array silently fails at runtime.

**Recommendations**: See Section 6 for detailed provider-switching and function/tool recommendations.

---

### 2.6 Provider

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | External service configuration. Stores how to connect to an LLM API (or other service type). |
| **Why It Exists** | Multiple agents may use the same LLM API (e.g., Anthropic). Rather than duplicating API configuration per agent, providers are shared org-level resources. Providers also support template substitution for secrets (`{{ANTHROPIC_API_KEY}}`). |
| **Fields** | `id`, `name`, `type` (ai/git/auth/storage), `options` (JSONB), `headers` (JSONB), `bodyParams` (JSONB), `orgId`, `createdAt`, `updatedAt` |
| **Key Relationships** | Belongs to: Org. Has: Agents (1:many), Secrets (provider-scoped), Threads (reference). |
| **Used By** | Backend (provider CRUD, secret resolution for agent execution), Admin (provider configuration UI, quickstart wizard), Agent runtime (LLM adapter config built from provider) |

**Assessment**: Good abstraction. The `type` field supports future expansion (git, auth, storage providers), though currently only `ai` type is used at runtime.

**Issue 1 — No `model` Column**: The default model is stored in `options.model` (JSONB), which isn't indexed or validated. A `model` column with a foreign key to a hypothetical `models` table would enable better validation and UI dropdowns.

**Issue 2 — Provider Is Org-Scoped Only**: Providers can't be project-scoped. If a project needs a different API key for the same LLM service, you need a separate provider at the org level. This means provider names like "Anthropic - Production" and "Anthropic - Staging" proliferate.

**Issue 3 — Type Enum Not Enforced**: `type` is stored as plain text with no CHECK constraint. Invalid values like `type: "foo"` would be accepted.

**Recommendations**:
- Add a CHECK constraint on `providers.type` to restrict to valid values.
- Consider whether providers should support project-scoping (add optional `projectId` FK with exclusive arc: org XOR project).
- Extract `model` from JSONB `options` into a first-class column for better queryability.

---

### 2.7 Endpoint

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | HTTP route definition. Maps a URL path + method to a handler (proxy, FaaS, or agent). |
| **Why It Exists** | The platform's API gateway capability. Users define endpoints that either proxy to external APIs, invoke serverless functions, or trigger AI agents. This is how external systems interact with ThreadedStack. |
| **Fields** | `id`, `name`, `path`, `method`, `type` (proxy/faas/agent), `public`, `headers` (JSONB), `options` (JSONB), `projectId`, `createdAt`, `updatedAt` |
| **Key Relationships** | Belongs to: Project. Has: Functions (1:many). |
| **Used By** | Backend (routing engine, endpoint execution), Admin (endpoint configuration with type-specific forms) |

**Assessment**: Well-designed with the conditional type system (TEndpointOpts<T> uses TypeScript conditional types for type-safe options per endpoint type).

**Issue 1 — Agent Endpoints Store `agentId` in JSONB**: For `type: "agent"`, the agent reference is in `options.agentId` (JSONB), not as a proper FK. This means:
- No referential integrity (agent can be deleted while endpoint still references it)
- No cascading behavior
- Can't query "which endpoints use this agent?" without JSON path queries

**Issue 2 — FaaS Endpoints Store `functionId` in JSONB**: Same issue — `options.functionId` is a JSONB reference, not a proper FK.

**Recommendation**: Add proper nullable FK columns: `agentId` (for agent endpoints) and `functionId` (for FaaS endpoints) alongside the JSONB options. This enables referential integrity while maintaining the flexible options pattern.

---

### 2.8 Function

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Serverless compute unit. User-authored code that executes in a sandbox. |
| **Why It Exists** | Two use cases: (1) FaaS endpoints invoke functions to handle HTTP requests, (2) AI agents call functions as tools during conversation. Functions are the bridge between user code and the platform runtime. |
| **Fields** | `id`, `name`, `description`, `content` (source code), `branch`, `language`, `defaultArgs` (JSONB), `dependencies` (JSONB), `inputSchema` (JSONB), `endpointId`, `projectId`, `createdAt`, `updatedAt` |
| **Key Relationships** | Belongs to: Project, Endpoint (optional). Many-to-many: Agents (via junction). |
| **Used By** | Backend (FaaS execution, agent function executor), Admin (function editor UI), Agent runtime (custom functions become agent tools) |

**Assessment**: The dual-purpose design (FaaS handler + agent tool) is clever but creates tension.

**Issue 1 — `endpointId` Creates Tight Coupling**: A function can only be linked to ONE endpoint, but the same function might be useful as both a FaaS endpoint handler AND an agent tool. The `endpointId` FK makes functions "belong" to endpoints, but the agent junction makes them "shared" with agents. This is contradictory.

**Issue 2 — No Versioning**: `content` stores source code directly. There's no version history, rollback capability, or deployment staging. The `branch` field suggests git integration but isn't wired to anything.

**Issue 3 — Agent Tool Names Aren't Unique**: When an agent has custom functions, they become tools with `name` as the tool identifier. But there's no unique constraint on `(name, projectId)`, so two functions with the same name in the same project would create ambiguous tool references.

**Recommendations**:
- Consider removing `endpointId` from functions. Instead, have FaaS endpoints reference functions via `options.functionId` (which they already do). Functions would become standalone entities that can be referenced by both endpoints and agents.
- Add a unique constraint on `(name, projectId)` to prevent ambiguous tool names.
- The `branch` and `gitUrl` fields (inherited from project context) suggest a future git-backed deployment model. Until that's built, these fields are dead weight.

---

### 2.9 Secret

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Encrypted credential storage. Stores API keys, tokens, and other sensitive values with server-side encryption. |
| **Why It Exists** | AI agents need API keys to call LLMs. Proxy endpoints need credentials to forward requests. Functions need environment variables. Secrets provide a secure, scoped credential vault. |
| **Fields** | `id`, `name`, `description`, `hashKey`, `encryptedValue`, `orgId`, `projectId`, `providerId`, `agentId`, `createdAt`, `updatedAt` |
| **Exclusive Arc** | Exactly ONE scope owner (with `orgId + providerId` exception) |
| **Key Relationships** | Belongs to: Org OR Project OR Provider OR Agent |
| **Used By** | Backend (3-tier secret resolution for agent execution, encryption/decryption), Admin (secret management UI), Proxy (doesn't access secrets directly) |

**Assessment**: The exclusive arc is the right pattern for scoped credentials. The 3-tier resolution (agent → provider → org) enables both shared credentials and agent-specific overrides.

**Issue 1 — The org+provider Exception Breaks the Arc**: The CHECK constraint allows `orgId IS NOT NULL AND providerId IS NOT NULL` together. This was added for the quickstart flow (create a provider secret scoped to both org and provider). But it violates the exclusive arc's intent — now a secret can be "owned" by two entities simultaneously, which complicates resolution logic.

**Issue 2 — No `userId` on Secrets**: Secrets are encrypted with HKDF-derived keys using the scope owner's ID. But when a secret is org-scoped, the encryption key is derived from `orgId`. This means ALL org members with admin access can decrypt the same secret. There's no per-user secret encryption.

**Issue 3 — `hashKey` Is a Truncated Hash**: `hashKey` uses `createHashKey()` which truncates SHA-256 to 16 hex characters (64 bits). This is used for secret name lookup. While collision risk is low for typical workloads, it's not cryptographically strong.

**Recommendations**:
- Eliminate the org+provider exception. Provider-scoped secrets (`providerId` only) are sufficient. The quickstart flow can create a provider-scoped secret (with `providerId` set) and the resolution logic already checks provider secrets.
- Consider using the full SHA-256 hash for `hashKey` instead of truncating to 16 chars.

---

### 2.10 API Key

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Machine-to-machine authentication. Enables CLI tools, scripts, and external systems to authenticate without user sessions. |
| **Why It Exists** | Not all API consumers are humans in browsers. The REPL CLI, CI/CD systems, and third-party integrations need programmatic access. API keys provide this with scope-based access control and rate limiting. |
| **Fields** | `id`, `name`, `keyPrefix`, `keyHash`, `scopes`, `active`, `rateLimit`, `expiresAt`, `lastUsedAt`, `orgId`, `projectId`, `userId`, `createdAt`, `updatedAt` |
| **Key Relationships** | Belongs to: Org, Project (optional), User |
| **Used By** | Proxy (API key auth middleware), Backend (key generation/management), Admin (key management UI), REPL (login command) |

**Assessment**: Well-implemented. The hash-based lookup is fast (indexed), the scope-to-role mapping is clean, and the `lastUsedAt` tracking enables audit.

**Issue — No Exclusive Arc**: Unlike secrets, API keys don't use exclusive arc. `orgId`, `projectId`, and `userId` can all be set simultaneously. This is intentional (a key is owned by a user, scoped to an org, optionally restricted to a project), but the semantics differ from other entities.

**Issue — Rate Limiting Not Enforced**: The `rateLimit` field exists in the schema but the proxy doesn't enforce it. It's stored but never checked.

**Recommendations**:
- Implement rate limiting in the proxy using the stored `rateLimit` value.
- Clarify in documentation that API keys use a different ownership pattern than the exclusive arc entities.

---

### 2.11 Thread

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Conversation container. Represents a multi-turn dialogue between a user and an AI agent. |
| **Why It Exists** | Stateful conversations need persistence. Threads group messages in sequence, support branching (forking at a specific message), and maintain context across sessions. |
| **Fields** | `id`, `name`, `meta` (JSONB), `public`, `userId`, `agentId`, `providerId`, `orgId`, `projectId`, `parentThreadId`, `branchMessageId`, `createdAt`, `updatedAt` |
| **Key Relationships** | Belongs to: User (NOT NULL), Org, Agent, Provider, Project (all optional). Has: Messages. Self-reference: parentThreadId for branching. |
| **Used By** | Backend (thread CRUD, agent run creates threads), Admin (thread list, chat UI), Agent runtime (message history), REPL (chat command) |

**Assessment**: The branching model (parentThreadId + branchMessageId) is well-designed for conversation exploration.

**Issue 1 — Too Many Optional FKs**: A thread has 4 optional scope FKs (orgId, agentId, providerId, projectId). Unlike secrets (exclusive arc), threads have no CHECK constraint — all 4 can be set simultaneously or all can be NULL. The intended semantics are unclear: Is a thread "in" an org, "for" an agent, "using" a provider, or "within" a project? The answer is "all of the above," but this makes querying threads ambiguous.

**Issue 2 — `agentId` is SET NULL on Delete**: When an agent is deleted, `threads.agentId` is set to NULL rather than cascading. This preserves thread history but orphans the thread — you can't tell which agent the conversation was with.

**Recommendation**:
- Clarify the semantics: `orgId` and `projectId` are context (where the thread lives), while `agentId` and `providerId` are configuration (what powers the thread). Document this distinction.
- Consider storing agent metadata (name, model) in `thread.meta` when the thread is created, so thread history remains meaningful even after agent deletion.
- Consider adding a `deletedAgentId` or similar field to preserve the reference after agent deletion, or use soft-delete on agents.

---

### 2.12 Message

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Conversation entry. A single turn in a thread — user input, assistant response, tool call, or tool result. |
| **Why It Exists** | Threads need ordered content. Messages store the full conversation history in a normalized format that works across all LLM providers (Anthropic, OpenAI, Google, Z.AI). |
| **Fields** | `id`, `type` (user/assistant/system/tool/action), `content` (JSONB), `meta` (JSONB), `threadId`, `orgId`, `projectId`, `createdAt`, `updatedAt` |
| **Key Relationships** | Belongs to: Thread (NOT NULL), Org, Project. Has: Assets. |
| **Used By** | Backend (message CRUD, agent run persists messages), Agent runtime (message history loaded, new messages created), REPL (message display) |

**Assessment**: The polymorphic `content: TMessageContent[]` design is excellent — it unifies text, tool calls, and tool results in a single array, making provider-agnostic persistence possible.

**Issue 1 — No `userId` on Messages**: Messages don't track who sent them. The `type` field distinguishes user vs assistant messages, but in a multi-user thread (future feature), you can't tell WHICH user sent a message.

**Issue 2 — `orgId` and `projectId` Are Redundant**: These are always the same as the parent thread's orgId/projectId. Every message insert must duplicate these values, and there's no FK constraint ensuring they match the thread's values.

**Issue 3 — No Index on `threadId`**: Messages are always queried by threadId (WHERE threadId = X ORDER BY createdAt), but there's no explicit index on threadId. The FK constraint creates an implicit index, but a composite index on `(threadId, createdAt)` would be optimal.

**Recommendations**:
- Add `userId` to messages for future multi-user thread support.
- Consider removing `orgId` and `projectId` from messages — they can always be derived from the thread. This eliminates data duplication and the risk of inconsistency.
- Add a composite index on `(threadId, createdAt)` for optimal message listing performance.

---

### 2.13 Asset

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | File/media storage reference. Tracks uploaded images, documents, and generated artifacts. |
| **Why It Exists** | Multi-modal AI (images, documents) and user uploads need persistent storage. Assets provide metadata tracking with scoped ownership. |
| **Fields** | `id`, `name`, `type`, `url`, `meta` (JSONB), `content` (JSONB), `orgId`, `projectId`, `userId`, `threadId`, `messageId`, `providerId`, `createdAt`, `updatedAt` |
| **Exclusive Arc** | Exactly ONE owner: org, project, user, thread, or message |
| **Used By** | Backend (CRUD), Admin (file management) — currently minimal usage |

**Assessment**: The exclusive arc is correct for ownership isolation. However, assets appear to be a future-facing entity — the current platform doesn't have robust file upload/download workflows.

**Issue — `providerId` is Outside the Arc**: The `providerId` field uses SET NULL on delete and is NOT part of the exclusive arc CHECK. This means `providerId` is metadata ("which provider generated this"), not ownership. This is semantically different from the other FK fields, which determine ownership.

**Recommendation**: Document that `providerId` on assets is a metadata reference, not an ownership scope. Consider renaming it to `generatedByProviderId` for clarity.

---

### 2.14 Quota

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Usage metering. Tracks how many resources an org has consumed in a billing period. |
| **Why It Exists** | SaaS billing requires usage limits. Quotas enable "you've used 8 of 10 projects on the Basic plan" enforcement. They're also the source of truth for billing dashboards. |
| **Fields** | `id`, `orgId`, `period`, `price`, `retention`, `organizations`, `projects`, `members`, `endpoints`, `threads`, `messages`, `functionCalls`, `runtime`, `orgSecrets`, `projectSecrets`, `createdAt`, `updatedAt` |
| **Key Relationships** | Belongs to: Org (NOT NULL) |
| **Used By** | Backend (quota increment on resource creation, limit checks), Admin (usage dashboard) |

**Assessment**: The atomic increment using SQL `INSERT...ON CONFLICT...UPDATE` is well-designed for concurrent access. The period-based approach (YYYY-MM) enables monthly billing cycles.

**Issue — Quota Limits Come From Owner's Subscription, Not Org**: The org itself doesn't store plan limits. Instead, the backend finds the org owner's subscription, maps the tier to plan limits, and compares against quota usage. But there's no explicit `ownerId` on the org table, making this lookup fragile.

**Recommendation**: Add `ownerId` (FK to users) on the organizations table. This makes the subscription→quota limit chain explicit: `org.ownerId → subscriptions.userId → plan.metadata → limits`.

---

### 2.15 Subscription

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Payment plan tracking. Records a user's subscription tier and Polar.sh integration. |
| **Why It Exists** | The platform has tiered pricing (free/basic/developer/pro). Subscriptions track which tier a user pays for, which determines their orgs' resource limits. |
| **Fields** | `id`, `userId` (UNIQUE), `tier`, `status`, `polarId`, `polarCustomerId`, `polarPriceId`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `seats`, `createdAt`, `updatedAt` |
| **Key Relationships** | Belongs to: User (1:1) |
| **Used By** | Backend (plan limit resolution, Polar.sh webhooks), Admin (billing page) |

**Assessment**: The 1:1 user relationship is correct — each user has exactly one subscription.

**Issue — Subscription is User-Level, Limits are Org-Level**: A user's subscription determines ALL their orgs' limits. But a user can be a member (not owner) of multiple orgs. The system assumes each org has one "owner" whose subscription governs the org's limits, but this ownership isn't explicitly modeled.

**Recommendation**: Same as Quota — add `ownerId` to organizations to make the subscription chain explicit.

---

### 2.16 Domain

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Custom domain management. Enables users to serve their API under their own domain (e.g., `api.mycompany.com`). |
| **Why It Exists** | White-labeling and custom branding. Enterprises want their API endpoints on their own domains, not on `*.threadedstack.app`. |
| **Fields** | `id`, `domain`, `verified`, `verifiedAt`, `sslEnabled`, `sslPrivateKey`, `sslCertificate`, `sslExpiresAt`, `orgId`, `projectId`, `createdAt`, `updatedAt` |
| **Exclusive Arc** | Exactly ONE owner: org OR project |
| **Key Relationships** | Belongs to: Org OR Project. Has: Certificates (via Caddy). |
| **Used By** | Backend (domain CRUD, DNS verification), Proxy (domain validation for TLS), Admin (domain management UI) |

**Assessment**: The exclusive arc (org XOR project) is correct. The Caddy integration for automated SSL is well-designed.

**Issue — SSL Private Keys in the Domain Table**: `sslPrivateKey` stores the private key as plain text. This is a security concern — private keys should be encrypted at rest or stored in a dedicated secrets manager.

**Recommendation**: Encrypt `sslPrivateKey` using the same encryption utilities used for secrets, or remove manual SSL upload entirely and rely solely on Caddy's automated certificate management.

---

### 2.17 Invitation

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Org onboarding. Enables admins to invite users to join an organization with a specific role. |
| **Why It Exists** | New team members need a way to join orgs. Invitations provide a secure, auditable onboarding flow with email-based tokens and expiration. |
| **Fields** | `id`, `email`, `roleType`, `token`, `orgId`, `userId`, `invitedBy`, `revokedBy`, `status`, `expiresAt`, `acceptedAt`, `revokedAt`, `createdAt`, `updatedAt` |
| **Key Relationships** | Belongs to: Org (NOT NULL). References: User (invitee, inviter, revoker). |
| **Used By** | Backend (invitation CRUD, acceptance flow), Admin (invitation management UI) |

**Assessment**: Well-designed with proper lifecycle states (pending → accepted/expired/revoked) and audit trail (invitedBy, revokedBy, timestamps).

No significant issues.

---

### 2.18 Certificate (Caddy-Managed)

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | SSL certificate storage. Caddy stores its auto-managed certificates in PostgreSQL via the certmagic storage plugin. |
| **Why It Exists** | Caddy needs persistent certificate storage that survives pod restarts in Kubernetes. PostgreSQL is already available, so it's used as the storage backend. |
| **Fields** | `parent` (domain name), `name` (file name), `isFile`, `value` (bytea), `modified` |
| **Managed By** | Caddy (external). ThreadedStack reads but never writes. |

**Assessment**: Correctly implemented as a read-only reference. No changes needed.

---

### 2.19 Junction: agent_projects

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Many-to-many link between agents and projects. An agent can serve multiple projects; a project can have multiple agents. |
| **Fields** | `id`, `agentId`, `projectId`, `alias`, `createdAt`, `updatedAt` |
| **Unique Constraint** | `(agentId, projectId)` — one link per pair |

**Assessment**: The `alias` field enables project-specific naming for shared agents, which is a nice touch. The junction is correctly implemented.

---

### 2.20 Junction: agent_functions

| Aspect | Detail |
|--------|--------|
| **Business Purpose** | Many-to-many link between agents and functions. Custom functions become tools available to agents during conversation. |
| **Fields** | `id`, `agentId`, `functionId`, `createdAt`, `updatedAt` |
| **Unique Constraint** | `(agentId, functionId)` — one link per pair |

**Assessment**: Correctly implemented. The agent runtime loads these via `db.services.function.listByAgent(agentId)`.

---

## 3. Relationship Architecture

### 3.1 Complete Relationship Map

```
Organization (root tenant)
│
├── User ← linked via Role (RBAC)
│   ├── Role (org-scoped: admin/member/viewer)
│   ├── Subscription (1:1, determines org limits)
│   ├── API Keys (machine auth)
│   ├── Threads (conversation owner)
│   └── Assets (user uploads)
│
├── Project (workspace)
│   ├── Role (project-scoped: admin/member/viewer)
│   ├── Endpoint (HTTP routes)
│   │   └── Function (FaaS handler, optional 1:many)
│   ├── Function (standalone or endpoint-linked)
│   ├── Secret (project-scoped credentials)
│   ├── Domain (project custom domain)
│   ├── Thread (project context)
│   └── Message (project context)
│
├── Agent (AI agent config)
│   ├── Provider (LLM API, 1:1 required)
│   ├── Secret (agent-scoped credentials)
│   ├── Thread (conversation container)
│   ├── ↔ Project (many-to-many via junction)
│   └── ↔ Function (many-to-many via junction)
│
├── Provider (LLM service config)
│   ├── Secret (provider API key)
│   ├── Agent (agents using this provider)
│   └── Thread (provider context)
│
├── Secret (encrypted credentials, exclusive arc)
│   └── Scoped to: Org | Project | Provider | Agent
│
├── Quota (usage metering per period)
├── Invitation (team onboarding)
├── Domain (org custom domain)
├── Asset (org files)
└── API Key (org machine auth)

Thread (conversation)
├── User (creator, NOT NULL)
├── Agent (optional)
├── Provider (optional)
├── Org (optional context)
├── Project (optional context)
├── Message (ordered content)
│   └── Asset (attachments)
└── Thread (parent, for branching)

Subscription → Plan → Quota Limits
└── User.subscription.tier → plan.metadata → { projects: 10, agents: 5, ... }
```

### 3.2 Cascading Delete Behavior

| When Deleted | Cascades To | Behavior |
|---|---|---|
| Organization | Projects, Agents, Providers, Roles, Secrets, Quotas, Invitations, Threads, Domains, Assets | CASCADE (everything under org is deleted) |
| Project | Endpoints, Functions, Roles, Secrets, Threads, Messages, Domains, AgentProjects junctions | CASCADE |
| Agent | Secrets (agent-scoped), AgentProjects, AgentFunctions junctions | CASCADE |
| Agent | Threads.agentId | SET NULL (preserves thread history) |
| Provider | Agents (!) | CASCADE (too aggressive — see Issue) |
| Provider | Threads.providerId, Assets.providerId | SET NULL |
| Endpoint | Functions (!) | CASCADE (see Issue) |
| Thread | Messages, Assets | CASCADE |
| User | Roles, Threads, Subscription, API Keys, Assets | CASCADE |

**Critical Cascade Issues**:
1. **Provider → Agent CASCADE**: Deleting a provider deletes all agents using it. Users would expect agents to become "unconfigured" (SET NULL), not deleted.
2. **Endpoint → Function CASCADE**: Deleting an endpoint deletes its functions. But functions may also be used as agent tools. Deleting an endpoint shouldn't destroy reusable functions.

---

## 4. Exclusive Arc Pattern Analysis

### 4.1 Current Implementations

| Entity | Arc Fields | Pattern | CHECK Constraint |
|---|---|---|---|
| Secret | orgId, projectId, providerId, agentId | Exactly 1 (with org+provider exception) | Yes |
| Asset | orgId, projectId, userId, threadId, messageId | Exactly 1 (providerId is metadata, not in arc) | Yes |
| Role | orgId, projectId | Exactly 1 | Yes |
| Domain | orgId, projectId | Exactly 1 | Yes |

### 4.2 Pattern Evaluation

The exclusive arc pattern is well-suited for this platform:
- **Secrets**: Scoped credentials MUST belong to exactly one entity. Correct.
- **Assets**: File ownership MUST be unambiguous. Correct.
- **Roles**: RBAC grants apply to one scope. Correct.
- **Domains**: A domain serves one entity. Correct.

### 4.3 Issue — Secret Arc Exception

The secret CHECK constraint allows `orgId + providerId` together. This was added for the quickstart flow but violates the pattern's intent.

**Current constraint** (5 valid combinations):
```
orgId only | projectId only | providerId only | agentId only | orgId + providerId
```

**Recommended constraint** (4 valid combinations — strict exclusive arc):
```
orgId only | projectId only | providerId only | agentId only
```

The quickstart flow should create a provider-scoped secret (`providerId` only). The 3-tier secret resolution already checks provider secrets, so `orgId` on the secret is redundant when `providerId` is set.

---

## 5. Data Flow Through the Stack

### 5.1 Agent Execution Flow (The Critical Path)

This is the most important data flow — it touches the most entities:

```
1. Client → POST /_/agents/:id/run { prompt, threadId? }
   ↓
2. Backend loads Agent (with relations):
   - Agent.provider (Provider model)
   - Agent.secrets (Secret[] — agent-scoped)
   - Agent.functions (Function[] — via junction)
   ↓
3. SecretResolver resolves API key (3-tier):
   a. Agent secrets (WHERE agentId = agent.id)
   b. Provider secrets (WHERE providerId = agent.providerId)
   c. Org secrets (WHERE orgId = agent.orgId)
   → First match wins → Decrypt with HKDF(masterKey, scopeOwnerId)
   ↓
4. SecretResolver resolves headers/bodyParams:
   - Scan provider.headers for {{SECRET_NAME}} templates
   - Load provider + org secrets, deduplicate by name
   - Replace templates with decrypted values
   ↓
5. Build LLM config:
   {
     apiKey: <decrypted>,
     model: override || agent.model || provider.options.model,
     provider: provider.type,
     systemPrompt: override || agent.systemPrompt,
     headers: <resolved>,
     bodyParams: <resolved>
   }
   ↓
6. Get/Create Thread:
   - If threadId provided → load thread + messages
   - If no threadId → create new thread (userId, orgId, agentId)
   ↓
7. AgentRunner loop (max 10 steps):
   a. Convert stored messages to LLM format
   b. Stream LLM response (text + tool calls)
   c. Execute tools in sandbox
   d. Persist assistant message
   e. Persist tool result as user message
   f. Repeat if stopReason === 'tool_use'
   ↓
8. Stream SSE events to client
```

**Entities touched**: Agent, Provider, Secret, Function, Thread, Message, User (auth), Org (scoping)

### 5.2 Quickstart Flow

Creates 5 entities in one transaction:

```
1. Provider (org-scoped, from template)
2. Secret (provider-scoped, encrypted API key)
3. Project (org-scoped)
4. Agent (org-scoped, linked to provider)
5. AgentProject junction
6. Endpoint (project-scoped, type=agent)
```

### 5.3 Authentication Flow

```
Client → Proxy:
  ├── JWT (Neon Auth) → JWKS verify → req.user = { userId, email, role }
  ├── API Key (tdsk_*) → Hash → DB lookup → req.user = { userId, role }
  └── Session Token → Presence check → Forward to backend
  ↓
Proxy → Backend (via headers):
  X-User-Id, X-User-Role, X-User-Email, X-Proxy-Auth
  ↓
Backend → Permission Check:
  Load user's org/project role → Compare against PermissionMatrix
```

---

## 6. Relationship Gap Analysis & Recommendations

### 6.1 Organization Ownership (CRITICAL)

**Problem**: There is no way to determine who "owns" an organization from the database. The subscription-driven quota system assumes an org owner exists, but ownership is not modeled.

**Impact**:
- Backend must scan roles to find the "admin" user, which isn't necessarily the owner
- If the owner leaves the org, quota limits become undefined
- Can't transfer ownership without manually juggling roles

**Recommendation**: Add `ownerId` column to the `organizations` table:
```sql
ALTER TABLE organizations ADD COLUMN owner_id UUID NOT NULL REFERENCES users(id);
```

**Affected repos**: database (schema), domain (model), backend (CRUD + quota resolution), admin (ownership UI)

---

### 6.2 Provider-Agent Relationship (HIGH)

**Problem**: `agents.providerId` is NOT NULL with ON DELETE CASCADE. Deleting a provider deletes all its agents.

**Impact**: Users who delete a provider to create a better one lose all agent configurations.

**Recommendation**: Change cascade behavior:
```sql
ALTER TABLE agents
  ALTER COLUMN provider_id DROP NOT NULL,
  DROP CONSTRAINT agents_provider_id_fkey,
  ADD CONSTRAINT agents_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL;
```

This makes `providerId` nullable. An agent without a provider is "unconfigured" — the backend should return an error when trying to run it, but the configuration is preserved.

**Affected repos**: database (schema), domain (model — make `providerId` optional), backend (validate provider exists before agent run), admin (show "no provider" warning)

---

### 6.3 Provider Quick-Switching (HIGH)

**Problem**: There's no streamlined flow for switching an agent from one provider to another. The user must:
1. Create a new provider
2. Create a new secret for the new provider
3. Update the agent's providerId
4. Hope the new provider has compatible options

**Impact**: Users can't easily experiment with different LLM providers.

**Recommendation**:
- The current `agents.providerId` FK already supports switching (just update the field). The real gap is in the **admin UI** — there's no "switch provider" action.
- Add a backend endpoint: `PUT /_/agents/:id/provider` that validates the new provider has the required secrets before switching.
- The admin should show a provider selector dropdown on the agent edit form, with validation that the selected provider has API key secrets configured.

**Affected repos**: backend (new endpoint or enhance existing update), admin (UI for provider switching with validation)

---

### 6.4 Endpoint-Agent/Function References (HIGH)

**Problem**: Agent endpoints store `agentId` in JSONB `options`. FaaS endpoints store `functionId` in JSONB `options`. Neither has referential integrity.

**Impact**:
- Deleting an agent doesn't invalidate its agent endpoints
- Deleting a function doesn't invalidate its FaaS endpoints
- Can't query "which endpoints use this agent?" efficiently

**Recommendation**: Add optional FK columns to the endpoints table:
```sql
ALTER TABLE endpoints
  ADD COLUMN agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  ADD COLUMN function_id UUID REFERENCES functions(id) ON DELETE SET NULL;
```

When an endpoint is created with `type: "agent"`, set `agentId` from `options.agentId`. Same for FaaS/functionId. Keep the JSONB `options` for additional config but use the FK for integrity.

**Affected repos**: database (schema), domain (model), backend (endpoint CRUD — populate FK on create/update), admin (no change needed — already uses options)

---

### 6.5 Function-Endpoint Coupling (MEDIUM)

**Problem**: `functions.endpointId` creates a 1:many ownership relationship (function belongs to endpoint). But functions are also shared with agents via the junction table. A function can't serve both an endpoint AND be an agent tool without this FK creating confusing ownership semantics.

**Impact**: If an endpoint is deleted, its functions cascade-delete, even if those functions are also used as agent tools.

**Recommendation**: Remove `functions.endpointId` entirely. Instead:
- FaaS endpoints reference functions via `endpoints.function_id` (new FK from 6.4 above)
- Functions become standalone project-scoped entities
- Both endpoints and agents reference functions, neither "owns" them
- Functions cascade-delete only when their project is deleted

```sql
ALTER TABLE functions DROP COLUMN endpoint_id;
-- Functions are now project-scoped only, referenced by endpoints and agents
```

**Affected repos**: database (schema), domain (model), backend (function CRUD, endpoint CRUD), admin (function forms)

---

### 6.6 Message Denormalization (MEDIUM)

**Problem**: Messages duplicate `orgId` and `projectId` from their parent thread. This creates data inconsistency risk and unnecessary storage.

**Impact**: If a thread's orgId changes (unlikely but possible), messages retain stale values. Every message insert requires passing these extra fields.

**Recommendation**: Remove `orgId` and `projectId` from the messages table. When org/project context is needed, join through the thread:
```sql
SELECT m.*, t.org_id, t.project_id
FROM messages m
JOIN threads t ON m.thread_id = t.id
WHERE m.thread_id = $1
```

**Affected repos**: database (schema), domain (model), backend (message creation — stop passing orgId/projectId), agent runtime (stop passing orgId in createMessage)

---

### 6.7 Thread Scope Clarification (MEDIUM)

**Problem**: Threads have 4 optional scope FKs (orgId, agentId, providerId, projectId) with no constraint on how many can be set. The semantics are unclear.

**Recommendation**: Distinguish between **required context** and **optional metadata**:

- `userId` — Required. Who created the thread.
- `orgId` — Required. Which org the thread belongs to (for scoping and permissions).
- `agentId` — Optional. Which agent powers the thread (SET NULL on agent delete is correct).
- `projectId` — Optional. Project context (for project-scoped threads).
- `providerId` — Remove from threads. Provider is always derivable from the agent's provider. Storing it separately creates stale data risk.

```sql
ALTER TABLE threads
  ALTER COLUMN org_id SET NOT NULL,
  DROP COLUMN provider_id;
```

**Affected repos**: database (schema), domain (model), backend (thread CRUD), admin (thread display)

---

### 6.8 Secret Arc Simplification (MEDIUM)

**Problem**: The secret exclusive arc allows `orgId + providerId` together, breaking the exclusive arc pattern.

**Recommendation**: Remove the exception. Provider-scoped secrets (providerId only) are sufficient:
```sql
-- New CHECK constraint (strict exclusive arc)
CHECK (
  (orgId IS NOT NULL AND projectId IS NULL AND providerId IS NULL AND agentId IS NULL) OR
  (orgId IS NULL AND projectId IS NOT NULL AND providerId IS NULL AND agentId IS NULL) OR
  (orgId IS NULL AND projectId IS NULL AND providerId IS NOT NULL AND agentId IS NULL) OR
  (orgId IS NULL AND projectId IS NULL AND providerId IS NULL AND agentId IS NOT NULL)
)
```

Update the quickstart flow to create provider-scoped secrets (set `providerId` only, not `orgId + providerId`).

**Affected repos**: database (schema constraint), backend (quickstart endpoint, secret resolution), admin (no change)

---

### 6.9 Provider Type Constraint (LOW)

**Problem**: `providers.type` is stored as plain text with no CHECK constraint.

**Recommendation**: Add a CHECK constraint:
```sql
ALTER TABLE providers ADD CONSTRAINT provider_type_check
  CHECK (type IN ('ai', 'git', 'auth', 'storage'));
```

**Affected repos**: database (schema)

---

### 6.10 Role Type Constraint (LOW)

**Problem**: `roles.type` is stored as plain text with no CHECK constraint.

**Recommendation**: Add a CHECK constraint:
```sql
ALTER TABLE roles ADD CONSTRAINT role_type_check
  CHECK (type IN ('admin', 'member', 'viewer'));
```

Note: `owner` and `super` are not stored in the roles table — they're computed roles.

**Affected repos**: database (schema)

---

### 6.11 Function Name Uniqueness (LOW)

**Problem**: No unique constraint on function names within a project. Two functions with the same name create ambiguous agent tool references.

**Recommendation**:
```sql
CREATE UNIQUE INDEX functions_project_name_idx ON functions (project_id, name);
```

**Affected repos**: database (schema)

---

### 6.12 Message Indexing (LOW)

**Problem**: No composite index optimized for the most common query pattern (messages by thread, ordered by creation).

**Recommendation**:
```sql
CREATE INDEX messages_thread_created_idx ON messages (thread_id, created_at);
```

**Affected repos**: database (schema)

---

## 7. Cross-Cutting Concerns

### 7.1 Domain Model vs Database Model Alignment

The domain models (TypeScript classes) and database schemas (Drizzle tables) are mostly aligned but have some divergences:

| Domain Model | DB Field | Discrepancy |
|---|---|---|
| `Agent.secrets` | Not a DB column | Populated via service layer join, not a DB relation |
| `Agent.functions` | Not a DB column | Populated via junction table, not a DB relation |
| `Agent.projects` | Not a DB column | Populated via junction table, not a DB relation |
| `Agent.provider` | Not a DB column | Populated via service layer join |
| `Function.agentIds` | Not a DB column | Domain model has it, DB uses junction |
| `User.first`, `User.last` | Not in DB | Computed in domain model from `name` |
| `Secret.value` | Not in DB | Runtime-only (decrypted value never stored in plaintext) |

These are all intentional denormalizations for the domain layer — the domain models carry populated relations that don't exist as DB columns. This is a good pattern (rich domain models vs lean DB schemas).

### 7.2 Encryption Architecture

The encryption system uses:
- **AES-256-GCM** for secret values
- **HKDF-SHA256** for per-scope key derivation
- **SHA-256** for API key hashing and secret name lookup

The key derivation uses the scope owner's ID as the HKDF salt, which is technically an RFC 5869 deviation (salt should be random, info should be contextual). However, changing this would require re-encrypting all existing secrets, so it should be documented as a known deviation rather than changed.

### 7.3 Soft Delete vs Hard Delete

The platform uses a mix:
- **Hard delete**: Most entities (CASCADE from parent)
- **Soft delete**: API keys (`active = false`), Invitations (status field)
- **Orphan on delete**: Threads lose agentId/providerId (SET NULL)

**Recommendation**: Consider soft-delete for agents and providers. These are high-value configurations that users may want to recover. Add an `active` or `deletedAt` column.

---

## 8. Summary of Recommendations

### Priority: Critical
| # | Recommendation | Impact | Effort |
|---|---|---|---|
| 6.1 | Add `ownerId` to organizations | Fixes subscription→quota chain | Low |
| 6.2 | Change Provider→Agent cascade to SET NULL | Prevents data loss on provider delete | Low |

### Priority: High
| # | Recommendation | Impact | Effort |
|---|---|---|---|
| 6.3 | Add provider quick-switch UI/API | Improves developer experience | Medium |
| 6.4 | Add `agentId`/`functionId` FKs to endpoints | Adds referential integrity | Low |
| 6.5 | Remove `endpointId` from functions | Fixes cascade + ownership issues | Medium |

### Priority: Medium
| # | Recommendation | Impact | Effort |
|---|---|---|---|
| 6.6 | Remove `orgId`/`projectId` from messages | Eliminates data duplication | Medium |
| 6.7 | Make `threads.orgId` NOT NULL, remove `providerId` | Clarifies thread scoping | Medium |
| 6.8 | Remove org+provider secret arc exception | Simplifies secret ownership | Low |
| 2.2 | Rename User's `role` to `platformRole` | Reduces confusion with RBAC Role | Low |
| 2.11 | Store agent metadata in thread.meta on creation | Preserves history after agent delete | Low |

### Priority: Low
| # | Recommendation | Impact | Effort |
|---|---|---|---|
| 6.9 | Add CHECK constraint on providers.type | Data integrity | Trivial |
| 6.10 | Add CHECK constraint on roles.type | Data integrity | Trivial |
| 6.11 | Add unique index on (projectId, name) for functions | Prevents ambiguous tool names | Trivial |
| 6.12 | Add composite index on (threadId, createdAt) for messages | Query performance | Trivial |
| 2.7 | Add CHECK constraint on endpoints.type | Data integrity | Trivial |
| 2.10 | Implement rate limiting in proxy | Uses existing rateLimit field | Medium |
| 2.16 | Encrypt sslPrivateKey in domains | Security hardening | Medium |
| 7.3 | Add soft-delete for agents and providers | Prevents accidental data loss | Medium |

### Not Recommended (Acceptable As-Is)
- **HKDF salt usage**: Technically incorrect per RFC but changing would require secret re-encryption migration
- **JSONB for agent tools**: Tool names in JSONB is fine since they reference built-in tool definitions, not DB entities
- **Asset provider reference**: `providerId` on assets is correctly modeled as metadata (SET NULL), not ownership
- **API key ownership pattern**: Intentionally different from exclusive arc — a key has a user, an org, and optionally a project

---

## Appendix A: Entity-Relationship Diagram (Text)

```
┌─────────────┐     1:N      ┌──────────┐     1:N     ┌───────────┐
│Organization │──────────────│ Project   │────────────│ Endpoint   │
│             │              │           │            │            │
│ ownerId* ──┼──┐           │ orgId     │            │ projectId  │
└─────────────┘  │           └──────────┘            │ agentId*   │
      │          │                │                   │ functionId*│
      │ 1:N      │                │ N:M               └───────────┘
      │          │                │
      ▼          │           ┌────┴────┐              ┌───────────┐
┌──────────┐     │           │ Agent   │──────────────│ Function   │
│ Provider │     │           │ Projects│    N:M       │            │
│          │     │           │ Junction│              │ projectId  │
│ orgId    │     │           └─────────┘              └───────────┘
└──────────┘     │                │
      │          │                │
      │ 1:N      │           ┌────┴────┐
      │          │           │  Agent  │
      ▼          │           │         │
┌──────────┐     │           │ orgId   │
│  Agent   │─────┼───────────│providerId│
│          │     │           └─────────┘
│ orgId    │     │                │
│providerId│     │                │ 1:N
└──────────┘     │                ▼
                 │           ┌──────────┐    1:N    ┌──────────┐
                 │           │  Thread  │──────────│ Message   │
                 │           │          │          │           │
                 │           │ userId   │          │ threadId  │
                 │           │ orgId    │          └──────────┘
                 │           │ agentId  │
                 │           └──────────┘
                 │
                 │    1:1    ┌──────────────┐
                 └──────────│    User       │
                            │              │
                            └──────────────┘
                                  │
                                  │ 1:1
                                  ▼
                            ┌──────────────┐
                            │ Subscription │
                            │              │
                            │ userId       │
                            │ tier         │
                            └──────────────┘

* = Recommended new fields
```

## Appendix B: Exclusive Arc Visualization

```
Secret ownership (current — 5 valid states):
  ┌── orgId ──────────────────────┐
  ├── projectId ──────────────────┤
  ├── providerId ─────────────────┤ Exactly ONE
  ├── agentId ────────────────────┤
  └── orgId + providerId ─────────┘ ← Exception (recommend removing)

Secret ownership (recommended — 4 valid states):
  ┌── orgId ──────────────────────┐
  ├── projectId ──────────────────┤ Exactly ONE
  ├── providerId ─────────────────┤
  └── agentId ────────────────────┘

Asset ownership (5 valid states):
  ┌── orgId ──────────────────────┐
  ├── projectId ──────────────────┤
  ├── userId ─────────────────────┤ Exactly ONE
  ├── threadId ───────────────────┤
  └── messageId ──────────────────┘
  (+providerId as metadata, not in arc)

Role scope (2 valid states):
  ┌── orgId ──────────────────────┐
  └── projectId ──────────────────┘ Exactly ONE

Domain ownership (2 valid states):
  ┌── orgId ──────────────────────┐
  └── projectId ──────────────────┘ Exactly ONE
```
