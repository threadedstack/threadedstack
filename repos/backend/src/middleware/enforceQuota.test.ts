import type { Router } from 'express'
import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'

import express from 'express'
import request from 'supertest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAsyncRouter } from '../server/router'
import { enforceQuota, enforceOrgCreationQuota } from './enforceQuota'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe(`enforceOrgCreationQuota middleware`, () => {
  let mockNext: ReturnType<typeof vi.fn>
  let mockRes: Partial<TResponse>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      user: { id: `user-1` },
      app: {
        locals: {
          db: {
            services: {
              org: {
                list: vi.fn().mockResolvedValue({ data: [] }),
              },
              subscription: {
                findByUser: vi.fn().mockResolvedValue({ data: { tier: `free` } }),
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

  it(`should call next when no userId`, async () => {
    const req = buildMockReq({ user: undefined })
    await enforceOrgCreationQuota(req, mockRes as TResponse, mockNext as NextFunction)
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should call next when under the owned-org limit`, async () => {
    const req = buildMockReq()
    await enforceOrgCreationQuota(req, mockRes as TResponse, mockNext as NextFunction)
    expect(mockNext).toHaveBeenCalled()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should return 403 when at the owned-org limit`, async () => {
    const req = buildMockReq()
    const org = req.app.locals.db.services.org as any
    // Free tier = 1 org, user owns 1 already
    org.list.mockResolvedValue({ data: [{ id: `org-1` }] })

    await enforceOrgCreationQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(403)
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ error: `quota_exceeded`, resource: `organizations` })
    )
  })

  it(`should allow unlimited-org tiers`, async () => {
    const req = buildMockReq()
    const sub = req.app.locals.db.services.subscription as any
    sub.findByUser.mockResolvedValue({ data: { tier: `team` } })

    await enforceOrgCreationQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalled()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should return 503 when subscription lookup fails`, async () => {
    const req = buildMockReq()
    const sub = req.app.locals.db.services.subscription as any
    sub.findByUser.mockResolvedValue({ error: new Error(`Sub lookup failed`) })

    await enforceOrgCreationQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(503)
  })

  it(`should return 503 when org.list fails`, async () => {
    const req = buildMockReq()
    const org = req.app.locals.db.services.org as any
    org.list.mockResolvedValue({ error: new Error(`List failed`) })

    await enforceOrgCreationQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(503)
  })

  it(`should return 503 on unexpected errors (fail closed)`, async () => {
    const req = buildMockReq()
    const org = req.app.locals.db.services.org as any
    org.list.mockRejectedValue(new Error(`DB crashed`))

    await enforceOrgCreationQuota(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(503)
  })
})

describe(`enforceQuota(resourceKey) factory`, () => {
  let mockNext: ReturnType<typeof vi.fn>
  let mockRes: Partial<TResponse>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      method: `POST`,
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
              },
              subscription: {
                findByUser: vi.fn().mockResolvedValue({ data: { tier: `free` } }),
              },
              quota: {
                findByOrgAndPeriod: vi.fn().mockResolvedValue({ data: { projects: 0 } }),
                increment: vi.fn().mockResolvedValue({ data: { projects: 1 } }),
                incrementIfUnderLimit: vi
                  .fn()
                  .mockResolvedValue({ data: { projects: 1 } }),
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
    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should call next when no userId`, async () => {
    const req = buildMockReq({ user: undefined })
    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should call next when orgId param is missing`, async () => {
    const req = buildMockReq({ params: {} })
    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should call next when under quota`, async () => {
    const req = buildMockReq()
    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)
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

    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)

    const finishCallback = mockOn.mock.calls.find((c: any[]) => c[0] === `finish`)?.[1]
    ;(mockRes as any).statusCode = 500
    finishCallback()

    expect(quota.decrement).toHaveBeenCalledWith(`org-1`, expect.any(String), `projects`)
  })

  it(`should not decrement on successful response`, async () => {
    const req = buildMockReq()
    const mockOn = mockRes.on as ReturnType<typeof vi.fn>
    const quota = req.app.locals.db.services.quota as any
    quota.decrement = vi.fn()

    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)

    const finishCallback = mockOn.mock.calls.find((c: any[]) => c[0] === `finish`)?.[1]
    ;(mockRes as any).statusCode = 201
    finishCallback()

    expect(quota.decrement).not.toHaveBeenCalled()
  })

  it(`should return 403 when at quota limit`, async () => {
    const req = buildMockReq()
    const quota = req.app.locals.db.services.quota as any
    quota.incrementIfUnderLimit.mockResolvedValue({ data: null, quotaExceeded: true })
    quota.findByOrgAndPeriod.mockResolvedValue({ data: { projects: 2 } })

    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(403)
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ error: `quota_exceeded`, resource: `projects` })
    )
  })

  it(`should allow unlimited resources (limit = -1) while still tracking usage`, async () => {
    const req = buildMockReq()
    const sub = req.app.locals.db.services.subscription as any
    sub.findByUser.mockResolvedValue({ data: { tier: `team` } })

    const quota = req.app.locals.db.services.quota as any

    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalled()
    expect(mockStatus).not.toHaveBeenCalled()
    expect(quota.increment).toHaveBeenCalledWith(`org-1`, expect.any(String), `projects`)
    expect(quota.incrementIfUnderLimit).not.toHaveBeenCalled()
  })

  it(`should not block unlimited requests when usage tracking fails`, async () => {
    const req = buildMockReq()
    const sub = req.app.locals.db.services.subscription as any
    sub.findByUser.mockResolvedValue({ data: { tier: `team` } })

    const quota = req.app.locals.db.services.quota as any
    quota.increment.mockResolvedValue({ error: new Error(`tracking failed`) })

    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalled()
    expect(mockStatus).not.toHaveBeenCalled()
    expect(req.quotaIncremented).toBeUndefined()
  })

  it(`should return next when the resource key has no defined plan limit`, async () => {
    const req = buildMockReq()

    await enforceQuota(`not-a-real-resource` as any)(
      req,
      mockRes as TResponse,
      mockNext as NextFunction
    )
    expect(mockNext).toHaveBeenCalled()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should return 503 when org lookup returns error`, async () => {
    const req = buildMockReq()
    const org = req.app.locals.db.services.org as any
    org.get.mockResolvedValue({ error: new Error(`DB connection failed`) })

    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(503)
    expect(mockJson).toHaveBeenCalledWith({ error: `quota_check_unavailable` })
  })

  it(`should call next when org is not found`, async () => {
    const req = buildMockReq()
    const org = req.app.locals.db.services.org as any
    org.get.mockResolvedValue({ data: null })

    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalled()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`should return 503 when subscription lookup fails`, async () => {
    const req = buildMockReq()
    const sub = req.app.locals.db.services.subscription as any
    sub.findByUser.mockResolvedValue({ error: new Error(`Sub lookup failed`) })

    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(503)
    expect(mockJson).toHaveBeenCalledWith({ error: `quota_check_unavailable` })
  })

  it(`should return 503 on unexpected errors (fail closed)`, async () => {
    const req = buildMockReq()
    const org = req.app.locals.db.services.org as any
    org.get.mockRejectedValue(new Error(`DB crashed`))

    await enforceQuota(`projects`)(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(503)
    expect(mockJson).toHaveBeenCalledWith({ error: `quota_check_unavailable` })
  })
})

/**
 * Real-routing regression guard: the original bug survived because both the
 * middleware-mount fix and its test doubles only ever exercised a
 * hand-constructed req (req.params / req.path set directly), never the
 * actual Express nested-router chain. `router.use(path, ...mw, childRouter)`
 * strips the matched path prefix for EVERY layer registered in that same
 * `.use()` call, including plain middleware functions — so a path-suffix
 * inference approach silently no-ops one level down while req.params
 * (resolved by the path-to-regexp match itself, independent of url
 * stripping) is still correct. Mounting through createAsyncRouter() here
 * mirrors setupEndpoints.ts's real `router.use(path, ...mw, childRouter)`
 * nesting exactly, so this test would fail if enforceQuota ever went back
 * to inferring its resource from req.path/req.originalUrl instead of a
 * caller-supplied resourceKey.
 */
describe(`enforceQuota — real nested Express routing`, () => {
  const buildDb = (overrides: Record<string, any> = {}) => ({
    services: {
      org: {
        get: vi.fn().mockResolvedValue({ data: { id: `org-1`, ownerId: `owner-1` } }),
      },
      subscription: {
        findByUser: vi.fn().mockResolvedValue({ data: { tier: `free` } }),
      },
      quota: {
        findByOrgAndPeriod: vi.fn().mockResolvedValue({ data: { secrets: 0 } }),
        increment: vi.fn().mockResolvedValue({ data: { secrets: 1 } }),
        incrementIfUnderLimit: vi.fn().mockResolvedValue({ data: { secrets: 1 } }),
      },
      ...overrides,
    },
  })

  // Mirrors the real mount chain: app -> /orgs -> orgSecrets.ts's
  // `/:orgId/secrets` router.use(path, enforceQuota('secrets'), childRouter).
  const buildApp = (db: any) => {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      ;(req as any).user = { id: `user-1` }
      next()
    })
    app.locals = { db } as any

    const secretsChild = createAsyncRouter()
    secretsChild.post(`/`, (_req, res) => {
      res.status(201).json({ data: { id: `secret-1` } })
    })

    const orgsRouter = createAsyncRouter()
    orgsRouter.use(
      `/:orgId/secrets`,
      enforceQuota(`secrets`) as any,
      secretsChild as unknown as Router
    )

    app.use(`/orgs`, orgsRouter as unknown as Router)

    app.use(
      (
        err: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        res.status(500).json({ error: err.message })
      }
    )

    return app
  }

  it(`resolves orgId from the nested route and creates the resource when under quota`, async () => {
    const db = buildDb()
    const app = buildApp(db)

    const response = await request(app).post(`/orgs/org-1/secrets`).send({})

    expect(response.status).toBe(201)
    expect(db.services.org.get).toHaveBeenCalledWith(`org-1`)
    expect(db.services.quota.incrementIfUnderLimit).toHaveBeenCalledWith(
      `org-1`,
      expect.any(String),
      `secrets`,
      expect.any(Number)
    )
  })

  it(`blocks with 403 when the nested route is over quota`, async () => {
    const db = buildDb({
      quota: {
        findByOrgAndPeriod: vi.fn().mockResolvedValue({ data: { secrets: 5 } }),
        increment: vi.fn(),
        incrementIfUnderLimit: vi
          .fn()
          .mockResolvedValue({ data: null, quotaExceeded: true }),
      },
    })
    const app = buildApp(db)

    const response = await request(app).post(`/orgs/org-1/secrets`).send({})

    expect(response.status).toBe(403)
    expect(response.body).toEqual(
      expect.objectContaining({ error: `quota_exceeded`, resource: `secrets` })
    )
  })

  it(`does not gate non-POST requests on the same nested route`, async () => {
    const db = buildDb()
    const app = buildApp(db)

    // No GET handler registered on secretsChild, so this proves the request
    // reached past enforceQuota (404 from the router, not a quota block).
    const response = await request(app).get(`/orgs/org-1/secrets`)

    expect(response.status).toBe(404)
    expect(db.services.org.get).not.toHaveBeenCalled()
  })
})

/**
 * Project-scoped secrets create resources via the exact same createSecret
 * handler as org-scoped secrets, but through a SEPARATE sibling mount
 * (orgProjects.ts's `projectSecrets`, nested one level deeper than
 * orgSecrets.ts). A prior version of this fix covered orgSecrets but missed
 * this sibling entirely — caught in review, not by any test — so this is a
 * real 3-level nested mount (app -> /orgs -> /:orgId/projects ->
 * /:projectId/secrets) proving the gap is closed and guarding against it
 * reopening.
 */
describe(`enforceQuota — project-scoped secrets (real 3-level nested routing)`, () => {
  const buildDb = (overrides: Record<string, any> = {}) => ({
    services: {
      org: {
        get: vi.fn().mockResolvedValue({ data: { id: `org-1`, ownerId: `owner-1` } }),
      },
      subscription: {
        findByUser: vi.fn().mockResolvedValue({ data: { tier: `free` } }),
      },
      quota: {
        findByOrgAndPeriod: vi.fn().mockResolvedValue({ data: { secrets: 0 } }),
        increment: vi.fn().mockResolvedValue({ data: { secrets: 1 } }),
        incrementIfUnderLimit: vi.fn().mockResolvedValue({ data: { secrets: 1 } }),
      },
      ...overrides,
    },
  })

  // Mirrors the real mount chain: app -> /orgs -> /:orgId/projects (orgProjects.ts)
  // -> /:projectId/secrets (projectSecrets, enforceQuota('secrets') in its
  // own middleware array).
  const buildApp = (db: any) => {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      ;(req as any).user = { id: `user-1` }
      next()
    })
    app.locals = { db } as any

    const projectSecretsChild = createAsyncRouter()
    projectSecretsChild.post(`/`, (_req, res) => {
      res.status(201).json({ data: { id: `secret-1` } })
    })

    const projectsRouter = createAsyncRouter()
    projectsRouter.use(
      `/:projectId/secrets`,
      enforceQuota(`secrets`) as any,
      projectSecretsChild as unknown as Router
    )

    const orgsRouter = createAsyncRouter()
    orgsRouter.use(`/:orgId/projects`, projectsRouter as unknown as Router)

    app.use(`/orgs`, orgsRouter as unknown as Router)

    app.use(
      (
        err: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        res.status(500).json({ error: err.message })
      }
    )

    return app
  }

  it(`resolves orgId through the doubly-nested route and enforces quota on project-scoped secrets`, async () => {
    const db = buildDb()
    const app = buildApp(db)

    const response = await request(app)
      .post(`/orgs/org-1/projects/proj-1/secrets`)
      .send({})

    expect(response.status).toBe(201)
    expect(db.services.org.get).toHaveBeenCalledWith(`org-1`)
    expect(db.services.quota.incrementIfUnderLimit).toHaveBeenCalledWith(
      `org-1`,
      expect.any(String),
      `secrets`,
      expect.any(Number)
    )
  })

  it(`blocks with 403 when the project-scoped route is over quota`, async () => {
    const db = buildDb({
      quota: {
        findByOrgAndPeriod: vi.fn().mockResolvedValue({ data: { secrets: 5 } }),
        increment: vi.fn(),
        incrementIfUnderLimit: vi
          .fn()
          .mockResolvedValue({ data: null, quotaExceeded: true }),
      },
    })
    const app = buildApp(db)

    const response = await request(app)
      .post(`/orgs/org-1/projects/proj-1/secrets`)
      .send({})

    expect(response.status).toBe(403)
    expect(response.body).toEqual(
      expect.objectContaining({ error: `quota_exceeded`, resource: `secrets` })
    )
  })
})
