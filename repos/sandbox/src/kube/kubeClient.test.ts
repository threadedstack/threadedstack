import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EContainerState, EProto } from '@tdsk/domain'
import {
  PodLabelKeys,
  PodAnnotationKeys,
  PodManagedSelector,
  PodCycleInterval,
} from '@TSB/constants/kube'

const mockCoreApi = {
  createNamespacedPod: vi.fn(),
  readNamespacedPod: vi.fn(),
  listNamespacedPod: vi.fn(),
  deleteNamespacedPod: vi.fn(),
  createNamespacedSecret: vi.fn(),
  patchNamespacedSecret: vi.fn(),
  deleteNamespacedSecret: vi.fn(),
  readNamespacedPodLog: vi.fn(),
  listNamespacedResourceQuota: vi.fn(),
}

const mockAppsApi = {
  readNamespacedDeployment: vi.fn(),
  patchNamespacedDeployment: vi.fn(),
  listNamespacedReplicaSet: vi.fn(),
}

const mockWatcher = {
  watch: vi.fn(),
}

const mockExecWs = {
  on: vi.fn(),
  close: vi.fn(),
  send: vi.fn(),
}

let capturedStatusCallback: ((status: any) => void) | null = null

const mockExec = {
  exec: vi.fn(
    (
      _ns: string,
      _pod: string,
      _container: string,
      _cmd: string[],
      _stdout: any,
      _stderr: any,
      _stdin: any,
      _tty: boolean,
      statusCb?: (status: any) => void
    ) => {
      capturedStatusCallback = statusCb ?? null
      return Promise.resolve(mockExecWs)
    }
  ),
}

// Track which API class is being constructed so we can route makeApiClient
// to the right mock. The constructor calls makeApiClient(CoreV1Api) first
// then makeApiClient(AppsV1Api). We use a call counter to distinguish.
let makeApiClientCallCount = 0

const mockKc = {
  loadFromCluster: vi.fn(),
  loadFromDefault: vi.fn(),
  makeApiClient: vi.fn(() => {
    makeApiClientCallCount++
    // First call = CoreV1Api, second call = AppsV1Api
    if (makeApiClientCallCount % 2 === 0) return mockAppsApi
    return mockCoreApi
  }),
}

vi.mock(`@kubernetes/client-node`, () => ({
  KubeConfig: vi.fn(() => mockKc),
  CoreV1Api: vi.fn(),
  AppsV1Api: vi.fn(),
  Watch: vi.fn(() => mockWatcher),
  Exec: vi.fn(() => mockExec),
}))

vi.mock(`@TSB/kube/getKubeNS`, () => ({
  getKubeNS: vi.fn(() => `test-ns`),
}))

vi.mock(`@TSB/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { KubeClient } from './kubeClient'
import { logger } from '@TSB/utils/logger'

const makePod = (overrides: Record<string, any> = {}) => ({
  metadata: {
    name: `tdsk-sb-test1234-abcd`,
    labels: {
      [PodLabelKeys.managed]: `true`,
      [PodLabelKeys.orgId]: `org-1`,
      [PodLabelKeys.userId]: `user-1`,
      [PodLabelKeys.sandboxId]: `sandbox-1`,
      [PodLabelKeys.projectId]: `proj-1`,
      ...overrides.labels,
    },
    annotations: {
      [PodAnnotationKeys.subdomain]: `sb-test1234-abcd`,
      [PodAnnotationKeys.ports]: JSON.stringify({ '3000': { protocol: `http` } }),
      [PodAnnotationKeys.placeholders]: JSON.stringify({
        tdsk_ph_abc: { secretId: `secret-1` },
      }),
      ...overrides.annotations,
    },
    ...overrides.metadata,
  },
  status: {
    phase: EContainerState.Running,
    podIP: `10.0.0.5`,
    ...overrides.status,
  },
  ...overrides.pod,
})

describe(`KubeClient`, () => {
  let client: KubeClient

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    makeApiClientCallCount = 0
    client = new KubeClient()
  })

  // --- hydrate: route map construction ---

  describe(`hydrate — route map construction`, () => {
    it(`should build route map from running pods with valid annotations`, async () => {
      const pod = makePod()
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [pod] })

      const routes = await client.hydrate()

      expect(routes[`sb-test1234-abcd`]).toBeDefined()
      expect(routes[`sb-test1234-abcd`].meta).toEqual({
        podIp: `10.0.0.5`,
        podName: `tdsk-sb-test1234-abcd`,
        sandboxId: `sandbox-1`,
        state: EContainerState.Running,
      })
      expect(routes[`sb-test1234-abcd`].ports[`3000`]).toEqual({
        host: `10.0.0.5`,
        port: 3000,
        protocol: EProto.http,
      })
      expect(routes[`sb-test1234-abcd`].placeholders).toEqual({
        tdsk_ph_abc: { secretId: `secret-1` },
      })
    })

    it(`should skip pods without subdomain annotation`, async () => {
      const pod = makePod({
        annotations: {
          [PodAnnotationKeys.subdomain]: undefined,
          [PodAnnotationKeys.ports]: JSON.stringify({}),
          [PodAnnotationKeys.placeholders]: JSON.stringify({}),
        },
      })
      // Remove the subdomain key entirely
      delete pod.metadata.annotations[PodAnnotationKeys.subdomain]
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [pod] })

      const routes = await client.hydrate()

      expect(Object.keys(routes)).toHaveLength(0)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`missing subdomain annotation`)
      )
    })

    it(`should skip pods without podIP`, async () => {
      const pod = makePod({
        status: { phase: EContainerState.Pending, podIP: undefined },
      })
      delete pod.status.podIP
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [pod] })

      const routes = await client.hydrate()

      expect(Object.keys(routes)).toHaveLength(0)
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`has no IP yet`))
    })

    it(`should handle pods with multiple port entries`, async () => {
      const pod = makePod({
        annotations: {
          [PodAnnotationKeys.subdomain]: `sb-multi-port`,
          [PodAnnotationKeys.ports]: JSON.stringify({
            '3000': { protocol: `http` },
            '8443': { protocol: `https` },
          }),
          [PodAnnotationKeys.placeholders]: JSON.stringify({}),
        },
      })
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [pod] })

      const routes = await client.hydrate()

      expect(routes[`sb-multi-port`].ports[`3000`]).toEqual({
        host: `10.0.0.5`,
        port: 3000,
        protocol: EProto.http,
      })
      expect(routes[`sb-multi-port`].ports[`8443`]).toEqual({
        host: `10.0.0.5`,
        port: 8443,
        protocol: EProto.https,
      })
    })

    it(`should parse placeholders annotation into route entry`, async () => {
      const placeholders = {
        tdsk_ph_key1: { secretId: `secret-a` },
        tdsk_ph_key2: { secretId: `secret-b` },
      }
      const pod = makePod({
        annotations: {
          [PodAnnotationKeys.subdomain]: `sb-placeholders`,
          [PodAnnotationKeys.ports]: JSON.stringify({ '3000': { protocol: `http` } }),
          [PodAnnotationKeys.placeholders]: JSON.stringify(placeholders),
        },
      })
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [pod] })

      const routes = await client.hydrate()

      expect(routes[`sb-placeholders`].placeholders).toEqual(placeholders)
    })

    it(`should handle malformed annotation JSON`, async () => {
      const pod = makePod({
        annotations: {
          [PodAnnotationKeys.subdomain]: `sb-bad-json`,
          [PodAnnotationKeys.ports]: `{not valid json`,
          [PodAnnotationKeys.placeholders]: JSON.stringify({}),
        },
      })
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [pod] })

      const routes = await client.hydrate()

      expect(Object.keys(routes)).toHaveLength(0)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Malformed annotation JSON`),
        expect.any(String)
      )
    })

    it(`should clear existing routes before rebuilding`, async () => {
      const pod1 = makePod()
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [pod1] })

      await client.hydrate()
      expect(Object.keys(client.routes)).toHaveLength(1)

      const pod2 = makePod({
        metadata: { name: `tdsk-sb-other-9999` },
        annotations: {
          [PodAnnotationKeys.subdomain]: `sb-other-9999`,
          [PodAnnotationKeys.ports]: JSON.stringify({ '4000': { protocol: `http` } }),
          [PodAnnotationKeys.placeholders]: JSON.stringify({}),
        },
        labels: {
          [PodLabelKeys.sandboxId]: `sandbox-2`,
        },
      })
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [pod2] })

      await client.hydrate()

      expect(client.routes[`sb-test1234-abcd`]).toBeUndefined()
      expect(client.routes[`sb-other-9999`]).toBeDefined()
      expect(Object.keys(client.routes)).toHaveLength(1)
    })
  })

  // --- hydrate: cleanup of failed/succeeded pods ---

  describe(`hydrate — cleanup of failed/succeeded pods`, () => {
    it(`should delete pods in Failed state`, async () => {
      const pod = makePod({
        status: { phase: EContainerState.Failed, podIP: `10.0.0.6` },
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

    it(`should delete pods in Succeeded state`, async () => {
      const pod = makePod({
        status: { phase: EContainerState.Succeeded, podIP: `10.0.0.7` },
      })
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [pod] })
      mockCoreApi.deleteNamespacedPod.mockResolvedValue({})

      await client.hydrate()

      expect(mockCoreApi.deleteNamespacedPod).toHaveBeenCalledWith({
        name: `tdsk-sb-test1234-abcd`,
        namespace: `test-ns`,
        gracePeriodSeconds: undefined,
      })
    })

    it(`should log warning when cleanup deletion fails but continue`, async () => {
      const failedPod = makePod({
        metadata: { name: `tdsk-sb-fail-aaaa` },
        status: { phase: EContainerState.Failed, podIP: `10.0.0.8` },
      })
      const runningPod = makePod({
        metadata: { name: `tdsk-sb-good-bbbb` },
        annotations: {
          [PodAnnotationKeys.subdomain]: `sb-good-bbbb`,
          [PodAnnotationKeys.ports]: JSON.stringify({ '3000': { protocol: `http` } }),
          [PodAnnotationKeys.placeholders]: JSON.stringify({}),
        },
        labels: { [PodLabelKeys.sandboxId]: `sandbox-good` },
        status: { phase: EContainerState.Running, podIP: `10.0.0.9` },
      })
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [failedPod, runningPod] })
      mockCoreApi.deleteNamespacedPod.mockRejectedValue(new Error(`not found`))

      const routes = await client.hydrate()

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to clean up pod`),
        `tdsk-sb-fail-aaaa`,
        `not found`
      )
      expect(routes[`sb-good-bbbb`]).toBeDefined()
    })

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

    it(`should NOT delete Running or Pending pods`, async () => {
      const runningPod = makePod({
        status: { phase: EContainerState.Running, podIP: `10.0.0.10` },
      })
      const pendingPod = makePod({
        metadata: { name: `tdsk-sb-pending-cccc` },
        annotations: {
          [PodAnnotationKeys.subdomain]: `sb-pending-cccc`,
          [PodAnnotationKeys.ports]: JSON.stringify({}),
          [PodAnnotationKeys.placeholders]: JSON.stringify({}),
        },
        labels: { [PodLabelKeys.sandboxId]: `sandbox-pending` },
        status: { phase: EContainerState.Pending, podIP: undefined },
      })
      delete pendingPod.status.podIP
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [runningPod, pendingPod] })

      await client.hydrate()

      expect(mockCoreApi.deleteNamespacedPod).not.toHaveBeenCalled()
    })
  })

  // --- hydrateSingle ---

  describe(`hydrateSingle`, () => {
    it(`should add single pod to route map with correct structure`, () => {
      const pod = makePod()

      client.hydrateSingle(pod as any)

      const entry = client.routes[`sb-test1234-abcd`]
      expect(entry).toBeDefined()
      expect(entry.meta).toEqual({
        podIp: `10.0.0.5`,
        podName: `tdsk-sb-test1234-abcd`,
        sandboxId: `sandbox-1`,
        state: EContainerState.Running,
      })
      expect(entry.ports[`3000`]).toEqual({
        host: `10.0.0.5`,
        port: 3000,
        protocol: EProto.http,
      })
      expect(entry.placeholders).toEqual({ tdsk_ph_abc: { secretId: `secret-1` } })
    })

    it(`should set meta.state from pod.status.phase via toContainerState`, () => {
      const pendingPod = makePod({
        status: { phase: EContainerState.Pending, podIP: `10.0.0.11` },
      })

      client.hydrateSingle(pendingPod as any)

      expect(client.routes[`sb-test1234-abcd`].meta.state).toBe(EContainerState.Pending)
    })

    it(`should use default protocol http when port config has no protocol`, () => {
      const pod = makePod({
        annotations: {
          [PodAnnotationKeys.subdomain]: `sb-no-proto`,
          [PodAnnotationKeys.ports]: JSON.stringify({ '5000': {} }),
          [PodAnnotationKeys.placeholders]: JSON.stringify({}),
        },
      })

      client.hydrateSingle(pod as any)

      expect(client.routes[`sb-no-proto`].ports[`5000`].protocol).toBe(EProto.http)
    })

    it(`should skip pod missing name`, () => {
      const pod = makePod()
      delete pod.metadata.name
      pod.metadata = { ...pod.metadata, name: undefined as any }

      client.hydrateSingle(pod as any)

      expect(Object.keys(client.routes)).toHaveLength(0)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`missing name or sandboxId`)
      )
    })

    it(`should skip pod missing sandboxId label`, () => {
      const pod = makePod()
      delete pod.metadata.labels[PodLabelKeys.sandboxId]

      client.hydrateSingle(pod as any)

      expect(Object.keys(client.routes)).toHaveLength(0)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`missing name or sandboxId`)
      )
    })

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

    it(`should not hydrate Pending pod with deletionTimestamp set`, () => {
      const pod = makePod({
        metadata: { deletionTimestamp: new Date().toISOString() },
        status: { phase: EContainerState.Pending, podIP: `10.0.0.5` },
      })
      const callback = vi.fn()
      client.onRemoveRoute(callback)

      client.hydrateSingle(pod as any)

      expect(Object.keys(client.routes)).toHaveLength(0)
      expect(callback).not.toHaveBeenCalled()
    })
  })

  // --- hydrateSingle — terminal phase cleanup ---

  describe(`hydrateSingle — terminal phase cleanup`, () => {
    it(`should remove route when pod transitions to Failed`, () => {
      const pod = makePod()

      // Pod starts Running — route exists
      client.hydrateSingle(pod as any)
      expect(client.routes[`sb-test1234-abcd`]).toBeDefined()

      // Pod transitions to Failed — route should be removed
      const failedPod = makePod({
        status: { phase: EContainerState.Failed, podIP: `10.0.0.5` },
      })
      const callback = vi.fn()
      client.onRemoveRoute(callback)

      client.hydrateSingle(failedPod as any)

      expect(client.routes[`sb-test1234-abcd`]).toBeUndefined()
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ sandboxId: `sandbox-1` }),
        })
      )
    })

    it(`should remove route when pod transitions to Succeeded`, () => {
      const pod = makePod()
      client.hydrateSingle(pod as any)
      expect(client.routes[`sb-test1234-abcd`]).toBeDefined()

      const succeededPod = makePod({
        status: { phase: EContainerState.Succeeded, podIP: `10.0.0.5` },
      })

      client.hydrateSingle(succeededPod as any)

      expect(client.routes[`sb-test1234-abcd`]).toBeUndefined()
    })

    it(`should be no-op for Failed pod with no existing route`, () => {
      const failedPod = makePod({
        status: { phase: EContainerState.Failed, podIP: `10.0.0.5` },
      })
      const callback = vi.fn()
      client.onRemoveRoute(callback)

      client.hydrateSingle(failedPod as any)

      expect(Object.keys(client.routes)).toHaveLength(0)
      expect(callback).not.toHaveBeenCalled()
    })

    it(`should not remove route for Running or Pending pods`, () => {
      const pod = makePod()
      client.hydrateSingle(pod as any)
      expect(client.routes[`sb-test1234-abcd`]).toBeDefined()

      // Modified event with same Running phase — route stays
      const stillRunning = makePod({
        status: { phase: EContainerState.Running, podIP: `10.0.0.5` },
      })
      client.hydrateSingle(stillRunning as any)
      expect(client.routes[`sb-test1234-abcd`]).toBeDefined()
    })
  })

  // --- Full lifecycle: hydrate → transition → cleanup ---

  describe(`full lifecycle — route cleanup on pod death`, () => {
    it(`route is added on Running, removed on Failed, callback fires`, () => {
      const callback = vi.fn()
      client.onRemoveRoute(callback)

      // 1. Pod starts Running — watch "added" event
      const pod = makePod()
      client.hydrateSingle(pod as any)
      expect(client.routes[`sb-test1234-abcd`]).toBeDefined()
      expect(callback).not.toHaveBeenCalled()

      // 2. Pod transitions to Failed — watch "modified" event
      const failedPod = makePod({
        status: { phase: EContainerState.Failed, podIP: `10.0.0.5` },
      })
      client.hydrateSingle(failedPod as any)
      expect(client.routes[`sb-test1234-abcd`]).toBeUndefined()
      expect(callback).toHaveBeenCalledTimes(1)

      // 3. Pod deleted — watch "deleted" event (no-op, already cleaned)
      client.removeFromCache(pod as any)
      expect(callback).toHaveBeenCalledTimes(1) // not called again
    })

    it(`multiple pods: only terminal pod route is removed`, () => {
      const pod1 = makePod()
      const pod2 = makePod({
        metadata: { name: `tdsk-sb-other-0000` },
        annotations: {
          [PodAnnotationKeys.subdomain]: `sb-other-0000`,
          [PodAnnotationKeys.ports]: JSON.stringify({ '8080': { protocol: `http` } }),
          [PodAnnotationKeys.placeholders]: JSON.stringify({}),
        },
        labels: { [PodLabelKeys.sandboxId]: `sandbox-2` },
        status: { phase: EContainerState.Running, podIP: `10.0.0.20` },
      })

      client.hydrateSingle(pod1 as any)
      client.hydrateSingle(pod2 as any)
      expect(Object.keys(client.routes)).toHaveLength(2)

      // pod1 fails — only pod1's route removed
      const failedPod1 = makePod({
        status: { phase: EContainerState.Failed, podIP: `10.0.0.5` },
      })
      client.hydrateSingle(failedPod1 as any)

      expect(client.routes[`sb-test1234-abcd`]).toBeUndefined()
      expect(client.routes[`sb-other-0000`]).toBeDefined()
    })
  })

  // --- removeFromCache ---

  describe(`removeFromCache`, () => {
    it(`should remove route by subdomain and call onRouteRemoved callback`, () => {
      const pod = makePod()
      client.hydrateSingle(pod as any)
      expect(client.routes[`sb-test1234-abcd`]).toBeDefined()

      const callback = vi.fn()
      client.onRemoveRoute(callback)

      client.removeFromCache(pod as any)

      expect(client.routes[`sb-test1234-abcd`]).toBeUndefined()
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ sandboxId: `sandbox-1` }),
        })
      )
    })

    it(`should be no-op when subdomain not in routes`, () => {
      const pod = makePod({
        annotations: {
          [PodAnnotationKeys.subdomain]: `sb-nonexistent`,
          [PodAnnotationKeys.ports]: JSON.stringify({}),
          [PodAnnotationKeys.placeholders]: JSON.stringify({}),
        },
      })

      const callback = vi.fn()
      client.onRemoveRoute(callback)

      client.removeFromCache(pod as any)

      expect(callback).not.toHaveBeenCalled()
    })

    it(`should be no-op when pod has no subdomain annotation`, () => {
      const pod = makePod()
      delete pod.metadata.annotations[PodAnnotationKeys.subdomain]

      const callback = vi.fn()
      client.onRemoveRoute(callback)

      client.removeFromCache(pod as any)

      expect(callback).not.toHaveBeenCalled()
    })
  })

  // --- watch / cycleListen / cleanup ---

  describe(`watch / cycleListen / cleanup`, () => {
    it(`should call watcher.watch with correct path and label selector`, async () => {
      mockWatcher.watch.mockResolvedValue(undefined)

      const events = { added: vi.fn() }
      await client.watch(events)

      expect(mockWatcher.watch).toHaveBeenCalledWith(
        `/api/v1/namespaces/test-ns/pods`,
        { labelSelector: PodManagedSelector },
        expect.any(Function),
        expect.any(Function)
      )
    })

    it(`should invoke event handlers for pod events`, async () => {
      let watchCallback: (type: string, pod: any) => void = () => {}
      mockWatcher.watch.mockImplementation(
        async (_path: string, _opts: any, cb: any, _errCb: any) => {
          watchCallback = cb
        }
      )

      const events = {
        added: vi.fn(),
        modified: vi.fn(),
        deleted: vi.fn(),
      }
      await client.watch(events)

      const pod = makePod()
      watchCallback(`ADDED`, pod)
      watchCallback(`MODIFIED`, pod)
      watchCallback(`DELETED`, pod)

      expect(events.added).toHaveBeenCalledWith(pod)
      expect(events.modified).toHaveBeenCalledWith(pod)
      expect(events.deleted).toHaveBeenCalledWith(pod)
    })

    it(`should invoke error callback when watch error handler fires`, async () => {
      let errorCallback: (err?: any) => void = () => {}
      mockWatcher.watch.mockImplementation(
        async (_path: string, _opts: any, _cb: any, errCb: any) => {
          errorCallback = errCb
        }
      )

      const events = { error: vi.fn() }
      await client.watch(events)

      const err = new Error(`connection lost`)
      errorCallback(err)

      expect(events.error).toHaveBeenCalledWith(err)
    })

    it(`should log error when no error handler provided and watch errors`, async () => {
      let errorCallback: (err?: any) => void = () => {}
      mockWatcher.watch.mockImplementation(
        async (_path: string, _opts: any, _cb: any, errCb: any) => {
          errorCallback = errCb
        }
      )

      await client.watch({})

      errorCallback(new Error(`watch failed`))

      expect(logger.error).toHaveBeenCalledWith(`watch failed`)
    })

    it(`should create synthetic error when watch error callback fires with no error`, async () => {
      let errorCallback: (err?: any) => void = () => {}
      mockWatcher.watch.mockImplementation(
        async (_path: string, _opts: any, _cb: any, errCb: any) => {
          errorCallback = errCb
        }
      )

      const events = { error: vi.fn() }
      await client.watch(events)

      errorCallback(undefined)

      expect(events.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Kubernetes Watch listener failed without error`,
        })
      )
    })

    it(`should restart watch on interval via cycleListen`, async () => {
      mockWatcher.watch.mockResolvedValue(undefined)

      const events = { added: vi.fn(), error: vi.fn() }
      client.cycleListen(events, 5000)

      // Initial watch call from the first restart()
      await vi.advanceTimersByTimeAsync(0)
      expect(mockWatcher.watch).toHaveBeenCalledTimes(1)

      // Advance by the interval to trigger next restart
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockWatcher.watch).toHaveBeenCalledTimes(2)

      // Another interval
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockWatcher.watch).toHaveBeenCalledTimes(3)

      client.cleanup()
    })

    it(`should clear interval and abort watch on cleanup`, async () => {
      mockWatcher.watch.mockResolvedValue(undefined)

      const events = { added: vi.fn(), error: vi.fn() }
      client.cycleListen(events, 5000)

      await vi.advanceTimersByTimeAsync(0)
      expect(mockWatcher.watch).toHaveBeenCalledTimes(1)

      client.cleanup()

      // After cleanup, no more intervals should fire
      await vi.advanceTimersByTimeAsync(15000)
      expect(mockWatcher.watch).toHaveBeenCalledTimes(1)
    })

    it(`should stop watch without clearing cycle timer via stopWatch`, async () => {
      mockWatcher.watch.mockResolvedValue(undefined)

      await client.watch({ added: vi.fn() })
      client.stopWatch()

      // stopWatch only aborts the current watch, does not clear cycleTimer
      // No error should be thrown
      expect(mockWatcher.watch).toHaveBeenCalledTimes(1)
    })
  })

  // --- constructor ---

  describe(`constructor`, () => {
    it(`should try loadFromCluster first, fall back to loadFromDefault on failure`, () => {
      vi.clearAllMocks()
      mockKc.loadFromCluster.mockImplementation(() => {
        throw new Error(`not in cluster`)
      })

      new KubeClient()

      expect(mockKc.loadFromCluster).toHaveBeenCalled()
      expect(mockKc.loadFromDefault).toHaveBeenCalled()
    })

    it(`should skip loadFromCluster when inCluster is false`, () => {
      vi.clearAllMocks()

      new KubeClient({ inCluster: false })

      expect(mockKc.loadFromCluster).not.toHaveBeenCalled()
      expect(mockKc.loadFromDefault).toHaveBeenCalled()
    })

    it(`should use loadFromCluster when inCluster is not false`, () => {
      vi.clearAllMocks()
      mockKc.loadFromCluster.mockImplementation(() => {})

      new KubeClient()

      expect(mockKc.loadFromCluster).toHaveBeenCalled()
      expect(mockKc.loadFromDefault).not.toHaveBeenCalled()
    })
  })

  // --- routes getter ---

  describe(`routes getter`, () => {
    it(`should return current route map`, () => {
      const pod = makePod()
      client.hydrateSingle(pod as any)

      const routes = client.routes
      expect(routes[`sb-test1234-abcd`]).toBeDefined()
      expect(routes[`sb-test1234-abcd`].meta.sandboxId).toBe(`sandbox-1`)
    })
  })

  // --- execStream ---

  describe(`execStream`, () => {
    beforeEach(() => {
      mockExecWs.on.mockReset()
      mockExecWs.close.mockReset()
      mockExecWs.send.mockReset()
      mockExec.exec.mockClear()
      capturedStatusCallback = null
      mockExec.exec.mockImplementation(
        (_ns, _pod, _container, _cmd, _stdout, _stderr, _stdin, _tty, statusCb) => {
          capturedStatusCallback = statusCb ?? null
          return Promise.resolve(mockExecWs)
        }
      )
    })

    it(`should call kubeExec.exec with correct namespace, pod, container, and command`, async () => {
      await client.execStream(`my-pod`, [`bash`, `-l`])

      expect(mockExec.exec).toHaveBeenCalledWith(
        `test-ns`,
        `my-pod`,
        `sandbox`,
        [`bash`, `-l`],
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        false,
        expect.any(Function)
      )
    })

    it(`should pass tty flag to exec`, async () => {
      await client.execStream(`my-pod`, [`bash`], { tty: true, cols: 120, rows: 40 })

      const call = mockExec.exec.mock.calls[0]
      expect(call[7]).toBe(true)
    })

    it(`should return stdin, stdout, stderr, close, and resize`, async () => {
      const result = await client.execStream(`my-pod`, [`bash`])

      expect(result.stdin).toBeDefined()
      expect(result.stdout).toBeDefined()
      expect(result.stderr).toBeDefined()
      expect(typeof result.close).toBe(`function`)
      expect(typeof result.resize).toBe(`function`)
    })

    it(`should create ResizablePassThrough stdout with columns/rows when tty is true`, async () => {
      const result = await client.execStream(`my-pod`, [`bash`], {
        tty: true,
        cols: 120,
        rows: 40,
      })

      expect((result.stdout as any).columns).toBe(120)
      expect((result.stdout as any).rows).toBe(40)
    })

    it(`should default to 80x24 when tty is true but cols/rows omitted`, async () => {
      const result = await client.execStream(`my-pod`, [`bash`], { tty: true })

      expect((result.stdout as any).columns).toBe(80)
      expect((result.stdout as any).rows).toBe(24)
    })

    it(`should create plain PassThrough stdout without columns/rows when tty is false`, async () => {
      const result = await client.execStream(`my-pod`, [`bash`])

      expect((result.stdout as any).columns).toBeUndefined()
      expect((result.stdout as any).rows).toBeUndefined()
    })

    it(`resize should update columns/rows, emit resize event, and send control frame when tty is true`, async () => {
      const result = await client.execStream(`my-pod`, [`bash`], {
        tty: true,
        cols: 80,
        rows: 24,
      })

      const resizeHandler = vi.fn()
      result.stdout.on(`resize`, resizeHandler)

      result.resize(200, 50)

      expect((result.stdout as any).columns).toBe(200)
      expect((result.stdout as any).rows).toBe(50)
      expect(resizeHandler).toHaveBeenCalledOnce()

      expect(mockExecWs.send).toHaveBeenCalledOnce()
      const frame = mockExecWs.send.mock.calls[0][0] as Buffer
      expect(frame[0]).toBe(4)
      const payload = JSON.parse(frame.subarray(1).toString())
      expect(payload).toEqual({ Width: 200, Height: 50 })
    })

    it(`resize should log warning when execWs.send throws`, async () => {
      mockExecWs.send.mockImplementation(() => {
        throw new Error(`ws closed`)
      })
      const result = await client.execStream(`my-pod`, [`bash`], {
        tty: true,
        cols: 80,
        rows: 24,
      })

      result.resize(200, 50)

      expect((result.stdout as any).columns).toBe(200)
      expect((result.stdout as any).rows).toBe(50)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Resize failed`),
        `ws closed`
      )
    })

    it(`resize should be a no-op when tty is false`, async () => {
      const result = await client.execStream(`my-pod`, [`bash`])

      const resizeHandler = vi.fn()
      result.stdout.on(`resize`, resizeHandler)

      result.resize(200, 50)

      expect(resizeHandler).not.toHaveBeenCalled()
      expect((result.stdout as any).columns).toBeUndefined()
      expect(mockExecWs.send).not.toHaveBeenCalled()
    })

    it(`close should end stdin and close the exec WebSocket`, async () => {
      const result = await client.execStream(`my-pod`, [`bash`])

      const stdinEndSpy = vi.spyOn(result.stdin, `end`)
      result.close()

      expect(stdinEndSpy).toHaveBeenCalled()
      expect(mockExecWs.close).toHaveBeenCalled()
    })

    it(`close should log warning when execWs.close throws`, async () => {
      mockExecWs.close.mockImplementation(() => {
        throw new Error(`already closed`)
      })
      const result = await client.execStream(`my-pod`, [`bash`])

      result.close()

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`execWs.close()`),
        `already closed`
      )
    })

    it(`status callback should end stdout and stderr`, async () => {
      const result = await client.execStream(`my-pod`, [`bash`])

      const stdoutEndSpy = vi.spyOn(result.stdout, `end`)
      const stderrEndSpy = vi.spyOn(result.stderr, `end`)

      expect(capturedStatusCallback).toBeDefined()
      capturedStatusCallback!({ status: `Success` })

      expect(stdoutEndSpy).toHaveBeenCalled()
      expect(stderrEndSpy).toHaveBeenCalled()
    })

    it(`execWs error handler should destroy stdout and stderr with the error`, async () => {
      let errorHandler: (err: Error) => void = () => {}
      mockExecWs.on.mockImplementation((event: string, handler: any) => {
        if (event === `error`) errorHandler = handler
      })

      const result = await client.execStream(`my-pod`, [`bash`])

      result.stdout.on(`error`, () => {})
      result.stderr.on(`error`, () => {})

      const stdoutDestroySpy = vi.spyOn(result.stdout, `destroy`)
      const stderrDestroySpy = vi.spyOn(result.stderr, `destroy`)
      const testErr = new Error(`connection lost`)

      errorHandler(testErr)

      expect(stdoutDestroySpy).toHaveBeenCalledWith(testErr)
      expect(stderrDestroySpy).toHaveBeenCalledWith(testErr)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Exec WebSocket error`),
        `connection lost`
      )
    })

    it(`execWs close handler should end stdout and stderr`, async () => {
      let closeHandler: () => void = () => {}
      mockExecWs.on.mockImplementation((event: string, handler: any) => {
        if (event === `close`) closeHandler = handler
      })

      const result = await client.execStream(`my-pod`, [`bash`])

      const stdoutEndSpy = vi.spyOn(result.stdout, `end`)
      const stderrEndSpy = vi.spyOn(result.stderr, `end`)

      closeHandler()

      expect(stdoutEndSpy).toHaveBeenCalled()
      expect(stderrEndSpy).toHaveBeenCalled()
    })

    it(`should propagate exec rejection`, async () => {
      mockExec.exec.mockRejectedValue(new Error(`pod not found`))

      await expect(client.execStream(`bad-pod`, [`bash`])).rejects.toThrow(
        `pod not found`
      )
    })
  })

  // --- createDockerRegistrySecret ---

  describe(`createDockerRegistrySecret`, () => {
    it(`should create a docker-registry secret with correct structure`, async () => {
      mockCoreApi.createNamespacedSecret.mockResolvedValue({})

      await client.createDockerRegistrySecret(
        `my-pull-secret`,
        `ghcr.io`,
        `myuser`,
        `mytoken`
      )

      expect(mockCoreApi.createNamespacedSecret).toHaveBeenCalledOnce()
      const call = mockCoreApi.createNamespacedSecret.mock.calls[0][0]
      expect(call.namespace).toBe(`test-ns`)

      const body = call.body
      expect(body.type).toBe(`kubernetes.io/dockerconfigjson`)
      expect(body.metadata.name).toBe(`my-pull-secret`)

      const decoded = JSON.parse(
        Buffer.from(body.data[`.dockerconfigjson`], `base64`).toString()
      )
      expect(decoded.auths[`ghcr.io`]).toBeDefined()
      expect(decoded.auths[`ghcr.io`].username).toBe(`myuser`)
      expect(decoded.auths[`ghcr.io`].password).toBe(`mytoken`)
      expect(decoded.auths[`ghcr.io`].auth).toBe(
        Buffer.from(`myuser:mytoken`).toString(`base64`)
      )
    })

    it(`should propagate K8s API errors`, async () => {
      mockCoreApi.createNamespacedSecret.mockRejectedValue(new Error(`403 Forbidden`))

      await expect(
        client.createDockerRegistrySecret(`s`, `ghcr.io`, `u`, `p`)
      ).rejects.toThrow(`403 Forbidden`)
    })
  })

  // --- deleteSecret ---

  describe(`deleteSecret`, () => {
    it(`should call deleteNamespacedSecret with correct name and namespace`, async () => {
      mockCoreApi.deleteNamespacedSecret.mockResolvedValue({})

      await client.deleteSecret(`my-secret`)

      expect(mockCoreApi.deleteNamespacedSecret).toHaveBeenCalledWith({
        name: `my-secret`,
        namespace: `test-ns`,
      })
    })

    it(`should swallow 404 errors silently`, async () => {
      mockCoreApi.deleteNamespacedSecret.mockRejectedValue({ code: 404 })
      await expect(client.deleteSecret(`gone`)).resolves.toBeUndefined()

      mockCoreApi.deleteNamespacedSecret.mockRejectedValue({ statusCode: 404 })
      await expect(client.deleteSecret(`gone2`)).resolves.toBeUndefined()

      mockCoreApi.deleteNamespacedSecret.mockRejectedValue({
        response: { statusCode: 404 },
      })
      await expect(client.deleteSecret(`gone3`)).resolves.toBeUndefined()
    })

    it(`should re-throw non-404 errors`, async () => {
      mockCoreApi.deleteNamespacedSecret.mockRejectedValue({ code: 500 })
      await expect(client.deleteSecret(`fail`)).rejects.toEqual({ code: 500 })
    })
  })

  // --- readDeployment ---

  describe(`readDeployment`, () => {
    it(`returns normalized deployment info`, async () => {
      mockAppsApi.readNamespacedDeployment.mockResolvedValue({
        metadata: {
          name: `my-deploy`,
          annotations: { 'deployment.kubernetes.io/revision': '3' },
        },
        spec: {
          replicas: 2,
          selector: { matchLabels: { app: `my-deploy` } },
          template: {
            spec: { containers: [{ image: `my-image:v1`, name: `app` }] },
          },
        },
        status: {
          replicas: 2,
          readyReplicas: 2,
          availableReplicas: 2,
          updatedReplicas: 2,
          conditions: [
            { type: `Available`, status: `True` },
            { type: `Progressing`, status: `True` },
          ],
        },
      })

      const result = await client.readDeployment(`my-deploy`)

      expect(mockAppsApi.readNamespacedDeployment).toHaveBeenCalledWith({
        name: `my-deploy`,
        namespace: `test-ns`,
      })
      expect(result).toEqual({
        name: `my-deploy`,
        replicas: { desired: 2, ready: 2, available: 2, updated: 2 },
        image: `my-image:v1`,
        revision: `3`,
        conditions: [
          { name: `Available`, status: `True` },
          { name: `Progressing`, status: `True` },
        ],
      })
    })

    it(`handles missing optional fields gracefully`, async () => {
      mockAppsApi.readNamespacedDeployment.mockResolvedValue({
        metadata: { name: `bare-deploy` },
        spec: { selector: { matchLabels: {} }, template: { spec: { containers: [] } } },
        status: {},
      })

      const result = await client.readDeployment(`bare-deploy`)

      expect(result.image).toBeUndefined()
      expect(result.revision).toBeUndefined()
      expect(result.conditions).toEqual([])
      expect(result.replicas).toEqual({ desired: 0, ready: 0, available: 0, updated: 0 })
    })

    it(`throws a not-found error when the API returns 404`, async () => {
      const err = Object.assign(new Error(`Not Found`), { code: 404 })
      mockAppsApi.readNamespacedDeployment.mockRejectedValue(err)

      await expect(client.readDeployment(`missing-deploy`)).rejects.toThrow(
        `Deployment missing-deploy not found in namespace test-ns`
      )
    })

    it(`rethrows non-404 errors`, async () => {
      const err = Object.assign(new Error(`Internal Server Error`), { code: 500 })
      mockAppsApi.readNamespacedDeployment.mockRejectedValue(err)

      await expect(client.readDeployment(`my-deploy`)).rejects.toMatchObject({
        code: 500,
      })
    })
  })

  // --- listPodsBySelector ---

  describe(`listPodsBySelector`, () => {
    it(`calls listNamespacedPod with the exact provided labelSelector (no defaults added)`, async () => {
      mockCoreApi.listNamespacedPod.mockResolvedValue({
        items: [
          {
            metadata: { name: `backend-abc` },
            status: {
              phase: `Running`,
              containerStatuses: [{ restartCount: 2 }],
            },
            spec: {
              nodeName: `node-1`,
              containers: [{ image: `backend:v2` }],
            },
          },
        ],
      })

      const result = await client.listPodsBySelector(
        `app.kubernetes.io/component=backend`
      )

      expect(mockCoreApi.listNamespacedPod).toHaveBeenCalledWith({
        namespace: `test-ns`,
        labelSelector: `app.kubernetes.io/component=backend`,
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: `backend-abc`,
        phase: `Running`,
        restartCount: 2,
        image: `backend:v2`,
        node: `node-1`,
      })
    })

    it(`does NOT inject the PodManagedSelector`, async () => {
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [] })

      await client.listPodsBySelector(`app=myapp`)

      const call = mockCoreApi.listNamespacedPod.mock.calls[0][0]
      expect(call.labelSelector).toBe(`app=myapp`)
      expect(call.labelSelector).not.toContain(`tdsk-managed`)
    })

    it(`returns empty array when no pods match`, async () => {
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [] })

      const result = await client.listPodsBySelector(`app=nonexistent`)

      expect(result).toEqual([])
    })

    it(`handles pods with missing optional fields`, async () => {
      mockCoreApi.listNamespacedPod.mockResolvedValue({
        items: [
          {
            metadata: { name: `bare-pod` },
            status: { phase: `Pending` },
            spec: {},
          },
        ],
      })

      const result = await client.listPodsBySelector(`app=bare`)

      expect(result[0]).toEqual({
        name: `bare-pod`,
        phase: `Pending`,
        restartCount: 0,
        image: undefined,
        node: undefined,
      })
    })
  })

  // --- readPodLogs ---

  describe(`readPodLogs`, () => {
    it(`calls readNamespacedPodLog with name and namespace`, async () => {
      mockCoreApi.readNamespacedPodLog.mockResolvedValue(`line1\nline2\n`)

      const result = await client.readPodLogs(`my-pod`)

      expect(mockCoreApi.readNamespacedPodLog).toHaveBeenCalledWith({
        name: `my-pod`,
        namespace: `test-ns`,
        tailLines: undefined,
        previous: undefined,
        container: undefined,
      })
      expect(result).toBe(`line1\nline2\n`)
    })

    it(`forwards tailLines, previous, and container opts`, async () => {
      mockCoreApi.readNamespacedPodLog.mockResolvedValue(`tail output`)

      await client.readPodLogs(`my-pod`, {
        tailLines: 100,
        previous: true,
        container: `sidecar`,
      })

      expect(mockCoreApi.readNamespacedPodLog).toHaveBeenCalledWith({
        name: `my-pod`,
        namespace: `test-ns`,
        tailLines: 100,
        previous: true,
        container: `sidecar`,
      })
    })

    it(`propagates errors from the API`, async () => {
      mockCoreApi.readNamespacedPodLog.mockRejectedValue(
        new Error(`400 Bad Request: a container name must be specified`)
      )

      await expect(client.readPodLogs(`multi-container-pod`)).rejects.toThrow(
        `400 Bad Request: a container name must be specified`
      )
    })
  })

  // --- restartDeployment ---

  describe(`restartDeployment`, () => {
    it(`reads deployment first to capture prevRevision, then patches with restartedAt annotation`, async () => {
      mockAppsApi.readNamespacedDeployment.mockResolvedValue({
        metadata: {
          name: `my-deploy`,
          annotations: { 'deployment.kubernetes.io/revision': '5' },
        },
        spec: {
          replicas: 2,
          selector: { matchLabels: { app: `my-deploy` } },
          template: { spec: { containers: [{ image: `img:v1`, name: `app` }] } },
        },
        status: {
          replicas: 2,
          readyReplicas: 2,
          availableReplicas: 2,
          updatedReplicas: 2,
          conditions: [],
        },
      })
      mockAppsApi.patchNamespacedDeployment.mockResolvedValue({})

      const result = await client.restartDeployment(`my-deploy`)

      // Must read before patch
      expect(mockAppsApi.readNamespacedDeployment).toHaveBeenCalledWith({
        name: `my-deploy`,
        namespace: `test-ns`,
      })

      // Patch must be called
      expect(mockAppsApi.patchNamespacedDeployment).toHaveBeenCalledOnce()
      const patchCall = mockAppsApi.patchNamespacedDeployment.mock.calls[0][0]
      expect(patchCall.name).toBe(`my-deploy`)
      expect(patchCall.namespace).toBe(`test-ns`)

      // Body must contain the restartedAt annotation in the pod template
      const annotation =
        patchCall.body?.spec?.template?.metadata?.annotations?.[
          'kubectl.kubernetes.io/restartedAt'
        ]
      expect(annotation).toBeDefined()
      expect(() => new Date(annotation as string)).not.toThrow()

      // Returns prevRevision
      expect(result).toEqual({ prevRevision: `5` })
    })

    it(`returns null prevRevision when deployment has no revision annotation`, async () => {
      mockAppsApi.readNamespacedDeployment.mockResolvedValue({
        metadata: { name: `no-rev-deploy` },
        spec: {
          replicas: 1,
          selector: { matchLabels: {} },
          template: { spec: { containers: [] } },
        },
        status: {},
      })
      mockAppsApi.patchNamespacedDeployment.mockResolvedValue({})

      const result = await client.restartDeployment(`no-rev-deploy`)

      expect(result).toEqual({ prevRevision: null })
    })

    it(`propagates errors from readDeployment`, async () => {
      const err = Object.assign(new Error(`Not Found`), { code: 404 })
      mockAppsApi.readNamespacedDeployment.mockRejectedValue(err)

      await expect(client.restartDeployment(`gone`)).rejects.toThrow(
        `Deployment gone not found in namespace test-ns`
      )
      expect(mockAppsApi.patchNamespacedDeployment).not.toHaveBeenCalled()
    })
  })

  // --- rollbackDeployment ---

  describe(`rollbackDeployment`, () => {
    it(`patches the deployment with a restartedAt annotation set to epoch-0 to trigger rollback`, async () => {
      mockAppsApi.patchNamespacedDeployment.mockResolvedValue({})

      const result = await client.rollbackDeployment(`my-deploy`, `4`)

      expect(mockAppsApi.patchNamespacedDeployment).toHaveBeenCalledOnce()
      const patchCall = mockAppsApi.patchNamespacedDeployment.mock.calls[0][0]
      expect(patchCall.name).toBe(`my-deploy`)
      expect(patchCall.namespace).toBe(`test-ns`)
      const annotation =
        patchCall.body?.spec?.template?.metadata?.annotations?.[
          'kubectl.kubernetes.io/restartedAt'
        ]
      expect(annotation).toBeDefined()
      expect(result).toEqual({ ok: true })
    })

    it(`returns { ok: false } when patch fails`, async () => {
      mockAppsApi.patchNamespacedDeployment.mockRejectedValue(new Error(`forbidden`))

      const result = await client.rollbackDeployment(`my-deploy`, `3`)

      expect(result).toMatchObject({
        ok: false,
        detail: expect.stringContaining(`forbidden`),
      })
    })
  })

  // --- listResourceQuotas ---

  describe(`listResourceQuotas`, () => {
    it(`calls listNamespacedResourceQuota and returns normalized rows`, async () => {
      mockCoreApi.listNamespacedResourceQuota.mockResolvedValue({
        items: [
          {
            metadata: { name: `default-quota` },
            status: {
              hard: { 'requests.cpu': '4', 'requests.memory': '8Gi' },
              used: { 'requests.cpu': '1', 'requests.memory': '2Gi' },
            },
          },
        ],
      })

      const result = await client.listResourceQuotas()

      expect(mockCoreApi.listNamespacedResourceQuota).toHaveBeenCalledWith({
        namespace: `test-ns`,
      })
      expect(result).toEqual([
        {
          name: `default-quota`,
          hard: { 'requests.cpu': '4', 'requests.memory': '8Gi' },
          used: { 'requests.cpu': '1', 'requests.memory': '2Gi' },
        },
      ])
    })

    it(`returns empty array when no quotas exist`, async () => {
      mockCoreApi.listNamespacedResourceQuota.mockResolvedValue({ items: [] })

      const result = await client.listResourceQuotas()

      expect(result).toEqual([])
    })

    it(`handles quota items with empty status`, async () => {
      mockCoreApi.listNamespacedResourceQuota.mockResolvedValue({
        items: [
          {
            metadata: { name: `empty-quota` },
            status: {},
          },
        ],
      })

      const result = await client.listResourceQuotas()

      expect(result).toEqual([{ name: `empty-quota`, hard: {}, used: {} }])
    })
  })

  // --- patchSecretOwnerReferences ---

  describe(`patchSecretOwnerReferences`, () => {
    it(`should call patchNamespacedSecret with correct namespace, name, and body`, async () => {
      mockCoreApi.patchNamespacedSecret.mockResolvedValue({})

      const ownerRefs = [
        {
          apiVersion: `v1`,
          kind: `Pod`,
          name: `tdsk-sb-test-abcd`,
          uid: `pod-uid-1234`,
          blockOwnerDeletion: false,
        },
      ]

      await client.patchSecretOwnerReferences(`my-docker-secret`, ownerRefs)

      expect(mockCoreApi.patchNamespacedSecret).toHaveBeenCalledOnce()
      expect(mockCoreApi.patchNamespacedSecret).toHaveBeenCalledWith({
        name: `my-docker-secret`,
        namespace: `test-ns`,
        body: { metadata: { ownerReferences: ownerRefs } },
      })
    })

    it(`should propagate errors from the K8s API`, async () => {
      mockCoreApi.patchNamespacedSecret.mockRejectedValue(new Error(`403 Forbidden`))

      await expect(
        client.patchSecretOwnerReferences(`secret-x`, [
          {
            apiVersion: `v1`,
            kind: `Pod`,
            name: `pod-1`,
            uid: `uid-1`,
          },
        ])
      ).rejects.toThrow(`403 Forbidden`)
    })
  })
})
