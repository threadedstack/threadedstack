import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, put, post, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { cleanupQuickstart } from '../utils/tsa-cleanup'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: Agent Project Config (Override) CRUD
 *
 * Validates project-level agent config overrides:
 * - Config CRUD (GET/PUT/DELETE) on /_/orgs/:orgId/projects/:projectId/agents/:agentId/config
 * - Effective config merging via project-scoped agent endpoints
 * - Unlinking agents from projects via project-scoped DELETE
 * - Deep merge behavior for envVars and environment
 * - functionIds assignment via project config
 */
describe('Tier 1: Agent Project Config', () => {
  const ctx = readContext()

  // Resources created by quickstart
  let orgId = ''
  let projectId = ''
  let agentId = ''
  let providerId = ''
  let quickstartResult: Record<string, any> = {}
  let setupFailed = false

  // Additional resources for specific tests
  let functionId = ''

  const agentPath = () => `/orgs/${orgId}/agents/${agentId}`
  const projectAgentPath = () =>
    `/orgs/${orgId}/projects/${projectId}/agents/${agentId}`
  const configPath = () =>
    `/orgs/${orgId}/projects/${projectId}/agents/${agentId}/config`

  beforeAll(async () => {
    orgId = ctx.orgId

    // Create a quickstart setup: provider + secret + project + agent + endpoint
    const res = await post<Record<string, any>>(
      `/orgs/${orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-ant-test-config-override',
        projectName: uniqueName('Config Override IT'),
        agentName: uniqueName('Config Override Agent'),
        agentDescription: 'Base agent description',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 50000,
        systemPrompt: 'You are a helpful base assistant.',
      }
    )

    if (res.status !== 201 || !res.data?.project?.id) {
      setupFailed = true
      return
    }

    quickstartResult = res.data
    projectId = quickstartResult.project.id
    agentId = quickstartResult.agent.id
    providerId = quickstartResult.provider?.id || ''

    // Create a function in the project for functionIds tests
    const funcRes = await post<{ id: string }>(
      `/orgs/${orgId}/projects/${projectId}/functions`,
      {
        name: uniqueName('config-test-func'),
        content: 'export default () => "hello"',
        projectId,
        language: 'typescript',
      }
    )

    if (funcRes.ok && funcRes.data?.id) {
      functionId = funcRes.data.id
    }
  })

  afterAll(async () => {
    // Clean up function first
    if (functionId) {
      await tryDelete(
        `/orgs/${orgId}/projects/${projectId}/functions/${functionId}`
      )
    }
    // Clean up quickstart resources (endpoint → agent → project → secret → provider)
    await cleanupQuickstart(orgId, quickstartResult)
  })

  // ─── Config CRUD ─────────────────────────────────────────────────

  test('GET config returns 200 with null overrides when no override has been set', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, unknown>>(configPath())

    // Quickstart creates the agentProjects row (agent linked to project),
    // so a config record exists but all override fields are null
    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    // Override fields should be null (no overrides set yet)
    expect(res.data.model).toBeNull()
    expect(res.data.maxTokens).toBeNull()
    expect(res.data.systemPrompt).toBeNull()
  })

  test('PUT config creates a project override', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await put<{ id: string; model: string }>(
      configPath(),
      {
        model: 'claude-haiku-3-5-20241022',
        maxTokens: 8192,
        systemPrompt: 'You are a project-specific assistant.',
        tools: ['webSearch'],
        envVars: { PROJECT_VAR: 'project-value' },
        environment: { streaming: false, temperature: 0.3 },
      }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    // Response is the effective (merged) agent
    expect(res.data.model).toBe('claude-haiku-3-5-20241022')
  })

  test('GET config returns saved override', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{
        model: string
        maxTokens: number
        systemPrompt: string
        tools: string[]
        envVars: Record<string, string>
        environment: Record<string, unknown>
      }>(configPath())

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)

    const config = res.data
    expect(config.model).toBe('claude-haiku-3-5-20241022')
    expect(config.maxTokens).toBe(8192)
    expect(config.systemPrompt).toBe('You are a project-specific assistant.')
    expect(config.tools).toEqual(['webSearch'])
    expect(config.envVars).toEqual({ PROJECT_VAR: 'project-value' })
    expect(config.environment).toMatchObject({
      streaming: false,
      temperature: 0.3,
    })
  })

  // ─── Effective config merging ────────────────────────────────────

  test('GET agent via project path returns merged effective config', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{
        id: string
        name: string
        model: string
        maxTokens: number
        systemPrompt: string
        tools: string[]
        description: string
      }>(projectAgentPath())

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)

    const agent = res.data
    // Overridden fields should reflect project values
    expect(agent.model).toBe('claude-haiku-3-5-20241022')
    expect(agent.maxTokens).toBe(8192)
    expect(agent.systemPrompt).toBe('You are a project-specific assistant.')
    expect(agent.tools).toEqual(['webSearch'])

    // Identity fields remain from base
    expect(agent.name).toContain('Config Override Agent')
    expect(agent.description).toBe('Base agent description')

    // Overrides metadata should be present
    expect(res.overrides).toBeDefined()
    expect(res.overrides).not.toBeNull()
  })

  test('base agent at org level is unchanged', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{
        id: string
        model: string
        maxTokens: number
        systemPrompt: string
        tools: string[]
      }>(agentPath())

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)

    const agent = res.data
    // Org-level agent should have the ORIGINAL values, not the overrides
    expect(agent.model).toBe('claude-sonnet-4-20250514')
    expect(agent.maxTokens).toBe(50000)
    expect(agent.systemPrompt).toBe('You are a helpful base assistant.')
    expect(agent.tools).toEqual([])

    // Overrides should be null at org level
    expect(res.overrides).toBeNull()
  })

  test('list agents in project returns merged effective configs', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Array<{
        id: string
        model: string
        maxTokens: number
      }>>(`/orgs/${orgId}/projects/${projectId}/agents`)

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)

    const ourAgent = res.data.find((a) => a.id === agentId)
    expect(ourAgent).toBeDefined()
    // Should have the project-overridden values
    expect(ourAgent!.model).toBe('claude-haiku-3-5-20241022')
    expect(ourAgent!.maxTokens).toBe(8192)
  })

  // ─── Partial override ───────────────────────────────────────────

  test('partial override only changes specified fields', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Update only maxTokens, leave other overrides in place
    const res = await put<{
        model: string
        maxTokens: number
        systemPrompt: string
      }>(configPath(), { maxTokens: 4096 })

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)

    // maxTokens should be updated
    expect(res.data.maxTokens).toBe(4096)
    // model should still be the previous override
    expect(res.data.model).toBe('claude-haiku-3-5-20241022')
    // systemPrompt should still be the previous override
    expect(res.data.systemPrompt).toBe(
      'You are a project-specific assistant.'
    )
  })

  // ─── envVars deep merge ─────────────────────────────────────────

  test('envVars deep merge — project keys win', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // First set base agent envVars
    await put(agentPath(), {
      envVars: { BASE_VAR: 'base-value', SHARED_VAR: 'base-shared' },
    })

    // Set project override envVars with overlapping key
    await put(configPath(), {
      envVars: { SHARED_VAR: 'project-wins', PROJECT_ONLY: 'project-only' },
    })

    // Fetch via project path — should be deep merged
    const res = await get<{ envVars: Record<string, string> }>(projectAgentPath())

    expect(res.status).toBe(200)
    const envVars = res.data.envVars

    // Base key preserved
    expect(envVars.BASE_VAR).toBe('base-value')
    // Overlapping key — project wins
    expect(envVars.SHARED_VAR).toBe('project-wins')
    // Project-only key present
    expect(envVars.PROJECT_ONLY).toBe('project-only')

    // Clean up base envVars
    await put(agentPath(), { envVars: {} })
  })

  // ─── functionIds ────────────────────────────────────────────────

  test('functionIds — assign functions via project config', async () => {
    if (setupFailed || !functionId) return expect(setupFailed).toBe(false)

    // Assign function to agent via project config
    const res = await put<{ id: string }>(configPath(), { functionIds: [functionId] })

    expect(res.status).toBe(200)

    // Verify config has the functionIds
    const configRes = await get<{ functionIds: string[] }>(configPath())

    expect(configRes.status).toBe(200)
    expect(configRes.data.functionIds).toEqual([functionId])
  })

  test('functionIds — rejects function from wrong project', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Use a fake function ID that doesn't exist
    const res = await put(configPath(), {
      functionIds: ['zz00000000'],
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  // ─── DELETE config (reset) ──────────────────────────────────────

  test('DELETE config resets overrides (agent stays linked)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await del<{ id: string; configReset: boolean }>(
      configPath()
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.configReset).toBe(true)
  })

  test('GET agent after config delete returns base values', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<{
        id: string
        model: string
        maxTokens: number
        systemPrompt: string
        tools: string[]
      }>(projectAgentPath())

    expect(res.status).toBe(200)
    const agent = res.data

    // After config reset, all fields should revert to base values
    expect(agent.model).toBe('claude-sonnet-4-20250514')
    expect(agent.maxTokens).toBe(50000)
    expect(agent.systemPrompt).toBe('You are a helpful base assistant.')
    expect(agent.tools).toEqual([])
  })

  test('agent is still linked to project after config reset', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Array<{ id: string }>>(
      `/orgs/${orgId}/projects/${projectId}/agents`
    )

    expect(res.status).toBe(200)
    const ourAgent = res.data.find((a) => a.id === agentId)
    expect(ourAgent).toBeDefined()
  })

  // ─── DELETE agent from project (unlink) ─────────────────────────

  test('DELETE agent via project path unlinks (base agent still exists)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Unlink agent from project
    const unlinkRes = await del<{ id: string; unlinked: boolean }>(
      projectAgentPath()
    )

    expect(unlinkRes.status).toBe(200)
    expect(unlinkRes.ok).toBe(true)
    expect(unlinkRes.data.unlinked).toBe(true)

    // Agent should no longer appear in project's agent list
    const listRes = await get<Array<{ id: string }>>(
      `/orgs/${orgId}/projects/${projectId}/agents`
    )
    expect(listRes.status).toBe(200)
    const found = listRes.data.find((a) => a.id === agentId)
    expect(found).toBeUndefined()

    // Base agent should still exist at org level
    const orgRes = await get<{ id: string; name: string }>(
      agentPath()
    )
    expect(orgRes.status).toBe(200)
    expect(orgRes.data.id).toBe(agentId)
    expect(orgRes.data.name).toContain('Config Override Agent')

    // Re-link agent to project for cleanup to work properly
    await put(agentPath(), { projectIds: [projectId] })
  })
})
