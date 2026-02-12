import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import type { TProxyApp } from '@TPX/types'

vi.mock(`@TPX/utils/logger`, () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock(`@TPX/services/auth`, () => ({
  Auth: vi.fn(),
}))

import { validateAuth } from './setupAuth'

const createMockAuth = () => ({
  isPublic: vi.fn(),
  extract: vi.fn(),
  initialized: vi.fn(),
  verify: vi.fn(),
})

const createMockApp = (auth = createMockAuth()) =>
  ({
    locals: {
      auth,
      config: {
        jwks: { jwksUrl: `https://example.com/.well-known/jwks.json` },
      },
    },
  }) as unknown as TProxyApp

const createMockRes = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }) as unknown as Response

describe(`validateAuth`, () => {
  let mockAuth: ReturnType<typeof createMockAuth>
  let mockApp: TProxyApp
  let mockRes: Response
  let mockNext: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth = createMockAuth()
    mockApp = createMockApp(mockAuth)
    mockRes = createMockRes()
    mockNext = vi.fn() as unknown as NextFunction
  })

  it(`should skip auth for public routes and call next`, async () => {
    mockAuth.isPublic.mockReturnValue(true)
    const mockReq = { path: `/health`, headers: {} } as unknown as Request

    const middleware = validateAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockAuth.isPublic).toHaveBeenCalledWith(`/health`)
    expect(mockNext).toHaveBeenCalled()
    expect(mockAuth.extract).not.toHaveBeenCalled()
    expect(mockAuth.verify).not.toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should call next when no token is provided (defers to API key middleware)`, async () => {
    mockAuth.isPublic.mockReturnValue(false)
    mockAuth.extract.mockReturnValue(null)
    const mockReq = { path: `/auth/me`, headers: {} } as unknown as Request

    const middleware = validateAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should call next when token starts with tdsk_ (defers to API key middleware)`, async () => {
    mockAuth.isPublic.mockReturnValue(false)
    mockAuth.extract.mockReturnValue(`tdsk_abc123def456`)
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
    expect(mockAuth.verify).not.toHaveBeenCalled()
  })

  it(`should return 500 when auth is not initialized`, async () => {
    mockAuth.isPublic.mockReturnValue(false)
    mockAuth.extract.mockReturnValue(`some-token`)
    mockAuth.initialized.mockReturnValue(false)
    const mockReq = { path: `/auth/me`, headers: {} } as unknown as Request

    const middleware = validateAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: `Authentication service unavailable`,
    })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should return 401 for an invalid token`, async () => {
    mockAuth.isPublic.mockReturnValue(false)
    mockAuth.extract.mockReturnValue(`invalid-token`)
    mockAuth.initialized.mockReturnValue(true)
    mockAuth.verify.mockResolvedValue({ valid: false })
    const mockReq = { path: `/auth/me`, headers: {} } as unknown as Request

    const middleware = validateAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockAuth.verify).toHaveBeenCalledWith(`invalid-token`)
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Invalid token` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should return 401 for an expired token`, async () => {
    mockAuth.isPublic.mockReturnValue(false)
    mockAuth.extract.mockReturnValue(`expired-token`)
    mockAuth.initialized.mockReturnValue(true)
    mockAuth.verify.mockResolvedValue({ valid: false, expired: true })
    const mockReq = { path: `/auth/me`, headers: {} } as unknown as Request

    const middleware = validateAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Token expired` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should return 401 when payload is missing even if valid is true`, async () => {
    mockAuth.isPublic.mockReturnValue(false)
    mockAuth.extract.mockReturnValue(`some-token`)
    mockAuth.initialized.mockReturnValue(true)
    mockAuth.verify.mockResolvedValue({ valid: true, payload: undefined })
    const mockReq = { path: `/auth/me`, headers: {} } as unknown as Request

    const middleware = validateAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Invalid token` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should attach req.user and call next on valid token`, async () => {
    mockAuth.isPublic.mockReturnValue(false)
    mockAuth.extract.mockReturnValue(`valid-token`)
    mockAuth.initialized.mockReturnValue(true)
    mockAuth.verify.mockResolvedValue({
      valid: true,
      payload: {
        sub: `user-123`,
        email: `user@example.com`,
        role: `admin`,
      },
    })
    const mockReq = { path: `/auth/me`, headers: {} } as unknown as Request

    const middleware = validateAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-123`,
      email: `user@example.com`,
      role: `admin`,
    })
    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should use userId fallback when sub is not present`, async () => {
    mockAuth.isPublic.mockReturnValue(false)
    mockAuth.extract.mockReturnValue(`valid-token`)
    mockAuth.initialized.mockReturnValue(true)
    mockAuth.verify.mockResolvedValue({
      valid: true,
      payload: {
        userId: `user-789`,
        email: `fallback@example.com`,
      },
    })
    const mockReq = { path: `/auth/me`, headers: {} } as unknown as Request

    const middleware = validateAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-789`,
      email: `fallback@example.com`,
      role: `user`,
    })
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should default email to empty string and role to user when not in payload`, async () => {
    mockAuth.isPublic.mockReturnValue(false)
    mockAuth.extract.mockReturnValue(`valid-token`)
    mockAuth.initialized.mockReturnValue(true)
    mockAuth.verify.mockResolvedValue({
      valid: true,
      payload: {
        sub: `user-minimal`,
      },
    })
    const mockReq = { path: `/auth/me`, headers: {} } as unknown as Request

    const middleware = validateAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-minimal`,
      email: ``,
      role: `user`,
    })
  })

  it(`should return 500 when verify throws an error`, async () => {
    mockAuth.isPublic.mockReturnValue(false)
    mockAuth.extract.mockReturnValue(`bad-token`)
    mockAuth.initialized.mockReturnValue(true)
    mockAuth.verify.mockRejectedValue(new Error(`JWKS fetch failed`))
    const mockReq = { path: `/auth/me`, headers: {} } as unknown as Request

    const middleware = validateAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: `Authentication error`,
    })
    expect(mockNext).not.toHaveBeenCalled()
  })
})
