import type { TProxyApp } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger
vi.mock(`@TPX/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Create error classes for mock
class MockTokenExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = `TokenExpiredError`
  }
}

class MockJsonWebTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = `JsonWebTokenError`
  }
}

// Mock jwt
vi.mock(`jsonwebtoken`, () => ({
  default: {
    sign: vi.fn().mockReturnValue(`mock-token`),
    verify: vi.fn().mockImplementation((token, _secret) => {
      if (token === `valid-token`) {
        return { userId: `user-123`, email: `test@test.com` }
      }
      if (token === `expired-token`) {
        throw new MockTokenExpiredError(`Token expired`)
      }
      throw new MockJsonWebTokenError(`Invalid token`)
    }),
  },
  TokenExpiredError: MockTokenExpiredError,
  JsonWebTokenError: MockJsonWebTokenError,
}))

const createMockApp = (): TProxyApp =>
  ({
    locals: {
      config: {
        jwt: {
          secret: `test-secret`,
          expiresIn: `7d`,
          refreshExpiresIn: `30d`,
        },
      },
    },
  }) as TProxyApp

const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    path: `/protected`,
    headers: {},
    user: undefined,
    ...overrides,
  }) as Request

const createMockResponse = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

describe(`JWT Auth Middleware`, () => {
  let mockApp: TProxyApp
  let mockRes: Response
  let mockNext: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
    mockApp = createMockApp()
    mockRes = createMockResponse()
    mockNext = vi.fn() as any
  })

  describe(`setupAuth middleware`, () => {
    it(`should skip auth for public routes`, async () => {
      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({ path: `/auth/login` })

      middleware(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it(`should skip auth for health endpoint`, async () => {
      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({ path: `/health` })

      middleware(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it(`should return 401 if no token provided`, async () => {
      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({ path: `/protected` })

      middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `No authentication token provided`,
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it(`should return 401 for invalid token format`, async () => {
      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({
        path: `/protected`,
        headers: { authorization: `InvalidFormat token` },
      })

      middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `No authentication token provided`,
      })
    })

    it(`should return 401 for expired token`, async () => {
      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({
        path: `/protected`,
        headers: { authorization: `Bearer expired-token` },
      })

      middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Token expired`,
      })
    })

    it(`should return 401 for invalid token`, async () => {
      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({
        path: `/protected`,
        headers: { authorization: `Bearer invalid-token` },
      })

      middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Invalid token`,
      })
    })

    it(`should attach user to request for valid token`, async () => {
      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({
        path: `/protected`,
        headers: { authorization: `Bearer valid-token` },
      })

      middleware(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockReq.user).toEqual({
        userId: `user-123`,
        email: `test@test.com`,
        teamId: undefined,
        role: undefined,
      })
    })
  })
})
