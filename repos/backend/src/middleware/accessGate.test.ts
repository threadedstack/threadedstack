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

vi.mock(`@tdsk/domain`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tdsk/domain')>()
  return {
    ...actual,
    isFeatureEnabled: vi.fn(() => true),
  }
})

import { accessGate } from './accessGate'
import { logger } from '@TBE/utils/logger'
import { isFeatureEnabled } from '@tdsk/domain'

const mockIsFeatureEnabled = isFeatureEnabled as ReturnType<typeof vi.fn>

describe(`accessGate middleware`, () => {
  let mockNext: ReturnType<typeof vi.fn>
  let mockRes: Partial<TResponse>
  let mockWaitlistNotification: ReturnType<typeof vi.fn>
  let mockUserUpdate: ReturnType<typeof vi.fn>

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    mockWaitlistNotification = vi.fn().mockResolvedValue(true)
    mockUserUpdate = vi.fn().mockResolvedValue({ data: { id: `test-user-id` } })
    return {
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
        role: `authenticated`,
      },
      app: {
        locals: {
          db: { services: { user: { update: mockUserUpdate } } },
          email: { waitlistNotification: mockWaitlistNotification },
          config: {
            urls: {
              admin: `https://app.threadedstack.com`,
              threads: `https://threads.threadedstack.com`,
            },
          },
        },
      },
      ...overrides,
    } as unknown as TRequest
  }

  beforeEach(() => {
    mockNext = vi.fn()
    mockRes = {
      locals: {},
      status: vi.fn(),
      json: vi.fn(),
    } as unknown as Partial<TResponse>
    ;(mockRes.status as ReturnType<typeof vi.fn>).mockReturnValue(mockRes)
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockReturnValue(true)
  })

  it(`should call next without checks when accessGate feature is disabled`, async () => {
    mockIsFeatureEnabled.mockReturnValue(false)
    const req = buildMockReq()
    await accessGate(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockIsFeatureEnabled).toHaveBeenCalledWith(`accessGate`)
    expect(mockUserUpdate).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should call next when the request is authenticated via API key`, async () => {
    const req = buildMockReq()
    ;(mockRes.locals as any).auth = { apiKeyId: `key-123` }
    await accessGate(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockUserUpdate).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should call next when there is no user on the request`, async () => {
    const req = buildMockReq({ user: undefined })
    await accessGate(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockUserUpdate).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it(`should call next when user has ApprovedRole`, async () => {
    const req = buildMockReq({
      user: { id: `test-user-id`, email: `test@example.com`, role: `approved` },
    })
    await accessGate(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockUserUpdate).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should return 403 without a DB write when user already has WaitlistRole`, async () => {
    const req = buildMockReq({
      user: { id: `test-user-id`, email: `test@example.com`, role: `waitlist` },
    })
    await accessGate(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockUserUpdate).not.toHaveBeenCalled()
    expect(mockNext).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: `Access pending`,
      code: `WAITLISTED`,
    })
  })

  it(`should demote an unapproved user to WaitlistRole, fire the waitlist email, and return 403`, async () => {
    const req = buildMockReq()
    await accessGate(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockUserUpdate).toHaveBeenCalledWith({ id: `test-user-id`, role: `waitlist` })
    expect(mockWaitlistNotification).toHaveBeenCalledWith({
      email: `test@example.com`,
      adminUrl: `https://app.threadedstack.com`,
      threadsUrl: `https://threads.threadedstack.com`,
    })
    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: `Access pending`,
      code: `WAITLISTED`,
    })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should not send the waitlist email when the DB update returns no data`, async () => {
    const req = buildMockReq()
    mockUserUpdate.mockResolvedValue({ data: undefined })

    await accessGate(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockWaitlistNotification).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(403)
  })

  it(`should still return 403 and log an error when the role-update DB write throws`, async () => {
    const req = buildMockReq()
    mockUserUpdate.mockRejectedValue(new Error(`DB write failed`))

    await accessGate(req, mockRes as TResponse, mockNext as NextFunction)

    expect(logger.error).toHaveBeenCalledWith(
      `[accessGate] Failed to set waitlist role for user test-user-id:`,
      expect.any(Error)
    )
    expect(mockWaitlistNotification).not.toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should return 403 immediately without awaiting the waitlist email`, async () => {
    let resolveEmail: () => void
    const emailPromise = new Promise<boolean>((resolve) => {
      resolveEmail = () => resolve(true)
    })
    const req = buildMockReq()
    mockWaitlistNotification.mockReturnValue(emailPromise)

    await accessGate(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockRes.status).toHaveBeenCalledWith(403)
    resolveEmail!()
  })

  it(`should log an error when the waitlist email rejects`, async () => {
    const req = buildMockReq()
    const emailError = new Error(`SMTP connection failed`)
    mockWaitlistNotification.mockRejectedValue(emailError)

    await accessGate(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockRes.status).toHaveBeenCalledWith(403)
    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        `[accessGate] Failed to send waitlist email for user test-user-id:`,
        emailError
      )
    })
  })

  it(`should log an error and forward it to next on an unexpected exception`, async () => {
    mockIsFeatureEnabled.mockImplementation(() => {
      throw new Error(`Unexpected crash`)
    })
    const req = buildMockReq()
    await accessGate(req, mockRes as TResponse, mockNext as NextFunction)

    expect(logger.error).toHaveBeenCalledWith(
      `[accessGate] Unexpected error:`,
      expect.any(Error)
    )
    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
  })
})
