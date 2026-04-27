import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { env } from '../utils/env'

/**
 * Tier 1: Onboarding Flow — API Orchestration
 *
 * Validates the sequence of API calls made by the onboarding wizard:
 *   1. Create org
 *   2. Create provider (with real API key)
 *   3. Create project
 *   4. Update a built-in sandbox to link projectIds + providerInputs
 *
 * Also validates the "skip provider" variant where the sandbox is linked
 * to a project without any provider.
 */
describe('Tier 1: Onboarding Flow', () => {
  const ctx = readContext()

  // ── Full flow resources ────────────────────────────────────────────────
  let fullOrgId = ''
  let fullProviderId = ''
  let fullProjectId = ''
  let fullSandboxId = ''

  // ── Skip-provider flow resources ──────────────────────────────────────
  let skipOrgId = ''
  let skipProjectId = ''
  let skipSandboxId = ''

  // ── Shared setup state ────────────────────────────────────────────────
  let builtInSandboxId = ''
  let setupFailed = false

  const hasProviderKey = Boolean(env.testProviderKey)

  beforeAll(async () => {
    // Find an existing built-in sandbox in the context org to use as the
    // sandbox selection target in both flow variants.
    const listRes = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/sandboxes?limit=50`
    )
    if (!listRes.ok || !Array.isArray(listRes.data)) {
      setupFailed = true
      return
    }

    const builtIn = listRes.data.find((s: any) => s.builtIn === true)
    builtInSandboxId = builtIn?.id || listRes.data[0]?.id || ''

    if (!builtInSandboxId) {
      setupFailed = true
    }
  }, 30_000)

  afterAll(async () => {
    // Clean up full-flow resources
    if (fullSandboxId) await tryDelete(`/orgs/${fullOrgId}/sandboxes/${fullSandboxId}`)
    if (fullProjectId) await tryDelete(`/orgs/${fullOrgId}/projects/${fullProjectId}`)
    if (fullProviderId) await tryDelete(`/orgs/${fullOrgId}/providers/${fullProviderId}`)
    if (fullOrgId) await tryDelete(`/orgs/${fullOrgId}`)

    // Clean up skip-provider flow resources
    if (skipSandboxId) await tryDelete(`/orgs/${skipOrgId}/sandboxes/${skipSandboxId}`)
    if (skipProjectId) await tryDelete(`/orgs/${skipOrgId}/projects/${skipProjectId}`)
    if (skipOrgId) await tryDelete(`/orgs/${skipOrgId}`)
  })

  // ════════════════════════════════════════════════════════════════════════
  // Full Onboarding Flow: org → provider → project → sandbox link
  // ════════════════════════════════════════════════════════════════════════

  describe('Full flow: org + provider + project + sandbox', () => {
    test.skipIf(!hasProviderKey)(
      'Step 1 — POST /orgs creates a new org',
      async () => {
        if (setupFailed) return expect(setupFailed).toBe(false)

        const res = await post<Record<string, any>>(
          '/orgs',
          {
            name: uniqueName('Onboarding Full Org'),
            description: 'Created by onboarding flow integration test',
          }
        )

        expect(res.status).toBe(201)
        expect(res.ok).toBe(true)
        expect(res.data).toBeDefined()
        expect(res.data.id).toBeTruthy()
        expect(res.data.name).toContain('Onboarding Full Org')

        fullOrgId = res.data.id
      }
    )

    test.skipIf(!hasProviderKey)(
      'Step 2 — POST /orgs/:orgId/providers creates a provider with brand + API key',
      async () => {
        if (setupFailed || !fullOrgId) return expect(fullOrgId).toBeTruthy()

        const res = await post<Record<string, any>>(
          `/orgs/${fullOrgId}/providers`,
          {
            name: uniqueName('Onboarding Provider'),
            type: 'ai',
            brand: 'zai',
            orgId: fullOrgId,
          }
        )

        expect(res.status).toBe(201)
        expect(res.ok).toBe(true)
        expect(res.data).toBeDefined()
        expect(res.data.id).toBeTruthy()
        expect(res.data.brand).toBe('zai')

        fullProviderId = res.data.id
      }
    )

    test.skipIf(!hasProviderKey)(
      'Step 2b — POST /orgs/:orgId/secrets stores the API key for the provider',
      async () => {
        if (setupFailed || !fullOrgId || !fullProviderId) {
          return expect(fullOrgId && fullProviderId).toBeTruthy()
        }

        const res = await post<Record<string, any>>(
          `/orgs/${fullOrgId}/secrets`,
          {
            name: uniqueName('Provider API Key'),
            value: env.testProviderKey,
            type: 'api_key',
            providerId: fullProviderId,
          }
        )

        expect(res.status).toBe(201)
        expect(res.ok).toBe(true)
        expect(res.data).toBeDefined()
        expect(res.data.id).toBeTruthy()
        // Value must not be returned in plaintext
        expect(res.data.value).toBeUndefined()
      }
    )

    test.skipIf(!hasProviderKey)(
      'Step 3 — POST /orgs/:orgId/projects creates a project',
      async () => {
        if (setupFailed || !fullOrgId) return expect(fullOrgId).toBeTruthy()

        const res = await post<Record<string, any>>(
          `/orgs/${fullOrgId}/projects`,
          {
            name: uniqueName('Onboarding Project'),
            description: 'Created by onboarding flow integration test',
            orgId: fullOrgId,
          }
        )

        expect(res.status).toBe(201)
        expect(res.ok).toBe(true)
        expect(res.data).toBeDefined()
        expect(res.data.id).toBeTruthy()
        expect(res.data.name).toContain('Onboarding Project')

        fullProjectId = res.data.id
      }
    )

    test.skipIf(!hasProviderKey)(
      'Step 4 — POST /orgs/:orgId/sandboxes creates a sandbox linked to project + provider',
      async () => {
        if (setupFailed || !fullOrgId || !fullProjectId || !fullProviderId) {
          return expect(fullOrgId && fullProjectId && fullProviderId).toBeTruthy()
        }

        const res = await post<Record<string, any>>(
          `/orgs/${fullOrgId}/sandboxes`,
          {
            name: uniqueName('Onboarding Sandbox'),
            orgId: fullOrgId,
            config: {
              runtime: 'claude-code',
              image: 'node:22-slim',
            },
            projectIds: [fullProjectId],
            providerInputs: [{ id: fullProviderId }],
          }
        )

        expect(res.status).toBe(201)
        expect(res.ok).toBe(true)
        expect(res.data).toBeDefined()
        expect(res.data.id).toBeTruthy()

        fullSandboxId = res.data.id

        // Verify project is linked
        const projectIds = res.data.projectIds || res.data.projects?.map((p: any) => p.id) || []
        expect(projectIds).toContain(fullProjectId)

        // Verify provider is linked
        const providers = res.data.providerLinks || res.data.providers || []
        const linked = providers.find(
          (l: any) => (l.provider?.id || l.id) === fullProviderId
        )
        expect(linked).toBeDefined()
      }
    )

    test.skipIf(!hasProviderKey)(
      'Verify — GET sandbox returns linked project and provider',
      async () => {
        if (setupFailed || !fullOrgId || !fullSandboxId) {
          return expect(fullSandboxId).toBeTruthy()
        }

        const res = await get<Record<string, any>>(
          `/orgs/${fullOrgId}/sandboxes/${fullSandboxId}`
        )

        expect(res.status).toBe(200)
        expect(res.ok).toBe(true)
        expect(res.data.id).toBe(fullSandboxId)

        // Project link
        const projectIds = res.data.projectIds || res.data.projects?.map((p: any) => p.id) || []
        expect(projectIds).toContain(fullProjectId)

        // Provider link
        const providers = res.data.providerLinks || res.data.providers || []
        const linked = providers.find(
          (l: any) => (l.provider?.id || l.id) === fullProviderId
        )
        expect(linked).toBeDefined()
      }
    )
  })

  // ════════════════════════════════════════════════════════════════════════
  // Skip-provider flow: org → project → sandbox link (no provider)
  // ════════════════════════════════════════════════════════════════════════

  describe('Skip-provider flow: org + project + sandbox (no provider)', () => {
    test('Step 1 — POST /orgs creates a new org', async () => {
      if (setupFailed) return expect(setupFailed).toBe(false)

      const res = await post<Record<string, any>>(
        '/orgs',
        {
          name: uniqueName('Onboarding Skip Org'),
          description: 'Created by onboarding skip-provider flow integration test',
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      expect(res.data.id).toBeTruthy()

      skipOrgId = res.data.id
    })

    test('Step 2 — POST /orgs/:orgId/projects creates a project', async () => {
      if (setupFailed || !skipOrgId) return expect(skipOrgId).toBeTruthy()

      const res = await post<Record<string, any>>(
        `/orgs/${skipOrgId}/projects`,
        {
          name: uniqueName('Onboarding Skip Project'),
          description: 'Created by onboarding skip-provider flow integration test',
          orgId: skipOrgId,
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      expect(res.data.id).toBeTruthy()

      skipProjectId = res.data.id
    })

    test('Step 3 — POST /orgs/:orgId/sandboxes creates sandbox linked to project only', async () => {
      if (setupFailed || !skipOrgId || !skipProjectId) {
        return expect(skipOrgId && skipProjectId).toBeTruthy()
      }

      const res = await post<Record<string, any>>(
        `/orgs/${skipOrgId}/sandboxes`,
        {
          name: uniqueName('Onboarding Skip Sandbox'),
          orgId: skipOrgId,
          config: {
            runtime: 'claude-code',
            image: 'node:22-slim',
          },
          projectIds: [skipProjectId],
          // No providerInputs — provider step was skipped
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      expect(res.data.id).toBeTruthy()

      skipSandboxId = res.data.id

      // Project is linked
      const projectIds = res.data.projectIds || res.data.projects?.map((p: any) => p.id) || []
      expect(projectIds).toContain(skipProjectId)

      // No provider links
      const providers = res.data.providerLinks || res.data.providers || []
      expect(providers.length).toBe(0)
    })

    test('Verify — GET sandbox confirms project linked, no providers', async () => {
      if (setupFailed || !skipOrgId || !skipSandboxId) {
        return expect(skipSandboxId).toBeTruthy()
      }

      const res = await get<Record<string, any>>(
        `/orgs/${skipOrgId}/sandboxes/${skipSandboxId}`
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data.id).toBe(skipSandboxId)

      const projectIds = res.data.projectIds || res.data.projects?.map((p: any) => p.id) || []
      expect(projectIds).toContain(skipProjectId)

      const providers = res.data.providerLinks || res.data.providers || []
      expect(providers.length).toBe(0)
    })
  })

  // ════════════════════════════════════════════════════════════════════════
  // Update path: link existing built-in sandbox via PUT
  // ════════════════════════════════════════════════════════════════════════

  describe('Update path: PUT sandbox to link project + provider', () => {
    let updateProjectId = ''
    let updateProviderId = ''

    afterAll(async () => {
      if (updateProjectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${updateProjectId}`)
      if (updateProviderId) await tryDelete(`/orgs/${ctx.orgId}/providers/${updateProviderId}`)
    })

    test('Setup — create project and provider in the context org', async () => {
      if (setupFailed || !builtInSandboxId) {
        return expect(builtInSandboxId).toBeTruthy()
      }

      const [projRes, provRes] = await Promise.all([
        post<Record<string, any>>(
          `/orgs/${ctx.orgId}/projects`,
          { name: uniqueName('Onboarding Update Project'), orgId: ctx.orgId }
        ),
        post<Record<string, any>>(
          `/orgs/${ctx.orgId}/providers`,
          { name: uniqueName('Onboarding Update Provider'), type: 'ai', brand: 'anthropic', orgId: ctx.orgId }
        ),
      ])

      if (projRes.ok) updateProjectId = projRes.data.id
      if (provRes.ok) updateProviderId = provRes.data.id

      expect(updateProjectId).toBeTruthy()
      expect(updateProviderId).toBeTruthy()
    })

    test('PUT /orgs/:orgId/sandboxes/:id links projectIds to built-in sandbox', async () => {
      if (setupFailed || !builtInSandboxId || !updateProjectId) {
        return expect(builtInSandboxId && updateProjectId).toBeTruthy()
      }

      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes/${builtInSandboxId}`,
        { projectIds: [updateProjectId] }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()

      const projectIds = res.data.projectIds || res.data.projects?.map((p: any) => p.id) || []
      expect(projectIds).toContain(updateProjectId)
    })

    test('PUT /orgs/:orgId/sandboxes/:id links providerInputs to sandbox', async () => {
      if (setupFailed || !builtInSandboxId || !updateProviderId) {
        return expect(builtInSandboxId && updateProviderId).toBeTruthy()
      }

      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes/${builtInSandboxId}`,
        { providerInputs: [{ id: updateProviderId }] }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()

      const providers = res.data.providerLinks || res.data.providers || []
      const linked = providers.find(
        (l: any) => (l.provider?.id || l.id) === updateProviderId
      )
      expect(linked).toBeDefined()
    })

    test('PUT /orgs/:orgId/sandboxes/:id links both projectIds + providerInputs together', async () => {
      if (setupFailed || !builtInSandboxId || !updateProjectId || !updateProviderId) {
        return expect(builtInSandboxId && updateProjectId && updateProviderId).toBeTruthy()
      }

      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes/${builtInSandboxId}`,
        {
          projectIds: [updateProjectId],
          providerInputs: [{ id: updateProviderId }],
        }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()

      const projectIds = res.data.projectIds || res.data.projects?.map((p: any) => p.id) || []
      expect(projectIds).toContain(updateProjectId)

      const providers = res.data.providerLinks || res.data.providers || []
      const linked = providers.find(
        (l: any) => (l.provider?.id || l.id) === updateProviderId
      )
      expect(linked).toBeDefined()
    })

    test('PUT without auth returns 401', async () => {
      if (setupFailed || !builtInSandboxId) return expect(builtInSandboxId).toBeTruthy()

      const res = await put(
        `/orgs/${ctx.orgId}/sandboxes/${builtInSandboxId}`,
        { projectIds: [] },
        { noAuth: true }
      )

      expect(res.status).toBe(401)
    })
  })
})
