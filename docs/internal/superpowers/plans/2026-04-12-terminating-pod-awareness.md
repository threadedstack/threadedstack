# Terminating Pod Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the system from connecting to K8s pods that are being terminated by checking `metadata.deletionTimestamp` at every point where pod liveness is evaluated.

**Architecture:** Add `deletionTimestamp` awareness at three layers — domain enum (`EContainerState.Terminating`), kube client route cache (`shouldHydrate`/`shouldRemove`), and backend sandbox service queries (`findRunningPod`/`findActivePod`/`getPodState`). No changes to endpoint handlers or frontend.

**Tech Stack:** TypeScript, Kubernetes client-node, Vitest

**Spec:** `docs/superpowers/specs/2026-04-12-terminating-pod-awareness-design.md`

---

### Task 1: Add `Terminating` to `EContainerState` enum

**Files:**
- Modify: `repos/domain/src/types/sandbox.types.ts:213-219`

- [ ] **Step 1: Add the enum value**

In `repos/domain/src/types/sandbox.types.ts`, add `Terminating` to the `EContainerState` enum:

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

- [ ] **Step 2: Verify type checks pass for domain**

Run: `cd repos/domain && pnpm types`
Expected: Clean exit, no errors. The new enum value is purely additive.

- [ ] **Step 3: Verify sandbox repo still compiles**

Run: `cd repos/sandbox && pnpm types`
Expected: Clean exit. `ContainerStatesSet` in `repos/sandbox/src/constants/kube.ts` is built from `Object.values(EContainerState)` and automatically includes the new value.

---

### Task 2: Add `deletionTimestamp` tests for KubeClient

**Files:**
- Modify: `repos/sandbox/src/kube/kubeClient.test.ts`

- [ ] **Step 1: Add test — `shouldHydrate` rejects pod with `deletionTimestamp` (even if Running)**

Add to the `hydrateSingle` describe block in `repos/sandbox/src/kube/kubeClient.test.ts`:

```typescript
it(`should remove route when Running pod has deletionTimestamp set`, () => {
  const pod = makePod()

  // Pod starts Running — route exists
  client.hydrateSingle(pod as any)
  expect(client.routes[`sb-test1234-abcd`]).toBeDefined()

  // Pod gets deletionTimestamp (K8s delete with grace period) — phase still Running
  const terminatingPod = makePod({
    metadata: { deletionTimestamp: new Date().toISOString() },
  })
  const callback = vi.fn()
  client.onRemoveRoute(callback)

  client.hydrateSingle(terminatingPod as any)

  expect(client.routes[`sb-test1234-abcd`]).toBeUndefined()
  expect(callback).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Add test — `shouldRemove` returns true for pod with `deletionTimestamp`**

Add to the `hydrate — cleanup of failed/succeeded pods` describe block:

```typescript
it(`should delete pods with deletionTimestamp set (terminating)`, async () => {
  const pod = makePod({
    metadata: { deletionTimestamp: new Date().toISOString() },
    status: { phase: EContainerState.Running, podIP: `10.0.0.5` },
  })
  mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [pod] })
  mockCoreApi.deleteNamespacedPod.mockResolvedValue({})

  await client.hydrate()

  expect(mockCoreApi.deleteNamespacedPod).toHaveBeenCalledWith({
    name: `tdsk-sb-test1234-abcd`,
    namespace: `test-ns`,
    gracePeriodSeconds: undefined,
  })
  expect(Object.keys(client.routes)).toHaveLength(0)
})
```

- [ ] **Step 3: Add test — `shouldHydrate` rejects Pending pod with `deletionTimestamp`**

Add to the `hydrateSingle` describe block:

```typescript
it(`should not hydrate Pending pod with deletionTimestamp set`, () => {
  const pod = makePod({
    metadata: { deletionTimestamp: new Date().toISOString() },
    status: { phase: EContainerState.Pending, podIP: `10.0.0.5` },
  })
  const callback = vi.fn()
  client.onRemoveRoute(callback)

  client.hydrateSingle(pod as any)

  expect(Object.keys(client.routes)).toHaveLength(0)
})
```

- [ ] **Step 4: Run tests to verify they FAIL**

Run: `cd repos/sandbox && npx vitest run --config configs/vitest.config.ts src/kube/kubeClient.test.ts`
Expected: The 3 new tests FAIL (current code doesn't check `deletionTimestamp`).

---

### Task 3: Implement `deletionTimestamp` checks in KubeClient

**Files:**
- Modify: `repos/sandbox/src/kube/kubeClient.ts:314-322`

- [ ] **Step 1: Update `shouldHydrate` to reject pods with `deletionTimestamp`**

In `repos/sandbox/src/kube/kubeClient.ts`, replace `shouldHydrate` (lines 314-317):

```typescript
private shouldHydrate(pod: k8s.V1Pod): boolean {
  if (pod.metadata?.deletionTimestamp) return false
  const phase = pod.status?.phase
  return phase === EContainerState.Running || phase === EContainerState.Pending
}
```

- [ ] **Step 2: Update `shouldRemove` to remove pods with `deletionTimestamp`**

Replace `shouldRemove` (lines 319-322):

```typescript
private shouldRemove(pod: k8s.V1Pod): boolean {
  if (pod.metadata?.deletionTimestamp) return true
  const phase = pod.status?.phase
  return phase === EContainerState.Failed || phase === EContainerState.Succeeded
}
```

- [ ] **Step 3: Run KubeClient tests to verify all pass**

Run: `cd repos/sandbox && npx vitest run --config configs/vitest.config.ts src/kube/kubeClient.test.ts`
Expected: ALL tests pass, including the 3 new ones from Task 2.

- [ ] **Step 4: Run full sandbox test suite**

Run: `cd repos/sandbox && pnpm test`
Expected: All 57+ tests pass.

---

### Task 4: Add `deletionTimestamp` tests for SandboxService

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandbox.test.ts`

- [ ] **Step 1: Add test — `findRunningPod` skips pod with `deletionTimestamp`**

Add a new describe block `findRunningPod` in `repos/backend/src/services/sandboxes/sandbox.test.ts`:

```typescript
describe(`findRunningPod`, () => {
  it(`should return podName for Running pod without deletionTimestamp`, async () => {
    kube.listPods.mockResolvedValue([
      {
        metadata: {
          name: `tdsk-sb-test-aaaa`,
          labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
        },
        status: { phase: `Running` },
      },
    ])

    const result = await svc.findRunningPod(`sb-1`, `org-1`)

    expect(result).toBe(`tdsk-sb-test-aaaa`)
  })

  it(`should skip Running pod with deletionTimestamp set`, async () => {
    kube.listPods.mockResolvedValue([
      {
        metadata: {
          name: `tdsk-sb-test-aaaa`,
          labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
          deletionTimestamp: new Date().toISOString(),
        },
        status: { phase: `Running` },
      },
    ])

    const result = await svc.findRunningPod(`sb-1`, `org-1`)

    expect(result).toBeUndefined()
  })

  it(`should return non-terminating pod when both exist for same sandboxId`, async () => {
    kube.listPods.mockResolvedValue([
      {
        metadata: {
          name: `tdsk-sb-test-old1`,
          labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
          deletionTimestamp: new Date().toISOString(),
        },
        status: { phase: `Running` },
      },
      {
        metadata: {
          name: `tdsk-sb-test-new1`,
          labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
        },
        status: { phase: `Running` },
      },
    ])

    const result = await svc.findRunningPod(`sb-1`, `org-1`)

    expect(result).toBe(`tdsk-sb-test-new1`)
  })
})
```

- [ ] **Step 2: Add test — `findActivePod` skips pod with `deletionTimestamp`**

Add a new describe block `findActivePod`:

```typescript
describe(`findActivePod`, () => {
  it(`should return podName for Pending pod without deletionTimestamp`, async () => {
    kube.listPods.mockResolvedValue([
      {
        metadata: {
          name: `tdsk-sb-test-aaaa`,
          labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
        },
        status: { phase: `Pending` },
      },
    ])

    const result = await svc.findActivePod(`sb-1`, `org-1`)

    expect(result).toBe(`tdsk-sb-test-aaaa`)
  })

  it(`should skip Running pod with deletionTimestamp set`, async () => {
    kube.listPods.mockResolvedValue([
      {
        metadata: {
          name: `tdsk-sb-test-aaaa`,
          labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
          deletionTimestamp: new Date().toISOString(),
        },
        status: { phase: `Running` },
      },
    ])

    const result = await svc.findActivePod(`sb-1`, `org-1`)

    expect(result).toBeUndefined()
  })

  it(`should skip Pending pod with deletionTimestamp set`, async () => {
    kube.listPods.mockResolvedValue([
      {
        metadata: {
          name: `tdsk-sb-test-aaaa`,
          labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
          deletionTimestamp: new Date().toISOString(),
        },
        status: { phase: `Pending` },
      },
    ])

    const result = await svc.findActivePod(`sb-1`, `org-1`)

    expect(result).toBeUndefined()
  })
})
```

- [ ] **Step 3: Add test — `getPodState` returns `Terminating` when `deletionTimestamp` is set**

Add to the existing `getPodState` describe block:

```typescript
it(`should return Terminating when pod has deletionTimestamp set`, async () => {
  kube.getPod.mockResolvedValue({
    metadata: { deletionTimestamp: new Date().toISOString() },
    status: { phase: `Running` },
  })

  const result = await svc.getPodState(`pod-a`)

  expect(result).toBe(EContainerState.Terminating)
  expect(mockToContainerState).not.toHaveBeenCalled()
})
```

- [ ] **Step 4: Run tests to verify they FAIL**

Run: `cd repos/backend && npx vitest run --config configs/vitest.config.ts src/services/sandboxes/sandbox.test.ts`
Expected: The 7 new tests FAIL (current code doesn't check `deletionTimestamp`).

---

### Task 5: Implement `deletionTimestamp` checks in SandboxService

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts:333-352,445-455`

- [ ] **Step 1: Update `findRunningPod` to skip terminating pods**

In `repos/backend/src/services/sandboxes/sandbox.ts`, replace `findRunningPod` (lines 333-339):

```typescript
async findRunningPod(sandboxId: string, orgId: string): Promise<string | undefined> {
  const pods = await this.listPods({ orgId, state: EContainerState.Running })
  const match = pods.find(
    (p) =>
      p.metadata?.labels?.[PodLabelKeys.sandboxId] === sandboxId &&
      !p.metadata?.deletionTimestamp
  )
  return match?.metadata?.name
}
```

- [ ] **Step 2: Update `findActivePod` to skip terminating pods**

Replace `findActivePod` (lines 341-352):

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

- [ ] **Step 3: Update `getPodState` to return `Terminating`**

Replace `getPodState` (lines 445-455):

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

- [ ] **Step 4: Run SandboxService tests to verify all pass**

Run: `cd repos/backend && npx vitest run --config configs/vitest.config.ts src/services/sandboxes/sandbox.test.ts`
Expected: ALL tests pass, including the 7 new ones from Task 4.

- [ ] **Step 5: Run full backend test suite**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass.

---

### Task 6: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run type checks across all affected repos**

Run: `cd repos/domain && pnpm types && cd ../sandbox && pnpm types && cd ../backend && pnpm types`
Expected: All three repos pass type checks with zero errors.

- [ ] **Step 2: Run full sandbox test suite**

Run: `cd repos/sandbox && pnpm test`
Expected: All tests pass (57+ existing + 3 new).

- [ ] **Step 3: Run full backend test suite**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass (existing + 7 new).

- [ ] **Step 4: Verify no regressions in other repos that import EContainerState**

Run: `pnpm types` (root — runs type checks across all repos)
Expected: All repos pass. The new `Terminating` enum value is additive and doesn't break existing switch/if statements (they use explicit value checks, not exhaustive switches).
