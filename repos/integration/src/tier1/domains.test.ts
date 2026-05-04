import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, del, api } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { uniqueName } from '../utils/unique-name'

/**
 * Domains API contract tests.
 *
 * The create endpoint performs live DNS verification — it checks that the
 * domain's CNAME/A records point to the platform's proxy host.  Because
 * integration tests use fake domain names that don't resolve to our
 * ingress, the happy-path create will always return 400.  We still
 * validate the full request/response contract for every endpoint.
 */
describe('Tier 1: Domains CRUD', () => {
  const ctx = readContext()
  let fixtures: TFixtureResult = {}
  let projectId = ''
  let setupFailed = false

  /** Fake domain names — DNS won't resolve these to our proxy */
  const fakeDomain = `test-${Date.now()}.example.com`
  const fakeDomain2 = `test2-${Date.now()}.example.com`
  const nonexistentDomain = `nonexistent-${Date.now()}.example.com`

  beforeAll(async () => {
    fixtures = await setupFixtures({
      orgId: ctx.orgId,
      providerBrand: 'anthropic',
      projectName: uniqueName('Domains Test Project'),
      createAgent: false,
    })

    if (!fixtures.project?.id) {
      setupFailed = true
      return
    }

    projectId = fixtures.project.id
  })

  afterAll(async () => {
    // Best-effort cleanup of any domains that might have been created
    await tryDelete(`/orgs/${ctx.orgId}/domains/${fakeDomain}`)
    await tryDelete(`/orgs/${ctx.orgId}/domains/${fakeDomain2}`)

    await cleanupFixtures(ctx.orgId, fixtures)
  })

  // ─── Org-Scoped Create ──────────────────────────────────────────

  test('POST /orgs/:orgId/domains with missing domain field returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/domains`,
      { orgId: ctx.orgId }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /orgs/:orgId/domains with unresolvable domain returns 400 (DNS verification)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/domains`,
      { domain: fakeDomain, orgId: ctx.orgId }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /orgs/:orgId/domains with resolvable but wrong-target domain returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // example.com resolves but won't point to our proxy ingress
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/domains`,
      { domain: 'example.com', orgId: ctx.orgId }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  // ─── Org-Scoped List ────────────────────────────────────────────

  test('GET /orgs/:orgId/domains returns 200 with data array', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/domains`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  // ─── Org-Scoped Get (nonexistent) ──────────────────────────────

  test('GET /orgs/:orgId/domains/:domain for nonexistent domain returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/domains/${nonexistentDomain}`
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // ─── Org-Scoped Update (nonexistent) ───────────────────────────

  test('PATCH /orgs/:orgId/domains/:domain for nonexistent domain returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<Record<string, any>>(
      `/orgs/${ctx.orgId}/domains/${nonexistentDomain}`,
      { method: 'PATCH', body: { verified: true } }
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // ─── Org-Scoped Delete (nonexistent) ───────────────────────────

  test('DELETE /orgs/:orgId/domains/:domain for nonexistent domain returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await del<Record<string, any>>(
      `/orgs/${ctx.orgId}/domains/${nonexistentDomain}`
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // ─── Project-Scoped Routes ─────────────────────────────────────

  test('GET /orgs/:orgId/projects/:projectId/domains returns 200 with data array', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/projects/${projectId}/domains`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  test('POST /orgs/:orgId/projects/:projectId/domains with unresolvable domain returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/domains`,
      { domain: fakeDomain2, projectId }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('GET /orgs/:orgId/projects/:projectId/domains/:domain for nonexistent returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/domains/${nonexistentDomain}`
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // ─── Auth ──────────────────────────────────────────────────────

  test('GET /orgs/:orgId/domains without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get(
      `/orgs/${ctx.orgId}/domains`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('POST /orgs/:orgId/domains without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/domains`,
      { domain: fakeDomain, orgId: ctx.orgId },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('PATCH /orgs/:orgId/domains/:domain without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api(
      `/orgs/${ctx.orgId}/domains/${fakeDomain}`,
      { method: 'PATCH', body: { verified: true }, noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('DELETE /orgs/:orgId/domains/:domain without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await del(
      `/orgs/${ctx.orgId}/domains/${fakeDomain}`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })
})
