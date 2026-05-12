# Multi-Instance Sandbox — Continuation Prompt

## What's Done

Multi-instance sandbox support has been implemented across domain, backend, admin, and threads repos.

### Implemented Files (modified)
- `repos/domain/src/types/sandbox.types.ts` — `maxInstances` on `TKubeSandboxConfig`, `TSandboxInstance`, `TSandboxInstancesResponse`
- `repos/domain/src/constants/sandbox.ts` — `DefaultMaxInstances = 1`
- `repos/backend/src/services/sandboxes/sandbox.ts` — `findRunningPods`/`findActivePods` (plural), refactored `findRunningPod`/`findActivePod` (singular, validate by podName + optional sandboxId), counter-based `startingPods` Map, `countStarting()`, `getInstanceSessions()`
- `repos/backend/src/endpoints/sandboxes/connectSandbox.ts` — accepts `podName`/`newInstance` body params, enforces `maxInstances` limit
- `repos/backend/src/endpoints/sandboxes/listInstances.ts` — NEW: `GET /:id/instances`
- `repos/backend/src/endpoints/sandboxes/listSessions.ts` — aggregates across all running pods
- `repos/backend/src/endpoints/sandboxes/stopSandbox.ts` — `stopAll` with session checks, error reporting
- `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` — `podName` query param with sandbox validation
- `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts` — same
- `repos/backend/src/endpoints/sandboxes/createSandbox.ts` — `maxInstances` validation (clamp to positive int)
- `repos/backend/src/endpoints/sandboxes/updateSandbox.ts` — same
- `repos/backend/src/endpoints/orgs/orgProjects.ts` — registered `listInstances`
- `repos/backend/src/services/sandboxes/sandbox.test.ts` — updated tests for refactored methods
- `repos/admin/src/hooks/sandboxes/useSandboxForm.ts` — `maxInstances` state/save
- `repos/admin/src/components/Sandboxes/SandboxConfigAccordion.tsx` — Max Instances input
- `repos/admin/src/components/Sandboxes/Sandboxes.tsx` — multi-instance pod tracking, `newInstance: true` on connect, `stopAll` on stop
- `repos/threads/src/services/sandboxApi.ts` — `connect` opts, `listInstances()`, `stop` opts
- `repos/threads/src/types/sessions.types.ts` — `podName`/`newInstance` on `TOpenSessionOpts`
- `repos/threads/src/actions/sessions/openSession.ts` — passes `podName` through connect + WebSocket
- `repos/threads/src/actions/sandboxes/stopSandbox.ts` — `stopAll` support
- `repos/threads/src/pages/Sandbox/Sandbox.tsx` — instance-aware page with refresh
- `repos/threads/src/components/Sidebar/NavSandboxItem.tsx` — always 3-tier hierarchy
- `repos/threads/src/components/Sidebar/NavInstanceItem.tsx` — NEW component

---

## What's Left — Two Tasks

### Task 1: Rename `podName` → `instanceId` at the API boundary

`podName` is a K8s implementation detail that leaks through the entire API contract. The abstraction should use `instanceId` — an opaque identifier that happens to be the pod name under the hood but doesn't expose that to clients.

**API-facing locations that need renaming** (~20 files):

Domain types:
- `TSandboxSession.podName` → `instanceId`
- `TSandboxConnectResponse.podName` → `instanceId`
- `TSandboxInstance.podName` → `instanceId`

Backend endpoints (request/response bodies):
- `connectSandbox.ts` — req body `podName` → `instanceId`, response same
- `stopSandbox.ts` — req body `podName` → `instanceId`
- `listInstances.ts` — response uses `TSandboxInstance`
- `getSandboxStatus.ts` — query param `podName` → `instanceId`
- `execInSandbox.ts` — req body `podName` → `instanceId`
- `startSandbox.ts` — response `podName` → `instanceId`

WebSocket handlers (query params):
- `onShellConnect.ts` — `?podName=` → `?instanceId=`
- `onTunnelConnect.ts` — same

Admin UI:
- `Sandboxes.tsx` — local `TPodState.podName` → `instanceId`
- `ConnectModal.tsx` — display

Threads UI:
- `TOpenSession.podName` → `instanceId`
- `TOpenSessionOpts.podName` → `instanceId`
- `openSession.ts` — connect + WebSocket param
- `stopSandbox.ts` — API call
- `sandboxApi.ts` — connect/stop params
- `Sandbox.tsx` — display + instance selection
- `NavInstanceItem.tsx` — sidebar
- `NavSandboxItem.tsx` — session grouping

**What stays as `podName`** (internal only):
- `SandboxService` maps (`sessions`, `passwords`, `podActivity`)
- K8s operations (`startPod`, `stopPod`, `getPodState`, etc.)
- Pod manifest building, label lookups
- Internal method signatures within the service layer

Endpoints translate at the boundary: destructure `instanceId` from request, use as `podName` internally, return as `instanceId` in response.

### Task 2: TSA CLI multi-instance support

The `tsa` CLI (`repos/tsa/`) has not been updated for multi-instance. Key commands affected:
- `tsa ssh <sandbox-id>` — currently connects to THE running pod. Needs instance selection.
- `tsa run` — launches AI tool in a sandbox. Needs to know which instance.
- `tsa sync` — file sync via Mutagen. Needs instance targeting.
- `tsa sessions` — lists sessions. Needs to show which instance each session belongs to.

The TSA CLI skill is at `.claude/skills/tdsk-tsa/SKILL.md` — load it first.

Key questions to resolve:
- How does `tsa ssh` pick an instance when multiple are running? (prompt? flag? auto-assign?)
- Should `tsa run` auto-start a new instance or connect to an existing one?
- How does `tsa sync` target a specific instance?
- How does the CLI display instances in `tsa sessions`?

---

## Plan File
The original implementation plan is at: `~/.claude/plans/currently-users-can-start-graceful-cocoa.md`

## Key Architecture Notes
- Sandboxes are config/templates, instances are running pods, sessions are connections to instances
- `maxInstances` is stored in `TKubeSandboxConfig` JSONB (default 1)
- Instance limit enforced in `connectSandbox.ts`: `activePods.length + countStarting >= maxInstances`
- `startingPods` is a counter Map preventing race conditions on concurrent starts
- Idle timeout is already per-pod (no change needed)
- Sidebar always shows 3-tier: Sandbox → Instance → Session
- "New Instance" auto-creates a session after pod starts
- "New Session" is per-instance (user picks which instance)
