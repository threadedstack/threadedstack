import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { env } from '../utils/env'
import { post, get } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { uniqueName } from '../utils/unique-name'

const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

describe('Tier 1: AI Sessions', () => {
  const ctx = readContext()
  let agentId = ''
  let fixtures: TFixtureResult | null = null

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      fixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: uniqueName('Session Test Project'),
        agentName: uniqueName('Session Test Agent'),
      })

      if (fixtures.agent?.id) {
        agentId = fixtures.agent.id
      }
    }

    if (!agentId) {
      agentId = getAgentId()
    }

    if (!agentId) return

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${agentId}`
    )

    if (!res.ok) {
      throw new Error(
        `Agent (${agentId}) not accessible: ${res.status}\n` +
        `  Hint: Verify the agent exists and belongs to org ${ctx.orgId}`
      )
    }
  })

  afterAll(async () => {
    if (!fixtures) return
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  test.skipIf(!hasLLM())('POST /_/ai/sessions creates session with valid agent', async () => {
    const res = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.sessionToken).toBeTruthy()
    expect(res.data.provider).toBeTruthy()
    expect(res.data.model).toBeTruthy()
  })

  test.skipIf(!hasLLM())('session response does not leak apiKey', async () => {
    const res = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)
    expect(res.data).not.toHaveProperty('apiKey')
  })

  test.skipIf(!hasLLM())('session returns expected metadata', async () => {
    const res = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)
    expect(typeof res.data.sessionToken).toBe('string')
    expect(res.data.sessionToken.length).toBeGreaterThan(10)
    expect(['anthropic', 'openai', 'google', 'zai']).toContain(res.data.provider)
    expect(typeof res.data.model).toBe('string')
    expect(typeof res.data.maxTokens).toBe('number')
  })

  test.skipIf(!hasLLM())('session response includes tools array (when agent has tools)', async () => {
    const res = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)

    // tools may be undefined/null if agent has no tools configured
    // but if present, it must be an array
    if (res.data.tools !== undefined && res.data.tools !== null) {
      expect(Array.isArray(res.data.tools)).toBe(true)
    }
  })

  test.skipIf(!hasLLM())('session response includes environment (when agent has environment)', async () => {
    const res = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)

    // environment may be undefined/null if agent has no environment configured
    // but if present, it must be an object
    if (res.data.environment !== undefined && res.data.environment !== null) {
      expect(typeof res.data.environment).toBe('object')
    }
  })

  test.skipIf(!hasLLM())('session response does not leak envVars', async () => {
    const res = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )

    expect(res.status).toBe(200)

    // envVars should stay server-side — never in the response
    expect(res.data).not.toHaveProperty('envVars')
  })

  test.skipIf(!hasLLM())('POST /_/ai/sessions without agentId returns 400', async () => {
    const res = await post<{ error?: string }>(
      `/_/ai/sessions`,
      {}
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test.skipIf(!hasLLM())('POST /_/ai/sessions with non-existent agentId returns 404', async () => {
    const res = await post<{ error?: string }>(
      `/_/ai/sessions`,
      { agentId: 'zz00000000' }
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  test('POST /_/ai/sessions without auth returns 401', async () => {
    const res = await post<{ error?: string }>(
      `/_/ai/sessions`,
      { agentId: 'any-id' },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })
})
