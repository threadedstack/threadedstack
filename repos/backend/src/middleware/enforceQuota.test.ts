import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'
import { mapRouteToResource, enforceQuota } from './enforceQuota'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe(`mapRouteToResource`, () => {
  it(`should map POST /projects to projects`, () => {
    expect(mapRouteToResource(`/projects`, `POST`)).toBe(`projects`)
  })

  it(`should map POST /endpoints to endpoints`, () => {
    expect(mapRouteToResource(`/endpoints`, `POST`)).toBe(`endpoints`)
  })

  it(`should map POST /secrets to secrets`, () => {
    expect(mapRouteToResource(`/secrets`, `POST`)).toBe(`secrets`)
  })

  it(`should map POST /threads to threads`, () => {
    expect(mapRouteToResource(`/threads`, `POST`)).toBe(`threads`)
  })

  it(`should map POST /threads/:id/messages to messages`, () => {
    expect(mapRouteToResource(`/threads/abc-123/messages`, `POST`)).toBe(`messages`)
  })

  it(`should map POST /orgs to organizations`, () => {
    expect(mapRouteToResource(`/orgs`, `POST`)).toBe(`organizations`)
  })

  it(`should return undefined for GET requests`, () => {
    expect(mapRouteToResource(`/projects`, `GET`)).toBeUndefined()
  })

  it(`should return undefined for unmapped routes`, () => {
    expect(mapRouteToResource(`/some/random/path`, `POST`)).toBeUndefined()
  })
})

describe(`enforceQuota middleware`, () => {
  let mockNext: ReturnType<typeof vi.fn>
  let mockRes: Partial<TResponse>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      method: `POST`,
      path: `/projects`,
      user: { id: `user-1` },
      params: { orgId: `org-1` },
      app: {
        locals: {
          db: {
            services: {
              org: {
                get: vi.fn().mockResolvedValue({
                  data: { id: `org-1`, ownerId: `owner-1` },
                }),
                list: vi.fn().mockResolvedValue({ data: [] }),
              },
              subscription: {
                findByUser: vi.fn().mockResolvedValue({
                  data: { tier: `free` },
                }),
              },
              quota: {
                findByOrgAndPeriod: vi.fn().mockResolvedValue({
                  data: { projects: 0 },
                }),
              },
            },
          },
        },
      },
      ...overrides,
    } as unknown as TRequest
  }

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn(() => ({ json: mockJson }) as any)
    mockRes = { status: mockStatus, json: mockJson } as Partial<TResponse>
    mockNext = vi.fn()
    vi.clearAllMocks()
  })

  it(`should call next for non-POST requests`, async () => {
    const req = buildMockReq({ method: `GET` })
    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should call next for unmapped routes`, async () => {
    const req = buildMockReq({ path: `/some/random/path` })
    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should call next when no userId`, async () => {
    const req = buildMockReq({ user: undefined })
    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should call next when under quota`, async () => {
    const req = buildMockReq()
    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)
    expect(mockNext).toHaveBeenCalled()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should return 403 when at quota limit`, async () => {
    const req = buildMockReq()
    const quota = req.app.locals.db.services.quota as any
    // Free tier limit for projects is 2
    quota.findByOrgAndPeriod.mockResolvedValue({ data: { projects: 2 } })

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(403)
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: `quota_exceeded`,
        resource: `projects`,
      })
    )
  })

  it(`should allow unlimited resources (limit = -1)`, async () => {
    const req = buildMockReq()
    const sub = req.app.locals.db.services.subscription as any
    // Team tier has unlimited projects
    sub.findByUser.mockResolvedValue({ data: { tier: `team` } })

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalled()
  })

  it(`should handle organizations quota by counting owned orgs`, async () => {
    const req = buildMockReq({
      path: `/orgs`,
      params: {},
    })
    const sub = req.app.locals.db.services.subscription as any
    sub.findByUser.mockResolvedValue({ data: { tier: `free` } })

    const org = req.app.locals.db.services.org as any
    // Free tier = 1 org, user owns 1 already
    org.list.mockResolvedValue({ data: [{ id: `org-1` }] })

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(403)
  })

  it(`should return 503 on errors (fail closed)`, async () => {
    const req = buildMockReq()
    const org = req.app.locals.db.services.org as any
    org.get.mockRejectedValue(new Error(`DB crashed`))

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(503)
    expect(mockJson).toHaveBeenCalledWith({ error: `quota_check_unavailable` })
  })
})
