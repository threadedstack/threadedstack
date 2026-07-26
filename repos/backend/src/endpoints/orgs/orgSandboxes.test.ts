import type { Router } from 'express'
import type { TApp } from '@TBE/types'

import express from 'express'
import request from 'supertest'
import { describe, it, expect, vi } from 'vitest'
import { EPMethod } from '@TBE/types'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// Bypass the auth/membership stack: this suite proves ROUTE REGISTRATION
// ORDER, which those guards are unrelated to (and are already covered by
// their own dedicated tests).
vi.mock(`@TBE/middleware/projectAccessGuard`, () => ({
  projectAccessGuard: () => (_req: any, _res: any, next: any) => next(),
}))
vi.mock(`@TBE/middleware/authorize`, () => ({
  authorize: () => (_req: any, _res: any, next: any) => next(),
}))

// Route the real `@TBE/endpoints` singleton to ONLY the real `orgSandboxes`
// config, mounted under `/orgs` the same way `orgs.ts` mounts it in
// production — this exercises the ACTUAL registration order of
// `listOrgSandboxSessions` (`/sessions`) against `getSandbox` (`/:id`).
vi.mock(`@TBE/endpoints`, async () => {
  const { orgSandboxes } = await import(`@TBE/endpoints/orgs/orgSandboxes`)
  return {
    endpoints: {
      orgsRoot: {
        path: `/orgs`,
        method: EPMethod.Use,
        endpoints: { orgSandboxes },
      },
    },
  }
})

import { setupEndpoints } from '@TBE/middleware/setupEndpoints'

/**
 * Regression coverage for the routing gotcha called out in rec_p1YI6B: since
 * `endpoints: {}` maps register routes in strict insertion order with no
 * static-vs-param sorting, a static sibling path (`/sessions`) registered
 * AFTER a param path (`/:id`, `getSandbox`) would incorrectly match `/:id`
 * first (id="sessions") and hit `getSandbox` instead. This suite builds a
 * real Express app from the REAL `orgSandboxes` config via the REAL
 * `setupEndpoints` builder and hits the route through supertest, so a future
 * reordering regression fails here instead of hiding behind green
 * handler-level unit tests.
 */
describe(`orgSandboxes — listOrgSandboxSessions route registration (real mounted router)`, () => {
  const orgId = `org1234567`

  const buildApp = () => {
    const app = express()
    app.use(express.json())
    app.locals = {
      db: {
        services: {
          sandboxSession: {
            listByOrg: vi.fn().mockResolvedValue({ data: [{ id: `sess-1` }] }),
          },
          sandbox: {
            get: vi
              .fn()
              .mockResolvedValue({ data: { id: `sb_1234567`, orgId, name: `test-sb` } }),
          },
        },
      },
      config: { proxy: { publicRoutes: [] } },
    } as unknown as TApp[`locals`]

    setupEndpoints(app as unknown as TApp, app as unknown as Router)

    app.use(
      (
        err: any,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        res.status(err?.statusCode || err?.status || 500).json({ error: err?.message })
      }
    )

    return app
  }

  it(`routes GET /orgs/:orgId/sandboxes/sessions to listOrgSandboxSessions, not getSandbox (would 400 "Invalid id format" if shadowed by /:id)`, async () => {
    const response = await request(buildApp()).get(`/orgs/${orgId}/sandboxes/sessions`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      data: [{ id: `sess-1` }],
      limit: expect.any(Number),
      offset: expect.any(Number),
    })
  })

  it(`still routes GET /orgs/:orgId/sandboxes/:id to getSandbox for a real sandbox id (proves /:id still works alongside the new static sibling)`, async () => {
    const response = await request(buildApp()).get(`/orgs/${orgId}/sandboxes/sb_1234567`)

    // getSandbox's response shape (`{ data }` only, no `limit`/`offset`) is
    // distinct from listOrgSandboxSessions's — asserting on it proves this
    // request matched getSandbox specifically, not merely "some" handler.
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      data: { id: `sb_1234567`, orgId, name: `test-sb` },
    })
  })
})
