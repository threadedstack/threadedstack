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
}

const mockWatcher = {
  watch: vi.fn(),
}

const mockKc = {
  loadFromCluster: vi.fn(),
  loadFromDefault: vi.fn(),
  makeApiClient: vi.fn(() => mockCoreApi),
}

vi.mock(`@kubernetes/client-node`, () => ({
  KubeConfig: vi.fn(() => mockKc),
  CoreV1Api: vi.fn(),
  Watch: vi.fn(() => mockWatcher),
  Exec: vi.fn(() => ({})),
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
      [PodAnnotationKeys.placeholders]: JSON.stringify({ tdsk_ph_abc: `secret-1` }),
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
      expect(routes[`sb-test1234-abcd`].placeholders).toEqual({ tdsk_ph_abc: `secret-1` })
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
      const placeholders = { tdsk_ph_key1: `secret-a`, tdsk_ph_key2: `secret-b` }
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
      expect(entry.placeholders).toEqual({ tdsk_ph_abc: `secret-1` })
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
})
