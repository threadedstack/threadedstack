import type { IMutagenClient, TSyncRule } from '@tdsk/domain'

import { SyncManager } from '@TSA/services/sync/syncManager'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockClient: IMutagenClient = {
  createSession: vi.fn().mockResolvedValue({
    id: `sess-1`,
    name: `app`,
    status: `watching`,
    source: ``,
    target: ``,
    mode: `two-way-resolved`,
    labels: {},
  }),
  terminateSession: vi.fn().mockResolvedValue(undefined),
  pauseSession: vi.fn().mockResolvedValue(undefined),
  resumeSession: vi.fn().mockResolvedValue(undefined),
  flushSession: vi.fn().mockResolvedValue(undefined),
  listSessions: vi.fn().mockResolvedValue([]),
  getSession: vi.fn().mockResolvedValue(null),
  ensureDaemon: vi.fn().mockResolvedValue(undefined),
  stopDaemon: vi.fn().mockResolvedValue(undefined),
}

describe(`SyncManager`, () => {
  let manager: SyncManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new SyncManager(mockClient)
  })

  describe(`startAll`, () => {
    it(`ensures daemon is running before creating sessions`, async () => {
      const rules: TSyncRule[] = [
        {
          name: `app`,
          source: `/src`,
          target: `/workspace/src`,
          mode: `two-way-resolved`,
        },
      ]

      await manager.startAll(`sb_abc`, `org_1`, rules, undefined)

      expect(mockClient.ensureDaemon).toHaveBeenCalledOnce()
      expect(mockClient.createSession).toHaveBeenCalledOnce()
    })

    it(`creates one session per rule with correct labels`, async () => {
      const rules: TSyncRule[] = [
        { name: `app`, source: `/src`, target: `/workspace/src` },
        { name: `config`, source: `/config`, target: `/workspace/config` },
      ]

      await manager.startAll(`sb_abc`, `org_1`, rules, undefined)

      expect(mockClient.createSession).toHaveBeenCalledTimes(2)

      const firstCall = (mockClient.createSession as any).mock.calls[0][0]
      expect(firstCall.labels).toEqual({
        sandboxId: `sb_abc`,
        ruleName: `app`,
        orgId: `org_1`,
      })

      const secondCall = (mockClient.createSession as any).mock.calls[1][0]
      expect(secondCall.labels).toEqual({
        sandboxId: `sb_abc`,
        ruleName: `config`,
        orgId: `org_1`,
      })
    })

    it(`does not pass password to createSession`, async () => {
      const rules: TSyncRule[] = [
        { name: `app`, source: `/src`, target: `/workspace/src` },
      ]

      await manager.startAll(`sb_abc`, `org_1`, rules, undefined)

      const sessionOpts = (mockClient.createSession as any).mock.calls[0][0]
      expect(sessionOpts).not.toHaveProperty(`password`)
    })

    it(`skips existing sessions with matching name`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([
        { id: `existing`, name: `app`, status: `watching`, labels: {} },
      ])

      const rules: TSyncRule[] = [
        { name: `app`, source: `/src`, target: `/workspace/src` },
      ]

      await manager.startAll(`sb_abc`, `org_1`, rules, undefined)

      expect(mockClient.createSession).not.toHaveBeenCalled()
    })

    it(`includes instanceId in labels and compound SSH host when provided`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([])
      const rules: TSyncRule[] = [
        { name: `app`, source: `/src`, target: `/workspace/src` },
      ]

      await manager.startAll(
        `sb_abc`,
        `org_1`,
        rules,
        undefined,
        undefined,
        undefined,
        `inst-1`
      )

      const call = (mockClient.createSession as any).mock.calls[0][0]
      expect(call.labels).toEqual({
        sandboxId: `sb_abc`,
        ruleName: `app`,
        orgId: `org_1`,
        instanceId: `inst-1`,
      })
      expect(call.sandboxId).toBe(`sb_abc--inst-1`)
    })

    it(`filters existing sessions by instanceId when provided`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([])
      const rules: TSyncRule[] = [
        { name: `app`, source: `/src`, target: `/workspace/src` },
      ]

      await manager.startAll(
        `sb_abc`,
        `org_1`,
        rules,
        undefined,
        undefined,
        undefined,
        `inst-1`
      )

      expect(mockClient.listSessions).toHaveBeenCalledWith({
        sandboxId: `sb_abc`,
        instanceId: `inst-1`,
      })
    })
  })

  describe(`stopAll`, () => {
    it(`terminates all sessions for a sandbox by label`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([
        { id: `sess-1`, name: `app`, labels: { sandboxId: `sb_abc` } },
        { id: `sess-2`, name: `config`, labels: { sandboxId: `sb_abc` } },
      ])

      await manager.stopAll(`sb_abc`)

      expect(mockClient.listSessions).toHaveBeenCalledWith({ sandboxId: `sb_abc` })
      expect(mockClient.terminateSession).toHaveBeenCalledTimes(2)
      expect(mockClient.terminateSession).toHaveBeenCalledWith(`sess-1`)
      expect(mockClient.terminateSession).toHaveBeenCalledWith(`sess-2`)
    })

    it(`does nothing when no sessions exist`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([])
      await manager.stopAll(`sb_abc`)
      expect(mockClient.terminateSession).not.toHaveBeenCalled()
    })

    it(`filters by instanceId when provided`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([
        {
          id: `sess-1`,
          name: `app`,
          labels: { sandboxId: `sb_abc`, instanceId: `inst-1` },
        },
      ])

      await manager.stopAll(`sb_abc`, `inst-1`)

      expect(mockClient.listSessions).toHaveBeenCalledWith({
        sandboxId: `sb_abc`,
        instanceId: `inst-1`,
      })
      expect(mockClient.terminateSession).toHaveBeenCalledWith(`sess-1`)
    })

    it(`aggregates errors when some sessions fail to terminate`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([
        { id: `sess-1`, name: `app`, labels: { sandboxId: `sb_abc` } },
        { id: `sess-2`, name: `config`, labels: { sandboxId: `sb_abc` } },
        { id: `sess-3`, name: `data`, labels: { sandboxId: `sb_abc` } },
      ])
      ;(mockClient.terminateSession as any)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error(`session locked`))
        .mockResolvedValueOnce(undefined)

      await expect(manager.stopAll(`sb_abc`)).rejects.toThrow(
        `Failed to terminate 1 session(s)`
      )
      // All 3 sessions were attempted despite the middle one failing
      expect(mockClient.terminateSession).toHaveBeenCalledTimes(3)
    })
  })

  describe(`flushAll`, () => {
    it(`flushes all sessions for a sandbox`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([
        { id: `sess-1`, name: `app`, labels: { sandboxId: `sb_abc` } },
      ])

      await manager.flushAll(`sb_abc`)

      expect(mockClient.flushSession).toHaveBeenCalledWith(`sess-1`)
    })

    it(`aggregates errors when some sessions fail to flush`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([
        { id: `sess-1`, name: `app`, labels: { sandboxId: `sb_abc` } },
        { id: `sess-2`, name: `config`, labels: { sandboxId: `sb_abc` } },
      ])
      ;(mockClient.flushSession as any)
        .mockRejectedValueOnce(new Error(`session paused`))
        .mockResolvedValueOnce(undefined)

      await expect(manager.flushAll(`sb_abc`)).rejects.toThrow(
        `Failed to flush 1 session(s)`
      )
      expect(mockClient.flushSession).toHaveBeenCalledTimes(2)
    })

    it(`filters by instanceId when provided`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([
        {
          id: `sess-1`,
          name: `app`,
          labels: { sandboxId: `sb_abc`, instanceId: `inst-1` },
        },
      ])

      await manager.flushAll(`sb_abc`, `inst-1`)

      expect(mockClient.listSessions).toHaveBeenCalledWith({
        sandboxId: `sb_abc`,
        instanceId: `inst-1`,
      })
      expect(mockClient.flushSession).toHaveBeenCalledWith(`sess-1`)
    })
  })

  describe(`status`, () => {
    it(`lists sessions filtered by sandboxId`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([])
      await manager.status(`sb_abc`)
      expect(mockClient.listSessions).toHaveBeenCalledWith({ sandboxId: `sb_abc` })
    })

    it(`lists all sessions when no sandboxId provided`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([])
      await manager.status()
      expect(mockClient.listSessions).toHaveBeenCalledWith(undefined)
    })

    it(`filters by both sandboxId and instanceId when provided`, async () => {
      ;(mockClient.listSessions as any).mockResolvedValue([])
      await manager.status(`sb_abc`, `inst-1`)
      expect(mockClient.listSessions).toHaveBeenCalledWith({
        sandboxId: `sb_abc`,
        instanceId: `inst-1`,
      })
    })
  })
})
