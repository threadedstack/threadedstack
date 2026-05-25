import type { Response } from 'express'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest } from '@TBE/types'

// Mock logger
vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// Mock pxToBeHeader
vi.mock(`@TBE/utils/auth/pxToBeHeader`, () => ({
  pxToBeHeader: vi.fn(),
}))

// Mock @tdsk/domain — inline Exception class to avoid vitest hoisting issues
vi.mock(`@tdsk/domain`, () => ({
  fromAuthHeaders: vi.fn(),
  Exception: class Exception extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { authenticateRequest } from './authenticateRequest'
import { pxToBeHeader } from '@TBE/utils/auth/pxToBeHeader'
import { fromAuthHeaders } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'

type TExceptionLike = Error & { status: number }

describe(`authenticateRequest`, () => {
  const mockUser = { id: `user-123`, email: `test@example.com` }

  const buildMockRes = () => {
    return { locals: {} } as unknown as Response
  }

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      app: {
        locals: {
          db: {
            services: {
              user: {
                get: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
              },
              role: {
                isOrgMember: vi.fn().mockResolvedValue({ data: true, error: null }),
              },
            },
          },
        },
      },
      ...overrides,
    } as unknown as TRequest
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should call pxToBeHeader to extract proxy headers`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({ userId: `user-123` })

    const req = buildMockReq()
    const res = buildMockRes()
    await authenticateRequest(req, res)

    expect(pxToBeHeader).toHaveBeenCalledWith(req)
  })

  it(`should set req.user when valid auth headers and user found`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({ userId: `user-123` })

    const req = buildMockReq()
    const res = buildMockRes()
    await authenticateRequest(req, res)

    expect(req.user).toEqual(mockUser)
  })

  it(`should set res.locals.auth when user found`, async () => {
    const authObj = { userId: `user-123`, orgId: `org-1` }
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue(authObj)

    const req = buildMockReq()
    const res = buildMockRes()
    await authenticateRequest(req, res)

    expect(res.locals.auth).toEqual(authObj)
  })

  it(`should throw 401 when no userId in auth headers`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({ userId: undefined })

    const req = buildMockReq()
    const res = buildMockRes()

    try {
      await authenticateRequest(req, res)
      expect.unreachable(`Should have thrown`)
    } catch (err) {
      expect((err as TExceptionLike).status).toBe(401)
      expect((err as Error).message).toContain(`A valid and authorized user is required`)
    }
  })

  it(`should throw 401 when fromAuthHeaders returns empty object`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({})

    const req = buildMockReq()
    const res = buildMockRes()

    try {
      await authenticateRequest(req, res)
      expect.unreachable(`Should have thrown`)
    } catch (err) {
      expect((err as TExceptionLike).status).toBe(401)
    }
  })

  it(`should throw 401 when user lookup returns error`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({ userId: `user-123` })

    const req = buildMockReq()
    const res = buildMockRes()
    const mockGet = req.app.locals.db.services.user.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null, error: new Error(`DB connection failed`) })

    try {
      await authenticateRequest(req, res)
      expect.unreachable(`Should have thrown`)
    } catch (err) {
      expect((err as TExceptionLike).status).toBe(401)
      expect((err as Error).message).toContain(`Authentication failed`)
    }
  })

  it(`should log error when user lookup fails`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({ userId: `user-123` })

    const dbError = new Error(`DB connection failed`)
    const req = buildMockReq()
    const res = buildMockRes()
    const mockGet = req.app.locals.db.services.user.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null, error: dbError })

    try {
      await authenticateRequest(req, res)
    } catch {
      // expected
    }

    expect(logger.error).toHaveBeenCalledWith(`Auth user lookup failed:`, dbError)
  })

  it(`should throw 401 when user not found in DB`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({ userId: `user-123` })

    const req = buildMockReq()
    const res = buildMockRes()
    const mockGet = req.app.locals.db.services.user.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null, error: null })

    try {
      await authenticateRequest(req, res)
      expect.unreachable(`Should have thrown`)
    } catch (err) {
      expect((err as TExceptionLike).status).toBe(401)
      expect((err as Error).message).toContain(
        `A valid and authorized user could not be found`
      )
    }
  })

  it(`should call db.services.user.get with the userId from auth headers`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({ userId: `user-456` })

    const req = buildMockReq()
    const res = buildMockRes()
    await authenticateRequest(req, res)

    expect(req.app.locals.db.services.user.get).toHaveBeenCalledWith(`user-456`)
  })

  it(`should skip membership check when no apiKeyId in auth`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({ userId: `user-123`, orgId: `org-1` })

    const req = buildMockReq()
    const res = buildMockRes()
    await authenticateRequest(req, res)

    expect(req.app.locals.db.services.role.isOrgMember).not.toHaveBeenCalled()
  })

  it(`should skip membership check when no orgId in auth`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({ userId: `user-123`, apiKeyId: `key-1` })

    const req = buildMockReq()
    const res = buildMockRes()
    await authenticateRequest(req, res)

    expect(req.app.locals.db.services.role.isOrgMember).not.toHaveBeenCalled()
  })

  it(`should pass when API key owner is still an org member`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({
      userId: `user-123`,
      apiKeyId: `key-1`,
      orgId: `org-1`,
    })

    const req = buildMockReq()
    const res = buildMockRes()
    await authenticateRequest(req, res)

    expect(req.app.locals.db.services.role.isOrgMember).toHaveBeenCalledWith(
      `user-123`,
      `org-1`
    )
    expect(req.user).toEqual(mockUser)
  })

  it(`should throw 401 when API key owner is no longer an org member`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({
      userId: `user-123`,
      apiKeyId: `key-1`,
      orgId: `org-1`,
    })

    const req = buildMockReq()
    const res = buildMockRes()
    const mockIsOrgMember = req.app.locals.db.services.role.isOrgMember as ReturnType<
      typeof vi.fn
    >
    mockIsOrgMember.mockResolvedValue({ data: false, error: null })

    try {
      await authenticateRequest(req, res)
      expect.unreachable(`Should have thrown`)
    } catch (err) {
      expect((err as TExceptionLike).status).toBe(401)
      expect((err as Error).message).toContain(
        `API key owner is no longer a member of the organization`
      )
    }
  })

  it(`should throw 401 and log error when membership check fails`, async () => {
    const mockFromAuth = fromAuthHeaders as ReturnType<typeof vi.fn>
    mockFromAuth.mockReturnValue({
      userId: `user-123`,
      apiKeyId: `key-1`,
      orgId: `org-1`,
    })

    const memberErr = new Error(`DB query failed`)
    const req = buildMockReq()
    const res = buildMockRes()
    const mockIsOrgMember = req.app.locals.db.services.role.isOrgMember as ReturnType<
      typeof vi.fn
    >
    mockIsOrgMember.mockResolvedValue({ data: null, error: memberErr })

    try {
      await authenticateRequest(req, res)
      expect.unreachable(`Should have thrown`)
    } catch (err) {
      expect((err as TExceptionLike).status).toBe(401)
      expect((err as Error).message).toContain(`Authentication failed`)
    }

    expect(logger.error).toHaveBeenCalledWith(
      `API key membership check failed:`,
      memberErr
    )
  })
})
