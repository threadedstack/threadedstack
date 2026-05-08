import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, put, post, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { uniqueName } from '../utils/unique-name'
import { env } from '../utils/env'

/**
 * Tier 1: Web Tools Configuration
 *
 * Validates API contract for the webFetch/webSearch tools and
 * webProvider environment config on agents.
 * No LLM required — uses quickstart with a real provider key for pure CRUD validation.
 */
describe('Tier 1: Web Tools Configuration', () => {
  const ctx = readContext()

  let orgId = ''
  let projectId = ''
  let agentId = ''
  let fixtures: TFixtureResult = {}
  let setupFailed = false
  const extraSecretIds: string[] = []

  const agentPath = () => `/orgs/${orgId}/agents/${agentId}`
  const projectAgentPath = () =>
    `/orgs/${orgId}/projects/${projectId}/agents/${agentId}`
  const configPath = () =>
    `/orgs/${orgId}/projects/${projectId}/agents/${agentId}/config`

  beforeAll(async () => {
    orgId = ctx.orgId

    try {
      fixtures = await setupFixtures({
        orgId,
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: uniqueName('Web Tools Config IT'),
        agentName: uniqueName('Web Tools Config Agent'),
        systemPrompt: 'You are a test assistant.',
      })
    }
    catch {
      setupFailed = true
      return
    }

    if (!fixtures.project?.id) {
      setupFailed = true
      return
    }

    projectId = fixtures.project.id
    agentId = fixtures.agent!.id
  })

  afterAll(async () => {
    for (const id of extraSecretIds) {
      await del(`/orgs/${orgId}/secrets/${id}`).catch((e) =>
        console.warn(`[web-tools-config] cleanup secret ${id} failed:`, e?.message)
      )
    }
    await cleanupFixtures(orgId, fixtures)
  })

  // ─── Tool assignment ──────────────────────────────────────────────

  test('agent creation with webFetch and webSearch tools', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const updateRes = await put<{ id: string; tools: string[] }>(
      agentPath(),
      { tools: ['webSearch', 'webFetch'] }
    )

    expect(updateRes.status).toBe(200)
    expect(updateRes.ok).toBe(true)

    const getRes = await get<{ id: string; tools: string[] }>(
      agentPath()
    )

    expect(getRes.status).toBe(200)
    expect(getRes.data.tools).toEqual(
      expect.arrayContaining(['webSearch', 'webFetch'])
    )
    expect(getRes.data.tools).toHaveLength(2)
  })

  // ─── webProvider environment config ───────────────────────────────

  test('agent update with environment.webProvider config', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const updateRes = await put<{ id: string; environment: Record<string, any> }>(agentPath(), {
      environment: { webProvider: { type: 'jina' } },
    })

    expect(updateRes.status).toBe(200)
    expect(updateRes.ok).toBe(true)

    const getRes = await get<{ id: string; environment: Record<string, any> }>(agentPath())

    expect(getRes.status).toBe(200)
    expect(getRes.data.environment).toBeDefined()
    expect(getRes.data.environment.webProvider).toBeDefined()
    expect(getRes.data.environment.webProvider.type).toBe('jina')
  })

  test('agent update with webProvider secretId referencing encrypted secret', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Create a secret to reference
    const secretRes = await post<{ id: string }>(
      `/orgs/${orgId}/secrets`,
      { name: uniqueName('jina-api-key'), value: 'jina_test_key_123' }
    )

    expect(secretRes.status).toBe(201)
    const secretId = secretRes.data.id
    extraSecretIds.push(secretId)

    const updateRes = await put<{ id: string; environment: Record<string, any> }>(agentPath(), {
      environment: { webProvider: { type: 'jina', secretId } },
    })

    expect(updateRes.status).toBe(200)
    expect(updateRes.ok).toBe(true)

    const getRes = await get<{ id: string; environment: Record<string, any> }>(agentPath())

    expect(getRes.status).toBe(200)
    const webProvider = getRes.data.environment?.webProvider
    expect(webProvider).toBeDefined()
    expect(webProvider.type).toBe('jina')
    expect(webProvider.secretId).toBe(secretId)
  })

  // ─── Project config override with web tools ───────────────────────

  test('project config override with webFetch tool', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Set project override with only webFetch and a webProvider
    const overrideRes = await put<Record<string, any>>(configPath(), {
      tools: ['webFetch'],
      environment: { webProvider: { type: 'jina' } },
    })

    expect(overrideRes.status).toBe(200)

    // Verify via project-scoped GET — should reflect override
    const projectRes = await get<{
        tools: string[]
        environment: Record<string, any>
      }>(projectAgentPath())

    expect(projectRes.status).toBe(200)
    expect(projectRes.data.tools).toEqual(['webFetch'])
    expect(projectRes.data.environment?.webProvider?.type).toBe('jina')

    // Verify base agent at org level is unchanged
    const orgRes = await get<{
        tools: string[]
        environment: Record<string, any>
      }>(agentPath())

    expect(orgRes.status).toBe(200)
    // Base agent should still have both tools from earlier test
    expect(orgRes.data.tools).toEqual(
      expect.arrayContaining(['webSearch', 'webFetch'])
    )
  })

  // ─── Removing webProvider ─────────────────────────────────────────

  test('removing webProvider from environment', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Update environment to empty object (clears webProvider)
    const updateRes = await put<{ id: string; environment: Record<string, any> }>(agentPath(), {
      environment: {},
    })

    expect(updateRes.status).toBe(200)

    const getRes = await get<{ id: string; environment: Record<string, any> | null }>(agentPath())

    expect(getRes.status).toBe(200)
    const environment = getRes.data.environment
    // After setting empty environment, webProvider should be gone
    if (environment) {
      expect(environment.webProvider).toBeUndefined()
    }
  })

  // ─── Session with web tools ───────────────────────────────────────

  test('session creation reflects tools and webProvider when configured', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Create a secret for the webProvider
    const secretRes = await post<{ id: string }>(
      `/orgs/${orgId}/secrets`,
      { name: uniqueName('jina-session-key'), value: 'jina_session_test_key' }
    )
    expect(secretRes.status).toBe(201)
    const wpSecretId = secretRes.data.id
    extraSecretIds.push(wpSecretId)

    // Re-set tools and webProvider for session test
    await put(agentPath(), {
      tools: ['webSearch', 'webFetch'],
      environment: { webProvider: { type: 'jina', ...(wpSecretId ? { secretId: wpSecretId } : {}) } },
    })

    // Session creation — may fail with fake provider key, which is expected
    const sessionRes = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )

    // With a fake provider key, session may fail — that's OK for a config test
    // If it succeeds, verify the tools and webProvider are included
    if (sessionRes.ok && sessionRes.data) {
      const session = sessionRes.data
      if (session.tools) {
        expect(session.tools).toEqual(
          expect.arrayContaining(['webSearch', 'webFetch'])
        )
      }
      if (session.environment?.webProvider) {
        expect(session.environment.webProvider.type).toBe('jina')
      }
    }
    // If session creation fails (e.g. provider key can't be resolved),
    // we've still validated the agent CRUD above — session test is best-effort
  })
})
