import type { Router } from 'express'
import type { TApp } from '@TBE/types'

import express from 'express'
import request from 'supertest'
import { describe, it, expect, vi } from 'vitest'
import { EPMethod } from '@TBE/types'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

// Bypass the auth/membership stack: this suite proves ROUTE REGISTRATION,
// which those guards are unrelated to (and are already covered by their own
// dedicated tests).
vi.mock(`@TBE/middleware/projectAccessGuard`, () => ({
  projectAccessGuard: () => (_req: any, _res: any, next: any) => next(),
}))
vi.mock(`@TBE/middleware/projectMemberGuard`, () => ({
  projectMemberGuard: () => (_req: any, _res: any, next: any) => next(),
}))
vi.mock(`@TBE/middleware/authorize`, () => ({
  authorize: () => (_req: any, _res: any, next: any) => next(),
}))

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn() }))
vi.mock(`@TBE/services/functions/functionExecutor`, () => ({
  FunctionExecutor: { execute: mockExecute },
}))

// Route the real `@TBE/endpoints` singleton to ONLY the real `orgProjects`
// config, mounted under `/orgs` the same way `orgs.ts` mounts it in
// production — this exercises the ACTUAL org->project->functions->invoke
// registration chain, not a hand-rolled stand-in that could drift from it.
vi.mock(`@TBE/endpoints`, async () => {
  const { orgProjects } = await import(`@TBE/endpoints/orgs/orgProjects`)
  return {
    endpoints: {
      orgsRoot: {
        path: `/orgs`,
        method: EPMethod.Use,
        endpoints: { orgProjects },
      },
    },
  }
})

import { setupEndpoints } from '@TBE/middleware/setupEndpoints'

/**
 * Regression coverage for a real incident: `invokeFunction` was written and
 * unit-tested in isolation, but never added to `projectFunctions.endpoints`
 * in orgProjects.ts — the actually-mounted router. The handler-level unit
 * test and the type check both stayed green while the route 404'd in
 * production. This suite builds a real Express app from the REAL
 * `orgProjects` config via the REAL `setupEndpoints` builder and hits the
 * route through supertest, so a future regression of the same shape (a
 * handler that exists but isn't registered on its parent router) fails here
 * instead of hiding behind green tests.
 */
describe(`orgProjects — projectFunctions route registration (real mounted router)`, () => {
  const orgId = `org1234567`
  const projectId = `proj123456`
  const funcId = `func123456`

  const buildApp = () => {
    const app = express()
    app.use(express.json())
    app.locals = {
      db: {
        services: {
          function: {
            get: vi.fn().mockResolvedValue({ data: { id: funcId, name: `test-fn` } }),
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

  it(`routes POST /orgs/:orgId/projects/:projectId/functions/:id/invoke to invokeFunction (would 404 if unregistered)`, async () => {
    mockExecute.mockResolvedValue({
      output: { ok: true },
      logs: `did the thing`,
      error: undefined,
    })

    const response = await request(buildApp())
      .post(`/orgs/${orgId}/projects/${projectId}/functions/${funcId}/invoke`)
      .send({ input: { foo: `bar` } })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      data: {
        result: { ok: true },
        logs: `did the thing`,
        durationMs: expect.any(Number),
      },
    })
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ id: funcId }),
      expect.objectContaining({ context: { args: { foo: `bar` } } })
    )
  })

  it(`still 404s a route that genuinely does not exist (proves the 200 above is a real route match, not a catch-all)`, async () => {
    const response = await request(buildApp()).post(
      `/orgs/${orgId}/projects/${projectId}/functions/${funcId}/not-a-real-route`
    )

    expect(response.status).toBe(404)
  })
})
