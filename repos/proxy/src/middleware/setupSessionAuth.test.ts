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
  isSession: vi.fn((path: string) =>
    [`/ai/chat`, `/ai/stream`].some((route) => path.startsWith(route))
  ),
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

  it(`should call next for non /ai/chat paths`, () => {
    const mockReq = {
      path: `/_/orgs`,
      headers: {},
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should call next for /ai/sessions path (not /ai/chat)`, () => {
    const mockReq = {
      path: `/ai/sessions`,
      headers: {},
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should return 401 when no Authorization header on /ai/chat`, () => {
    mockAuth.extract.mockReturnValue(null)
    const mockReq = {
      path: `/ai/chat`,
      headers: {},
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Session token required` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should pass through when any token is present on /ai/chat`, () => {
    mockAuth.extract.mockReturnValue(`some-jwt`)
    const mockReq = {
      path: `/ai/chat`,
      headers: { authorization: `Bearer some-jwt` },
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should return 401 when Session token is empty`, () => {
    mockAuth.extract.mockReturnValue(``)
    const mockReq = {
      path: `/ai/chat`,
      headers: { authorization: `Session ` },
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Session token required` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should call next when valid Session token is present`, () => {
    mockAuth.extract.mockReturnValue(`abc-123-def-456`)
    const mockReq = {
      path: `/ai/chat`,
      headers: { authorization: `Session abc-123-def-456` },
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should handle /ai/chat sub-paths`, () => {
    mockAuth.extract.mockReturnValue(`abc-123`)
    const mockReq = {
      path: `/ai/chat/stream`,
      headers: { authorization: `Session abc-123` },
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should return 401 when no Authorization header on /ai/stream`, () => {
    mockAuth.extract.mockReturnValue(null)
    const mockReq = {
      path: `/ai/stream`,
      headers: {},
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Session token required` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should call next when valid Session token is present on /ai/stream`, () => {
    mockAuth.extract.mockReturnValue(`abc-123-def-456`)
    const mockReq = {
      path: `/ai/stream`,
      headers: { authorization: `Session abc-123-def-456` },
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })
})
