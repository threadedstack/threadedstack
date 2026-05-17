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
  isDeferredAuth: vi.fn().mockReturnValue(false),
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
      user: { userId: `user-123`, email: `test@test.com` },
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
      apiKeyId: `key-4`,
    })
    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
    expect(mockDb.services.apiKey.touchLastUsed).toHaveBeenCalledWith(`key-4`)
  })

  it(`should authenticate admin-scoped API key`, async () => {
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
      apiKeyId: `key-5`,
    })
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should authenticate read-scoped API key`, async () => {
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
      apiKeyId: `key-6`,
    })
  })

  it(`should authenticate write-scoped API key`, async () => {
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
      apiKeyId: `key-7`,
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

  it(`should call next (not 401) for proxy routes with no token`, async () => {
    mockAuth.isDeferredAuth.mockReturnValue(true)
    mockAuth.extract.mockReturnValue(null)
    const mockReq = { path: `/proxy/proj-1/ep-1`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockDb.services.apiKey.getByHash).not.toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should call next (not 401) for proxy routes with non-API-key token`, async () => {
    mockAuth.isDeferredAuth.mockReturnValue(true)
    mockAuth.extract.mockReturnValue(`eyJhbGciOiJSUzI1NiJ9.invalid`)
    const mockReq = { path: `/proxy/proj-1/ep-1`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockDb.services.apiKey.getByHash).not.toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should still validate API key on proxy routes when token is an API key`, async () => {
    mockAuth.isDeferredAuth.mockReturnValue(true)
    mockAuth.extract.mockReturnValue(`tdsk_invalid_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: undefined })
    const mockReq = { path: `/proxy/proj-1/ep-1`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockDb.services.apiKey.getByHash).toHaveBeenCalledWith(
      `hashed_tdsk_invalid_key`
    )
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Invalid API key` })
  })

  it(`should set req.user for valid API key on a proxy route`, async () => {
    mockAuth.isDeferredAuth.mockReturnValue(true)
    const validKey = new ApiKey({
      id: `key-proxy`,
      name: `Proxy Key`,
      keyHash: `hash`,
      keyPrefix: `tdsk_prox`,
      active: true,
      scopes: `write`,
      userId: `user-proxy-1`,
      orgId: `org-proxy-1`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_proxy_valid`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: validKey })
    const mockReq = { path: `/proxy/proj-1/ep-1`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-proxy-1`,
      email: ``,
      orgId: `org-proxy-1`,
      apiKeyId: `key-proxy`,
    })
    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it(`should return 500 when getByHash throws on a proxy route with API key`, async () => {
    mockAuth.isDeferredAuth.mockReturnValue(true)
    mockAuth.extract.mockReturnValue(`tdsk_throw_proxy`)
    mockDb.services.apiKey.getByHash.mockRejectedValue(new Error(`DB connection lost`))
    const mockReq = { path: `/proxy/proj-1/ep-1`, headers: {} } as unknown as Request

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

  it(`should attach orgId when API key is org-scoped`, async () => {
    const orgKey = new ApiKey({
      id: `key-org`,
      name: `Org Key`,
      keyHash: `hash`,
      keyPrefix: `tdsk_orgk`,
      active: true,
      scopes: `admin`,
      userId: `user-300`,
      orgId: `org-123`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_org_scoped`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: orgKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-300`,
      email: ``,
      orgId: `org-123`,
      apiKeyId: `key-org`,
    })
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should attach projectId when API key is project-scoped`, async () => {
    const projKey = new ApiKey({
      id: `key-proj`,
      name: `Project Key`,
      keyHash: `hash`,
      keyPrefix: `tdsk_proj`,
      active: true,
      scopes: `write`,
      userId: `user-400`,
      projectId: `proj-456`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_proj_scoped`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: projKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-400`,
      email: ``,
      projectId: `proj-456`,
      apiKeyId: `key-proj`,
    })
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should not attach orgId or projectId when API key has neither`, async () => {
    const bareKey = new ApiKey({
      id: `key-bare`,
      name: `Bare Key`,
      keyHash: `hash`,
      keyPrefix: `tdsk_bare`,
      active: true,
      scopes: `read`,
      userId: `user-500`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_bare_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: bareKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-500`,
      email: ``,
      apiKeyId: `key-bare`,
    })
    expect(mockReq.user).not.toHaveProperty(`orgId`)
    expect(mockReq.user).not.toHaveProperty(`projectId`)
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should include apiKeyRole in req.user when key has a role`, async () => {
    const roleKey = new ApiKey({
      id: `key-role`,
      name: `Role Key`,
      keyHash: `hash`,
      keyPrefix: `tdsk_role`,
      active: true,
      scopes: `read`,
      role: `member`,
      userId: `user-role-1`,
      orgId: `org-role-1`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_role_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: roleKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).toEqual({
      userId: `user-role-1`,
      email: ``,
      orgId: `org-role-1`,
      apiKeyId: `key-role`,
      apiKeyRole: `member`,
    })
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should reject API key with invalid role value`, async () => {
    const badRoleKey = new ApiKey({
      id: `key-bad-role`,
      name: `Bad Role Key`,
      keyHash: `hash`,
      keyPrefix: `tdsk_badr`,
      active: true,
      scopes: `read`,
      role: `super`,
      userId: `user-bad-role`,
      orgId: `org-bad-role`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_bad_role_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: badRoleKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      error: `Invalid API key configuration`,
    })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should not include apiKeyRole when key has no role set`, async () => {
    const noRoleKey = new ApiKey({
      id: `key-no-role`,
      name: `No Role Key`,
      keyHash: `hash`,
      keyPrefix: `tdsk_noro`,
      active: true,
      scopes: `read`,
      userId: `user-no-role`,
    })
    mockAuth.extract.mockReturnValue(`tdsk_no_role_key`)
    mockDb.services.apiKey.getByHash.mockResolvedValue({ data: noRoleKey })
    const mockReq = { path: `/_/orgs`, headers: {} } as unknown as Request

    const middleware = validateApiKeyAuth(mockApp)
    await middleware(mockReq, mockRes, mockNext)

    expect(mockReq.user).not.toHaveProperty(`apiKeyRole`)
    expect(mockNext).toHaveBeenCalled()
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
      apiKeyId: `key-8`,
    })
  })
})
