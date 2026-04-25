import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { env } from '../utils/env'
import { isFeatureEnabled } from '@tdsk/domain'

/**
 * Tier 1: Skill Lifecycle
 *
 * Validates skill CRUD, attach/detach to agents, and type invariants.
 *
 * Covers fix T3: `alwaysActive` is a required boolean (not optional).
 * The backend defaults it to `false` when omitted, and the response
 * should always include it as a boolean value.
 */
describe.skipIf(!isFeatureEnabled('skills'))('Tier 1: Skill Lifecycle', () => {
  const ctx = readContext()
  let agentId = ''
  let skillId = ''
  let skill2Id = ''
  let quickstartResult: Record<string, any> = {}
  let setupFailed = false

  beforeAll(async () => {
    if (!env.testProviderKey) {
      setupFailed = true
      return
    }

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: uniqueName('Skill Test'),
        agentName: uniqueName('Skill Agent'),
      }
    )

    if (res.status !== 201 || !res.data?.agent?.id) {
      setupFailed = true
      return
    }

    quickstartResult = res.data
    agentId = quickstartResult.agent.id
  })

  afterAll(async () => {
    if (skillId) await tryDelete(`/orgs/${ctx.orgId}/skills/${skillId}`)
    if (skill2Id) await tryDelete(`/orgs/${ctx.orgId}/skills/${skill2Id}`)
    if (quickstartResult.endpoint?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project?.id}/endpoints/${quickstartResult.endpoint.id}`)
    if (quickstartResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${quickstartResult.agent.id}`)
    if (quickstartResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project.id}`)
    if (quickstartResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${quickstartResult.secret.id}`)
    if (quickstartResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${quickstartResult.provider.id}`)
  })

  // ─── Create ────────────────────────────────────────────────────────

  test('POST creates a skill with alwaysActive explicitly false (T3 fix)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/skills`,
      {
        name: uniqueName('Code Review Skill'),
        description: 'Analyzes code for issues',
        instructions: 'Review the code and provide feedback.',
        triggerKeywords: ['review', 'check'],
        tools: ['readFile', 'listDir'],
        alwaysActive: false,
      }
    )

    expect(res.status).toBe(201)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeTruthy()
    expect(res.data.name).toContain('Code Review Skill')
    expect(res.data.instructions).toBe('Review the code and provide feedback.')

    // T3 fix: alwaysActive should be a boolean, not undefined
    expect(res.data.alwaysActive).toBe(false)
    expect(typeof res.data.alwaysActive).toBe('boolean')

    skillId = res.data.id
  })

  test('POST creates a skill without alwaysActive — defaults to false (T3 fix)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/skills`,
      {
        name: uniqueName('Search Skill'),
        instructions: 'Search for information.',
      }
    )

    expect(res.status).toBe(201)
    // T3 fix: When omitted, alwaysActive should default to false (not undefined)
    expect(res.data.alwaysActive).toBe(false)
    expect(typeof res.data.alwaysActive).toBe('boolean')

    skill2Id = res.data.id
  })

  test('POST creates a skill with alwaysActive true', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/skills`,
      {
        name: uniqueName('Always Active Skill'),
        instructions: 'Always provide help.',
        alwaysActive: true,
      }
    )

    expect(res.status).toBe(201)
    expect(res.data.alwaysActive).toBe(true)
    expect(typeof res.data.alwaysActive).toBe('boolean')

    // Clean up this extra skill
    await tryDelete(`/orgs/${ctx.orgId}/skills/${res.data.id}`)
  })

  test('POST requires name and instructions', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const missingName = await post(`/orgs/${ctx.orgId}/skills`, {
      instructions: 'Do something',
    })
    expect(missingName.status).toBe(400)

    const missingInstructions = await post(`/orgs/${ctx.orgId}/skills`, {
      name: 'Missing Instructions',
    })
    expect(missingInstructions.status).toBe(400)
  })

  // ─── Read ──────────────────────────────────────────────────────────

  test('GET retrieves the created skill', async () => {
    if (setupFailed || !skillId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/skills/${skillId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.id).toBe(skillId)
    expect(res.data.instructions).toBe('Review the code and provide feedback.')
    expect(typeof res.data.alwaysActive).toBe('boolean')
  })

  test('GET list returns skills for the org', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/skills`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    if (skillId) {
      const found = res.data.some((s: any) => s.id === skillId)
      expect(found).toBe(true)
    }
  })

  // ─── Update ────────────────────────────────────────────────────────

  test('PUT updates the skill', async () => {
    if (setupFailed || !skillId) return expect(setupFailed).toBe(false)

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/skills/${skillId}`,
      { instructions: 'Updated instructions for review.' }
    )

    expect(res.status).toBe(200)
    expect(res.data.instructions).toBe('Updated instructions for review.')
  })

  // ─── Attach / Detach ───────────────────────────────────────────────

  test('POST attach links skill to agent', async () => {
    if (setupFailed || !skillId || !agentId) return expect(setupFailed).toBe(false)

    // Path is /:skillId/agents/:agentId (not /attach)
    const res = await post(
      `/orgs/${ctx.orgId}/skills/${skillId}/agents/${agentId}`
    )

    expect(res.status).toBe(201)
  })

  test('DELETE detach unlinks skill from agent', async () => {
    if (setupFailed || !skillId || !agentId) return expect(setupFailed).toBe(false)

    // Path is /:skillId/agents/:agentId (not /detach), method is DELETE
    const res = await del(
      `/orgs/${ctx.orgId}/skills/${skillId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)
  })

  // ─── Attach/Detach edge cases ───────────────────────────────────────

  test('POST attach same skill twice → idempotent 201', async () => {
    if (setupFailed || !skillId || !agentId) return expect(setupFailed).toBe(false)

    const res1 = await post(
      `/orgs/${ctx.orgId}/skills/${skillId}/agents/${agentId}`
    )
    expect(res1.status).toBe(201)

    const res2 = await post(
      `/orgs/${ctx.orgId}/skills/${skillId}/agents/${agentId}`
    )
    expect(res2.status).toBe(201)

    await del(`/orgs/${ctx.orgId}/skills/${skillId}/agents/${agentId}`)
  })

  test('DELETE detach non-attached skill → idempotent 200', async () => {
    if (setupFailed || !skillId || !agentId) return expect(setupFailed).toBe(false)

    const res = await del(
      `/orgs/${ctx.orgId}/skills/${skillId}/agents/${agentId}`
    )

    expect(res.status).toBe(200)
  })

  // ─── Boolean .notNull invariant ─────────────────────────────────────

  test('GET skill returns alwaysActive as boolean, never null', async () => {
    if (setupFailed || !skillId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/skills/${skillId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.alwaysActive).not.toBeNull()
    expect(res.data.alwaysActive).not.toBeUndefined()
    expect(typeof res.data.alwaysActive).toBe('boolean')
  })

  // ─── Delete ────────────────────────────────────────────────────────

  test('DELETE removes the skill', async () => {
    if (setupFailed || !skill2Id) return expect(setupFailed).toBe(false)

    const res = await del(`/orgs/${ctx.orgId}/skills/${skill2Id}`)
    expect(res.status).toBe(200)

    const getRes = await get(`/orgs/${ctx.orgId}/skills/${skill2Id}`)
    expect(getRes.status).toBe(404)

    skill2Id = ''
  })

  // ─── Auth ──────────────────────────────────────────────────────────

  test('GET skills without auth returns 401', async () => {
    const res = await get(`/orgs/${ctx.orgId}/skills`, { noAuth: true })
    expect(res.status).toBe(401)
  })
})
