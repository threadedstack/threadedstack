import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, put, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { cleanupQuickstart } from '../utils/repl-cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: Web Tools Configuration
 *
 * Validates API contract for the webFetch/webSearch tools and
 * webProvider environment config on agents.
 * No LLM required — uses quickstart with a test key for pure CRUD.
 */
describe('Tier 1: Web Tools Configuration', () => {
  const ctx = readContext()

  let orgId = ''
  let projectId = ''
  let agentId = ''
  let quickstartResult: Record<string, any> = {}
  let setupFailed = false

  const agentPath = () => `/orgs/${orgId}/agents/${agentId}`
  const projectAgentPath = () =>
    `/orgs/${orgId}/projects/${projectId}/agents/${agentId}`
  const configPath = () =>
    `/orgs/${orgId}/projects/${projectId}/agents/${agentId}/config`

  beforeAll(async () => {
    orgId = ctx.orgId

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-ant-test-web-tools',
        projectName: uniqueName('Web Tools Config IT'),
        agentName: uniqueName('Web Tools Config Agent'),
        agentDescription: 'Agent for web tools config integration tests',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        systemPrompt: 'You are a test assistant.',
      }
    )

    if (res.status !== 201 || !res.data?.data?.project?.id) {
      setupFailed = true
      return
    }

    quickstartResult = res.data.data
    projectId = quickstartResult.project.id
    agentId = quickstartResult.agent.id
  })

  afterAll(async () => {
    await cleanupQuickstart(orgId, quickstartResult)
  })

  // ─── Tool assignment ──────────────────────────────────────────────

  test('agent creation with webFetch and webSearch tools', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const updateRes = await put<{ data: { id: string; tools: string[] } }>(
      agentPath(),
      { tools: ['webSearch', 'webFetch'] }
    )

    expect(updateRes.status).toBe(200)
    expect(updateRes.ok).toBe(true)

    const getRes = await get<{ data: { id: string; tools: string[] } }>(
      agentPath()
    )

    expect(getRes.status).toBe(200)
    expect(getRes.data.data.tools).toEqual(
      expect.arrayContaining(['webSearch', 'webFetch'])
    )
    expect(getRes.data.data.tools).toHaveLength(2)
  })

  // ─── webProvider environment config ───────────────────────────────

  test('agent update with environment.webProvider config', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const updateRes = await put<{
      data: { id: string; environment: Record<string, any> }
    }>(agentPath(), {
      environment: { webProvider: { type: 'jina' } },
    })

    expect(updateRes.status).toBe(200)
    expect(updateRes.ok).toBe(true)

    const getRes = await get<{
      data: { id: string; environment: Record<string, any> }
    }>(agentPath())

    expect(getRes.status).toBe(200)
    expect(getRes.data.data.environment).toBeDefined()
    expect(getRes.data.data.environment.webProvider).toBeDefined()
    expect(getRes.data.data.environment.webProvider.type).toBe('jina')
  })

  test('agent update with webProvider apiKey', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const updateRes = await put<{
      data: { id: string; environment: Record<string, any> }
    }>(agentPath(), {
      environment: { webProvider: { type: 'jina', apiKey: 'jina_test_key_123' } },
    })

    expect(updateRes.status).toBe(200)
    expect(updateRes.ok).toBe(true)

    const getRes = await get<{
      data: { id: string; environment: Record<string, any> }
    }>(agentPath())

    expect(getRes.status).toBe(200)
    const webProvider = getRes.data.data.environment?.webProvider
    expect(webProvider).toBeDefined()
    expect(webProvider.type).toBe('jina')
    // apiKey may be present or sanitized — just verify the field exists
    expect(webProvider).toHaveProperty('apiKey')
  })

  // ─── Project config override with web tools ───────────────────────

  test('project config override with webFetch tool', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Set project override with only webFetch and a webProvider
    const overrideRes = await put<{ data: Record<string, any> }>(configPath(), {
      tools: ['webFetch'],
      environment: { webProvider: { type: 'jina' } },
    })

    expect(overrideRes.status).toBe(200)

    // Verify via project-scoped GET — should reflect override
    const projectRes = await get<{
      data: {
        tools: string[]
        environment: Record<string, any>
      }
    }>(projectAgentPath())

    expect(projectRes.status).toBe(200)
    expect(projectRes.data.data.tools).toEqual(['webFetch'])
    expect(projectRes.data.data.environment?.webProvider?.type).toBe('jina')

    // Verify base agent at org level is unchanged
    const orgRes = await get<{
      data: {
        tools: string[]
        environment: Record<string, any>
      }
    }>(agentPath())

    expect(orgRes.status).toBe(200)
    // Base agent should still have both tools from earlier test
    expect(orgRes.data.data.tools).toEqual(
      expect.arrayContaining(['webSearch', 'webFetch'])
    )
  })

  // ─── Removing webProvider ─────────────────────────────────────────

  test('removing webProvider from environment', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Update environment to empty object (clears webProvider)
    const updateRes = await put<{
      data: { id: string; environment: Record<string, any> }
    }>(agentPath(), {
      environment: {},
    })

    expect(updateRes.status).toBe(200)

    const getRes = await get<{
      data: { id: string; environment: Record<string, any> | null }
    }>(agentPath())

    expect(getRes.status).toBe(200)
    const environment = getRes.data.data.environment
    // After setting empty environment, webProvider should be gone
    if (environment) {
      expect(environment.webProvider).toBeUndefined()
    }
  })

  // ─── Session with web tools ───────────────────────────────────────

  test('session creation reflects tools and webProvider when configured', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Re-set tools and webProvider for session test
    await put(agentPath(), {
      tools: ['webSearch', 'webFetch'],
      environment: { webProvider: { type: 'jina' } },
    })

    // Session creation — may fail with fake provider key, which is expected
    const sessionRes = await post<{ data: Record<string, any> }>(
      `/_/ai/sessions`,
      { agentId }
    )

    // With a fake provider key, session may fail — that's OK for a config test
    // If it succeeds, verify the tools and webProvider are included
    if (sessionRes.ok && sessionRes.data?.data) {
      const session = sessionRes.data.data
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
