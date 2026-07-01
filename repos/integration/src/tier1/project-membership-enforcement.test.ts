import { describe, test, expect, afterAll } from 'vitest'
import { isFeatureEnabled } from '@tdsk/domain'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Project membership enforcement integration tests.
 *
 * Verifies that non-admin org members cannot access project-scoped resources
 * in projects they do not have a role in. The `projectMemberGuard` middleware
 * should return 403 for non-member users.
 *
 * Test strategy:
 * 1. Create a new project using the owner API key (member won't have a role in it)
 * 2. Verify the member CANNOT access project-scoped resources in the new project
 * 3. Verify the member CAN still access projects they ARE a member of
 * 4. Clean up the test project
 *
 * Requires ctx.memberApiKey provisioned in global-setup. If unavailable,
 * all tests are skipped.
 */

const ctx = readContext()
const hasMember = !!ctx.memberApiKey

const memberOpts = () => ({ apiKey: ctx.memberApiKey! })

describe.skipIf(!hasMember)('Tier 1: Project Membership Enforcement', () => {
  let testProjectId: string | undefined

  afterAll(async () => {
    if (testProjectId) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${testProjectId}`)
    }
  })

  test('precondition: create a project the member has no role in', async () => {
    const res = await post<{ id: string }>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('RBAC Test Project') }
    )
    expect(res.ok).toBe(true)
    expect(res.data?.id).toBeTruthy()
    testProjectId = res.data!.id
  })

  // ── Member CAN access their own projects ────────────────────────────

  describe('Member access to assigned projects (allowed)', () => {
    test('member can list projects (only sees assigned ones)', async () => {
      const res = await get(`/orgs/${ctx.orgId}/projects`, memberOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('member can GET a project they are assigned to', async () => {
      const res = await get(`/orgs/${ctx.orgId}/projects`, memberOpts())
      expect(res.ok).toBe(true)
      const projects = res.data as Array<{ id: string }>
      if (projects.length === 0) return

      const memberProjectId = projects[0].id
      const getRes = await get(
        `/orgs/${ctx.orgId}/projects/${memberProjectId}`,
        memberOpts()
      )
      expect(getRes.status).toBe(200)
      expect(getRes.ok).toBe(true)
    })
  })

  // ── Member CANNOT access non-assigned projects ──────────────────────

  describe('Member access to non-assigned projects (denied)', () => {
    test('member cannot GET a project they have no role in', async () => {
      expect(testProjectId).toBeTruthy()
      const res = await get(
        `/orgs/${ctx.orgId}/projects/${testProjectId}`,
        memberOpts()
      )
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('member cannot list endpoints in a non-assigned project', async () => {
      expect(testProjectId).toBeTruthy()
      const res = await get(
        `/orgs/${ctx.orgId}/projects/${testProjectId}/endpoints`,
        memberOpts()
      )
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('member cannot list functions in a non-assigned project', async () => {
      expect(testProjectId).toBeTruthy()
      const res = await get(
        `/orgs/${ctx.orgId}/projects/${testProjectId}/functions`,
        memberOpts()
      )
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('member cannot list secrets in a non-assigned project', async () => {
      expect(testProjectId).toBeTruthy()
      const res = await get(
        `/orgs/${ctx.orgId}/projects/${testProjectId}/secrets`,
        memberOpts()
      )
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test.skipIf(!isFeatureEnabled('agents'))('member cannot list agents in a non-assigned project', async () => {
      expect(testProjectId).toBeTruthy()
      const res = await get(
        `/orgs/${ctx.orgId}/projects/${testProjectId}/agents`,
        memberOpts()
      )
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('member cannot list sandboxes in a non-assigned project', async () => {
      expect(testProjectId).toBeTruthy()
      const res = await get(
        `/orgs/${ctx.orgId}/projects/${testProjectId}/sandboxes`,
        memberOpts()
      )
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('member cannot UPDATE a project they have no role in', async () => {
      expect(testProjectId).toBeTruthy()
      const res = await put(
        `/orgs/${ctx.orgId}/projects/${testProjectId}`,
        { name: 'Hacked Project Name' },
        memberOpts()
      )
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })
  })

  // ── Admin CAN access any project ────────────────────────────────────

  describe.skipIf(!ctx.adminApiKey)('Admin bypasses project membership (allowed)', () => {
    const adminOpts = () => ({ apiKey: ctx.adminApiKey! })

    test('admin can GET a project without explicit membership', async () => {
      expect(testProjectId).toBeTruthy()
      const res = await get(
        `/orgs/${ctx.orgId}/projects/${testProjectId}`,
        adminOpts()
      )
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    })

    test('admin can list endpoints in any project', async () => {
      expect(testProjectId).toBeTruthy()
      const res = await get(
        `/orgs/${ctx.orgId}/projects/${testProjectId}/endpoints`,
        adminOpts()
      )
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    })
  })
})
