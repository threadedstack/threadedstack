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
                increment: vi.fn().mockResolvedValue({
                  data: { projects: 1 },
                }),
                incrementIfUnderLimit: vi.fn().mockResolvedValue({
                  data: { projects: 1 },
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
    mockRes = { status: mockStatus, json: mockJson, on: vi.fn() } as Partial<TResponse>
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
    expect(req.quotaIncremented).toEqual({
      orgId: `org-1`,
      period: expect.any(String),
      resource: `projects`,
    })
  })

  it(`should register rollback that decrements on handler failure`, async () => {
    const req = buildMockReq()
    const mockOn = mockRes.on as ReturnType<typeof vi.fn>
    const quota = req.app.locals.db.services.quota as any
    quota.decrement = vi.fn().mockResolvedValue({ data: { projects: 0 } })

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockOn).toHaveBeenCalledWith(`finish`, expect.any(Function))
    const finishCallback = mockOn.mock.calls.find((c: any[]) => c[0] === `finish`)?.[1]

    // Simulate handler failure (status 500)
    ;(mockRes as any).statusCode = 500
    finishCallback()

    expect(quota.decrement).toHaveBeenCalledWith(`org-1`, expect.any(String), `projects`)
  })

  it(`should not decrement on successful response`, async () => {
    const req = buildMockReq()
    const mockOn = mockRes.on as ReturnType<typeof vi.fn>
    const quota = req.app.locals.db.services.quota as any
    quota.decrement = vi.fn()

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    const finishCallback = mockOn.mock.calls.find((c: any[]) => c[0] === `finish`)?.[1]

    // Simulate successful response (status 201)
    ;(mockRes as any).statusCode = 201
    finishCallback()

    expect(quota.decrement).not.toHaveBeenCalled()
  })

  it(`should return 403 when at quota limit`, async () => {
    const req = buildMockReq()
    const quota = req.app.locals.db.services.quota as any
    quota.incrementIfUnderLimit.mockResolvedValue({ data: null, quotaExceeded: true })
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

  it(`should allow unlimited resources (limit = -1) while still tracking usage`, async () => {
    const req = buildMockReq()
    const sub = req.app.locals.db.services.subscription as any
    // Team tier has unlimited projects
    sub.findByUser.mockResolvedValue({ data: { tier: `team` } })

    const quota = req.app.locals.db.services.quota as any

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalled()
    expect(mockStatus).not.toHaveBeenCalled()
    // Tracking is decoupled from enforcement: the counter still increments
    expect(quota.increment).toHaveBeenCalledWith(`org-1`, expect.any(String), `projects`)
    expect(quota.incrementIfUnderLimit).not.toHaveBeenCalled()
    expect(req.quotaIncremented).toEqual({
      orgId: `org-1`,
      period: expect.any(String),
      resource: `projects`,
    })
  })

  it(`should not block unlimited requests when usage tracking fails`, async () => {
    const req = buildMockReq()
    const sub = req.app.locals.db.services.subscription as any
    sub.findByUser.mockResolvedValue({ data: { tier: `team` } })

    const quota = req.app.locals.db.services.quota as any
    quota.increment.mockResolvedValue({ error: new Error(`tracking failed`) })

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    // There is no limit to enforce, so the request proceeds
    expect(mockNext).toHaveBeenCalled()
    expect(mockStatus).not.toHaveBeenCalled()
    expect(req.quotaIncremented).toBeUndefined()
  })

  it(`should register rollback for unlimited-tier tracking on handler failure`, async () => {
    const req = buildMockReq()
    const sub = req.app.locals.db.services.subscription as any
    sub.findByUser.mockResolvedValue({ data: { tier: `team` } })

    const mockOn = mockRes.on as ReturnType<typeof vi.fn>
    const quota = req.app.locals.db.services.quota as any
    quota.decrement = vi.fn().mockResolvedValue({ data: { projects: 0 } })

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockOn).toHaveBeenCalledWith(`finish`, expect.any(Function))
    const finishCallback = mockOn.mock.calls.find((c: any[]) => c[0] === `finish`)?.[1]

    // Simulate handler failure (status 500)
    ;(mockRes as any).statusCode = 500
    finishCallback()

    expect(quota.decrement).toHaveBeenCalledWith(`org-1`, expect.any(String), `projects`)
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

  it(`should return 503 when org lookup returns error`, async () => {
    const req = buildMockReq()
    const org = req.app.locals.db.services.org as any
    org.get.mockResolvedValue({ error: new Error(`DB connection failed`) })

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(503)
    expect(mockJson).toHaveBeenCalledWith({ error: `quota_check_unavailable` })
  })

  it(`should return 503 when subscription lookup fails`, async () => {
    const req = buildMockReq()
    const sub = req.app.locals.db.services.subscription as any
    sub.findByUser.mockResolvedValue({ error: new Error(`Sub lookup failed`) })

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(503)
    expect(mockJson).toHaveBeenCalledWith({ error: `quota_check_unavailable` })
  })

  it(`should return 503 when org.list fails for organizations quota`, async () => {
    const req = buildMockReq({
      path: `/orgs`,
      params: {},
    })
    const org = req.app.locals.db.services.org as any
    org.list.mockResolvedValue({ error: new Error(`List failed`) })

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(503)
    expect(mockJson).toHaveBeenCalledWith({ error: `quota_check_unavailable` })
  })

  it(`should return 503 on unexpected errors (fail closed)`, async () => {
    const req = buildMockReq()
    const org = req.app.locals.db.services.org as any
    org.get.mockRejectedValue(new Error(`DB crashed`))

    await enforceQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(503)
    expect(mockJson).toHaveBeenCalledWith({ error: `quota_check_unavailable` })
  })
})
