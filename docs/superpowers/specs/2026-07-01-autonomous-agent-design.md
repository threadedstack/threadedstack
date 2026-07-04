# ThreadedStack Autonomous Agent: Design Spec

Date: 2026-07-01
Status: Draft for review
Author: Design session (brainstorming)

## 1. Goal

Give ThreadedStack an `agent` that owns the entire platform 24/7 and runs it like a CEO. It
sets its own roadmap, forms strategy, decides what to build and which repos to touch, and owns
the full delivery lifecycle hands-free: code, test, merge, deploy to the Civo Kubernetes
cluster, run database migrations, publish npm packages, and build/ship docker images. Cost is
not a constraint. This is not a coding sidekick and not a human-task executor; a headless
coding CLI (`claude -p`, `codex exec`, `pi -p`) is at most the "hands" the agent delegates
code-writing to.

There is one entity: the `agent`. "Autonomy" is a set of faculties an agent can have (a durable
SOUL, a heartbeat that wakes it, semantic memory, self-direction, delegation, and delivery
authority), not a separate kind of thing. An agent configured with those faculties runs
autonomously; the same entity without them is a plain request/response agent. Same entity,
capabilities dialed up. There is deliberately no second term.

The build dog-foods ThreadedStack's own primitives: a Sandbox is the body, the AgentRunner
plus AI Providers are the brain, Skills are the self-improving procedural memory, the Scheduler
is the heartbeat, Threads/Messages plus a new semantic memory store are the memory, and git
plus the existing GitHub Actions pipelines are the delivery hands.

The system supports multiple agents. The ThreadedStack-platform agent is instance #1; additional
agents (support, research, a service host, a different product) are created from the same
machinery with different composition.

## 2. Key decisions (locked in brainstorming)

1. **There is only the `agent` entity, evolved in place. No parallel table, no second name,
   no removal of agents.** Autonomy faculties (SOUL, heartbeat, semantic memory,
   self-direction, delegation, delivery authority) are layered onto the existing `agent`. The
   difference between an autonomous agent and a plain chat agent is capability and configuration,
   not entity kind. This reverses the prior "remove agents system" decision.
2. **Reuse the AgentRunner engine untouched.** Verified: `repos/agent` has zero dependency on
   the `agents` table (no `@tdsk/database` import in its `src`; `AgentRunner.init()` takes a
   plain config; `agentId` is only a log label). The only DB coupling is `resolveAgentConfig`,
   which we extend rather than duplicate.
3. **Always-on is the Scheduler, not a perpetual pod.** The backend Scheduler is already a
   live 60-second loop, restart-resilient. The brain is invoked per-heartbeat with fresh
   context rehydrated from durable state, which defeats context rot and sidesteps the pod
   idle-reaper and the missing-PVC problem in one move.
4. **Delivery: the agent commits/pushes/dispatches; CI does the privileged work.** Multi-arch
   buildx, cluster-admin deploy, and migrations run in GitHub Actions with the secrets already
   provisioned there. The agent's verbs reduce to "land a commit on production" and
   "`gh workflow run`". Real tokens never live in the pod; they are reached via the egress
   placeholder-swap.
5. **Autonomy is governed by the SOUL plus executable guardrails, not by human configuration.**
   A human never sets scope, cost, priorities, which repo, or when to ship. Guardrails are
   objective and automatic (tests, migration linter, auditor agent, canary/rollback,
   circuit breakers), which is what makes hands-free delivery survivable without a human on
   the merge button.
6. **Turn the existing `agents` feature flag ON.** No new flag.

## 3. Architecture overview

```
                    ┌──────────────────────────────────────────────────┐
   seed once ──────►│  THE AGENT  (autonomy faculties enabled)          │
 (SOUL + authority) │                                                    │
                    │  SOUL / constitution      (pinned prompt slot #1)  │
                    │        │                                           │
                    │        ▼                                           │
                    │  MEMORY: episodic (threads/messages)               │
                    │          + semantic (pgvector `memories`)          │
                    │          + procedural (skills)                     │
                    │        │                                           │
                    │        ▼                                           │
                    │  ROADMAP / CURRICULUM  (self-set goals)            │
                    │        │                                           │
                    │        ▼                                           │
                    │  BRAIN = AgentRunner loop  ◄──────────┐            │
                    └────────┬───────────────┬──────────────┼───────────┘
              heartbeat wakes │      delegates │      reflects│
              (Scheduler cron)│  (delegate_task│     (nightly)│
                              ▼    tool)        ▼              │
                    ┌──────────────┐   ┌─────────────────┐   ┌──────────────┐
                    │ SANDBOX POD  │   │ in-pod coding    │   │ SKILLS       │
                    │  = body      │──►│ agents: claude -p │   │ (self-       │
                    │ (KubeSandbox)│   │ /codex/pi (hands)│   │  authored,   │
                    └──────────────┘   └─────────────────┘   │  gated)      │
                              │                               └──────────────┘
                              ▼ verified change
                    ┌────────────────────────────────────────────────────────┐
                    │ DELIVERY: bot commits/pushes → executable-invariant gate │
                    │  + read-only auditor → merge / `gh workflow run` → CI     │
                    │  (deploy-production.yml, publish-tsa.yml, firebase)       │
                    │  → Civo rollout + migrate + npm → verify-job → MEMORY      │
                    └────────────────────────────────────────────────────────┘
                              │
                    ESCALATION (on block): email + GitHub issue + admin alert,
                    pause the affected cadence.
```

## 4. Layers

Each layer names its purpose, the existing primitive it builds on, and the smallest net-new
work. These are faculties of the one `agent` entity.

### 4.1 Identity / Soul
- **Purpose:** a durable persona plus values constitution with an explicit priority hierarchy
  (safe / preserve-oversight > ethical / honest > guideline-compliant > helpful), pinned into
  the first slot of every turn so identity never drifts and value conflicts resolve
  deterministically across thousands of autonomous decisions.
- **Built on:** `AgentRunner.init()` already builds a `systemPrompt` and supports
  `updateConfig({ systemPrompt })`; `skills.instructions` already inject text into the prompt.
- **New work:** add a `soul` (constitution) text column on `agents`, distinct from the mutable
  `systemPrompt`; formalize prompt-assembly order in the runner's prompt builder
  (SOUL, then memory, then active skills, then sandbox procedures, then tool guidance);
  ship the SOUL as an `alwaysActive` skill so retrieval can never drop it. The SOUL is a plain
  editable admin field so a human versions identity, never the ongoing decisions.

### 4.2 Memory
- **Purpose:** weeks-long recall. A bounded curated store (facts, conventions, roadmap; hard
  char cap) injected each session, plus scored semantic recall over the agent's own decisions
  and documents. This is the single largest missing primitive: the platform's "Built-in RAG"
  claim is not backed by any vector store today (verified: no pgvector, no embedding column, no
  similarity query anywhere).
- **Built on:** `threads` plus `messages` durable episodic log (the runner persists assistant
  and tool messages on `turn_end` and replays the last 100 on init); `assets` with
  `meta.extractedText`; `contextManager` compaction (currently distills key facts then throws
  them away); `threads.agentId` FK makes cross-thread queries cheap.
- **New work:** add pgvector and a `memories` table (org/agent-scoped: `text`, `importance`,
  `createdAt`, `lastAccessedAt`, `embedding`), plus `memory_search` and `memory_write` agent
  tools. Persist the `contextManager` compaction summary back as a durable memory instead of
  discarding it. Add a cross-thread recall query on `threads.agentId`. Index `messages.content`
  and `assets.meta.extractedText` for hybrid full-text plus vector recall. Run a nightly
  reflection schedule that compresses recent high-importance memories into cited insight
  records. Scored retrieval: `recency (0.995^hours) x importance (1..10) x cosine relevance`,
  top-K.

### 4.3 Decision / Roadmap engine
- **Purpose:** self-direction. Hold a persisted roadmap (quarter/week objectives, daily chunks,
  steps), re-derive the current subgoal from the roadmap each cycle (never from the prior turn)
  to defeat drift, and run an automatic curriculum that proposes the next achievable-yet-novel
  goal calibrated to current state, each goal carrying a machine-checkable "done" criterion.
- **Built on:** the memory layer (the roadmap is a top-level durable memory record re-injected
  at the top of every turn); `schedule_runs` history as the completed/failed goal ledger; the
  Scheduler as cadence driver.
- **New work:** a goal-proposal plus planning run (on a schedule) that reads
  `{roadmap, completed goals, failed goals, recent reflections, current resource/quota state}`,
  diffs proposed actions against `schedule_runs` to prevent duplicate or looping work, and emits
  the next subgoal with an objective completion test. Every self-set goal must carry a
  measurable "done" before execution starts. Note: the curriculum is load-bearing; ablating the
  automatic-curriculum in Voyager cost roughly 93% of performance.

### 4.4 Heartbeat / Cadence
- **Purpose:** turn request/response into a 24/7 agent with a durable clock that survives
  restarts and wakes fresh-context runs at strategic, tactical, execution, reflection, and
  delivery cadences, with a circuit-breaker that disables a misbehaving cadence.
- **Built on:** `schedules` (`cronExpression`, `nextRunAt` indexed with `enabled`,
  `consecutiveErrors` / `maxConsecutiveErrors` default 5) plus `scheduleRuns` plus the 60s-tick
  Scheduler, gated by `featureGate('schedules')` (already enabled). This is a mature heartbeat.
- **New work:** add `agentId` (and a stable continuity `threadId`) to `schedules`; change
  `createScheduleExecutor` from fire-and-forget pod-exec of a static prompt command to invoking
  the persistent brain (`resolveAgentConfig` then `AgentRunner.run`) against the agent's
  continuity thread. Seed a heartbeat-style checklist memory so the recurring run reads "act on
  anything due, else no-op". Map the CEO loop to distinct cron rows (strategic weekly, tactical
  daily, execution hourly, reflection nightly, delivery on-demand). **This is the single most
  important wiring change: it turns "cron runs a command" into "the agent wakes up and thinks
  with its own brain, skills, and memory."**

### 4.5 Execution (delegation to in-pod coding agents)
- **Purpose:** delegate code-writing to bounded, isolated child coding processes inside the
  agent's sandbox pod, collecting structured results without polluting the parent context, with
  enforced depth, turn, and concurrency caps.
- **Built on:** `AgentRunner.run()` (one-shot init+turn+destroy); `createSandboxTools`
  `shellExec` against the K8s pod; `SandboxRuntimeConfigs.promptCommand` templates
  (`claude -p`, `codex exec`, `opencode run`, `pi -p`); skills mounted as `SKILL.md` into the
  pod; the `FunctionExecutor` isolate as a secondary delegation seam.
- **New work:** a first-class `delegate_task` agent tool that wraps `AgentRunner.run()` (or an
  in-pod prompt command) in a child sandbox session with a restricted tools/skills subset, a
  bounded turn budget, background-handle support, and a structured result contract returned to
  the parent. Thread a `depth`/`maxDepth` field through the init options and reject beyond cap;
  enforce a concurrency cap. Ground every delegated task's success on real sandbox signals
  (exit codes, tests) plus a separate critic call, bounded to a fixed round cap.
- **IMPLEMENTED (P3a, 2026-07-04):** the `delegateTask` agent tool is live for api-brain
  agents (gated by the `delegation` feature flag). It spawns a bounded in-pod child coding
  process via the runtime's `promptCommand` and the K8s exec API — deliberately NOT a nested
  `AgentRunner` — with depth cap 1 (children cannot delegate; `TDSK_DELEGATION_DEPTH` threaded
  as defense in depth), a per-pod concurrency cap of 3, timeouts clamped to 30 minutes, stdout
  tail-capped at 16k chars, and one advisory critic pass (an in-pod CLI verdict grounded on the
  child's exit code; the critic is a quality signal, not a trust boundary). The runtime-brain
  steward does not use this tool: it already delegates through its own CLI's subagents.

### 4.6 Self-improvement
- **Purpose:** compound competence over time. After a complex verified task the agent authors a
  new skill (procedural memory), through a proposal plus security-scan gate so a poisoned or
  self-authored skill cannot silently rewrite behavior (skills feed straight into the prompt, a
  direct injection vector).
- **Built on:** the `skills` table (`instructions`, `triggerKeywords`, `tools`, `alwaysActive`,
  `orgId`), full skills CRUD/attach endpoints, `resolveActiveSkills` keyword activation, and
  `RuntimeSkillPathMap` sandbox mount. A mature `SKILL.md` analog.
- **New work:** an `authorSkill` agent tool that writes to a new `skill_proposals` table
  (not an active skills row), triggered after N successful tool calls with a self-verifier
  confirmation. Promotion is AUTOMATIC, not human-reviewed: a security scan (exfiltration,
  prompt-injection, destructive patterns) plus approval by the read-only auditor agent
  promotes a proposal to an active skill; only a scan/audit failure escalates. Humans MAY
  browse and veto proposals in admin but are never a required step. `skills_list` /
  `skill_view` for progressive disclosure. A nightly curator schedule (usage tracking,
  mark-stale, archive, consolidate) whose changes flow through the same automatic
  scan-plus-audit promotion. Bind the write path to a scoped agent key, not a human's.
- **IMPLEMENTED (P3b, 2026-07-04):** the pipeline is live. Api-brain agents get the real
  `authorSkill`/`skillsList`/`skillView` tools; the runtime brain (`claude -p`) exercises the
  same faculty through fenced structured-output blocks parsed SERVER-SIDE from its report
  stdout: a `tdsk-skills` fenced block (JSON array of `{name, description, instructions,
  tools?, triggerKeywords?, alwaysActive?}`, max 3 per run, instructions capped at 8000 chars)
  authors PROPOSALS into `skill_proposals`, and a `tdsk-skill-reviews` fenced block (JSON array
  of `{proposalId, approve, reason}`) records curator decisions on the scanned proposals the
  executor injects under `## Skill proposals awaiting review`. Every proposal is
  deterministically security-scanned on creation (exfiltration, prompt-injection, destructive
  patterns, tool allowlist), and an approval re-runs the scanner as a hard gate
  (`applySkillReview`) before `promoteSkillProposal` creates and attaches the skill. Humans may
  veto in the admin Skill Proposals view; nothing an agent emits ever activates directly.
  `delegateTask` and `authorSkill` are deliberately OUTSIDE the scanner's tool allowlist, so a
  self-authored skill can never grant itself delegation or recursive authoring.

### 4.7 Delivery / Ownership
- **Purpose:** own the full lifecycle hands-free by reducing the agent's verbs to (a) land a
  commit on production and (b) `gh workflow run`, delegating all privileged and multi-arch work
  to CI.
- **Built on:** the three production pipelines keyed on `push:[production]` plus
  `workflow_dispatch` (`deploy-production.yml`, `publish-tsa.yml`,
  `firebase-hosting-merge.yml`); the `tdsk` CLI `deploy apply` (DevSpace then Helm);
  semantic-release; the egress MITM placeholder-swap (`tdsk_ph_*`) for in-pod credential
  handoff without the pod holding real tokens; the CLI `db generate` and `db migrate` tasks
  (already exist, currently unused). The delivery CI secrets are already provisioned as GitHub
  Actions repo secrets (`GIT_TOKEN`, `NPM_TOKEN`, `TDSK_CIVO_TOKEN`, `TDSK_DB_*`,
  `FIREBASE_SERVICE_ACCOUNT_*`, `TDSK_MASTER_KEY`, etc.).
- **New work:** replace interactive `db push` with versioned `db generate` at PR time (committed
  SQL) plus non-interactive `db migrate` at deploy time, under an expand-migrate-contract
  discipline so a destructive change can never hang or brick a deploy. Establish the missing SQL
  migration history. Fix the kube-context mismatch (CI selects `threadedstack`; the CLI passes
  `--kube-context tdsk`). Make change-detection deterministic via explicit dispatch inputs. Give
  the agent a scoped bot GitHub App identity (`contents:write` to merge/push protected
  `production`, `actions:write` to dispatch) whose real token is an encrypted DB secret reached
  only via the egress placeholder-swap, domain-gated to github.com and registry.npmjs.org.
  Multi-arch buildx and cluster-admin stay CI-only, never held in the pod.

### 4.8 Observability and Escalation
- **Purpose:** an objective, non-LLM verdict on every autonomous run and delivery, a durable
  trail of decisions and results, and a way to surface a blocker to a human.
- **Built on:** the deploy verify-job (rollout status, `/health`, `/_/health`, image rollback);
  `scheduleRuns` (start/end/duration/error); the Winston redacting logger; quota middleware; the
  egress proxy audit surface; a working `EmailService` (`app.locals.email.send`, Resend/Mailgun,
  `TDSK_EMAIL_API_KEY` set); the admin `ScheduleRuns` table.
- **New work, Escalation layer (none exists today; verified):**
  - Self-remediation first: on a tool/API failure, retry, then fail over to a backup provider.
    Multi-provider is configurable (`agent_providers`, priority-ordered) but there is no
    auto-failover today, so add runtime failover to the next-priority provider before escalating.
  - If still blocked: an `escalate` agent tool that writes a durable escalation record (new
    lightweight `escalations` table: `orgId`, `agentId`, `scheduleId?`/`threadId?`, `severity`,
    `message`, `status`), emails the human owner, optionally opens a GitHub issue (the agent
    has `gh` plus the bot identity), surfaces an admin alert (clone the `ScheduleRuns` DataTable
    pattern), and pauses the affected cadence rather than silently looping or dying.
  - Wire the scheduler circuit-breaker trip (currently a silent auto-disable) to send an email.
  - Because the agent process cannot reach the email service directly, `escalate` POSTs to a
    backend endpoint that writes the record and sends the mail.
  - Feed the verify-job verdict, `scheduleRuns`, and quota state back into the memory stream as
    durable high-importance records so reflection can learn from failures.
  - Extend rollback scope beyond images to the caddy configmap; gate the DB via
    expand-migrate-contract. Add a read-only auditor-agent schedule that diffs deployed vs
    intended state and flags drift.

## 5. The evolved `agents` entity (schema and config)

The autonomous agent is the existing `agents` entity with additions. No parallel table, no
second name.

**Schema additions:**
- `agents.soul` (text): the constitution, pinned first in prompt assembly.
- `agents.autonomous` (boolean, optional): a display/behavior flag indicating the autonomy
  faculties are enabled for this agent (heartbeat, delegation, delivery). It is not a distinct
  entity type; it only toggles defaults in the UI and which faculties are wired.
- `schedules.agentId` (FK to `agents`): binds a heartbeat cadence to an agent.
- `schedules` continuity `threadId` (nullable): the agent's persistent memory thread.
- New `memories` table (pgvector) scoped by `orgId`/`agentId`.
- New `skill_proposals` table for self-authored skills pending review.
- New `escalations` table for human-intervention records.
- Optional: promote `agents.environment.sandboxId` (jsonb pointer) to a real FK for referential
  integrity between an agent and its body sandbox.

**Reused as-is:** `agents` CRUD, `agent_providers` (multi-provider, priority-ordered brain),
`agent_skills`, `agent_projects`, `resolveAgentConfig` (extended, not duplicated), the admin
`Agents/` UI (extended for the new fields), the SSE and OpenAI-compatible endpoints (a bonus:
you can talk to an agent via a standard API), `threads.agentId`.

**Config model (how an agent is composed and adjusted):**
- Brain: `agent_providers` (multiple, priority-ordered) plus model plus secret.
- Body: a Sandbox (any runtime; can run code or host a service).
- Learning: Skills (`agent_skills` plus per-turn keyword activation plus sandbox-mounted
  `SKILL.md`).
- Heartbeat: Schedules (now `agentId`-bound).
- Memory: threads/messages plus the `memories` store, per agent.
- Identity: the `soul` field.
- Config is read fresh on every run by `resolveAgentConfig`, so any human edit (SOUL, model,
  skills, providers, sandbox) applies on the next heartbeat automatically; no redeploy, no
  restart. Mid-run, `updateConfig` can hot-swap `model`/`provider`/`tools`/`systemPrompt`/
  `thinkingLevel` (next-turn effect). Changing the sandbox requires a fresh cycle.
- Human adjustment process: edit the agent (or its SOUL, a skill, or a provider link) in
  admin or via API; the next cycle picks it up. Deeper harness/code changes go through the
  agent's own delivery pipeline (it ships changes to itself).

## 6. The CEO loop (cadence)

Five cron cadences, each a fresh-context run against durable state so context rot never
accumulates in a long-lived window:

- **Strategic (weekly):** read roadmap plus reflections plus repo/quota state; revise
  quarter/week objectives; propose the next novel-yet-achievable goals via the curriculum; write
  them back to memory.
- **Tactical (daily):** re-derive today's 5 to 8 subgoals from the persisted roadmap (never from
  yesterday's turn), each with a machine-checkable "done"; diff against `schedule_runs` to skip
  completed or looping work.
- **Execution (hourly):** read the heartbeat checklist; pick the highest-value due subgoal;
  delegate code-writing to a bounded in-pod child coding process; ground success on real signals
  (exit codes, tests) plus a separate critic within a fixed round cap; act or no-op.
- **Reflection (nightly):** compress recent high-importance memories into cited insights; run
  the skill curator (mark-stale, consolidate, archive as proposals); persist the compaction
  summary as durable memory.
- **Delivery (event/threshold-driven):** when a verified change is ready, commit and push, let
  the executable invariants plus the read-only auditor plus CI gate it, merge to `production` or
  `gh workflow run`, then read the verify-job verdict and rollback signal back into memory.

The heartbeat (60s Scheduler tick, list-due, mark-run with cron `nextRunAt`) drives all five;
`consecutiveErrors`/`maxConsecutiveErrors` is the per-cadence circuit breaker. The
defeat-context-rot invariant: no cycle trusts in-window continuity; each rehydrates from
Postgres (threads/messages/memories/schedule_runs) plus git, so a crash or compaction loses
nothing and every run reconstructs the same structure (SOUL, memory, skills, procedures, tools).

## 7. Autonomy model

The agent decides for itself; a human never configures scope, cost, priorities, which repo to
touch, or when to ship. Decisions are governed top-down by the written SOUL/constitution
(pinned slot #1, ranked priority hierarchy) and bottom-up by durable state. Each cycle the
curriculum engine proposes the next goal from `{roadmap, completed/failed goals, reflections,
current resource state}`, calibrated to be achievable-yet-novel; this goal generator replaces a
human task queue. Before any consequential or irreversible action the agent runs a
constitutional self-critique-and-revise pass (generate plan, critique against SOUL, revise,
act). It re-derives the current subgoal from the persisted roadmap every cycle, so autonomy
stays coherent rather than drifting.

What a human sets once: identity (the SOUL text plus initial high-level roadmap objectives) and
authority (the one credential/authority grant). What the human never sets: the day-to-day
decisions those enable.

### 7.1 End-state autonomy contract

When all phases are implemented, the agent runs the full lifecycle (roadmap → code → test →
merge → deploy → migrate → publish → validate → rollback) with ZERO required human actions.
Exactly two human touchpoints exist, and both are non-blocking to the loop:

1. **The one-time seed** (section 10): author the SOUL and grant authority. Done once.
2. **Optional escalation response** (section 4.8): on an unrecoverable blocker the agent
   self-remediates first (retry, provider failover), then writes an escalation, notifies, and
   pauses only the affected cadence; other cadences continue. A human MAY respond; nothing
   waits on approval.

Everything else humans can do (edit the SOUL, swap providers, veto a skill proposal, flip the
feature flag) is a lever they MAY use, never a step the agent requires. Gates are executable
(CI invariants, migration linter, auditor agent, canary/rollback, circuit breakers), never a
person.

Interim phases temporarily retain human elements only where the safety machinery is not yet
built, and each is explicitly removed by a later phase: P0 is read-only by credential scope
(humans still develop the platform); P1 removes the merge human by introducing the executable
CI merge gate; interim deploys (fast-forwarding `production`) and interactive schema pushes
remain manual until P4's delivery spine (versioned migrations, invariant gate, canary/rollback)
removes them. After P5 no required human element remains anywhere.

## 8. Guardrails (what makes hands-free delivery safe without a human merge gate)

- **Executable invariants as the merge gate:** a change cannot merge to `production` unless CI
  `pnpm test` and `pnpm types` pass, the versioned migration is expand-only (no destructive
  `DROP` in the same release, enforced by a migration linter), and the self-verifier critic plus
  real sandbox signals confirmed the change. "Done" is never self-reported.
- **Read-only auditor agent** (a separate scheduled run with a restricted toolset) reviews each
  proposed change and diffs deployed-vs-intended state; a separate critic call verifies each
  delegated task. The process that wrote the code never rubber-stamps it.
- **Canary plus auto-rollback:** keep the deploy verify-job, extend rollback beyond images to
  the caddy configmap, and gate the DB via expand-migrate-contract so a destructive migration
  plus a failed deploy can never strand new schema on an old image.
- **Hard per-run circuit breakers** via quota middleware: max steps/tokens/wall-clock/spend per
  run, loop detection (diff proposed actions vs `schedule_runs`), and `consecutiveErrors`
  auto-disable. Closes the runaway-cost and infinite-loop failure modes.
- **Bounded delegation:** max depth threaded through the init options, per-run turn budget,
  concurrency cap, and children inherit a strictly narrower scoped key.
- **Skill security gate:** self-authored or imported skills go through the `skill_proposals`
  pending state plus a security scan before becoming `alwaysActive`.
- **Authority boundary instead of an approval loop:** the truly irreversible
  externally-visible class (payments, outbound sends, force operations) sits OUTSIDE the
  agent's standing authority grant and is denied by default; attempting it produces an
  escalation record, not a wait-for-approval. Everything inside the grant (read, build, test,
  merge, deploy, migrate, publish, validate, rollback) auto-runs and NEVER requires human
  approval. Widening the grant is a human edit to the agent's authority (a seed-level lever),
  not a per-action approval.
- **Credentials never in the pod:** real bot GitHub/npm tokens are encrypted DB secrets reached
  only via egress placeholder-swap; cluster-admin and multi-arch buildx stay CI-only.
- **Feature flags as kill switches:** the `agents` flag gates the whole brain; a poisoned or
  looping agent is stopped by flipping the flag or disabling its schedules.

## 9. Multi-instance model

Every entity is `agentId`/`orgId`-scoped, so N agents coexist, each composed of its own
providers, sandbox, skills, schedules, memory, and SOUL. The ThreadedStack-platform agent is
instance #1 (SOUL: "own and improve ThreadedStack"). Additional agents are created through the
same admin/API surface with different composition and different authority grants. A
platform-privileged agent (delivery secrets, merge rights) is simply an instance owned by the
platform org with elevated authority; authority is a per-instance attribute, not a separate
entity.

**Invariant: no bespoke code for instance #1.** Anything the steward needs must land as a
generic platform capability configured through the existing entities: brain = `agent_providers`
(AI Providers, priority-ordered), body = `environment.sandboxId` → `sandboxes` (executing code
or hosting a service, plus `sandbox_projects`/git-provider junctions), learning = `agent_skills`
plus keyword activation plus pod-mounted `SKILL.md`, heartbeat = `schedules.agentId` (N
schedules per agent at distinct cadences), memory = `threads.agentId` plus the `memories`
store, identity = `agents.soul`, authority = per-instance secrets. An agent is created entirely
as DATA (rows) through the same CRUD any org uses; a support agent, research agent, or
service-hosting agent is the same machinery with different rows. P0 validates this by seeding a
second agent alongside the steward and verifying isolated threads and composition.

## 10. Human seed (one-time only)

1. **Identity:** author the SOUL/constitution (mission, character, non-negotiables, the ranked
   priority hierarchy) and the initial high-level roadmap objectives.
2. **Authority:** provision one scoped bot GitHub App (`contents:write` to merge/push protected
   `production`, `actions:write` to dispatch) and store its token, plus the existing delivery
   secrets (`TDSK_CIVO_TOKEN`, `NPM_TOKEN`, `TDSK_DB_*`, `GHCR`), as encrypted DB secrets reached
   only via the egress placeholder-swap. Set branch protection so only the bot plus the CI
   invariants gate merges. The delivery CI secrets are already provisioned as GitHub Actions repo
   secrets, so this step is largely confirming scopes and wiring the in-pod handoff.

## 11. Phased path (each phase independently valuable)

> Resequenced 2026-07-01: the bounded PR author moved ahead of semantic memory. The gap
> analysis showed the PR loop needs only pod plumbing (push auth, promptCommand flags, `gh`,
> timeout), not pgvector; git history plus the continuity thread are sufficient memory for it,
> so the original prompt's core value (an agent working on the codebase) lands a phase earlier.

- **P0: Brain is alive and scheduled.** Turn the `agents` flag ON; add the `soul` field and the
  formalized prompt-assembly order; add `agentId` plus continuity `threadId` to `schedules`;
  rewire `createScheduleExecutor` to invoke `AgentRunner` against the continuity thread; an
  hourly heartbeat run that reads state and reports, no writes. The agent is embodied in a K8s
  sandbox pod with the ThreadedStack repo cloned read-only (read-only PAT via the egress
  placeholder; fresh pod per heartbeat, torn down after each run), so its reports are grounded
  in the real repo and live health endpoints. Deliverable: a 24/7 monitoring/reporting agent.
- **P1: Autonomous PR author behind an executable CI gate.** Wire the pod write path on the
  existing primitives: persist the git placeholder header (`git config http.extraHeader` in
  `sandbox-entrypoint.sh`) so `git push` flows through the same egress MITM swap with a
  write-scoped bot token; a per-sandbox `promptCommand` override adding autonomy flags for
  `claude -p` (the global preset stays untouched); add the `gh` CLI to
  `deploy/Dockerfile.sandbox`; parameterize the 30-minute exec cap for coding runs. The merge
  gate arrives WITH this phase in minimal executable form (no PR CI exists today; only a
  paths-limited Firebase preview runs on PRs): a new `.github/workflows/ci.yml` running
  `pnpm types` plus `pnpm test` on `pull_request`, branch protection on `main` requiring those
  checks, and the agent merging its own PR via `gh pr merge --auto` once green. No human
  merges. The brain picks a small task each heartbeat, does the work in its pod via
  `shellExec` (running the in-pod coding CLI as its hands), pushes a branch, opens the PR, and
  lands it when CI passes. Git history plus the continuity thread are the memory. Merges land
  on `main`; nothing deploys until P4 wires `production`, so interim deploys remain the one
  manual step until the delivery spine removes it. Deliverable: an autonomous PR author whose
  merges are gated by executable CI invariants, with no human in the loop.
- **P2: Real memory plus self-direction.** pgvector plus `memories` plus `memory_search`/
  `memory_write`; scored retrieval plus nightly reflection; roadmap store plus curriculum
  goal-proposal plus machine-checkable "done"; persist compaction summaries; cross-thread recall.
  Deliverable: a self-directing agent with durable memory.
  IMPLEMENTED: the `memories` table (pgvector `vector(1536)`, org+agent-scoped, kinds
  fact/insight/reflection/compaction/roadmap), `db.services.memory.searchScored`/`getRoadmap`/
  `upsertRoadmap`, a NULL-safe backend `EmbeddingService`, the `memorySearch`/`memoryWrite`
  agent tools plus executor roadmap/memory injection and `tdsk-memories` capture, and
  compaction-summary persistence all shipped. In the same pass the runtime brain (`claude -p`)
  gained api-brain-parity resilience: per-provider env resolution (`resolveProviderEnvChain`)
  and automatic failover across the sandbox's priority-ordered ai providers on transient upstream
  failure (529/Overloaded/5xx/rate-limit).
- **P3: Formal delegation plus self-improvement.** `delegate_task` (bounded depth/turn/
  concurrency, structured result, critic); `authorSkill` plus `skill_proposals` plus security
  scan plus curator; `skills_list`/`skill_view`; PR authorship widens to a bounded set of
  low-risk repos. Deliverable: a self-improving agent with bounded delegation.
- **P4: Hands-free delivery spine.** Versioned SQL migrations under expand-migrate-contract;
  kube-context fix; deterministic dispatch-driven change-detection; scoped bot GitHub App via
  egress swap; escalation layer; executable-invariant merge gate plus read-only auditor plus
  canary/rollback extended to configmaps. Deliverable: fully autonomous ship of one repo
  end-to-end.
- **P5: Full-lifecycle ownership across all repos.** Roadmap/curriculum spanning the monorepo;
  delegation fan-out with concurrency caps; npm publish via semantic-release; Firebase SPA
  deploys; the full guardrail suite as the standing gate. Deliverable: the agent running the
  platform 24/7 hands-free.

Phasing exists for safety sequencing (read-only observation before PR authorship, an executable
CI merge gate before memory-driven self-direction, verified execution before hands-free
production merge, migration safety before auto-deploy), not for budget. No phase introduces a
required human step; see the end-state autonomy contract (section 7.1).

## 12. Reuse vs build

**Reuse:** AgentRunner (`init`/`runTurn`/`updateConfig`/`destroy` and one-shot `run`);
`schedules`/`scheduleRuns`/Scheduler with the circuit-breaker; `agents` CRUD plus
`agent_providers`/`agent_skills`/`agent_projects`; `resolveAgentConfig` (extended);
`skills` plus `resolveActiveSkills` plus `RuntimeSkillPathMap`; `threads`/`messages` plus
`threads.agentId`; `assets` `extractedText`; `contextManager` compaction; KubeSandbox/
LocalSandbox plus `createSandboxTools` plus `SandboxRuntimeConfigs.promptCommand`; the three CI
pipelines plus `tdsk deploy` plus semantic-release; egress placeholder-swap; `featureGate`/
`authorize`/`enforceQuota`; the Winston logger and deploy verify-job; `EmailService`; the CLI
`db generate`/`db migrate` tasks; the admin `Agents/` and `Schedules/` UI.

**Build:** pgvector plus `memories` plus memory tools; the `soul` field plus prompt-assembly
order; scored memory-stream retrieval plus reflection; roadmap plus curriculum plus done-criteria
plus action-history dedupe; `schedules.agentId` plus executor routing through AgentRunner;
`delegate_task` plus critic; `authorSkill` plus `skill_proposals` plus security scan plus
curator; the escalation layer (tool, table, email, GitHub issue, admin surface, breaker-trip
notify, provider auto-failover); versioned SQL migrations under expand-migrate-contract plus
kube-context fix plus scoped bot identity plus rollback-scope extension plus executable-invariant
gate plus read-only auditor; turn the `agents` flag ON.

## 13. Risks

- **Destructive migration plus failed deploy equals irreversible state.** Migrations run before
  deploy and rollback only restores images, not schema/configmaps. Without expand-migrate-contract
  and non-interactive versioned SQL, a single bad schema change bricks production. Highest-severity
  blocker; must be built before P4 (the delivery spine).
- **Interactive `drizzle-kit push` is a hands-free timebomb** (CI timeout, no versioned SQL
  history exists). Any destructive diff hangs the deploy.
- **Kube-context mismatch** (`threadedstack` vs `tdsk`) could apply to the wrong cluster if the
  agent ever manages multiple clusters.
- **Skill poisoning / prompt-injection.** Self-authored or imported skills feed instructions and
  tools directly into the prompt; the proposal plus security-scan gate is mandatory.
- **Runaway cost / infinite loops** from unbounded delegation or heartbeat. Requires hard per-run
  caps plus loop detection plus circuit-breaker even though cost is not a stated constraint.
- **Sycophantic self-evaluation.** If the same agent judges its own work, "done" is a vibe. Anchor
  on objective signals plus a separate critic.
- **Long-lived agent concentrating cluster-admin/npm/DB secrets is a high-value target.**
  Mitigated by keeping real secrets out of the pod (egress swap) and CI-delegating privileged work.
- **Three CI workflows fire concurrently on one production push** with only deploy-production in a
  concurrency group; no atomic delivery result to reason about or roll back as a unit.
- **Context rot / goal drift** if any cycle trusts in-window continuity instead of rehydrating from
  durable state. The fresh-context-per-cycle discipline must hold.

## 14. Non-goals (YAGNI)

- No PVC/StatefulSet or perpetual pod. Always-on is the Scheduler plus fresh-context rehydration.
- No durable job queue. Git history plus `schedule_runs` plus the memory store are the durable
  state.
- No parallel entity and no second name. There is only the `agent`, evolved.
- No adoption of Hermes or OpenClaw as the runtime. Mine their patterns (persona, memory
  curator, self-improving skills, heartbeat, bounded delegation) and build on ThreadedStack's own
  primitives.

## 15. References (patterns mined)

- Stanford Generative Agents (memory stream, retrieval by recency/importance/relevance,
  reflection, planning).
- Voyager (self-improving skill library, automatic curriculum; curriculum and self-verification
  are load-bearing).
- Reflexion (self-critique loop).
- Constitutional-AI framing applied to agent identity (ranked priority hierarchy).
- Ralph loop / RPI (fresh context per iteration, disk/git as memory, test backpressure).
- Vercel "agent responsibly" (safe defaults, canary plus auto-rollback, read-only auditors).
