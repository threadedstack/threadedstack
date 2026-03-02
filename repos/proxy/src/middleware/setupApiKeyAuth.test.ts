import type { TProxyApp } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'

import { ApiKey } from '@tdsk/domain'
import { validateApiKeyAuth } from './setupApiKeyAuth'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TPX/utils/logger`, () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock(`@tdsk/domain`, async () => {
  const actual = await vi.importActual<typeof import('@tdsk/domain')>(`@tdsk/domain`)
  return {
    ...actual,
    hashKey: vi.fn((key: string) => `hashed_${key}`),
  }
})

const createMockAuth = () => ({
  isPublic: vi.fn().mockReturnValue(false),
  isSession: vi.fn().mockReturnValue(false),
  extract: vi.fn(),
  initialized: vi.fn(),
  verify: vi.fn(),
})

const createMockDb = () => ({
  services: {
    apiKey: {
      getByHash: vi.fn(),
      touchLastUsed: vi.fn().mockResolvedValue({ data: true }),
    },
  },
})

const createMockApp = (auth = createMockAuth(), db = createMockDb()) =>
  ({
    locals: {
      auth,
      db,
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

describe(`validateApiKeyAuth`, () => {
  let mockAuth: ReturnType<typeof createMockAuth>
  let mockDb: ReturnType<typeof createMockDb>
  let mockApp: TProxyApp
  let mockRes: Response
  let mockNext: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth = createMockAuth()
    mockDb = createMockDb()
    mockApp = createMockApp(mockAuth, mockDb)
    mockRes = createMockRes()
    mockNext = vi.fn() as unknown as NextFunction
  })

  it(`should skip when req.user is already set (JWT validated)`, async () => {
    const mockReq = {
      path: `/_/orgs`,
      headers: { authorization: `Bearer tdsk_test` },
      user: { userId: `user-123`, email: `test@test.com`, role: `admin` },
    } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockDb.services.apiKey.getByHash).not.toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should skip for public routes`, async () => {
    mockAuth.isPublic.mockReturnValue(true)
    const mockReq = { path: `/health`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockAuth.isPublic).toHaveBeenCalledWith(`/health`)
    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should return 401 when no token is provided`, async () => {
    mockAuth.extract.mockReturnValue(null)
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: `No authentication token provided`,
    })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should return 401 for non-tdsk tokens`, async () => {
    mockAuth.extract.mockReturnValue(`eyJhbGciOiJSUzI1NiJ9.invalid`)
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: `Invalid authentication token`,
    })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should return 401 for invalid API key (not found)`, async () => {
    mockAuth.extract.mockReturnValue(`tdsk_invalid_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: undefined })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockDb.services.apiKey.getByHash).toHaveBeenCalledWith(
      `hashed_tdsk_invalid_key`
    )
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Invalid API key` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should return 401 for database error on lookup`, async () => {
    mockAuth.extract.mockReturnValue(`tdsk_error_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({
      error: new Error(`DB error`),
    })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Invalid API key` })
  })

  it(`should return 401 for revoked (inactive) API key`, async () => {
    const revokedKey = new ApiKey({
      id: `key-1`,
      name: `Revoked`,
      keyHash: `hash`,
      keyPrefix: `tdsk_revo`,
      active: false,
      scopes: `read`,
      userId: `user-1`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_revoked_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: revokedKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `API key revoked` })
  })

  it(`should return 401 for expired API key`, async () => {
    const expiredKey = new ApiKey({
      id: `key-2`,
      name: `Expired`,
      keyHash: `hash`,
      keyPrefix: `tdsk_expi`,
      active: true,
      scopes: `read`,
      userId: `user-1`,
      expiresAt: new Date(Date.now() - 86400000), // yesterday
    })
    mockAuth.extract.mockReturnValue(`tdsk_expired_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: expiredKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `API key expired` })
  })

  it(`should return 401 when API key has no userId`, async () => {
    const noUserKey = new ApiKey({
      id: `key-3`,
      name: `No User`,
      keyHash: `hash`,
      keyPrefix: `tdsk_nous`,
      active: true,
      scopes: `read`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_no_user_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: noUserKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: `Invalid API key configuration`,
    })
  })

  it(`should set req.user and call next for valid API key`, async () => {
    const validKey = new ApiKey({
      id: `key-4`,
      name: `Valid Key`,
      keyHash: `hash`,
      keyPrefix: `tdsk_vali`,
      active: true,
      scopes: `read,write`,
      userId: `user-456`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_valid_key_abc`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: validKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-456`,
      email: ``,
      role: `member`,
    })
    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
    expect(mockDb.services.apiKey.touchLastUsed).toHaveBeenCalledWith(`key-4`)
  })

  it(`should map admin scope to admin role`, async () => {
    const adminKey = new ApiKey({
      id: `key-5`,
      name: `Admin Key`,
      keyHash: `hash`,
      keyPrefix: `tdsk_admi`,
      active: true,
      scopes: `admin`,
      userId: `user-789`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_admin_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: adminKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-789`,
      email: ``,
      role: `admin`,
    })
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should map read scope to viewer role`, async () => {
    const readKey = new ApiKey({
      id: `key-6`,
      name: `Read Key`,
      keyHash: `hash`,
      keyPrefix: `tdsk_read`,
      active: true,
      scopes: `read`,
      userId: `user-101`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_read_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: readKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-101`,
      email: ``,
      role: `viewer`,
    })
  })

  it(`should map write scope to member role`, async () => {
    const writeKey = new ApiKey({
      id: `key-7`,
      name: `Write Key`,
      keyHash: `hash`,
      keyPrefix: `tdsk_writ`,
      active: true,
      scopes: `write`,
      userId: `user-102`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_write_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: writeKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-102`,
      email: ``,
      role: `member`,
    })
  })

  it(`should return 500 when getByHash throws`, async () => {
    mockAuth.extract.mockReturnValue(`tdsk_throw_key`)
    mockDb.services.apiKey.getByHash.mockRejectedValue(new Error(`DB connection lost`))
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Authentication error` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should skip API key auth for /ai/ws paths (session token auth)`, async () => {
    mockAuth.isSession.mockReturnValue(true)
    mockAuth.extract.mockReturnValue(null)
    const mockReq = { path: `/ai/ws`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockDb.services.apiKey.getByHash).not.toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should not block request if touchLastUsed fails`, async () => {
    const validKey = new ApiKey({
      id: `key-8`,
      name: `Touch Fail`,
      keyHash: `hash`,
      keyPrefix: `tdsk_touc`,
      active: true,
      scopes: `read`,
      userId: `user-200`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_touch_fail`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: validKey })
    mockDb.services.apiKey.touchLastUsed.mockRejectedValue(new Error(`update failed`))
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    // Should still succeed — touchLastUsed is fire-and-forget
    expect(mockNext).toHaveBeenCalled()
    expect(mockReq.user).toEqual({
      userId: `user-200`,
      email: ``,
      role: `viewer`,
    })
  })
})
