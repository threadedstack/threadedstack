import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { logger } from '@TBE/utils/logger'
import { Sandbox, EContainerState } from '@tdsk/domain'
import { connectSandbox } from './connectSandbox'

describe(`POST /_/sandboxes/:id/connect - Connect sandbox`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockGetPodState: ReturnType<typeof vi.fn>
  let mockGetPodConditionSummary: ReturnType<typeof vi.fn>
  let mockStartPod: ReturnType<typeof vi.fn>
  let mockStopPod: ReturnType<typeof vi.fn>
  let mockWaitForPodReady: ReturnType<typeof vi.fn>

  const sandbox = new Sandbox({
    id: `sb_test01`,
    name: `Test Sandbox`,
    orgId: `org-1`,
    config: { image: `tdsk-sandbox-claude` } as any,
  })

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any
    mockGetPodState = vi.fn().mockResolvedValue(EContainerState.Pending)
    mockGetPodConditionSummary = vi.fn().mockResolvedValue(undefined)
    mockStartPod = vi.fn().mockResolvedValue(`pod-a`)
    mockStopPod = vi.fn().mockResolvedValue(undefined)
    mockWaitForPodReady = vi.fn().mockResolvedValue(undefined)

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: {
        locals: {
          config: {
            egress: {},
            sandbox: { maxWait: 35_000, pollInterval: 5_000 },
          },
          db: {
            services: {
              sandbox: {
                get: vi.fn().mockResolvedValue({ data: sandbox }),
              },
            },
          },
          sandbox: {
            findActiveInstance: vi.fn(),
            findRunningInstances: vi.fn().mockResolvedValue([]),
            findInstanceForSession: vi.fn(),
            findActiveInstances: vi.fn().mockResolvedValue([]),
            countStarting: vi.fn().mockReturnValue(0),
            markStarting: vi.fn(),
            clearStarting: vi.fn(),
            broadcastInstanceList: vi.fn().mockResolvedValue(undefined),
            startPod: mockStartPod,
            getPodState: mockGetPodState,
            getPodConditionSummary: mockGetPodConditionSummary,
            waitForPodReady: mockWaitForPodReady,
            stopPod: mockStopPod,
          },
        },
      } as unknown as TApp,
      user: { id: `test-user-id`, email: `test@example.com` } as any,
      params: { id: `sb_test01`, orgId: `org-1` },
      body: { newInstance: true },
      query: {},
    }
  })

  it(`surfaces the pod condition summary in the 504 when the pod never reaches Running`, async () => {
    vi.useFakeTimers()
    try {
      mockGetPodConditionSummary.mockResolvedValue(
        `PodScheduled=False (Unschedulable): 0/3 nodes are available: insufficient cpu`
      )

      const rejection = expect(
        connectSandbox.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(
        `Pod did not reach Running state within timeout (PodScheduled=False (Unschedulable): 0/3 nodes are available: insufficient cpu)`
      )
      await vi.advanceTimersByTimeAsync(40_000)
      await rejection

      // Cleanup still ran even though the pod never became Running
      expect(mockStopPod).toHaveBeenCalledWith(`pod-a`)
    } finally {
      vi.useRealTimers()
    }
  })

  it(`logs the pod conditions once after ~30s of Pending, before the timeout fires`, async () => {
    vi.useFakeTimers()
    try {
      mockGetPodConditionSummary.mockResolvedValue(
        `PodScheduled=False (Unschedulable): 0/3 nodes are available`
      )

      const rejection = expect(
        connectSandbox.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Pod did not reach Running state within timeout`)
      await vi.advanceTimersByTimeAsync(40_000)
      await rejection

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Instance pod-a still Pending after 30s — conditions: PodScheduled=False (Unschedulable): 0/3 nodes are available`
        )
      )
      // Called once mid-loop and once more when building the final 504 message
      expect(mockGetPodConditionSummary).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it(`does not append a conditions suffix to the 504 message when none are available`, async () => {
    vi.useFakeTimers()
    try {
      mockGetPodConditionSummary.mockResolvedValue(undefined)

      const rejection = expect(
        connectSandbox.action(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Pod did not reach Running state within timeout`)
      await vi.advanceTimersByTimeAsync(40_000)
      await rejection
    } finally {
      vi.useRealTimers()
    }
  })
})
