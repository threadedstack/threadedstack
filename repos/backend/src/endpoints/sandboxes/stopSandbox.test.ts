import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { stopSandbox } from './stopSandbox'
import { Sandbox } from '@tdsk/domain'

describe(`DELETE /_/sandboxes/:id/stop - Stop sandbox`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockGetSessions: ReturnType<typeof vi.fn>
  let mockGracefulStopPod: ReturnType<typeof vi.fn>
  let mockValidateInstanceOwnership: ReturnType<typeof vi.fn>

  const sandbox = new Sandbox({
    id: `sb_test01`,
    name: `Test Sandbox`,
    orgId: `org-1`,
    config: { image: `tdsk-sandbox-claude` } as any,
  })

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any
    mockGetSessions = vi.fn().mockReturnValue([])
    mockGracefulStopPod = vi.fn().mockResolvedValue(undefined)
    mockValidateInstanceOwnership = vi.fn().mockResolvedValue(undefined)

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: {
        locals: {
          db: {
            services: {
              sandbox: {
                get: vi.fn().mockResolvedValue({ data: sandbox }),
              },
            },
          },
          sandbox: {
            getSessions: mockGetSessions,
            gracefulStopPod: mockGracefulStopPod,
            validateInstanceOwnership: mockValidateInstanceOwnership,
          },
        },
      } as unknown as TApp,
      user: { id: `test-user-id`, email: `test@example.com` } as any,
      params: { id: `sb_test01`, orgId: `org-1` },
      body: {},
      query: {},
    }
  })

  it(`returns a 409 with a plain string error and the activeSessions payload`, async () => {
    mockReq.body = { instanceId: `instance-1` }
    mockGetSessions.mockReturnValue([
      { userId: `other-user`, instanceId: `instance-1`, sessionId: `sess-1` },
    ])

    await stopSandbox.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(409)
    const body = mockJson.mock.calls[0][0]

    // error must be a plain string, matching the global errorHandler shape
    expect(typeof body.error).toBe(`string`)
    expect(body.error).toBe(`Active sessions exist`)
    expect(body.code).toBe(`ACTIVE_SESSIONS`)
    expect(body.data.activeSessions).toEqual([
      { userId: `other-user`, instanceId: `instance-1`, sessionId: `sess-1` },
    ])

    expect(mockGracefulStopPod).not.toHaveBeenCalled()
  })

  it(`stops the instance when there are no other active sessions`, async () => {
    mockReq.body = { instanceId: `instance-1` }
    mockGetSessions.mockReturnValue([])

    await stopSandbox.action(mockReq as TRequest, mockRes as Response)

    expect(mockGracefulStopPod).toHaveBeenCalledWith(`instance-1`, sandbox.id)
    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: { success: true } })
  })
})
