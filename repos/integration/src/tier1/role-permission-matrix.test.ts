import { describe, test, expect, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Cross-role permission matrix integration tests.
 *
 * Verifies that the RBAC permission matrix is enforced end-to-end across
 * multiple resource types. Uses two authentication contexts:
 *
 * - Owner (default): The test API key from env (TDSK_IT_API_KEY)
 * - Admin: A scoped API key created in global-setup (ctx.adminApiKey)
 *
 * Member-scoped tests are not included because the global-setup only provisions
 * owner and admin API keys. Adding a member-scoped key would require a third
 * org member with its own users-table entry and verified API key.
 */
describe('Tier 1: Role Permission Matrix', () => {
  const ctx = readContext()
  const hasAdmin = !!ctx.adminApiKey

  /** Send request as the admin user instead of the default owner */
  const adminOpts = () => ({ apiKey: ctx.adminApiKey! })

  // Track resources created during tests for cleanup
  const createdSecretIds: string[] = []
  const createdApiKeyIds: string[] = []

  afterAll(async () => {
    for (const id of createdSecretIds) {
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${id}`)
    }
    for (const id of createdApiKeyIds) {
      await tryDelete(`/orgs/${ctx.orgId}/api-keys/${id}`)
    }
  })

  // ── Section 1: Admin denied owner-only operations ──────────────────

  describe('Admin denied owner-only operations', () => {
    test('precondition: admin API key is available', () => {
      expect(
        ctx.adminApiKey,
        'adminApiKey missing — global-setup failed to find an admin member'
      ).toBeTruthy()
    })

    test('admin cannot delete the org (requires owner)', async () => {
      if (!hasAdmin) return

      const res = await del(`/orgs/${ctx.orgId}`, adminOpts())
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('admin cannot remove an owner-role org member', async () => {
      if (!hasAdmin) return

      // Find actual owner/super UUID from org member snapshot (ctx.userId may not be a UUID)
      // Seed data uses 'super' role for the org owner, so check both
      const ownerMember = ctx.orgMemberSnapshot?.find(
        m => m.type === 'owner' || m.type === 'super'
      )
      expect(ownerMember, 'No owner/super found in orgMemberSnapshot').toBeTruthy()

      const res = await del(
        `/orgs/${ctx.orgId}/members/${ownerMember!.userId}`,
        adminOpts()
      )
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })
  })

  // ── Section 2: Admin can perform admin-level operations ────────────

  describe('Admin can perform admin-level operations', () => {
    test('precondition: admin API key is available', () => {
      expect(ctx.adminApiKey).toBeTruthy()
    })

    test('admin can create a secret', async () => {
      if (!hasAdmin) return

      const secretName = uniqueName('perm-test-secret')
      const res = await post<{ id: string; name: string }>(
        `/orgs/${ctx.orgId}/secrets`,
        { name: secretName, value: 'test-value-for-permission-check' },
        adminOpts()
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      expect(res.data.name).toBe(secretName)

      if (res.data?.id) createdSecretIds.push(res.data.id)
    })

    test('admin can create an API key', async () => {
      if (!hasAdmin) return

      const keyName = uniqueName('perm-test-key')
      const res = await post<{ id: string; key: string }>(
        `/orgs/${ctx.orgId}/api-keys`,
        { name: keyName, scopes: 'admin', userId: ctx.adminUserId },
        adminOpts()
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      expect(res.data.id).toBeDefined()

      if (res.data?.id) createdApiKeyIds.push(res.data.id)
    })

    test('admin can update org settings', async () => {
      if (!hasAdmin) return

      // Fetch current org name first so we can restore it
      const getRes = await get<{ id: string; name: string; description?: string }>(
        `/orgs/${ctx.orgId}`,
        adminOpts()
      )
      expect(getRes.status).toBe(200)
      const originalName = getRes.data.name

      // Update with a temporary description change (non-destructive)
      const tempDesc = `permission-matrix-test-${Date.now()}`
      const updateRes = await put<{ id: string; description?: string }>(
        `/orgs/${ctx.orgId}`,
        { description: tempDesc },
        adminOpts()
      )

      expect(updateRes.status).toBe(200)
      expect(updateRes.ok).toBe(true)

      // Restore original description (use owner key for reliability)
      await put(`/orgs/${ctx.orgId}`, { name: originalName })
    })

    test('admin can list org members (read access)', async () => {
      if (!hasAdmin) return

      const res = await get(`/orgs/${ctx.orgId}/members`, adminOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })
  })

  // ── Section 3: Sandbox exec permission ─────────────────────────────

  describe('Sandbox exec permission', () => {
    let sandboxId: string | undefined

    test('precondition: admin API key is available', () => {
      expect(ctx.adminApiKey).toBeTruthy()
    })

    test('discover a sandbox for permission testing', async () => {
      if (!hasAdmin) return

      const res = await get<Array<{ id: string; name: string }>>(
        `/orgs/${ctx.orgId}/sandboxes?limit=1`
      )

      expect(res.status).toBe(200)
      if (res.data?.length) {
        sandboxId = res.data[0].id
      }
    })

    test('admin can read sandbox list (sandbox.read requires member+)', async () => {
      if (!hasAdmin) return

      const res = await get(`/orgs/${ctx.orgId}/sandboxes`, adminOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    })

    test('admin can attempt sandbox connect (not denied by RBAC)', async () => {
      if (!hasAdmin || !sandboxId) return

      // sandbox.exec requires member+ — admin qualifies.
      // The request may fail for infrastructure reasons (pod not running),
      // but it must NOT fail with 403 (permission denied).
      const res = await post(
        `/orgs/${ctx.orgId}/sandboxes/${sandboxId}/connect`,
        {},
        adminOpts()
      )

      // Any status except 403 means RBAC passed
      expect(res.status).not.toBe(403)
    })
  })

  // ── Section 4: Subscription permission ─────────────────────────────

  describe('Subscription permission', () => {
    test('precondition: admin API key is available', () => {
      expect(ctx.adminApiKey).toBeTruthy()
    })

    test('admin can read current subscription (subscription.read requires member+)', async () => {
      if (!hasAdmin) return

      const res = await get<{ tier: string; status: string }>(
        `/subscriptions/current`,
        adminOpts()
      )

      // subscription.read requires member role — admin qualifies
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      expect(typeof res.data.tier).toBe('string')
    })

    test('admin can read subscription plans', async () => {
      if (!hasAdmin) return

      const res = await get('/subscriptions/plans', adminOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    })

    test('admin can create portal session (subscription.manage requires admin+)', async () => {
      if (!hasAdmin) return

      // Portal session creation requires a Stripe customer ID.
      // For test orgs on the free tier this will likely return 404 ("No active subscription").
      // The key assertion is that it does NOT return 403 (RBAC denial).
      const res = await post('/subscriptions/portal', {}, adminOpts())

      expect(res.status).not.toBe(403)
    })
  })

  // ── Section 5: Unauthenticated requests ────────────────────────────

  describe('Unauthenticated requests', () => {
    test('GET /orgs without auth returns 401', async () => {
      const res = await get('/orgs', { noAuth: true })
      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('GET /orgs/:orgId without auth returns 401', async () => {
      const res = await get(`/orgs/${ctx.orgId}`, { noAuth: true })
      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('POST /orgs/:orgId/secrets without auth returns 401', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/secrets`,
        { name: 'no-auth-test', value: 'should-fail' },
        { noAuth: true }
      )
      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('DELETE /orgs/:orgId without auth returns 401', async () => {
      const res = await del(`/orgs/${ctx.orgId}`, { noAuth: true })
      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('GET /subscriptions/current without auth returns 401', async () => {
      const res = await get('/subscriptions/current', { noAuth: true })
      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('GET /orgs/:orgId/sandboxes without auth returns 401', async () => {
      const res = await get(`/orgs/${ctx.orgId}/sandboxes`, { noAuth: true })
      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('GET with invalid API key returns 401', async () => {
      const res = await get('/orgs', { apiKey: 'tdsk_completely_invalid_key' })
      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })
  })

  // ── Section 6: Owner can perform owner-only operations ─────────────

  describe('Owner can perform owner-only operations', () => {
    test('owner can read the org', async () => {
      const res = await get<{ id: string }>(`/orgs/${ctx.orgId}`)
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data.id).toBe(ctx.orgId)
    })

    test('owner can list org members', async () => {
      const res = await get(`/orgs/${ctx.orgId}/members`)
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('owner can create secrets', async () => {
      const secretName = uniqueName('perm-owner-secret')
      const res = await post<{ id: string; name: string }>(
        `/orgs/${ctx.orgId}/secrets`,
        { name: secretName, value: 'owner-permission-check' }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)

      if (res.data?.id) createdSecretIds.push(res.data.id)
    })

    test('owner can update the org', async () => {
      const tempDesc = `owner-perm-test-${Date.now()}`
      const res = await put(`/orgs/${ctx.orgId}`, { description: tempDesc })
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    })
  })

  // ── Section 7: Cross-resource admin read access ────────────────────

  describe('Admin read access across resource types', () => {
    test('precondition: admin API key is available', () => {
      expect(ctx.adminApiKey).toBeTruthy()
    })

    test('admin can list secrets (secret.read requires member+)', async () => {
      if (!hasAdmin) return

      const res = await get(`/orgs/${ctx.orgId}/secrets`, adminOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('admin can list API keys (apiKey.read requires admin+)', async () => {
      if (!hasAdmin) return

      const res = await get(`/orgs/${ctx.orgId}/api-keys`, adminOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('admin can list providers (provider.read requires member+)', async () => {
      if (!hasAdmin) return

      const res = await get(`/orgs/${ctx.orgId}/providers`, adminOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('admin can list agents (agent.read requires viewer+)', async () => {
      if (!hasAdmin) return

      const res = await get(`/orgs/${ctx.orgId}/agents`, adminOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('admin can list projects (project.read requires viewer+)', async () => {
      if (!hasAdmin) return

      const res = await get(`/orgs/${ctx.orgId}/projects`, adminOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })
  })
})
