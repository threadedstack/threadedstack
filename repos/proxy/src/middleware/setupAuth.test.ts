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

// Mock neonAuth
const mockVerifyToken = vi.fn()
const mockIsJWKSInitialized = vi.fn()

vi.mock(`@TPX/utils/auth/neonAuth`, () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
  isJWKSInitialized: () => mockIsJWKSInitialized(),
}))

const createMockApp = (): TProxyApp =>
  ({
    locals: {
      config: {
        jwt: {
          secret: `test-secret`,
          expiresIn: `7d`,
        },
        jwks: {
          jwksUrl: `https://auth.example.com/.well-known/jwks.json`,
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
    mockNext = vi.fn() as NextFunction
    mockIsJWKSInitialized.mockReturnValue(true)
  })

  describe(`setupAuth middleware`, () => {
    it(`should skip auth for health endpoint`, async () => {
      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({ path: `/health` })

      await middleware(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it(`should return 401 if no token provided`, async () => {
      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({ path: `/protected` })

      await middleware(mockReq, mockRes, mockNext)

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

      await middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `No authentication token provided`,
      })
    })

    it(`should return 500 if JWKS not initialized`, async () => {
      mockIsJWKSInitialized.mockReturnValue(false)

      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({
        path: `/protected`,
        headers: { authorization: `Bearer some-token` },
      })

      await middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Authentication service unavailable`,
      })
    })

    it(`should return 401 for expired token`, async () => {
      mockVerifyToken.mockResolvedValue({
        valid: false,
        error: `Token expired`,
      })

      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({
        path: `/protected`,
        headers: { authorization: `Bearer expired-token` },
      })

      await middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Token expired`,
      })
    })

    it(`should return 401 for invalid token`, async () => {
      mockVerifyToken.mockResolvedValue({
        valid: false,
        error: `Invalid token signature`,
      })

      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({
        path: `/protected`,
        headers: { authorization: `Bearer invalid-token` },
      })

      await middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Invalid token`,
      })
    })

    it(`should attach user to request for valid token`, async () => {
      mockVerifyToken.mockResolvedValue({
        valid: true,
        payload: {
          sub: `user-123`,
          email: `test@test.com`,
          teamId: `team-456`,
          role: `admin`,
        },
      })

      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({
        path: `/protected`,
        headers: { authorization: `Bearer valid-token` },
      })

      await middleware(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockReq.user).toEqual({
        userId: `user-123`,
        email: `test@test.com`,
        teamId: `team-456`,
        role: `admin`,
      })
    })

    it(`should use userId from payload if sub not present`, async () => {
      mockVerifyToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: `user-789`,
          email: `test@test.com`,
        },
      })

      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({
        path: `/protected`,
        headers: { authorization: `Bearer valid-token` },
      })

      await middleware(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockReq.user?.userId).toBe(`user-789`)
    })

    it(`should handle verification errors gracefully`, async () => {
      mockVerifyToken.mockRejectedValue(new Error(`Network error`))

      const { setupAuth } = await import(`./setupAuth`)
      const middleware = setupAuth(mockApp)
      const mockReq = createMockRequest({
        path: `/protected`,
        headers: { authorization: `Bearer some-token` },
      })

      await middleware(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Authentication error`,
      })
    })
  })
})
