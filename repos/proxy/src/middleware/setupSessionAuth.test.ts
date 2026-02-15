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

const createMockApp = () =>
  ({
    locals: {
      config: {},
    },
  }) as unknown as TProxyApp

const createMockRes = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }) as unknown as Response

describe(`validateSessionAuth`, () => {
  let mockApp: TProxyApp
  let mockRes: Response
  let mockNext: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
    mockApp = createMockApp()
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

  it(`should return 401 when Authorization is not Session type`, () => {
    const mockReq = {
      path: `/ai/chat`,
      headers: { authorization: `Bearer some-jwt` },
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Session token required` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should return 401 when Session token is empty`, () => {
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
    const mockReq = {
      path: `/ai/chat/stream`,
      headers: { authorization: `Session abc-123` },
    } as unknown as Request

    const middleware = validateSessionAuth(mockApp)
    middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })
})
