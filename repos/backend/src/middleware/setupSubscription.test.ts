import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { setupSubscription } from './setupSubscription'
import { logger } from '@TBE/utils/logger'

describe(`setupSubscription middleware`, () => {
  let mockNext: ReturnType<typeof vi.fn>
  let mockRes: Partial<TResponse>

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      user: { id: `test-user-id` },
      app: {
        locals: {
          db: {
            services: {
              subscription: {
                findByUser: vi
                  .fn()
                  .mockResolvedValue({ data: { tier: `free`, status: `active` } }),
                create: vi.fn().mockResolvedValue({ data: {}, error: undefined }),
              },
            },
          },
        },
      },
      ...overrides,
    } as unknown as TRequest
  }

  beforeEach(() => {
    mockNext = vi.fn()
    mockRes = { locals: {} } as Partial<TResponse>
    vi.clearAllMocks()
  })

  it(`should call next without error when subscription exists`, async () => {
    const req = buildMockReq()
    await setupSubscription(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(mockNext).toHaveBeenCalledWith()
    expect((mockRes as any).locals.subscriptionError).toBeUndefined()
  })

  it(`should call next without error when no userId is present`, async () => {
    const req = buildMockReq({ user: undefined })
    await setupSubscription(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(mockNext).toHaveBeenCalledWith()
  })

  it(`should set subscriptionError flag on res.locals when findByUser fails with real DB error`, async () => {
    const req = buildMockReq()
    const findByUser = req.app.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    findByUser.mockResolvedValue({ data: null, error: new Error(`DB connection failed`) })

    await setupSubscription(req, mockRes as TResponse, mockNext as NextFunction)

    expect((mockRes as any).locals.subscriptionError).toBe(true)
  })

  it(`should still call next when subscription lookup fails with real DB error (not block request)`, async () => {
    const req = buildMockReq()
    const findByUser = req.app.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    findByUser.mockResolvedValue({ data: null, error: new Error(`DB timeout`) })

    await setupSubscription(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(mockNext).toHaveBeenCalledWith()
  })

  it(`should log warning when subscription lookup fails with real DB error`, async () => {
    const req = buildMockReq()
    const lookupError = new Error(`Subscription query failed`)
    const findByUser = req.app.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    findByUser.mockResolvedValue({ data: null, error: lookupError })

    await setupSubscription(req, mockRes as TResponse, mockNext as NextFunction)

    expect(logger.warn).toHaveBeenCalledWith(`Failed to check subscription:`, lookupError)
  })

  it(`should create free tier subscription when none exists`, async () => {
    const req = buildMockReq()
    const findByUser = req.app.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    findByUser.mockResolvedValue({ data: null, error: undefined })

    await setupSubscription(req, mockRes as TResponse, mockNext as NextFunction)

    const create = req.app.locals.db.services.subscription.create as ReturnType<
      typeof vi.fn
    >
    expect(create).toHaveBeenCalledWith({
      userId: `test-user-id`,
      tier: `free`,
      seats: 1,
      status: `active`,
    })
    expect(mockNext).toHaveBeenCalledWith()
  })

  it(`should set subscriptionError flag when free tier creation fails`, async () => {
    const req = buildMockReq()
    const findByUser = req.app.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    findByUser.mockResolvedValue({ data: null, error: undefined })

    const create = req.app.locals.db.services.subscription.create as ReturnType<
      typeof vi.fn
    >
    create.mockResolvedValue({ error: new Error(`Insert failed`) })

    await setupSubscription(req, mockRes as TResponse, mockNext as NextFunction)

    expect((mockRes as any).locals.subscriptionError).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(
      `Failed to create free subscription:`,
      expect.any(Error)
    )
    expect(mockNext).toHaveBeenCalledWith()
  })

  it(`should call next, log error, and set subscriptionError when unexpected exception is thrown`, async () => {
    const req = buildMockReq()
    const findByUser = req.app.locals.db.services.subscription.findByUser as ReturnType<
      typeof vi.fn
    >
    findByUser.mockRejectedValue(new Error(`Unexpected crash`))

    await setupSubscription(req, mockRes as TResponse, mockNext as NextFunction)

    expect(logger.error).toHaveBeenCalledWith(
      `Unexpected error in setupSubscription:`,
      expect.any(Error)
    )
    expect((mockRes as any).locals.subscriptionError).toBe(true)
    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(mockNext).toHaveBeenCalledWith()
  })
})
