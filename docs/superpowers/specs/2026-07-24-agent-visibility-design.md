# Agent Visibility: Activity Surface (SP1)

**Date:** 2026-07-24
**Status:** Approved for planning
**Scope:** Sub-project 1 of 4 (see Decomposition)

## Problem

Six always-on resident agents (CEO, CMO, CTO, Engineer One/Two/Three) plus five
cron schedules run continuously in production. A user cannot see what any of
them is doing. There is no resident UI anywhere in the product: the admin SPA
exposes agent CRUD and a schedule-runs table, and the threads SPA exposes
sandbox terminals, but nothing surfaces a resident's turns, status, messages, or
memories.

The agents are not silent, though. They already write rich telemetry on every
turn. The gap is a presentation surface over data that exists, not missing
instrumentation.

### What already exists

| Data | Collection / table | Written by | Cadence |
|---|---|---|---|
| `sessionId`, `queueDepth`, `currentActivity`, `lastTurnAt`, `turnCount`, `degraded` | `resident_status` | `heartbeat` Function | ~30s |
| `event`, `input` (20k tail), `output` (20k tail), `at` | `resident_transcripts` | `appendTranscript` Function | once per turn |
| `text`, `importance`, `kind`, `meta`, `at` | `resident_memories` | `writeMemory` Function | per turn, when emitted |
| `to`, `from`, `subject`, `body`, `refs`, `readAt` | `agent_messages` | `sendAgentMessage` Function | event-driven |
| `status`, `startedAt`, `completedAt`, `durationMs`, `error`, `stdoutKey`, `stderrKey` | `schedule_runs` table | scheduler | per run |

`degraded` is owned exclusively by the resident watchdog
(`repos/backend/src/services/resident/watchdog.ts`), which reconciles every 60s
and flags a seat whose heartbeat is stale beyond 3 minutes. The heartbeat
Function never writes that field.

### What is genuinely missing

These were searched for and do not exist:

- No user-authed read API for resident telemetry. `residentRecordsQuery`
  (`repos/backend/src/endpoints/agents/residentRecordsQuery.ts`) is
  resident-token authed, for agents reading their own records.
- No streaming surface for turn events. `/ai/ws` carries AI chat; the sandbox
  WebSocket routes carry shell, tunnel, and session-monitor traffic.
- No token or cost accounting anywhere. No usage table exists, and
  `schedule_runs` has no token or cost columns.
- No structured tool-call trace. Transcript `input`/`output` are opaque text.
- No UI for any of the above.

## Goals

1. A user can see, for any agent in a project they can access, what it is doing
   right now and what it has done recently.
2. The surface is generic. It is driven by the collections and works for any
   org's agents. No agent-specific branching.
3. Zero runtime risk to the six agents currently running in production. This
   sub-project adds read paths only.

## Non-goals

- Control actions (pause, resume, nudge, kill). Observability first; control is
  a separate write surface with its own authorization design.
- Token and cost accounting. Requires runtime instrumentation (SP3).
- Structured tool-call traces. Requires a transcript format change (SP3).
- Real-time push. Polling is sufficient at current data granularity (see
  Liveness).

## Decomposition

The original request ("full visibility and insights") spans four independent
subsystems. This spec covers SP1 only.

| | Sub-project | Depends on |
|---|---|---|
| **SP1** | **Agent Activity Surface: read API + admin UI over existing telemetry** | nothing new |
| SP2 | Live streaming (WebSocket push of turn events) | SP1 |
| SP3 | Structured turn telemetry: tool calls, token usage, cost | runtime changes |
| SP4 | Insights and analytics: throughput, error rates, cost trends | SP3 |

SP1 is first because it delivers the whole visibility story against data that
already exists, with no changes to the running agent runtime.

## Architecture

### Backend

Four read-only endpoints, project-scoped and user-authed, mounted under the
existing agents route tree:

```
GET /_/orgs/:orgId/projects/:projectId/agents/:agentId/status
GET /_/orgs/:orgId/projects/:projectId/agents/:agentId/turns?limit&before
GET /_/orgs/:orgId/projects/:projectId/agents/:agentId/messages?limit&before
GET /_/orgs/:orgId/projects/:projectId/agents/:agentId/memories?limit&before
```

Each is a thin, guarded read over the Collections primitive, filtered by
`agentId`. They reuse the existing `projectAccessGuard` and `projectMemberGuard`
middleware, so they inherit the platform's access rules rather than inventing
new ones.

**Authorization boundary.** These endpoints must not widen what a user can read
beyond their own project. The agent is resolved and its project binding
verified before any collection is queried; an agent not bound to the requested
project returns 404, not the record set.

**Pagination.** Cursor-style on the `at` timestamp, newest first, via `before`
plus `limit` (default 25, max 100). The transcripts collection grows without
bound, so an unbounded list endpoint is not acceptable.

**Response shape.** Records are returned as `{ id, data }` matching the existing
records API convention, so the client uses one decode path for all four.

### Frontend

A dedicated route in the admin SPA, reached from a row action on the existing
agents table:

```
/orgs/:orgId/projects/:projectId/agents/:agentId/activity
```

A dedicated page rather than a tab in the existing `AgentDrawer`, because a
chronological timeline needs full-page width.

**Components** (`repos/admin/src/components/AgentActivity/`):

- `AgentActivityPage` composes the route.
- `AgentStatusHeader` renders liveness: current activity, queue depth, turn
  count, time since last turn, and a degraded badge.
- `AgentTimeline` renders a merged chronological feed of turns, messages, and
  memories, filterable by type.
- `TimelineEntry` renders one entry with a collapsed preview and expandable
  full `input`/`output`.

**State and data flow.** The repo's established pattern is followed exactly:
route loader calls an action, the action calls an accessor, the accessor calls
the API, and the result lands in a Jotai atom that components read.

Constraints carried from existing project conventions:

- Components never call accessors directly. Only actions do.
- No `useEffect` for data loading. Fetch in loaders, actions, or event handlers.
- Atom `undefined` means "not fetched yet"; `[]` means "fetched, empty". The
  timeline renders a loading state for the former and an empty state for the
  latter.
- Inputs come from `@tdsk/components` (`TextInput`), not MUI directly.
- Exported types live in `repos/admin/src/types/`; types used in a single file
  stay local.
- Deep-path imports for admin actions, no barrel imports.

### Liveness

Polling every 5 seconds while the activity route is mounted, not WebSocket.

The underlying data does not currently justify streaming: heartbeats land every
~30s and transcripts are appended after a turn completes, so a push channel
would deliver the same information at the same granularity with materially more
complexity. SP2 revisits this once SP3 emits per-tool-call events worth
streaming.

The polling loop is the one place where the no-`useEffect` rule needs care, so
the mechanism is fixed here rather than left to implementation: a module-level
poll controller in the action layer, driven by two actions,
`startAgentActivityPolling(agentId)` and `stopAgentActivityPolling()`. The route
loader starts it after its initial fetch and the route's cleanup stops it. Each
tick re-runs the same accessors the loader uses and writes to the same atoms, so
there is exactly one fetch path, the timer lives in the action layer, and no
component effect ever loads data.

A tick that overlaps a still-in-flight request is skipped rather than queued, so
a slow response cannot stack requests.

## Error handling

- **Agent has never run.** No `resident_status` record exists. The header
  renders "No activity recorded" rather than an error. This is the normal state
  for a scheduled (non-resident) agent.
- **Stale heartbeat.** When `lastTurnAt` is older than the watchdog's 3-minute
  threshold, or `degraded` is set, the header shows a degraded badge. The UI
  reports the flag; it does not compute its own health verdict, so there is one
  source of truth.
- **Truncated telemetry.** Transcript `input`/`output` are capped at 20k
  characters by the writer. Where a value is at the cap the UI marks it
  truncated, so a user is not misled into thinking they see the full turn.
- **Partial failure.** The four reads are independent. A failure of one (for
  example memories) renders that section's error state while status and turns
  still display.
- **Authorization failure.** 403 and 404 render a not-found state, never a raw
  error dump.

## Testing

**Backend:** per endpoint, tests for the happy path, pagination (limit, before,
boundary), the empty set, an agent not bound to the project (404), and an
unauthorized caller (403).

**Frontend:** component tests for `AgentStatusHeader` (live, degraded, and
never-run states), `AgentTimeline` (merge ordering across the three sources,
type filtering, loading vs empty distinction driven by `undefined` vs `[]`), and
`TimelineEntry` (collapse/expand, truncation marker).

**Integration:** an agent with seeded telemetry surfaces its turns through the
API and renders in the page.

## Risks

- **Transcript volume.** Six agents turning continuously append transcripts
  indefinitely. The pagination cap bounds the read path, but a retention or
  archival policy is a real follow-on concern and is called out here rather than
  silently ignored. It is out of scope for SP1.
- **Polling cost.** A 5-second poll per open activity page multiplies by
  concurrent viewers. Acceptable at current scale (single-digit operators) and
  superseded by SP2.
