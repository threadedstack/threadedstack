# Go-to-Market Strategy — Threaded Stack

**Date:** 2026-04-03
**Audience:** Stakeholders, leadership, prospective partners

---

## 1. Beta Strategy

### Model

Invite-only beta with real billing from day one. Users sign up through a controlled access flow and pay via Stripe using the same tiered plan structure that will carry into general availability. There are no "beta discounts" or placeholder pricing — what beta users pay is what GA users pay.

### Why Invite-Only

- **Quality control.** A controlled audience ensures every beta user gets hands-on support and that feedback comes from developers actually building with the platform, not tire-kickers.
- **Infrastructure sizing.** Sandbox compute (K8s pod provisioning, MITM proxy routing) is the most resource-intensive part of the platform. Controlled growth prevents capacity surprises.
- **Iteration speed.** A smaller cohort allows breaking changes between beta releases without broad impact. Schema migrations, API contract changes, and quota adjustments can happen rapidly.

### Why Real Billing

- **Validates willingness to pay.** Free beta users provide qualitatively different feedback than paying users. Charging from day one tests the value proposition, not just the technology.
- **Exercises the full stack.** Stripe checkout, webhook processing, subscription lifecycle (upgrade, downgrade, cancel), seat management, quota enforcement, and invoice tracking all get real-world validation.
- **Prevents rearchitecture at GA.** Billing is deeply integrated — subscriptions govern quota limits, seat counts drive Stripe subscription quantities, and quota enforcement gates every resource-creating API call. Bolting this on after beta would require reworking middleware, database schemas, and the admin UI.

### What Beta Validates

| Area | What We Learn |
|------|---------------|
| **Security model** | JIT secret injection works at scale — AI agents and users never see raw credentials, and the MITM proxy reliably intercepts and replaces placeholders across diverse API shapes. |
| **Shared entity model** | Org-to-project resource propagation is intuitive. Users understand that secrets, endpoints, and tools configured once are available across all projects in the org. |
| **Team management** | Roles and permissions work as expected. Seat-based billing (auto-increment on invite, auto-decrement on removal) is transparent and predictable. |
| **All endpoint types** | Proxy endpoints, FaaS functions, and agent endpoints each serve distinct use cases. Users can configure and run all three without confusion. |
| **Sandbox agent hosting** | Direct-connect sandboxes (SSH into a container running Claude Code, Codex, or any pre-configured tool) are the primary interaction surface for power users. The sandbox lifecycle — provision, connect, use, tear down — is reliable and fast. |
| **Billing and quotas** | Hard-block quota enforcement (403 with `quota_exceeded`) is acceptable. Users upgrade when they hit limits rather than churning. The four tiers (Free, Solo, Pro, Team) map to real user segments. |

---

## 2. Beta User Journey

The beta journey is a linear path from sign-up to autonomous AI agents running in managed sandboxes. Each step builds on the previous one.

### Step 1: Sign Up and Authenticate

The user receives a beta invitation link. They sign up using social login (GitHub, GitLab, Google, or Vercel) via Neon Auth. Authentication is handled entirely by the platform — no passwords, no custom auth flows.

### Step 2: Pick a Plan

Immediately after sign-up, the user selects a subscription tier:

| Tier | Price | Seats | Target |
|------|-------|-------|--------|
| **Free** | $0/mo | 1 | Exploration and evaluation |
| **Solo** | $15/mo | 1 | Individual developers shipping real projects |
| **Pro** | $39/mo | 3 included (+$10/seat) | Small teams building together |
| **Team** | $99/mo | 10 included (+$8/seat) | Organizations at scale |

Paid tiers redirect to Stripe hosted checkout. Free tier users get a subscription record in the database immediately with no Stripe interaction.

### Step 3: Create an Organization

Every resource in Threaded Stack lives inside an organization. The user creates their first org, which becomes the container for all projects, secrets, endpoints, and team members. Org count is governed by their plan tier (Free: 1, Solo: 2, Pro: 5, Team: unlimited).

### Step 4: Configure Secrets

The user adds API keys and credentials (OpenAI keys, database connection strings, third-party API tokens) as secrets. Secrets are encrypted at rest (AES-256-GCM) and never exposed to AI agents or end users. They are injected just-in-time by the MITM proxy using placeholder syntax, so agents interact with `{{SECRET_NAME}}` placeholders that resolve server-side.

### Step 5: Create Endpoints

The user configures how external APIs are accessed:

- **Proxy endpoints** route requests through the platform, injecting secrets into headers/bodies transparently.
- **FaaS functions** execute user-written code in sandboxed environments with secrets available as environment variables.
- **Agent endpoints** connect AI agents to tools, providers, and execution contexts.

Endpoints are assigned to projects, and projects inherit the org's secrets and configuration.

### Step 6: Build and Share Across Projects

The user creates projects within their org. Each project scopes which endpoints, secrets, and agents are available. The shared entity model means configuration happens once at the org level and is selectively exposed to projects — no duplication, no drift.

### Step 7: Add Team Members

For Pro and Team tiers, the user invites collaborators. Each invitation triggers seat management:

- If the team is within included seats, no billing change.
- If additional seats are needed, Stripe subscription quantity is updated automatically.
- When a member is removed, excess seats are decremented on the next billing cycle.

Free and Solo tiers are single-seat and cannot add members.

### Step 8: Configure and Run AI Agents

The user creates agents, attaches tools and providers, and runs them through one of four interaction surfaces:

1. **REPL CLI** (`tsa`) — Terminal-native TUI for developers who live in the terminal.
2. **Threads web app** — Browser-based chat interface for non-developer users and stakeholders.
3. **API** (SSE/WebSocket) — Programmatic integration for embedding AI capabilities into existing applications.
4. **Sandbox direct connect** — SSH into a container running any pre-configured AI tool (Claude Code, Codex, OpenCode). All traffic routes through the MITM proxy, so the tool works normally but never sees real credentials.

---

## 3. Success Criteria for Beta

Beta exits to general availability when the following conditions are met. These are binary (met or not met), not aspirational targets.

### Product Readiness

- **All four endpoint types operational.** Proxy, FaaS, agent, and sandbox-connect endpoints work reliably under sustained usage from beta cohort.
- **Quota enforcement stable.** Hard-block enforcement (403 at limit) triggers correctly across all six resource types (projects, compute, threads, messages, endpoints, secrets) with no false positives or race conditions.
- **Billing lifecycle complete.** Sign up, upgrade, downgrade, cancel, and resubscribe all work end-to-end through Stripe. Invoice history is accurate and accessible in the admin dashboard.
- **Sandbox reliability.** Sandbox pods provision in under 30 seconds, MITM proxy routing is stable, and teardown leaves no orphaned resources. Users can SSH into sandboxes running pre-configured AI tools without manual intervention.
- **Multi-tenant isolation verified.** No cross-org data leakage under any tested scenario. Secrets, endpoints, and threads are scoped exclusively to their owning org and project.

### Usage Signals

- **Retention over conversion.** Beta users who complete the full journey (sign up through agent execution) return and use the platform in subsequent weeks. Week-over-week retention above 40% for the active beta cohort.
- **Upgrade signal.** At least 20% of Free tier beta users upgrade to a paid tier within their first 30 days, indicating the free tier is useful for evaluation but the paid tiers unlock real value.
- **Team adoption.** At least 3 Pro or Team tier orgs have 2+ active members, validating that the shared entity model and team management features serve real collaborative workflows.

### Operational Readiness

- **Monitoring and alerting.** Automated alerts for sandbox provisioning failures, Stripe webhook delivery failures, quota enforcement errors, and auth proxy downtime.
- **Support playbook.** Documented procedures for the most common beta support requests (billing questions, sandbox connectivity issues, quota limit confusion).
- **Zero critical security findings.** No unresolved issues where secrets are exposed to agents, cross-org data is accessible, or auth can be bypassed.

---

## 4. Post-Beta Growth Path

### Phase 1: Beta (Current)

Invite-only access. Real billing. Small cohort of developers and small teams who are actively building AI-powered applications and need managed infrastructure.

**Focus:** Product-market fit validation, billing system hardening, sandbox reliability, direct feedback loops with every user.

### Phase 2: Public Launch

Open sign-up with self-serve onboarding. The Free tier serves as the primary acquisition channel — developers can evaluate the full platform (with resource limits) without talking to anyone.

**Focus:**
- **Self-serve onboarding documentation.** Getting-started guides, admin UI walkthrough, REPL CLI quickstart, and API reference — all tested against real user journeys during beta.
- **Pricing page and public marketing site.** Clear tier comparison, use-case positioning, and transparent pricing with no "contact sales" friction for tiers under Team.
- **Stripe Customer Portal integration.** Users manage payment methods, view invoices, and handle subscription changes without contacting support.

### Phase 3: Growth

Scale acquisition, expand use cases, and build the ecosystem.

**Focus:**
- **Usage-based pricing exploration.** Compute units are already tracked per-org per-period. If usage patterns from Phase 2 show demand for higher compute without full tier upgrades, introduce compute add-on packs.
- **Marketplace for pre-configured sandboxes.** Community-contributed sandbox environments (pre-configured with specific AI tools, frameworks, or language runtimes) that users can deploy with one click.
- **Enterprise tier.** SSO (SAML/OIDC), audit logging, dedicated infrastructure, SLAs, and custom retention policies. Priced per contract, not listed on the public pricing page.
- **API-first ecosystem.** Third-party developers build on top of Threaded Stack's API to create custom agent workflows, tool integrations, and monitoring dashboards.

---

## 5. Distribution Channels

### Developer Communities

- **GitHub presence.** Open-source components where possible (CLI tooling, sandbox configuration templates, domain model types). Developers discover the platform through the tools they already use.
- **Hacker News and Product Hunt launches.** Timed for public launch (Phase 2), not beta. Beta feedback shapes the narrative for these high-visibility, one-shot opportunities.
- **Developer forums and Discord.** Active presence in AI/ML developer communities (r/LocalLLaMA, r/MachineLearning, AI-focused Discord servers). Participation-first — answering questions, sharing architecture decisions, and demonstrating the platform's approach to secret management and sandbox security.

### Technical Content

- **Architecture blog posts.** Deep dives into the MITM proxy secret injection model, sandbox pod lifecycle, and exclusive arc data model. These attract senior engineers and technical leaders who evaluate infrastructure.
- **"How we built it" series.** Transparent content about real engineering decisions — why Stripe over alternatives, how quota enforcement works at the database level, why the strategy pattern for payment providers. Builds credibility with the target audience.
- **Video walkthroughs.** Screen recordings of the full user journey: sign up, configure secrets, create a proxy endpoint, run an AI agent in a sandbox. Optimized for discoverability on YouTube and embedded in documentation.

### AI/ML Events

- **Conference talks and workshops.** Focus on the security and governance angle — "How to deploy AI agents without leaking your API keys" is a talk that resonates at any AI/ML conference. The platform is the solution, not the pitch.
- **Local meetups.** Hands-on workshops where attendees configure a working agent setup in 30 minutes. Free tier accounts make this zero-friction.
- **Hackathon sponsorships.** Provide Free tier accounts and pre-configured sandbox environments at AI hackathons. Developers who build with the platform during a hackathon are the highest-intent leads.

### Organic and Referral

- **Word of mouth from beta cohort.** Beta users who have a good experience are the most credible acquisition channel. Referral incentives (extended compute quotas, additional seats) amplify this.
- **Integration partner co-marketing.** Joint content with AI tool vendors whose tools run in Threaded Stack sandboxes (see Partnerships below).

---

## 6. Partnerships

### AI Tool Vendors

The "bring your own AI tool" model creates natural partnership opportunities with the tools that run inside Threaded Stack sandboxes.

| Partner Type | Value to Partner | Value to Threaded Stack |
|---|---|---|
| **AI coding tools** (Anthropic/Claude Code, OpenAI/Codex, OpenCode) | Managed deployment environment for their tool. Enterprise customers get governance, secret management, and audit capabilities without the tool vendor building them. | Pre-configured sandbox environments that attract developers already using these tools. |
| **LLM providers** (OpenAI, Anthropic, Google, Mistral) | Distribution channel — developers configure provider API keys as secrets and route all LLM traffic through the proxy. Usage visibility for the provider's sales team. | Provider templates ship with the platform, making it trivial to configure any major LLM. Reduces onboarding friction. |
| **AI agent frameworks** (LangChain, CrewAI, AutoGen) | Managed runtime for framework-based agents. Teams using these frameworks get sandbox isolation and secret management without custom infrastructure. | Expands the addressable market beyond developers building custom agents to teams using established frameworks. |

### Cloud and Infrastructure Providers

| Partner Type | Value to Partner | Value to Threaded Stack |
|---|---|---|
| **Neon** (current database and auth provider) | Reference customer for Neon Auth in a production AI platform. Joint case study opportunity. | Deep integration already in place. Co-marketing validates both platforms. |
| **Kubernetes providers** (EKS, GKE, AKS) | Demonstrates K8s as the runtime for AI agent infrastructure. Sandbox pods are a compelling use case for managed K8s. | Multi-cloud sandbox deployment. Customers choose their preferred cloud without platform changes. |
| **Container registries** (Docker Hub, GitHub Container Registry) | Distribution point for pre-configured sandbox images. | Community-contributed sandbox environments stored and versioned in public registries. |

### DevOps and Security Platforms

| Partner Type | Value to Partner | Value to Threaded Stack |
|---|---|---|
| **Secret management tools** (HashiCorp Vault, AWS Secrets Manager, 1Password) | Integration point — enterprises with existing secret stores can sync credentials into Threaded Stack rather than re-entering them. | Enterprise readiness. Large organizations already have secret management tooling and will not adopt a platform that requires manual re-entry. |
| **Observability platforms** (Datadog, Grafana, New Relic) | AI agent telemetry is a growing data source. Threaded Stack sandbox metrics and proxy logs are high-value signals. | Production-grade monitoring without building a custom observability stack. Integration reduces the ops burden that blocks enterprise adoption. |
| **CI/CD platforms** (GitHub Actions, GitLab CI) | AI agents as CI/CD steps — code review agents, test generation agents, deployment verification agents all run in Threaded Stack sandboxes triggered by pipeline events. | Embeds the platform into existing developer workflows. Usage becomes habitual rather than deliberate. |

### Partnership Prioritization

**Beta phase:** Neon (already integrated), one AI coding tool vendor (sandbox co-development), one LLM provider (provider template validation).

**Public launch:** Expand to 2-3 AI tool vendors, add one secret management integration, publish integration guides for CI/CD platforms.

**Growth phase:** Formal partner program with tiered benefits, co-marketing commitments, and technical integration support.
