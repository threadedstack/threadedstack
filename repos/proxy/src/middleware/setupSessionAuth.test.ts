import type { TProxyApp } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'

import { validateSessionAuth } from './setupSessionAuth'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TPX/utils/logger`, () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

const createMockAuth = () => ({
  isSession: vi.fn((path: string) => [`/ai/ws`].some((route) => path.startsWith(route))),
  extract: vi.fn().mockReturnValue(null),
})

const createMockApp = (auth = createMockAuth()) =>
  ({
    locals: {
      auth,
      config: {},
    },
  }) as unknown as TProxyApp

const createMockRes = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }) as unknown as Response

describe(`validateSessionAuth`, () => {
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

  it(`should call next for non /ai/ws paths`, () => {
    const mockReq = {
      path: `/_/orgs`,
      headers: {},
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should call next for /ai/sessions path (not /ai/ws)`, () => {
    const mockReq = {
      path: `/ai/sessions`,
      headers: {},
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should return 401 when no Authorization header on /ai/ws`, () => {
    mockAuth.extract.mockReturnValue(null)
    const mockReq = {
      path: `/ai/ws`,
      headers: {},
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Session token required` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should pass through when any token is present on /ai/ws`, () => {
    mockAuth.extract.mockReturnValue(`some-jwt`)
    const mockReq = {
      path: `/ai/ws`,
      headers: { authorization: `Bearer some-jwt` },
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should skip session auth when req.user is already set`, () => {
    const mockReq = {
      path: `/ai/ws`,
      headers: { authorization: `Bearer some-jwt` },
      user: { userId: `user-123`, email: `test@test.com`, role: `user` },
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
    expect(mockAuth.extract).not.toHaveBeenCalled()
  })

  it(`should return 401 when Bearer token is empty`, () => {
    mockAuth.extract.mockReturnValue(``)
    const mockReq = {
      path: `/ai/ws`,
      headers: { authorization: `Bearer ` },
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Session token required` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should call next when valid session token is present via Bearer`, () => {
    mockAuth.extract.mockReturnValue(`abc-123-def-456`)
    const mockReq = {
      path: `/ai/ws`,
      headers: { authorization: `Bearer abc-123-def-456` },
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should call next when session token is in query param on /ai/ws`, () => {
    mockAuth.extract.mockReturnValue(`abc-session-token`)

    const mockReq = {
      path: `/ai/ws`,
      query: { token: `abc-session-token` },
      headers: {},
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should return 401 when no token on /ai/ws path`, () => {
    mockAuth.extract.mockReturnValue(null)

    const mockReq = {
      path: `/ai/ws`,
      query: {},
      headers: {},
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
  })
})
