import type { TProxyApp } from '@TPX/types'
import type { Request, Response } from 'express'
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

// Mock jwt
vi.mock(`jsonwebtoken`, () => ({
  default: {
    sign: vi.fn().mockReturnValue(`mock-token`),
    verify: vi.fn().mockImplementation((token, _secret) => {
      if (token === `valid-token`) {
        return { userId: `user-123`, email: `test@test.com`, type: `access` }
      }
      if (token === `valid-refresh-token`) {
        return { userId: `user-123`, email: `test@test.com`, type: `refresh` }
      }
      if (token === `expired-token`) {
        const err = new Error(`Token expired`)
        err.name = `TokenExpiredError`
        throw err
      }
      const err = new Error(`Invalid token`)
      err.name = `JsonWebTokenError`
      throw err
    }),
  },
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
    body: {},
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

describe(`Auth Endpoints`, () => {
  let mockApp: TProxyApp
  let mockRes: Response

  beforeEach(() => {
    vi.clearAllMocks()
    mockApp = createMockApp()
    mockRes = createMockResponse()
  })

  describe(`POST /auth/login`, () => {
    it(`should return 400 if email is missing`, async () => {
      const { login } = await import(`./login`)
      const handler = login(mockApp)
      const mockReq = createMockRequest({ body: { password: `password123` } })

      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Email and password are required`,
      })
    })

    it(`should return 400 if password is missing`, async () => {
      const { login } = await import(`./login`)
      const handler = login(mockApp)
      const mockReq = createMockRequest({ body: { email: `test@test.com` } })

      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Email and password are required`,
      })
    })

    it(`should return tokens on successful login`, async () => {
      const { login } = await import(`./login`)
      const handler = login(mockApp)
      const mockReq = createMockRequest({
        body: { email: `test@test.com`, password: `password123` },
      })

      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        data: expect.objectContaining({
          token: expect.any(String),
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            email: `test@test.com`,
          }),
        }),
      })
    })
  })

  describe(`POST /auth/logout`, () => {
    it(`should return success on logout`, async () => {
      const { logout } = await import(`./logout`)
      const handler = logout(mockApp)
      const mockReq = createMockRequest({
        user: { userId: `user-123`, email: `test@test.com` },
      })

      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        data: { message: `Logged out successfully` },
      })
    })

    it(`should return success even without user`, async () => {
      const { logout } = await import(`./logout`)
      const handler = logout(mockApp)
      const mockReq = createMockRequest()

      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
    })
  })

  describe(`POST /auth/refresh`, () => {
    it(`should return 400 if refresh token is missing`, async () => {
      const { refresh } = await import(`./refresh`)
      const handler = refresh(mockApp)
      const mockReq = createMockRequest({ body: {} })

      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Refresh token is required`,
      })
    })

    it(`should return 401 for invalid refresh token`, async () => {
      const { refresh } = await import(`./refresh`)
      const handler = refresh(mockApp)
      const mockReq = createMockRequest({ body: { refreshToken: `invalid-token` } })

      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Invalid refresh token`,
      })
    })

    it(`should return new tokens for valid refresh token`, async () => {
      const { refresh } = await import(`./refresh`)
      const handler = refresh(mockApp)
      const mockReq = createMockRequest({ body: { refreshToken: `valid-refresh-token` } })

      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        data: expect.objectContaining({
          token: expect.any(String),
          refreshToken: expect.any(String),
        }),
      })
    })
  })

  describe(`GET /auth/me`, () => {
    it(`should return 401 if not authenticated`, async () => {
      const { me } = await import(`./me`)
      const handler = me(mockApp)
      const mockReq = createMockRequest()

      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Not authenticated`,
      })
    })

    it(`should return user info if authenticated`, async () => {
      const { me } = await import(`./me`)
      const handler = me(mockApp)
      const mockReq = createMockRequest({
        user: {
          userId: `user-123`,
          email: `test@test.com`,
          teamId: `team-1`,
          role: `admin`,
        },
      })

      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        data: {
          userId: `user-123`,
          email: `test@test.com`,
          teamId: `team-1`,
          role: `admin`,
        },
      })
    })
  })
})
