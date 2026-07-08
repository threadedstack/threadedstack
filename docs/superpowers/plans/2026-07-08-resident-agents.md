# Resident Agents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the resident agent type — always-on, self-directing agent processes living in sandbox pods (persistent compacting session + mandatory agenda + inbox + watches + self-directed turns + sub-agents + heartbeat), as a generic capability configured per agent, alongside the unchanged scheduled type. Pilot on the CMO, then the board.

**Architecture:** Spec `docs/superpowers/specs/2026-07-08-resident-agents-design.md` (read FULLY first — esp. §1.1 autonomy principles, §2 generic-vs-data, §2.1 agnosticism test, §6 two modes). The runtime is repo code running IN the pod (`repos/resident/`), driven by data (resident_configs / agent_messages collections); the platform gains exactly: a dispatch endpoint, a pod-scoped token, a sandbox resident mode, and a watchdog reconciler.

**Seam anchors (verified):** pod command fallback `sleep infinity` + `restartPolicy: Never` (`repos/sandbox/src/kube/podManifest.ts:109,258-269`); idle reaper + activity map (`repos/backend/src/services/sandboxes/sandbox.ts:752-827,599`); one-shot exec path (`executor.ts:1313-1621`) — UNTOUCHED (scheduled mode); ② dispatch core `invokeAction` (`repos/backend/src/utils/agent/invokeAction.ts`); ① records endpoints (collections API); token-injection pattern (`TDSK_GIT_*` in `sandbox-entrypoint.sh:91-99` / pod env); delegation semantics (`repos/backend/src/utils/agent/delegation.ts:272-389`); threads/messages services (continuity/observability).

---

## Phase R1: Platform seams — dispatch endpoint, resident token, resident pod mode (additive)

- [ ] **`POST /_/orgs/:o/projects/:p/agents/:a/dispatch`** (backend endpoint, standard endpoint conventions + tests): body `{ actions: TAgentAction[] }` (≤20/call). Auth: a NEW key kind — resident token: an `api_keys` row with a `scope: 'resident'` + bound `agentId` (extend the api_keys schema/service minimally; the proxy already forwards Bearer `tdsk_*`). Authorization: token.agentId === :a AND the agent's project === :p. Each action runs through `invokeAction(app, db, projectId, action, allowlist, { agentId })` where **allowlist comes server-side from the agent's resident config** (never the request). Returns per-action `{ok,data,error}` array. Rate limit (reuse middleware).
- [ ] **Resident token minting + injection**: on resident-pod start, mint/rotate the token and inject as `TDSK_RESIDENT_TOKEN` + `TDSK_BACKEND_URL` (in-cluster service URL) pod env — mirror the git-token injection path. Records READ access for the same project rides the same token (the collections endpoints' authorize() accepts api keys — verify + test the resident scope is honored there, read-only + dispatch-only).
- [ ] **Sandbox resident mode**: `TKubeSandboxConfig.resident?: { agentId: string }`. In `podManifest.ts`: when set, container command = the resident launcher (`["/bin/sh","-lc","cd /workspace && pnpm --filter @tdsk/resident start"]` — exact form decided against the jobs image realities) instead of `sleep infinity`. In `sandbox.ts` idle reaper: skip pods whose sandbox config has `resident` (cite the config-resolution it already does at :768-778).
- [ ] DoD: backend+domain+database+sandbox types/tests green; dispatch endpoint unit-tested (auth matrix: wrong agent, wrong project, non-resident key, allowlist enforcement, happy path); reaper-skip tested; everything inert (no resident sandbox exists).

## Phase R2: The resident runtime (`repos/resident/`, new workspace package)

Small TypeScript package (runs under node/tsx in the pod from the monorepo clone; the jobs image already has deps). Modules:
- [ ] **config**: load resident config (records API `resident_configs` by agentId; refresh each loop pass) — `{ agenda[], watches[], inbox:{pollMs}, compaction:{maxTurns,maxBytes}, session:{seedPrompt refs, contextSources}, subAgents:{maxConcurrent}, selfDirected:{prompt, minIdleMs} }`.
- [ ] **event loop**: single-flight turn executor + priority queue (overdue agenda > inbox > watches > self-directed); agenda = cron eval (reuse a tiny cron lib already in the repo — check what the scheduler uses); watches = records queries with last-result hash + debounce; inbox = poll `agent_messages` where `to=agentId AND readAt IS NULL`, mark read after turn; **self-directed turn** fires when queue empty ≥ minIdleMs (autonomy §1.1: never idle).
- [ ] **session manager**: `claude -p --resume <sessionId> --output-format json <turn>` child process (flags verified against the pod's claude CLI — the promptCommand pattern in the steward sandbox config is the reference); session id persisted to disk; first-turn seeding (soul + standing directives + checkpoint summary + fresh contextSources render — the resident fetches sources via records API and renders `## <as>` sections itself, reusing the domain rendering conventions).
- [ ] **action pump**: reuse the ② parser (`parseActionsBlock` — import from the workspace) on each turn's output → POST dispatch (chunked, with retry/backoff); also parse ```tdsk-memories``` and dispatch a memory write (a `writeMemory` platform Function on the allowlist OR retained fence via dispatch — decide by what exists; report).
- [ ] **compactor**: turn/byte counters; threshold ⇒ inject the checkpoint turn (write durable memories + summary), capture summary, rotate session id, reseed.
- [ ] **sub-agents**: `spawn(prompt, {timeoutMs})` → in-pod `claude -p` child (fresh session), bounded by `subAgents.maxConcurrent` + depth env (mirror delegation.ts semantics); completion enqueues an inbox-style internal event with the tail-capped output.
- [ ] **heartbeat**: every ~30s upsert `resident_status` record `{agentId, sessionId, queueDepth, currentActivity, lastTurnAt, turnCount}` via dispatch (a `heartbeat` Function) or a records upsert — decide (report).
- [ ] **transcript**: append each turn (user+assistant) to the agent's continuity thread via a dispatch Function (`appendTranscript`) so observability lives in the existing threads UI.
- [ ] DoD: unit tests (queue ordering incl. agenda-preemption + self-directed idle fire; watch debounce; compaction trigger; pump parsing/chunking/retry; sub-agent caps) with the child-process + HTTP layers mocked; types green across the workspace.

## Phase R3: Collections, Functions, watchdog (config/data + one reconciler)

- [ ] Seeds (`repos/database/src/seeds/resident/`): `resident_configs`, `agent_messages`, `resident_status` collections (+schemas); Functions: `sendAgentMessage` (member/caller-stamped; writes agent_messages), `updateResidentConfig` (caller may update ONLY its own config), `heartbeat`/`appendTranscript` if chosen in R2; reconciler + `reconcile:resident` script (exec-board reconciler pattern).
- [ ] **Watchdog**: a small backend reconciler (scheduler-adjacent tick or a platform schedule): for each `resident_configs` record — pod exists? heartbeat fresh (<3m)? If not: recreate pod (startPod with the resident sandbox). Release rolling-restart: on deploy, send a `system:checkpoint-and-restart` inbox message, wait grace period, recreate. Crash-loop tracking (≥N restarts/hour ⇒ mark degraded in resident_status + open an escalation record via dispatch).
- [ ] DoD: seeds idempotent (tests); watchdog unit-tested (stale/fresh/degraded matrices); all green; still inert (no resident config rows in prod).

## Phase R4: CMO pilot (live gate)

- [ ] CMO resident config seed: agenda = daily marketing (its current cmo-marketing prompt), deliberation WATCH on `decision_proposals` open/deliberating (replaces the cmo-board cron — positions post within minutes of a decision appearing), plans watch; self-directed prompt = its GTM lane; compaction thresholds; allowlist = current cmo allowlists + `sendAgentMessage`/`updateResidentConfig`.
- [ ] Flip the CMO sandbox to resident mode (config PR); disable the 2 cmo `schedules` rows (data — the scheduled defs deleted from agentSchedules.ts for the CMO only).
- [ ] **Live gate (≥24h)**: agenda fired on time; a deliberation watch round-tripped (decision appeared → position posted via dispatch within minutes); ≥1 compaction with clean continuation; heartbeats continuous; 0 unexpected watchdog restarts; a release rolling-restart resumed from checkpoint; the board's consensus still commits (CEO+CTO on cron + CMO resident interoperating).
- [ ] DoD: all gate criteria evidenced from prod records/logs; memory checkpoint of results.

## Phase R5: Board residents + evaluation

- [ ] CEO + CTO resident configs (strategy/board agendas + decision watches); retire their schedules rows; board meetings become watch-driven real-time rounds. Observe a full decision lifecycle end-to-end in minutes.
- [ ] Evaluate dev-loop migration per agent (spec §7 P3 — fit-based, not mandated); write the recommendation to memory + a follow-up plan if proceeding.
- [ ] Cleanup: per-symbol-verified genuinely-unused code only (§6 correction); ⑤a dormant tables drop after data-copy.

---

Every phase: verification bars green across touched repos, evidence-first self-review, deploys clear of :30 windows, and the live loop + board never degraded (watchers between cutovers). The scheduled mode remains untouched and fully supported throughout.
