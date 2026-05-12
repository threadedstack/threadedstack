Here's the prompt:

---

**Continue multi-instance sandbox support in the TSA CLI. The initial implementation covered the main task flows (sandbox, ssh, sync, proxy) but the review found gaps in sub-tasks, type safety, and test coverage. All items below must be fixed.**

## Context

Multi-instance sandbox support was added to the TSA CLI in the previous session. The core flow works: `resolveInstanceId` does short-suffix matching and interactive prompts, `--instance`/`--new` flags exist on sandbox/ssh/sync tasks, Mutagen sync uses instance-scoped labels via compound `sandboxId--instanceId` SSH hostnames, and the proxy/shell WebSocket connections forward `instanceId`.

Key reference files already modified:
- Instance resolution: `repos/tsa/src/utils/tasks/resolveInstanceId.ts`
- Type: `TInstanceResolution` in `repos/tsa/src/types/tasks.types.ts`
- Options: `InstanceOptions` in `repos/tsa/src/constants/options.ts`
- API: `listInstances` + `connectSandbox(orgId, projectId, sandboxId, opts?)` in `repos/tsa/src/services/api.ts`
- Pattern to follow: see how `repos/tsa/src/tasks/sandbox.ts` and `repos/tsa/src/tasks/ssh.ts` do instance resolution before connecting

## Task 1: `sessions` sub-tasks need instance resolution

`repos/tsa/src/tasks/sessions.ts` has sub-tasks that call `connectAndAttach` or `connectSandbox` without any instance awareness:

- **`sessions start`** (line ~227) — calls `connectAndAttach` without `instanceOpts`. In multi-instance scenarios, the server receives no `instanceId` or `newInstance`, causing unpredictable instance selection. Fix: add `InstanceOptions` to the sub-task options, run `resolveInstanceId` before calling `connectAndAttach`, and pass `instanceOpts` through.

- **`sessions connect`** (line ~262) — same issue. When connecting to an existing session, the session already has an `instanceId` field (`TSandboxSession.instanceId`). After resolving the session's sandbox via `resolveSessionSandbox`, extract `session.instanceId` and pass it as `instanceOpts: { instanceId: session.instanceId }` to `connectAndAttach`.

- **`changeVisibility` helper** (line ~49) — calls `client.connectSandbox(orgId, projectId, resolved.sandboxId)` with no instance opts. It also builds a shell WebSocket URL without `?instanceId=`. Fix: extract `resolved.session.instanceId` and pass it to `connectSandbox` as `{ instanceId }`, and include `instanceId` in the WebSocket URL query params.

## Task 2: `sync stop/flush` sub-tasks need `--instance` support

`repos/tsa/src/tasks/sync.ts` has `stopTask` and `flushTask` sub-tasks that call `manager.stopAll(sandboxId)` and `manager.flushAll(sandboxId)` without instanceId. This means `tsa sync stop sb_xxx` destroys sync for ALL instances. The foreground sync cleanup in the main action correctly passes `resolvedInstanceId` — the sub-tasks should match.

Fix: add `InstanceOptions` (or at least `--instance`) to `stopTask` and `flushTask`. When `--instance` is provided, pass it through. When multiple instances have sync sessions and no `--instance` is given, either warn or prompt (follow the existing `resolveActiveSyncSandbox` pattern but extended for instances). The `cleanupTask` sub-task should also be instance-aware — it currently terminates all errored/disconnected sessions globally.

The `statusTask` already groups by sandboxId and instanceId in the display (updated in previous session), so it's fine.

## Task 3: Type `connectSandbox` return properly

`repos/tsa/src/services/api.ts` line ~233: `connectSandbox` returns `Promise<TApiResponse<any>>`. It should return `Promise<TApiResponse<TSandboxConnectResponse>>` — the type already exists in `@tdsk/domain`. Similarly, `getSandbox` (line ~244) returns `TApiResponse<any>` — consider typing that too.

This will give compile-time safety on all the `connectResp.instanceId`, `connectResp.workdir`, `connectResp.shellToken` accesses throughout the codebase.

## Task 4: Write `resolveInstanceId.test.ts`

New file: `repos/tsa/src/utils/tasks/resolveInstanceId.test.ts`

Follow the exact pattern of `repos/tsa/src/utils/tasks/resolveSandboxId.test.ts` — mock `ApiClient.listInstances`, test all code paths:
1. `forceNew: true` → returns `{ newInstance: true }` immediately (no API call)
2. API error + explicit instance → throws
3. API error + no explicit instance → returns `{}` (graceful degradation)
4. Explicit instance — exact match found
5. Explicit instance — suffix match found (one match)
6. Explicit instance — ambiguous suffix (multiple matches) → throws
7. Explicit instance — no match → throws
8. Zero instances → returns `{}`
9. One instance → auto-selects, returns `{ instanceId }`
10. Multiple instances + non-TTY → throws
11. (Optional) Multiple instances + TTY prompt — can skip as `resolveSandboxId.test.ts` does

## Task 5: Extend `api.test.ts` for new/changed methods

`repos/tsa/src/services/api.test.ts` needs:
- Test for `listInstances(orgId, projectId, sandboxId)` — verify correct URL path and HTTP method
- Test for `connectSandbox` with opts — verify `{ instanceId, newInstance }` is sent in the request body
- Test for `connectSandbox` without opts — verify `{}` is sent (backward compat)

## Task 6: Extend `syncManager.test.ts` for instanceId parameters

`repos/tsa/src/services/sync/syncManager.test.ts` needs:
- `startAll` with `instanceId` — verify `listSessions` called with `{ sandboxId, instanceId }`, verify `createSession` receives compound SSH host `sandboxId--instanceId` as `sandboxId`, verify labels include `instanceId`
- `stopAll` with `instanceId` — verify `listSessions` called with `{ sandboxId, instanceId }` filter
- `flushAll` with `instanceId` — same label filter check
- `status` with both sandboxId and instanceId — verify combined filter

## Task 7: Extend `connectAndAttach.test.ts`

Add one test case that passes explicit `instanceOpts: { instanceId: 'custom-inst' }` and verifies it reaches `sandboxConnectPod` and flows through to `connectShellWebSocket`.

---

**Prerequisite**: The `podName` → `instanceId` rename is already complete. All API fields use `instanceId`. The TSA skill is at `.claude/skills/tdsk-tsa/SKILL.md`.
