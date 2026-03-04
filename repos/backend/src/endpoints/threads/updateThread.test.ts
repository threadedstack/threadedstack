import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { updateThread } from './updateThread'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock(`@TDB/configs/db.config`, () => ({
  config: {
    logger: { label: `db`, level: `error` },
  },
}))

describe(`PUT /:id - Update thread`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const mockThread = {
    id: `t-1`,
    name: `Original Thread`,
    orgId: `org-1`,
    agentId: `agent-1`,
    userId: `test-user-id`,
    meta: null,
    public: false,
  }

  const buildApp = () => {
    return {
      locals: {
        config,
        payments: new PaymentsService(config.payments),
        db: {
          services: {
            thread: {
              get: vi.fn(),
              update: vi.fn(),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
            },
          },
        },
      },
    } as unknown as TApp
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response)

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: buildApp(),
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
      } as any,
      params: { id: `t-1`, agentId: `agent-1`, orgId: `org-1` },
      body: {},
      query: {},
    }
  })

  it(`should have correct endpoint configuration`, () => {
    expect(updateThread.path).toBe(`/:id`)
    expect(updateThread.method).toBe(`put`)
    expect(typeof updateThread.action).toBe(`function`)
  })

  it(`should update thread name`, async () => {
    const updatedThread = { ...mockThread, name: `Updated Thread` }

    const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<typeof vi.fn>
    const mockUpdate = mockReq.app?.locals.db.services.thread.update as ReturnType<
      typeof vi.fn
    >
    mockGet.mockResolvedValue({ data: { ...mockThread } })
    mockUpdate.mockResolvedValue({ data: updatedThread })
    mockReq.body = { name: `Updated Thread` }

    await updateThread.action(mockReq as TRequest, mockRes as Response)

    expect(mockGet).toHaveBeenCalledWith(`t-1`)
    expect(mockUpdate).toHaveBeenCalledWith({
      id: `t-1`,
      name: `Updated Thread`,
    })
    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: updatedThread })
  })

  it(`should update thread metadata`, async () => {
    const meta = { key: `value`, nested: { a: 1 } }
    const updatedThread = { ...mockThread, meta }

    const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<typeof vi.fn>
    const mockUpdate = mockReq.app?.locals.db.services.thread.update as ReturnType<
      typeof vi.fn
    >
    mockGet.mockResolvedValue({ data: { ...mockThread } })
    mockUpdate.mockResolvedValue({ data: updatedThread })
    mockReq.body = { meta }

    await updateThread.action(mockReq as TRequest, mockRes as Response)

    expect(mockUpdate).toHaveBeenCalledWith({
      id: `t-1`,
      meta,
    })
    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: updatedThread })
  })

  it(`should update thread public flag`, async () => {
    const updatedThread = { ...mockThread, public: true }

    const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<typeof vi.fn>
    const mockUpdate = mockReq.app?.locals.db.services.thread.update as ReturnType<
      typeof vi.fn
    >
    mockGet.mockResolvedValue({ data: { ...mockThread } })
    mockUpdate.mockResolvedValue({ data: updatedThread })
    mockReq.body = { public: true }

    await updateThread.action(mockReq as TRequest, mockRes as Response)

    expect(mockUpdate).toHaveBeenCalledWith({
      id: `t-1`,
      public: true,
    })
    expect(mockStatus).toHaveBeenCalledWith(200)
  })

  it(`should update multiple fields at once`, async () => {
    const updatedThread = {
      ...mockThread,
      name: `New Name`,
      meta: { updated: true },
      public: true,
    }

    const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<typeof vi.fn>
    const mockUpdate = mockReq.app?.locals.db.services.thread.update as ReturnType<
      typeof vi.fn
    >
    mockGet.mockResolvedValue({ data: { ...mockThread } })
    mockUpdate.mockResolvedValue({ data: updatedThread })
    mockReq.body = { name: `New Name`, meta: { updated: true }, public: true }

    await updateThread.action(mockReq as TRequest, mockRes as Response)

    expect(mockUpdate).toHaveBeenCalledWith({
      id: `t-1`,
      name: `New Name`,
      meta: { updated: true },
      public: true,
    })
  })

  it(`should only include defined fields in update data`, async () => {
    const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<typeof vi.fn>
    const mockUpdate = mockReq.app?.locals.db.services.thread.update as ReturnType<
      typeof vi.fn
    >
    mockGet.mockResolvedValue({ data: { ...mockThread } })
    mockUpdate.mockResolvedValue({ data: { ...mockThread, name: `Just Name` } })
    mockReq.body = { name: `Just Name` }

    await updateThread.action(mockReq as TRequest, mockRes as Response)

    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg).toEqual({ id: `t-1`, name: `Just Name` })
    expect(updateArg).not.toHaveProperty(`meta`)
    expect(updateArg).not.toHaveProperty(`public`)
  })

  it(`should throw 401 when user is not authenticated`, async () => {
    mockReq.user = undefined

    await expect(
      updateThread.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Authentication required`)
  })

  it(`should throw 404 when thread is not found`, async () => {
    const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null })
    mockReq.body = { name: `Updated` }

    await expect(
      updateThread.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Thread not found`)
  })

  it(`should throw 500 when thread.get returns error`, async () => {
    const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ error: `DB connection failed` })
    mockReq.body = { name: `Updated` }

    await expect(
      updateThread.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`DB connection failed`)
  })

  it(`should throw 404 when thread belongs to a different agent`, async () => {
    const wrongAgentThread = { ...mockThread, agentId: `other-agent` }

    const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: wrongAgentThread })
    mockReq.body = { name: `Updated` }

    await expect(
      updateThread.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Thread not found`)
  })

  it(`should throw 403 when thread belongs to a different user`, async () => {
    const otherUserThread = { ...mockThread, userId: `other-user` }

    const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: otherUserThread })
    mockReq.body = { name: `Updated` }

    await expect(
      updateThread.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Access denied`)
  })

  it(`should throw 500 when thread update fails`, async () => {
    const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<typeof vi.fn>
    const mockUpdate = mockReq.app?.locals.db.services.thread.update as ReturnType<
      typeof vi.fn
    >
    mockGet.mockResolvedValue({ data: { ...mockThread } })
    mockUpdate.mockResolvedValue({ error: `Update failed` })
    mockReq.body = { name: `Updated` }

    await expect(
      updateThread.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Update failed`)
  })

  it(`should return the updated thread data`, async () => {
    const updatedThread = {
      id: `t-1`,
      name: `Final Name`,
      orgId: `org-1`,
      agentId: `agent-1`,
      userId: `test-user-id`,
      meta: { version: 2 },
      public: true,
    }

    const mockGet = mockReq.app?.locals.db.services.thread.get as ReturnType<typeof vi.fn>
    const mockUpdate = mockReq.app?.locals.db.services.thread.update as ReturnType<
      typeof vi.fn
    >
    mockGet.mockResolvedValue({ data: { ...mockThread } })
    mockUpdate.mockResolvedValue({ data: updatedThread })
    mockReq.body = { name: `Final Name`, meta: { version: 2 }, public: true }

    await updateThread.action(mockReq as TRequest, mockRes as Response)

    expect(mockJson).toHaveBeenCalledWith({ data: updatedThread })
  })
})
