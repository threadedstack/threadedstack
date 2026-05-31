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
    isFeatureEnabled: vi.fn(() => false),
  }
})

import { welcomeNewUser } from './welcomeNewUser'
import { logger } from '@TBE/utils/logger'
import { isFeatureEnabled } from '@tdsk/domain'

const mockIsFeatureEnabled = isFeatureEnabled as ReturnType<typeof vi.fn>

describe(`welcomeNewUser middleware`, () => {
  let mockNext: ReturnType<typeof vi.fn>
  let mockRes: Partial<TResponse>
  let mockWelcome: ReturnType<typeof vi.fn>
  let mockUserUpdate: ReturnType<typeof vi.fn>

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    mockWelcome = vi.fn().mockResolvedValue(true)
    mockUserUpdate = vi.fn().mockResolvedValue({ data: {} })
    return {
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
        role: undefined,
        displayName: `Test User`,
        name: `Test User`,
      },
      app: {
        locals: {
          db: { services: { user: { update: mockUserUpdate } } },
          email: { welcome: mockWelcome },
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
    mockRes = { locals: {} } as Partial<TResponse>
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockReturnValue(false)
  })

  it(`should send welcome email when accessGate is disabled and user has no platform role`, async () => {
    const req = buildMockReq()
    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockIsFeatureEnabled).toHaveBeenCalledWith(`accessGate`)
    expect(mockWelcome).toHaveBeenCalledWith({
      email: `test@example.com`,
      name: `Test User`,
      adminUrl: `https://app.threadedstack.com`,
      threadsUrl: `https://threads.threadedstack.com`,
    })
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it(`should set ApprovedRole on the user to prevent duplicate emails`, async () => {
    const req = buildMockReq()
    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockUserUpdate).toHaveBeenCalledWith({
      id: `test-user-id`,
      role: `approved`,
    })
  })

  it(`should still send welcome email and call next if role update fails`, async () => {
    const req = buildMockReq()
    mockUserUpdate.mockRejectedValue(new Error(`DB write failed`))

    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(logger.error).toHaveBeenCalledWith(
      `[welcomeNewUser] Failed to set approved role for user test-user-id:`,
      expect.any(Error)
    )
    expect(mockWelcome).toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it(`should send welcome email when user has a Neon Auth default role`, async () => {
    const req = buildMockReq({
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
        role: `authenticated`,
        displayName: ``,
        name: ``,
      },
    })
    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockWelcome).toHaveBeenCalledWith({
      email: `test@example.com`,
      name: ``,
      adminUrl: `https://app.threadedstack.com`,
      threadsUrl: `https://threads.threadedstack.com`,
    })
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it(`should use fallback when displayName is undefined`, async () => {
    const req = buildMockReq({
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
        role: undefined,
        displayName: undefined,
        name: `Fallback Name`,
      },
    })
    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockWelcome).toHaveBeenCalledWith({
      email: `test@example.com`,
      name: `Fallback Name`,
      adminUrl: `https://app.threadedstack.com`,
      threadsUrl: `https://threads.threadedstack.com`,
    })
  })

  it(`should call next immediately without awaiting email send`, async () => {
    let resolveEmail: () => void
    const emailPromise = new Promise<boolean>((resolve) => {
      resolveEmail = () => resolve(true)
    })
    const req = buildMockReq()
    mockWelcome.mockReturnValue(emailPromise)

    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledTimes(1)
    resolveEmail!()
  })

  it(`should NOT send email when accessGate feature is enabled`, async () => {
    mockIsFeatureEnabled.mockReturnValue(true)
    const req = buildMockReq()
    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockWelcome).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it(`should NOT send email when user has ApprovedRole`, async () => {
    const req = buildMockReq({
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
        role: `approved`,
        displayName: `Test User`,
      },
    })
    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockWelcome).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it(`should NOT send email when user has WaitlistRole`, async () => {
    const req = buildMockReq({
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
        role: `waitlist`,
        displayName: `Test User`,
      },
    })
    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockWelcome).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it(`should call next when user is undefined`, async () => {
    const req = buildMockReq({ user: undefined })
    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockWelcome).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it(`should call next when email service is unavailable`, async () => {
    const req = buildMockReq()
    req.app.locals.email = undefined as any
    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it(`should call next when user.email is missing`, async () => {
    const req = buildMockReq({
      user: {
        id: `test-user-id`,
        email: undefined,
        role: undefined,
        displayName: `Test User`,
      },
    })
    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockWelcome).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it(`should log error and call next when email.welcome rejects`, async () => {
    const req = buildMockReq()
    const emailError = new Error(`SMTP connection failed`)
    mockWelcome.mockRejectedValue(emailError)

    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        `[welcomeNewUser] Failed to send welcome email for user test-user-id:`,
        emailError
      )
    })
  })

  it(`should log error and call next on unexpected exception`, async () => {
    mockIsFeatureEnabled.mockImplementation(() => {
      throw new Error(`Unexpected crash`)
    })
    const req = buildMockReq()
    await welcomeNewUser(req, mockRes as TResponse, mockNext as NextFunction)

    expect(logger.error).toHaveBeenCalledWith(
      `[welcomeNewUser] Unexpected error:`,
      expect.any(Error)
    )
    expect(mockNext).toHaveBeenCalledTimes(1)
  })
})
