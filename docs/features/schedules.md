# Schedules

> **Last Updated**: July 2026

## Table of Contents

1. [What are Schedules?](#1-what-are-schedules)
2. [Architecture Overview](#2-architecture-overview)
3. [Key Concepts](#3-key-concepts)
4. [Managing Schedules via the Admin API](#4-managing-schedules-via-the-admin-api)
5. [Manually Triggering a Schedule](#5-manually-triggering-a-schedule)
6. [Schedule Runs](#6-schedule-runs)
7. [Cron Expression Format](#7-cron-expression-format)
8. [`contextSources` and `actions`](#8-contextsources-and-actions)
9. [Auto-Disable on Repeated Failures](#9-auto-disable-on-repeated-failures)
10. [Limits and Constraints](#10-limits-and-constraints)
11. [Authentication and Permissions](#11-authentication-and-permissions)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. What are Schedules?

A Schedule is a project-scoped, cron-triggered cycle that runs a prompt or a raw shell
command inside one of the project's sandboxes. It is how you turn a one-off agent run or a
manual `tsa` session into something that fires on its own — a nightly report, a recurring
cleanup task, a self-directed coding loop.

```mermaid
flowchart LR
  subgraph Proj["Project"]
    SD["Schedule cron: '0 * * * *', type: prompt|shell"]
    SB["Sandbox (project-linked)"]
    SD -->|"runs in"| SB
    SD --> RUN1["ScheduleRun (success)"]
    SD --> RUN2["ScheduleRun (error)"]
  end
```

**When to use Schedules:**
- Run a recurring agent cycle (a coding loop, a report, a triage pass) without a human
  kicking it off each time
- Run a raw shell command on a fixed cadence inside a sandbox (`type: shell`)
- Give an agent a durable, self-triggering presence in a project rather than a
  single-conversation lifetime

**When not to use Schedules:** for a one-shot run triggered by a user action, use the
Agents run endpoint (`/_/orgs/<org-id>/projects/<project-id>/agents/<agent-id>/run`)
directly instead of creating a schedule you immediately disable.

---

## 2. Architecture Overview

```mermaid
flowchart LR
  TICK["Scheduler 60s tick"] -->|"listDue(): enabled=true AND nextRunAt <= now"| DB[("schedules table")]
  TICK -->|"fire-and-forget per due schedule"| PROC["#processSchedule"]
  PROC -->|"hasRunning? skip + advance nextRunAt"| RUNS[("schedule_runs table")]
  PROC -->|"markRun: advance nextRunAt BEFORE executing"| DB
  PROC -->|"executeAgent(schedule)"| EXEC["Executor: resolve sandbox, run prompt/command"]
  EXEC -->|"success"| RESET["resetErrors"]
  EXEC -->|"failure"| INC["incrementErrors (auto-disables at maxConsecutiveErrors)"]
  ADMIN["Admin API caller"] -->|"CRUD + manual trigger"| DB
```

The `Scheduler` (`repos/backend/src/services/scheduler/scheduler.ts`) ticks every 60
seconds and fetches all schedules where `enabled = true` and `nextRunAt <= now`. Each due
schedule is dispatched **fire-and-forget** — a single long-running cycle never blocks the
next tick from picking up other due schedules. `nextRunAt` is advanced via `markRun`
**before** the executor runs, so a slow or crashed executor never causes the same schedule
to be picked up twice by the following tick.

A per-schedule concurrency guard (`scheduleRun.hasRunning`) refuses to start a new run while
one is already in flight — including a manual trigger racing the natural cron slot — so a
schedule never runs two overlapping cycles.

On boot, `hydrateOrphanedRuns` inspects any row still `running` from before the last
deploy/crash/OOM and completes it based on the sandbox pod's actual state, rather than
leaving it wedged in `running` forever.

---

## 3. Key Concepts

### Schedule

The cron config itself: `cronExpression`, a `type` (`prompt` or `shell`), the sandbox it
runs in, and error/timeout bookkeeping (`consecutiveErrors`, `maxConsecutiveErrors`,
`timeoutMs`). Schedules are always scoped to an org, a project, and a specific sandbox that
must already be linked to that project; `agentId`, `threadId`, and `userId` are optional.

### Schedule Type

- `prompt` (default) — the executor runs the schedule's `prompt` through the sandbox's
  configured AI runtime, the same as a manual agent turn.
- `shell` — the executor runs the schedule's `command` directly, no AI runtime involved.

### Schedule Run

One execution record (`ScheduleRun`) per cycle: `status` (`running` | `success` | `error` |
`timeout`), `startedAt`/`completedAt`, `durationMs`, and S3 keys (`stdoutKey`/`stderrKey`)
for the captured output. See [§6](#6-schedule-runs).

### Next Run Computation

`nextRunAt` is computed from `cronExpression` via a shared 5-field cron parser
(`repos/domain/src/utils/cron.ts`) used by both the backend scheduler and the resident
runtime's agenda. See [§7](#7-cron-expression-format).

---

## 4. Managing Schedules via the Admin API

Base path: `/_/orgs/<org-id>/projects/<project-id>/schedules`

### Create a Schedule

```bash
curl -X POST \
  "https://local.threadedstack.app/_/orgs/<org-id>/projects/<project-id>/schedules" \
  -H "Authorization: Bearer tdsk_<api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "cronExpression": "0 * * * *",
    "sandboxId": "sb_a1b2c3d4e5",
    "type": "prompt",
    "prompt": "Summarize new leads from the last hour and post a digest.",
    "agentId": "agt_f6g7h8i9j0"
  }'
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "sd_k1l2m3n4o5",
    "orgId": "org-123",
    "projectId": "proj-123",
    "sandboxId": "sb_a1b2c3d4e5",
    "agentId": "agt_f6g7h8i9j0",
    "userId": "user-456",
    "type": "prompt",
    "prompt": "Summarize new leads from the last hour and post a digest.",
    "cronExpression": "0 * * * *",
    "enabled": true,
    "consecutiveErrors": 0,
    "maxConsecutiveErrors": 5,
    "nextRunAt": "2026-07-26T07:00:00.000Z",
    "createdAt": "2026-07-26T06:12:00.000Z",
    "updatedAt": "2026-07-26T06:12:00.000Z"
  }
}
```

A `shell`-type schedule requires `command` instead of `prompt`:

```json
{
  "cronExpression": "*/15 * * * *",
  "sandboxId": "sb_a1b2c3d4e5",
  "type": "shell",
  "command": "pnpm --filter @tdsk/backend test"
}
```

### Schedule Fields

| Field | Required | Settable via API | Description |
|-------|----------|-------------------|--------------|
| `cronExpression` | Yes | Create + Update | 5-field cron string; see [§7](#7-cron-expression-format) |
| `sandboxId` | Yes | Create + Update | Sandbox to run in; must already be linked to the project |
| `type` | No (default `prompt`) | Create only | `prompt` or `shell` |
| `prompt` | Yes if `type=prompt` | Create + Update | Prompt text for the AI runtime |
| `command` | Yes if `type=shell` | Create + Update | Raw shell command |
| `agentId` | No | Create + Update | Attributes the run to a specific agent; must belong to the org |
| `enabled` | No (default `true`) | Update only (not settable on create) | Cron tick skips a disabled schedule |
| `timeoutMs` | No | Create + Update | Per-run timeout; clamped between `MinScheduleTimeoutMS` (60s) and `MaxScheduleTimeoutMS` (8h). Defaults to the platform's `ExecTimeoutMS` (1h) when omitted |
| `maxConsecutiveErrors` | No (default `5`) | Create + Update | Auto-disable threshold; see [§9](#9-auto-disable-on-repeated-failures) |
| `contextSources` | No | Not exposed | Schema-level field consumed by the executor; see [§8](#8-contextsources-and-actions) |
| `actions` | No | Not exposed | Schema-level field consumed by the executor; see [§8](#8-contextsources-and-actions) |

`orgId`, `projectId`, `userId` (the creating user), `lastRunAt`, `nextRunAt`, and
`consecutiveErrors` are all set by the platform and are not client-writable.

### List / Get / Update / Delete

```bash
# List a project's schedules
GET /_/orgs/<org-id>/projects/<project-id>/schedules

# Get one schedule
GET /_/orgs/<org-id>/projects/<project-id>/schedules/sd_k1l2m3n4o5

# Update (only provided fields change; PUT, not PATCH)
PUT /_/orgs/<org-id>/projects/<project-id>/schedules/sd_k1l2m3n4o5
{ "cronExpression": "0 */2 * * *", "enabled": false }

# Delete
DELETE /_/orgs/<org-id>/projects/<project-id>/schedules/sd_k1l2m3n4o5
```

Changing `cronExpression` recomputes `nextRunAt` immediately. Changing `agentId` to a
different agent (or to `null`) also clears the schedule's `threadId`, so the next run starts
a fresh thread rather than continuing the previous agent's conversation.

---

## 5. Manually Triggering a Schedule

```bash
curl -X POST \
  "https://local.threadedstack.app/_/orgs/<org-id>/projects/<project-id>/schedules/sd_k1l2m3n4o5/trigger" \
  -H "Authorization: Bearer tdsk_<api-key>"
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "sd_k1l2m3n4o5",
    "...": "the full schedule object",
    "lastRunAt": "2026-07-26T06:20:00.000Z",
    "nextRunAt": "2026-07-26T07:00:00.000Z",
    "triggered": true
  }
}
```

A manual trigger shares the same "one run at a time" guard as the cron path — triggering a
schedule with a run already in flight returns **409 Conflict**
(`A run for this schedule is already in progress`) rather than starting a second concurrent
run. On success, `nextRunAt` is recomputed from the cron expression (not "now"), so the
natural cron slot is preserved instead of being pushed back by the manual trigger.

---

## 6. Schedule Runs

Base path: `/_/orgs/<org-id>/projects/<project-id>/schedules/<schedule-id>/runs`

### List Runs

```bash
GET /_/orgs/<org-id>/projects/<project-id>/schedules/sd_k1l2m3n4o5/runs?limit=20&offset=0
```

`limit` defaults to 20 and is clamped between 1 and 100; `offset` defaults to 0.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "sr_p6q7r8s9t0",
      "orgId": "org-123",
      "projectId": "proj-123",
      "scheduleId": "sd_k1l2m3n4o5",
      "status": "success",
      "startedAt": "2026-07-26T06:00:00.000Z",
      "completedAt": "2026-07-26T06:00:42.000Z",
      "durationMs": 42000,
      "instanceId": "inst-abc123",
      "stdoutKey": "schedule-runs/sr_p6q7r8s9t0/stdout",
      "stderrKey": "schedule-runs/sr_p6q7r8s9t0/stderr"
    }
  ]
}
```

### Get One Run

```bash
GET /_/orgs/<org-id>/projects/<project-id>/schedules/sd_k1l2m3n4o5/runs/sr_p6q7r8s9t0
```

`status` is one of `running`, `success`, `error`, or `timeout`. An `error` run carries an
`error` message field; a `running` run has no `completedAt`/`durationMs` yet.

### Get Run Output

```bash
GET /_/orgs/<org-id>/projects/<project-id>/schedules/sd_k1l2m3n4o5/runs/sr_p6q7r8s9t0/output?stream=stdout
```

Streams the captured output straight from S3 as `application/octet-stream`. `stream` is
`stdout` (default) or `stderr` — any other value is rejected with 400. Returns **503** if S3
is not configured for this deployment, and **404** if no output was recorded for the
requested stream (e.g. the run failed before producing output, or the object has since been
lifecycle-expired from the bucket).

---

## 7. Cron Expression Format

Schedules use a standard 5-field cron expression (`minute hour dayOfMonth month
dayOfWeek`), evaluated by a shared parser (`repos/domain/src/utils/cron.ts`) used by both
the backend scheduler and the resident runtime's agenda:

| Field | Range | Supports |
|-------|-------|----------|
| minute | 0-59 | `*`, number, `n/step`, `a,b,c`, `a-b` |
| hour | 0-23 | `*`, number, `n/step`, `a,b,c`, `a-b` |
| day of month | 1-31 | `*`, number, `n/step`, `a,b,c`, `a-b` |
| month | 1-12 | `*`, number, `n/step`, `a,b,c`, `a-b`, `JAN`-`DEC` |
| day of week | 0-6 (0 = Sunday) | `*`, number, `n/step`, `a,b,c`, `a-b`, `SUN`-`SAT` |

Examples: `0 * * * *` (top of every hour), `*/15 * * * *` (every 15 minutes),
`0 9 * * MON-FRI` (9am on weekdays). An invalid expression is rejected with **400** on both
create and update — `isValidCron` runs before the row is written or updated, so a malformed
schedule can never be persisted.

---

## 8. `contextSources` and `actions`

The `schedules` table carries two additional jsonb columns the executor actively consumes,
though **neither is currently settable through `createSchedule`/`updateSchedule`** — the
request bodies for both endpoints only read the fields listed in [§4](#4-managing-schedules-via-the-admin-api).
They are set through other internal mechanisms (e.g. a schedule authored directly against
the database service).

- **`contextSources`** — an array of `{ collection, query, as, max? }` entries. When a
  `prompt`-type cycle assembles its context, the executor runs each source's Collections
  query and injects the results under a `## <as>` heading (see the Collections doc's
  [`contextSources` section](./collections.md#9-access-path-contextsources) for the full
  shape). A schedule without `contextSources` runs no extra query.
- **`actions`** — an opt-in effect-surface allowlist. When set, the executor dispatches a
  ```` ```tdsk-actions``` ```` block found in the cycle's output only for the Function names
  listed here. A schedule without `actions` never dispatches any action block, regardless of
  what the model emits.

Both fields are additive and nullable: a schedule that never sets them behaves exactly as if
they did not exist in the schema.

---

## 9. Auto-Disable on Repeated Failures

Every failed run increments the schedule's `consecutiveErrors`. When
`consecutiveErrors + 1 >= maxConsecutiveErrors`, the schedule is atomically set to
`enabled: false` in the same update — the scheduler tick will no longer pick it up. A
successful run resets `consecutiveErrors` back to `0`.

This means a schedule that starts failing every cycle self-disables after
`maxConsecutiveErrors` (default `5`) consecutive failures rather than burning cycles
indefinitely; re-enable it explicitly via `PUT .../schedules/<id>` with `{"enabled": true}`
once the underlying issue is fixed.

A **skipped** run (one that never started because a prior run was still in flight) does not
count as a failure — `hasRunning` skips increment entirely.

---

## 10. Limits and Constraints

| Limit | Value | Notes |
|-------|-------|-------|
| Scheduler tick interval | 60 seconds | Fixed; not configurable per schedule |
| Minimum `timeoutMs` | 60,000 (60s) | `MinScheduleTimeoutMS` |
| Maximum `timeoutMs` | 28,800,000 (8h) | `MaxScheduleTimeoutMS` |
| Default execution timeout | 3,600,000 (1h) | `ExecTimeoutMS`, used when `timeoutMs` is omitted |
| Default `maxConsecutiveErrors` | 5 | Auto-disable threshold; overridable per schedule |
| Run history page size | 20 (default), 1-100 (clamped) | `listScheduleRuns` `limit`/`offset` |
| Concurrency | 1 run per schedule at a time | Enforced by `hasRunning`, both cron and manual trigger |
| Feature gate | `schedules` flag must be enabled | 404 on the whole route group when disabled |
| Scope | Project | A caller can never read/write another project's schedules |

---

## 11. Authentication and Permissions

### Permission Matrix

| Operation | Minimum Role | Permission |
|-----------|--------------|------------|
| List/get schedules, runs, run output | member | `schedule:read` |
| Create a schedule | member | `schedule:create` |
| Update a schedule | member | `schedule:update` |
| Manually trigger a schedule | member | `schedule:exec` |
| Delete a schedule | admin | `schedule:delete` |

All Schedules routes additionally require the `schedules` feature flag to be enabled for the
org, plus the standard project access + project member guards (mirrored by the Collections
API — see its [permission matrix](./collections.md#12-authentication-and-permissions)).

### Authentication Methods

```bash
# JWT (browser/Neon Auth login)
curl -H "Authorization: Bearer eyJhbGciOi..." \
  https://local.threadedstack.app/_/orgs/<org-id>/projects/<project-id>/schedules

# API Key
curl -H "Authorization: Bearer tdsk_your_api_key_here" \
  https://local.threadedstack.app/_/orgs/<org-id>/projects/<project-id>/schedules
```

---

## 12. Troubleshooting

### "Schedule not found" (404)

**Checks:**
1. Verify the `scheduleId` is exact — schedule IDs are the `sd_` prefix plus a 10-character
   nanoid.
2. Verify you are targeting the correct `orgId`/`projectId` in the URL — a schedule created
   under one project is invisible (and returns 404, not 403) from another project, even with
   a correct schedule ID.

### 404 on the entire `/schedules` route group

**Symptom:** every Schedules endpoint returns 404, including `GET .../schedules`.

**Checks:**
1. Confirm the `schedules` feature flag is enabled for this deployment
   (`repos/domain/src/constants/featureFlags.ts`) — `featureGate('schedules')` returns a
   blanket 404 for the whole route group when it is off, which looks identical to "route
   doesn't exist."

### 409 on manual trigger: "A run for this schedule is already in progress"

**Checks:**
1. This is expected, not a bug — a prior run (cron or manual) is still `running`.
2. Check `GET .../schedules/<id>/runs?limit=1` for the most recent run's `status`; if it has
   been `running` far longer than `timeoutMs`, the executor may have crashed without
   completing the run row — this self-heals on the next backend boot via orphaned-run
   hydration, or file a bug if it recurs on a healthy backend.

### 400 on create/update: "Invalid cron expression"

**Checks:**
1. The expression must be exactly 5 space-separated fields (`minute hour dayOfMonth month
   dayOfWeek`) — 6-field cron (with a seconds field) is not supported.
2. Day/month names must be 3-letter abbreviations (`MON`, `JAN`, etc.), not full names.

### 503 on run output: "S3 not configured"

**Checks:**
1. Run output (`stdout`/`stderr`) is only retrievable when the deployment has S3 (or an
   S3-compatible store) configured — check `app.locals.s3.active` server-side / the
   deployment's S3 env vars.
2. Without S3 configured, run status and duration are still available via
   `GET .../runs/<runId>` — only the raw output stream is unavailable.

### A schedule stopped running on its own

**Checks:**
1. `GET .../schedules/<id>` and check `enabled` — 5 (default `maxConsecutiveErrors`)
   consecutive failed runs auto-disables the schedule; see [§9](#9-auto-disable-on-repeated-failures).
2. Check the schedule's recent runs (`GET .../schedules/<id>/runs`) for the failure pattern
   before re-enabling — re-enabling without fixing the underlying cause just burns another
   `maxConsecutiveErrors` cycles before disabling again.
