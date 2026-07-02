import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

/**
 * Tier 1: Direct Path Equivalence Tests
 *
 * The backend mounts resources under both:
 *   - Org-scoped paths: /_/orgs/:orgId/<resource>
 *   - Direct paths:     /_/<resource>
 *
 * All existing tests use org-scoped paths. This test verifies the direct
 * mounts are wired up correctly and return the expected responses.
 *
 * Route mounting (from accounts.ts):
 *   Direct mounts: orgs, users, agents (OpenAI-compat routes only), assets, subscriptions, invitations
 *   Org-scoped only: projects, sandboxes, providers (incl. models), secrets, api-keys, endpoints, functions, skills, schedules
 */
describe('Tier 1: Direct Path Equivalence', () => {
  const ctx = readContext()

  // -------------------------------------------------------------------------
  // Direct paths that return 200 + array
  // -------------------------------------------------------------------------

  describe('direct paths that return data', () => {
    test('GET /_/orgs returns 200 with array', async () => {
      const res = await get<Record<string, any>[]>('/orgs')

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('GET /_/users?orgId=<id> returns 200 with array', async () => {
      const res = await get<Record<string, any>[]>(`/users?orgId=${ctx.orgId}`)

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('GET /_/subscriptions/plans returns 200 with array', async () => {
      const res = await get<Record<string, any>[]>('/subscriptions/plans')

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('GET /_/subscriptions/current returns 200 with subscription', async () => {
      const res = await get<Record<string, any>>('/subscriptions/current')

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      // Should have at minimum userId and tier
      expect(res.data.userId).toBeDefined()
      expect(res.data.tier).toBeDefined()
    })

    test('GET /_/invitations/me returns 200 or 401 (requires JWT user email)', async () => {
      const res = await get<Record<string, any>[]>('/invitations/me')

      expect([200, 401]).toContain(res.status)
      if (res.status === 200) {
        expect(Array.isArray(res.data)).toBe(true)
      }
    })

    test('GET /_/assets?orgId=<id> returns 200 with array', async () => {
      const res = await get<Record<string, any>[]>(`/assets?orgId=${ctx.orgId}`)

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Direct paths mounted but requiring params that aren't in the URL
  // -------------------------------------------------------------------------

  describe('direct paths that require scoping params', () => {
    test('GET /_/agents is no longer 404-by-feature-gate now that agents is enabled', async () => {
      // The agents routers are wrapped with featureGate('agents'); with the
      // flag ON requests pass through to the authed handlers. The live direct
      // /agents mount only exposes the OpenAI-compat subroutes (/:id/v1/*)
      // — see agentOaiRoutes in repos/backend/src/endpoints/agents/agents.ts —
      // so the bare path is a plain route-miss 404 regardless of the flag.
      // The org-scoped list behind the same featureGate('agents') returning
      // 200 proves the gate passes requests through instead of 404ing them.
      const direct = await get('/agents')

      expect(direct.status).toBe(404)
      expect(direct.ok).toBe(false)

      const orgScoped = await get<Record<string, any>[]>(`/orgs/${ctx.orgId}/agents`)

      expect(orgScoped.status).toBe(200)
      expect(orgScoped.ok).toBe(true)
      expect(Array.isArray(orgScoped.data)).toBe(true)
    })

    test('GET /_/users without orgId query returns non-401 (auth is valid)', async () => {
      const res = await get('/users')

      expect(res.status).not.toBe(401)
    })

    test('GET /_/assets without any filter returns 400', async () => {
      // listAssets requires at least one of: orgId, projectId, threadId, messageId.
      const res = await get('/assets')

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Paths that are NOT directly mounted (org-scoped only) — expect 404
  // These resources are only available under /_/orgs/:orgId/<resource>
  // -------------------------------------------------------------------------

  describe('org-scoped-only paths return 404 at direct mount', () => {
    test('GET /_/projects returns 404 (not directly mounted)', async () => {
      const res = await get('/projects')
      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('GET /_/sandboxes returns 404 (not directly mounted)', async () => {
      const res = await get('/sandboxes')
      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('GET /_/secrets returns 404 (not directly mounted)', async () => {
      const res = await get('/secrets')
      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('GET /_/api-keys returns 404 (not directly mounted)', async () => {
      const res = await get('/api-keys')
      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('GET /_/endpoints returns 404 (not directly mounted)', async () => {
      const res = await get('/endpoints')
      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('GET /_/functions returns 404 (not directly mounted)', async () => {
      const res = await get('/functions')
      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('GET /_/skills returns 404 (not directly mounted)', async () => {
      const res = await get('/skills')
      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('GET /_/schedules returns 404 (not directly mounted)', async () => {
      const res = await get('/schedules')
      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Auth verification — direct paths without auth should return 401
  // -------------------------------------------------------------------------

  describe('auth verification on direct paths', () => {
    test('GET /_/orgs without auth returns 401', async () => {
      const res = await get('/orgs', { noAuth: true })

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('GET /_/users without auth returns 401', async () => {
      const res = await get('/users', { noAuth: true })

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('GET /_/agents without auth returns 401', async () => {
      const res = await get('/agents', { noAuth: true })

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('GET /_/subscriptions/plans is a public route (200 without auth)', async () => {
      // /subscriptions/plans is listed in AuthIgnore (backend/src/constants/values.ts),
      // so the authenticate middleware short-circuits via shouldIgnore() and the
      // handler responds with the plans list — no JWT or API key required.
      const res = await get<Record<string, any>[]>('/subscriptions/plans', { noAuth: true })

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('GET /_/invitations/me without auth returns 401', async () => {
      const res = await get('/invitations/me', { noAuth: true })

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })
  })
})
