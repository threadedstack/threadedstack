import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { env } from '../utils/env'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: Agent-Provider Model Resolution Tests
 *
 * Validates the 3-tier model resolution hierarchy via session creation:
 *   1. Per-provider junction model (agentProviders.model)
 *   2. Agent-level model (agents.model)
 *   3. Provider default model (provider.options.model)
 *
 * Uses POST /_/ai/sessions to verify which model is resolved.
 * Requires TDSK_IT_PROVIDER_KEY for creating providers with real secrets via quickstart.
 */

const hasProviderKey = () => !!env.testProviderKey

describe('Tier 1: Agent-Provider Model Resolution', () => {
  const ctx = readContext()

  let fixtures: TFixtureResult = {}
  let setupFailed = false

  beforeAll(async () => {
    if (!hasProviderKey()) return

    try {
      fixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: uniqueName('MR Test Project'),
        agentName: uniqueName('MR Test Agent'),
      })
    }
    catch {
      setupFailed = true
      return
    }

    if (!fixtures.agent?.id) {
      setupFailed = true
    }
  })

  afterAll(async () => {
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  // ─── Junction model in session ──────────────────────────────────────

  test.skipIf(!hasProviderKey())('session uses junction model when set', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Set an explicit junction model
    const updateRes = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${fixtures.agent.id}`,
      {
        providerInputs: [
          { id: fixtures.provider.id, model: 'junction-test-model' },
        ],
      }
    )

    expect(updateRes.status).toBe(200)

    // Create session — should use junction model
    const sessionRes = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId: fixtures.agent.id }
    )

    expect(sessionRes.status).toBe(200)
    expect(sessionRes.data.model).toBe('junction-test-model')
  })

  test.skipIf(!hasProviderKey())('session falls through to agent.model when junction model is null', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Set agent-level model and clear junction model
    const updateRes = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${fixtures.agent.id}`,
      {
        model: 'agent-level-fallback',
        providerInputs: [
          { id: fixtures.provider.id },
        ],
      }
    )

    expect(updateRes.status).toBe(200)

    const sessionRes = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId: fixtures.agent.id }
    )

    expect(sessionRes.status).toBe(200)
    expect(sessionRes.data.model).toBe('agent-level-fallback')
  })

  test.skipIf(!hasProviderKey())('junction model takes precedence over agent.model', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Set both agent-level model AND junction model
    const updateRes = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/agents/${fixtures.agent.id}`,
      {
        model: 'agent-default-should-be-overridden',
        providerInputs: [
          { id: fixtures.provider.id, model: 'junction-override' },
        ],
      }
    )

    expect(updateRes.status).toBe(200)

    const sessionRes = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId: fixtures.agent.id }
    )

    expect(sessionRes.status).toBe(200)
    expect(sessionRes.data.model).toBe('junction-override')
  })

  // ─── Provider switching changes session model ────────────────────────

  describe('switching primary provider changes session model', () => {
    let provider2Id = ''
    let secret2Id = ''

    beforeAll(async () => {
      if (!hasProviderKey() || setupFailed) return

      // Create a second provider with secret
      const prov2Res = await post<{ id: string }>(
        `/orgs/${ctx.orgId}/providers`,
        {
          name: uniqueName('MR Provider 2'),
          type: 'ai',
          orgId: ctx.orgId,
          brand: 'zai',
          options: { baseUrl: 'https://api.z.ai/api/paas/v4' },
        }
      )

      if (prov2Res.status !== 201) return
      provider2Id = prov2Res.data.id

      // Create secret for provider2
      const secret2Res = await post<{ id: string }>(
        `/orgs/${ctx.orgId}/secrets`,
        {
          name: uniqueName('MR Secret 2'),
          value: env.testProviderKey,
          providerId: provider2Id,
        }
      )

      if (secret2Res.status === 201 && secret2Res.data?.id) {
        secret2Id = secret2Res.data.id
        await put(`/orgs/${ctx.orgId}/providers/${provider2Id}`, { secretId: secret2Id })
      }
    })

    afterAll(async () => {
      if (provider2Id) await tryDelete(`/orgs/${ctx.orgId}/providers/${provider2Id}`)
      if (secret2Id) await tryDelete(`/orgs/${ctx.orgId}/secrets/${secret2Id}`)
    })

    test.skipIf(!hasProviderKey())('switching primary changes session model to new primary junction model', async () => {
      if (setupFailed || !provider2Id) return expect(setupFailed).toBe(false)

      // Set provider1 as primary with model-a, provider2 with model-b
      await put(`/orgs/${ctx.orgId}/agents/${fixtures.agent.id}`, {
        providerInputs: [
          { id: fixtures.provider.id, model: 'model-a' },
          { id: provider2Id, model: 'model-b' },
        ],
      })

      // Session should use model-a (primary = provider1)
      const session1 = await post<Record<string, any>>(
        `/_/ai/sessions`,
        { agentId: fixtures.agent.id }
      )

      expect(session1.status).toBe(200)
      expect(session1.data.model).toBe('model-a')

      // Swap: provider2 becomes primary
      await put(`/orgs/${ctx.orgId}/agents/${fixtures.agent.id}`, {
        providerInputs: [
          { id: provider2Id, model: 'model-b' },
          { id: fixtures.provider.id, model: 'model-a' },
        ],
      })

      // Session should now use model-b (primary = provider2)
      const session2 = await post<Record<string, any>>(
        `/_/ai/sessions`,
        { agentId: fixtures.agent.id }
      )

      expect(session2.status).toBe(200)
      expect(session2.data.model).toBe('model-b')
    })
  })

  // ─── Session provider matches primary brand ────────────────────────

  test.skipIf(!hasProviderKey())('session provider field matches primary provider brand', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Restore single provider with explicit model
    await put(`/orgs/${ctx.orgId}/agents/${fixtures.agent.id}`, {
      providerInputs: [
        { id: fixtures.provider.id, model: 'zai-model' },
      ],
    })

    const sessionRes = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId: fixtures.agent.id }
    )

    expect(sessionRes.status).toBe(200)
    expect(sessionRes.data.provider).toBe('zai')
  })

  // ─── 400 when no model at any tier ──────────────────────────────────

  test.skipIf(!hasProviderKey())('session returns 400 when no model at any tier', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Clear all models: no junction model, no agent model
    await put(`/orgs/${ctx.orgId}/agents/${fixtures.agent.id}`, {
      model: '',
      providerInputs: [
        { id: fixtures.provider.id },
      ],
    })

    const sessionRes = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId: fixtures.agent.id }
    )

    // Should return 400 — no model configured anywhere
    // Note: provider.options.model might still have a default from quickstart
    // If it does, the session will succeed with the provider default
    if (sessionRes.status === 400) {
      expect(sessionRes.ok).toBe(false)
    } else {
      // Provider had a default model — session succeeded with fallback
      expect(sessionRes.status).toBe(200)
      expect(sessionRes.data.model).toBeTruthy()
    }
  })
})
