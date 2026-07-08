# Resident Agents — Always-On Autonomous Agent Processes (Design)

**Status:** Design (2026-07-08). Owner directive: the scheduled one-shot model is a fundamental
limitation — agents must be **always-on, long-running processes** that monitor, listen, adjust,
research, message each other, deliberate in long sessions, checkpoint + compact + continue, and
spawn sub-agents — with **no human input**, following **their own internal schedules**. Explicitly
modeled on how this Claude Code session operates. Built on **generic primitives** (any consumer can
run any number of resident agents); the CEO/CTO/CMO are the first use case. **No backwards
compatibility** ([[feedback-no-backwards-compatibility]]): when residents replace one-shot runs,
the legacy paths are deleted.

## 1. The model

A **resident agent** = a sandbox pod (a full VM) whose main process is the **resident runtime** —
a small, generic, config-driven supervisor that owns one persistent agent session and an event
loop. It is the in-pod equivalent of the harness running this session:

```
┌─ sandbox pod (long-lived) ─────────────────────────────────────────┐
│  resident runtime (main process, replaces `sleep infinity`)        │
│  ├─ event loop (serialized turns)                                  │
│  │   ├─ AGENDA   — the agent's own cadences (board-meeting,        │
│  │   │             planning, research, development) as data;       │
│  │   │             fires "it's time for X" turns                   │
│  │   ├─ INBOX    — agent-to-agent + system messages; injected as   │
│  │   │             turns the moment they arrive                    │
│  │   └─ WATCHES  — records queries (open decisions, plan           │
│  │                 milestones, deploy events); fire on change      │
│  ├─ session manager — one persistent claude session via            │
│  │   `claude -p --resume <sessionId>` per turn (state on disk,     │
│  │   crash-tolerant, naturally serialized)                         │
│  ├─ compactor — at context threshold: instruct the session to      │
│  │   write checkpoint memories + a summary, then reseed a fresh    │
│  │   session (soul + standing directives + summary)                │
│  ├─ action pump — parse ```tdsk-actions``` from EVERY turn's       │
│  │   output and dispatch to the platform immediately               │
│  ├─ sub-agents — in-pod `claude -p` children (parallel work) +     │
│  │   delegateTask for cross-pod                                    │
│  └─ heartbeat — liveness + current-activity records                │
└────────────────────────────────────────────────────────────────────┘
          │  plain authenticated HTTP to the backend (in-cluster)
          ▼
   platform: Functions (via action dispatch) · Collections (records
   API: inbox/watches/agenda/plans) · Memories · Escalations
```

Turns are **serialized** (one at a time, events queue) — the same discipline as this session.
Long-running work happens in sub-agents; the resident stays responsive.

## 2. What is generic vs. what is data

**Generic (built once, reused by every consumer):**
- The **resident runtime** — repo code (`repos/resident/`), present in the pod via the monorepo
  clone (runtime-as-code: it evolves through the same PR pipeline as prompts).
- **Two backend endpoints** (thin, generic):
  - `POST /_/orgs/:o/projects/:p/agents/:a/dispatch` — body `{ actions: TAgentAction[] }`;
    validates a **pod-scoped token**, enforces the agent's server-side allowlist, runs each through
    the existing `invokeAction` core (② unchanged — same gate, same Functions, same `caller`
    injection `{agentId}`). This is `dispatchActions` with HTTP in front of it instead of a
    post-run stdout parse.
  - Resident **session/heartbeat** upsert (liveness + current activity + session id) — one small
    collection-backed endpoint or a `resident_status` collection written via dispatch.
- **Pod-scoped auth**: an `api_keys` entry minted per resident (scoped: dispatch + records-read on
  its project only), injected as `TDSK_RESIDENT_TOKEN` at pod start — exactly the existing
  `TDSK_GIT_*` injection pattern. Records **reads** (watches/inbox/agenda/context) use the ①
  collections API that already exists.
- **Sandbox resident mode**: `sandbox.config.resident: { agentId, configRef }` — when present,
  `podManifest` uses the resident launcher as the container command (instead of `sleep infinity`),
  the idle reaper **exempts** the pod, and the watchdog owns its lifecycle.
- **Watchdog**: the scheduler, shrunk to its useful core — a reconciler tick that ensures each
  resident's pod exists and its heartbeat is fresh; stale ⇒ recreate pod (the session state
  reseeds from the last checkpoint). Also handles **rolling restarts on release**: send a
  "checkpoint now" inbox message, wait, recreate — the resident resumes from its checkpoint.

**Data/config (per agent, all primitives):**
- `resident_configs` collection — one record per resident:
  `{ agentId, agenda: [{key, cron, prompt}], watches: [{key, collection, query, debounce, prompt}],
  inbox: {pollMs}, compaction: {maxTurns, maxBytes}, session: {contextSources, standingDirectives},
  subAgents: {maxConcurrent} }`. The agent can evolve its OWN config via an `updateResidentConfig`
  Function on its allowlist — self-directed cadence changes ("the internal monitor is theirs").
- `agent_messages` collection — the inbox: `{ to, from, subject, body, refs, readAt }`. Sending =
  `sendAgentMessage` Function (allowlist-gated, caller-stamped). Delivery = each resident's inbox
  watch; read receipts by `readAt` patch. Board deliberation becomes real-time: a new decision
  record fires every member's watch; positions post within minutes; `resolveBoard` runs on the
  CEO's decision-watch turn.
- Prompts remain seeds (`agent-schedules/*.md` → renamed `agent-prompts/`): the session seed
  (soul + standing directives) + per-agenda-item activation prompts.

## 2.1 The agnosticism test (the design's acceptance criterion)

Creating a new resident agent — for ANY use case, unrelated to ThreadedStack's own operations —
must require **only data/config on the primitives, zero platform code**:

1. an **Agent** (soul/identity),
2. a **Sandbox** with `resident` mode (its always-on body),
3. a **resident_config** record (its agenda, watches, inbox, compaction),
4. **Collections** for its data,
5. **Functions** for its effects (its allowlist),
6. **Providers/Endpoints** if it needs external APIs (secrets server-side).

Illustration (NOT to be built — owner's example): a recipe agent = an agent whose agenda says
"each morning: research new recipes on the web" + a `recipes` collection + a `saveRecipe`
Function on its allowlist + pod web access via the egress proxy. Nothing else. If any use case
needs a platform change beyond this list, the design has failed the test. The exec board
(CEO/CTO/CMO) and the dev-loop are merely the FIRST consumers of this shape, not special cases.

## 3. The turn protocol

1. Event fires (agenda cron / inbox message / watch delta / heartbeat-idle tick).
2. Resident builds the turn input: event framing + fresh context (its configured
   `contextSources` fetched via the records API — context assembly moves INTO the resident,
   replacing the executor's server-side prompt assembly).
3. `claude -p --resume <sessionId> "<turn input>"` (first turn of a session: seed with soul +
   directives + checkpoint summary). Serialized; queue depth visible in heartbeat.
4. Output handling: the action pump extracts ```tdsk-actions``` → `POST dispatch` (immediate,
   per-turn — not once-per-run); ```tdsk-memories``` stays supported the same way (a `writeMemory`
   dispatch or retained fence). Transcript appended to the agent's continuity thread
   (threads/messages primitives — already exist) for observability.
5. Compaction check: over threshold ⇒ checkpoint turn ("write durable memories + a session
   summary"), then new session seeded from it. (This session's /compact, verbatim.)

## 4. Sub-agents

- **In-pod**: the resident exposes the existing pattern — `claude -p` children with bounded
  concurrency/depth (delegation.ts semantics, reused/ported into the runtime). The session
  requests them with a resident-local fenced block (```tdsk-spawn```), results return as inbox
  events. Cheap, parallel, no platform round-trip.
- **Cross-pod**: `delegateTask` unchanged (already generic).

## 5. Security

- The pod-scoped token authorizes ONLY: action dispatch for its own agentId (server-side allowlist
  still the gate — same ② model), records read/query on its own project, heartbeat. No admin
  surface. Secrets stay server-side (Providers/egress unchanged). The scan gate (`context.scan`)
  and fail-closed Function semantics are untouched — residents change WHEN actions dispatch, not
  what they're allowed to do.
- Runaway control: turn serialization + sub-agent caps + the watchdog's error tracking (repeated
  crash-loop ⇒ mark resident degraded + escalate) replace `maxConsecutiveErrors`.

## 6. Two first-class execution modes (OWNER CORRECTION — the scheduled model is NOT removed)

The platform offers **both modes, configured per agent** — "configure the type of agent you want
to build":

| | **`scheduled`** (today's model, unchanged) | **`resident`** (this spec) |
|---|---|---|
| Body | pod per run, torn down after | one long-lived pod |
| Trigger | platform `schedules` cron | own agenda + inbox + watches |
| Session | fresh per run (thread continuity) | persistent, compacting |
| Cost profile | cheap for periodic work | always-on |
| Fits | sensors, curators, digests, batch jobs | executives, operators, anything reactive/conversational |

The one-shot executor path, scheduler, and rehydrator all REMAIN — they serve the `scheduled`
mode. The no-backcompat rule applies only to code that ends up genuinely UNUSED after migrations:
e.g. if/when every agent of a given org migrates off a surface, per-symbol-verified dead code goes
— but the scheduled mode itself is a supported product capability, not legacy. (The dormant exec
tables from ⑤a still drop after their Collection data-copy — they have no mode keeping them
alive.) Consumers choose the mode in the sandbox/agent config; the same Agent identity can even
move between modes, since souls, prompts, Collections, Functions, allowlists, and memories are
mode-agnostic.

## 7. Rollout

- **P1 — runtime + pilot**: build `repos/resident/` + dispatch endpoint + resident sandbox mode +
  watchdog; pilot on the **CMO** (newest seat, lowest blast radius): agenda = daily marketing +
  deliberation watches; prove message→turn, agenda→turn, compaction, dispatch, heartbeat, watchdog
  restart, release rolling-restart.
- **P2 — the board resident**: CEO + CTO residents; deliberations become watch-driven real-time;
  retire the 5 exec `schedules` rows.
- **P3 — the dev-loop residents (evaluation-gated)**: steward + adversary MAY move to resident
  mode (cycles become agenda items; pr-response/verify become in-pod watches on GitHub state) —
  OR stay scheduled where the pod-per-run model fits better (e.g. the sensor). Decided per agent
  by fit, not by mandate: both modes are product capabilities.
- **P4 — cleanup sweep**: delete only what is genuinely unused after migrations (per-symbol
  verified) + drop the ⑤a dormant tables after data-copy. The platform's agent story: Agents
  (scheduled OR resident) + Sandboxes + Functions + Collections + Providers + Skills + Memories.

Each phase ships through the normal pipeline with live observation gates (the ⑤a/⑤b discipline).
⑤b's remaining cutovers proceed in parallel — the effect surface is identical under residents.

## 8. Testing
- Runtime unit tests (event loop ordering, queueing, compaction trigger, action-pump parsing —
  reuse the ② parser), real-pod integration (a resident in a local sandbox: inject inbox message ⇒
  turn ⇒ dispatch hits a mock backend), watchdog tests (stale heartbeat ⇒ recreate), and a live
  pilot gate (the CMO resident sustaining ≥24h: agenda fires, deliberation round-trips, ≥1
  compaction, 0 watchdog restarts outside releases).
