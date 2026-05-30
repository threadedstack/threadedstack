# Terminating Pod Awareness

## Problem

When a user stops a sandbox session and immediately starts a new one, the system reconnects to the pod that K8s is still terminating. The user sees a working interface briefly, then the pod is removed and the session breaks silently.

### Root Cause

K8s does not change `pod.status.phase` when a pod is being deleted. The phase remains `"Running"` during the entire graceful shutdown period (up to 30 seconds). The actual termination signal is `pod.metadata.deletionTimestamp` being set on the pod object. The codebase never checks `deletionTimestamp` — it only checks `pod.status.phase`, so a terminating pod looks identical to a healthy running pod.

### Affected Code Paths

`SandboxService.findRunningPod()` is the primary lookup used by 4 endpoints:

| Caller | File | Effect |
|--------|------|--------|
| `connectSandbox` | `repos/backend/src/endpoints/sandboxes/connectSandbox.ts:35` | Returns dying pod instead of creating new one |
| `onShellConnect` | `repos/backend/src/endpoints/sandboxes/onShellConnect.ts:193` | Opens shell to dying pod |
| `onTunnelConnect` | `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts:67` | Opens TCP tunnel to dying pod |
| `listSessions` | `repos/backend/src/endpoints/sandboxes/listSessions.ts:28` | Reports sessions on dying pod |

`SandboxService.findActivePod()` is the secondary lookup in `connectSandbox` (line 39), which also lacks the check.

The kube client's route cache (`shouldHydrate`/`shouldRemove` in `kubeClient.ts`) has the same gap — a terminating pod with phase `"Running"` is hydrated into the route map instead of being removed.

### Reproduction

1. Start a sandbox session (pod reaches Running)
2. Click "Stop" (backend sends `deletePod` with 30s grace, returns immediately)
3. Click "Start Session" within 30 seconds
4. `findRunningPod()` finds the old pod (phase still "Running", no `deletionTimestamp` check)
5. Connect endpoint returns the dying pod's credentials
6. UI connects, then breaks when K8s finishes termination

## Solution

Add `deletionTimestamp` awareness at three layers: domain enum, kube client cache, and sandbox service queries. The fix is to filter out pods where `metadata.deletionTimestamp` is set at every point where pod liveness is evaluated.

### Design Decision: Immediate New Pod (Option A)

When the connect endpoint finds no non-terminating pod, it creates a new one immediately. The old pod continues terminating in the background. Briefly two pods coexist for the same sandboxId, but:

- Pod names are unique (random 4-char suffix via `buildPodName()`)
- All queries filter by `deletionTimestamp`, so only the new pod is visible
- K8s cleans up the old pod within the grace period
- No extra latency for the user (vs. waiting up to 30s for the old pod to die)

### Alternative Considered: Wait-for-Deletion (Rejected)

Poll until the old pod is fully gone before creating a new one. Rejected because it adds up to 30 seconds of latency, requires new polling logic in the connect endpoint, and provides no practical benefit since K8s handles cleanup independently.

## Changes

### 1. Domain — `EContainerState` enum

**File:** `repos/domain/src/types/sandbox.types.ts`

Add `Terminating = "Terminating"` to the `EContainerState` enum:

```typescript
export enum EContainerState {
  Failed = `Failed`,
  Pending = `Pending`,
  Running = `Running`,
  Unknown = `Unknown`,
  Succeeded = `Succeeded`,
  Terminating = `Terminating`,
}
```

This lets `getPodState()` return an explicit state rather than `Unknown`. The sandbox repo's `ContainerStatesSet` is built from `Object.values(EContainerState)` and automatically includes the new value.

### 2. Sandbox KubeClient — Route cache hydration

**File:** `repos/sandbox/src/kube/kubeClient.ts`

**`shouldHydrate(pod)`** — return `false` when `deletionTimestamp` is set:

```typescript
private shouldHydrate(pod: k8s.V1Pod): boolean {
  if (pod.metadata?.deletionTimestamp) return false
  const phase = pod.status?.phase
  return phase === EContainerState.Running || phase === EContainerState.Pending
}
```

**`shouldRemove(pod)`** — return `true` when `deletionTimestamp` is set:

```typescript
private shouldRemove(pod: k8s.V1Pod): boolean {
  if (pod.metadata?.deletionTimestamp) return true
  const phase = pod.status?.phase
  return phase === EContainerState.Failed || phase === EContainerState.Succeeded
}
```

This ensures the kube watcher's `MODIFIED` event for a terminating pod triggers `removeFromCache()` instead of re-hydrating it as "Running". The watcher's `DELETED` event already calls `removeFromCache()` directly.

### 3. Backend SandboxService — Pod query filters

**File:** `repos/backend/src/services/sandboxes/sandbox.ts`

**`findRunningPod()`** — skip pods with `deletionTimestamp`:

```typescript
async findRunningPod(sandboxId: string, orgId: string): Promise<string | undefined> {
  const pods = await this.listPods({ orgId, state: EContainerState.Running })
  const match = pods.find(
    (p) => p.metadata?.labels?.[PodLabelKeys.sandboxId] === sandboxId
        && !p.metadata?.deletionTimestamp
  )
  return match?.metadata?.name
}
```

**`findActivePod()`** — skip pods with `deletionTimestamp`:

```typescript
async findActivePod(sandboxId: string, orgId: string): Promise<string | undefined> {
  const pods = await this.listPods({ orgId })
  const match = pods.find((p) => {
    const phase = p.status?.phase
    const id = p.metadata?.labels?.[PodLabelKeys.sandboxId]
    return (
      id === sandboxId &&
      !p.metadata?.deletionTimestamp &&
      (phase === EContainerState.Running || phase === EContainerState.Pending)
    )
  })
  return match?.metadata?.name
}
```

**`getPodState()`** — return `Terminating` when `deletionTimestamp` is set:

```typescript
async getPodState(podName: string): Promise<EContainerState> {
  try {
    const pod = await this.kube.getPod(podName)
    if (pod.metadata?.deletionTimestamp) return EContainerState.Terminating
    return toContainerState(pod.status?.phase)
  } catch (err: any) {
    const code = err?.code ?? err?.statusCode ?? err?.response?.statusCode
    if (code === 404) return EContainerState.Failed
    throw err
  }
}
```

### 4. No Changes Required

- **`connectSandbox.ts`** — existing flow works correctly once queries skip terminating pods
- **`toContainerState()`** — stays as-is; `deletionTimestamp` check happens at call sites with full pod access
- **Frontend (threads SPA)** — `stopSandbox()` awaits the backend response before `openSession()` calls connect; K8s has set `deletionTimestamp` by then
- **`stopSandbox.ts` endpoint** — no changes; the fix is in how the next connect handles the residual pod
- **`onShellConnect.ts`, `onTunnelConnect.ts`, `listSessions.ts`** — all call `findRunningPod()` which now skips terminating pods automatically

## Testing

### Unit Tests

Add tests to existing test files for the `deletionTimestamp` scenarios:

**`repos/sandbox/src/kube/kubeClient.test.ts`:**
- `shouldHydrate` returns `false` for pod with `deletionTimestamp` set (even if phase is Running)
- `shouldRemove` returns `true` for pod with `deletionTimestamp` set
- `hydrateSingle` calls `removeFromCache` for pod with `deletionTimestamp`

**`repos/backend/src/services/sandboxes/sandbox.test.ts`** (new or existing):
- `findRunningPod` skips pod with phase Running + `deletionTimestamp` set
- `findRunningPod` returns pod with phase Running + no `deletionTimestamp`
- `findActivePod` skips pod with phase Running/Pending + `deletionTimestamp` set
- `getPodState` returns `EContainerState.Terminating` when `deletionTimestamp` is set

### Integration Tests

Existing tests in `repos/integration/src/tier3/sandbox-connect.test.ts` cover the connect flow end-to-end. The fix doesn't change the API contract, so they should continue passing without modification.

## Files Changed

| File | Change |
|------|--------|
| `repos/domain/src/types/sandbox.types.ts` | Add `Terminating` to `EContainerState` |
| `repos/sandbox/src/kube/kubeClient.ts` | `shouldHydrate` returns false for `deletionTimestamp`; `shouldRemove` returns true |
| `repos/backend/src/services/sandboxes/sandbox.ts` | `findRunningPod`/`findActivePod` skip terminating pods; `getPodState` returns `Terminating` |
| `repos/sandbox/src/kube/kubeClient.test.ts` | Add `deletionTimestamp` test cases |
| `repos/backend/src/services/sandboxes/sandbox.test.ts` | Add `deletionTimestamp` test cases |
