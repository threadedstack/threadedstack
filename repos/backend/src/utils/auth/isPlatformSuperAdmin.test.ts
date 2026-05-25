import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest } from '@TBE/types'
import { ERoleType } from '@tdsk/domain'

import { isPlatformSuperAdmin } from './isPlatformSuperAdmin'

describe(`isPlatformSuperAdmin`, () => {
  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      user: { id: `test-user-id`, email: `test@example.com` },
      app: {
        locals: {
          db: {
            services: {
              role: {
                getUserRoles: vi.fn().mockResolvedValue({ data: [] }),
              },
            },
          },
        },
      },
      params: {},
      query: {},
      body: {},
      ...overrides,
    } as unknown as TRequest
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should return true when user has a role with type super`, async () => {
    const req = buildMockReq()
    const mockGetUserRoles = req.app.locals.db.services.role.getUserRoles as ReturnType<
      typeof vi.fn
    >
    mockGetUserRoles.mockResolvedValue({
      data: [{ type: ERoleType.super }],
    })

    const result = await isPlatformSuperAdmin(req)
    expect(result).toBe(true)
    expect(mockGetUserRoles).toHaveBeenCalledWith(`test-user-id`)
  })

  it(`should return false when user has only non-super roles`, async () => {
    const req = buildMockReq()
    const mockGetUserRoles = req.app.locals.db.services.role.getUserRoles as ReturnType<
      typeof vi.fn
    >
    mockGetUserRoles.mockResolvedValue({
      data: [
        { type: ERoleType.admin },
        { type: ERoleType.member },
        { type: ERoleType.member },
      ],
    })

    const result = await isPlatformSuperAdmin(req)
    expect(result).toBe(false)
  })

  it(`should return false when user has no roles (empty array)`, async () => {
    const req = buildMockReq()
    const mockGetUserRoles = req.app.locals.db.services.role.getUserRoles as ReturnType<
      typeof vi.fn
    >
    mockGetUserRoles.mockResolvedValue({ data: [] })

    const result = await isPlatformSuperAdmin(req)
    expect(result).toBe(false)
  })

  it(`should return false when userId is undefined`, async () => {
    const req = buildMockReq({ user: { email: `test@example.com` } })
    const mockGetUserRoles = req.app.locals.db.services.role.getUserRoles as ReturnType<
      typeof vi.fn
    >

    const result = await isPlatformSuperAdmin(req)
    expect(result).toBe(false)
    expect(mockGetUserRoles).not.toHaveBeenCalled()
  })

  it(`should return false when user object is undefined`, async () => {
    const req = buildMockReq({ user: undefined })
    const mockGetUserRoles = req.app.locals.db.services.role.getUserRoles as ReturnType<
      typeof vi.fn
    >

    const result = await isPlatformSuperAdmin(req)
    expect(result).toBe(false)
    expect(mockGetUserRoles).not.toHaveBeenCalled()
  })

  it(`should throw 500 when getUserRoles returns error`, async () => {
    const req = buildMockReq()
    const mockGetUserRoles = req.app.locals.db.services.role.getUserRoles as ReturnType<
      typeof vi.fn
    >
    mockGetUserRoles.mockResolvedValue({
      error: new Error(`DB connection failed`),
    })

    try {
      await isPlatformSuperAdmin(req)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(500)
      expect(err.message).toContain(`Role lookup failed`)
      expect(err.message).toContain(`DB connection failed`)
    }
  })

  it(`should return true when user has multiple roles including one super role`, async () => {
    const req = buildMockReq()
    const mockGetUserRoles = req.app.locals.db.services.role.getUserRoles as ReturnType<
      typeof vi.fn
    >
    mockGetUserRoles.mockResolvedValue({
      data: [
        { type: ERoleType.member },
        { type: ERoleType.admin },
        { type: ERoleType.super },
      ],
    })

    const result = await isPlatformSuperAdmin(req)
    expect(result).toBe(true)
  })
})
