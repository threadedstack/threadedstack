import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

describe('Tier 1: Sandbox Config CRUD', () => {
  const ctx = readContext()

  let sandboxId = ''
  let deletedSandboxId = ''

  const sandboxName = uniqueName('test-sandbox')
  const updatedName = uniqueName('test-sandbox-updated')

  const sandboxConfig = {
    image: 'node:22-slim',
    ports: { '3000': { protocol: 'http' } },
    resources: {
      limits: { cpu: '500m', memory: '256Mi' },
      requests: { cpu: '100m', memory: '128Mi' },
    },
  }

  afterAll(async () => {
    if (sandboxId)
      await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sandboxId}`)
  })

  // --- Create ---

  test('POST creates sandbox config', async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: sandboxName,
        config: sandboxConfig,
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()
    expect(res.data.name).toBe(sandboxName)
    expect(res.data.config).toBeDefined()
    expect(res.data.config.image).toBe('node:22-slim')
    expect(res.data.builtIn).toBe(false)

    sandboxId = res.data.id
  })

  test('POST without name returns 400', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        config: sandboxConfig,
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST without config.image returns 400', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('no-image'),
        config: {},
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  // --- Read ---

  test('GET single sandbox by ID', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()

    const sandbox = res.data
    expect(sandbox.id).toBe(sandboxId)
    expect(sandbox.name).toBe(sandboxName)
    expect(sandbox.config.image).toBe('node:22-slim')
    expect(sandbox.orgId).toBe(ctx.orgId)
    expect(sandbox.createdAt).toBeDefined()
    expect(typeof sandbox.builtIn).toBe('boolean')
  })

  // --- List ---

  test('GET /sandboxes returns 200 with data array', async () => {
    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/sandboxes`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  test('GET list includes created sandbox', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/sandboxes?limit=500`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    const found = res.data.find((s: any) => s.id === sandboxId)
    expect(found).toBeDefined()
    expect(found?.name).toBe(sandboxName)
    expect(found?.builtIn).toBe(false)
  })

  // --- Update ---

  test('PUT updates sandbox name', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
      { name: updatedName }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.name).toBe(updatedName)
  })

  test('PUT updates sandbox config', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
      {
        config: {
          ...sandboxConfig,
          image: 'python:3.12-slim',
          envVars: { NODE_ENV: 'test' },
        },
      }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.config.image).toBe('python:3.12-slim')
    expect(res.data.config.envVars).toEqual({ NODE_ENV: 'test' })
  })

  // --- Delete ---

  test('DELETE removes sandbox', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await del<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`
    )

    if (res.status === 403) {
      expect(res.ok).toBe(false)
      return
    }

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()

    deletedSandboxId = sandboxId
    sandboxId = ''
  })

  test('GET deleted sandbox returns 404', async () => {
    if (!deletedSandboxId) return expect(deletedSandboxId).toBeTruthy()

    const res = await get(`/orgs/${ctx.orgId}/sandboxes/${deletedSandboxId}`)

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // --- Auth ---

  test('GET without auth returns 401', async () => {
    const res = await get(
      `/orgs/${ctx.orgId}/sandboxes`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  // --- projectId & New Config Fields ---

  describe('projectId + new config fields', () => {
    let testProjectId = ''
    const createdSandboxIds: string[] = []

    const baseCfg = {
      image: 'node:22-slim',
      ports: { '3000': { protocol: 'http' } },
      resources: {
        limits: { cpu: '500m', memory: '256Mi' },
        requests: { cpu: '100m', memory: '128Mi' },
      },
    }

    beforeAll(async () => {
      const projRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('sb-proj-test'), orgId: ctx.orgId }
      )
      if (projRes.ok) testProjectId = projRes.data.id
    }, 30_000)

    afterAll(async () => {
      for (const sbId of createdSandboxIds) {
        await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sbId}`)
      }
      if (testProjectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${testProjectId}`)
    })

    // --- projectId CRUD ---

    test('POST creates sandbox with projectId', async () => {
      if (!testProjectId) return expect(testProjectId).toBeTruthy()

      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('sb-with-proj'),
          config: baseCfg,
          orgId: ctx.orgId,
          projectIds: [testProjectId],
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data.projects).toBeDefined()
      expect(res.data.projects.length).toBe(1)
      expect(res.data.projects[0].id).toBe(testProjectId)
      expect(res.data.builtIn).toBe(false)
      createdSandboxIds.push(res.data.id)
    })

    test('GET single sandbox includes projectId', async () => {
      if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

      const res = await get<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`
      )

      expect(res.status).toBe(200)
      expect(res.data.projects).toBeDefined()
      expect(res.data.projects.length).toBe(1)
      expect(res.data.projects[0].id).toBe(testProjectId)
    })

    test('GET list with ?projectId filter returns only matching sandboxes', async () => {
      if (!testProjectId) return expect(testProjectId).toBeTruthy()

      // Create a sandbox WITHOUT any project association
      const noProj = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        { name: uniqueName('sb-no-proj'), config: baseCfg, orgId: ctx.orgId }
      )
      expect(noProj.status).toBe(201)
      createdSandboxIds.push(noProj.data.id)

      const res = await get<Record<string, any>[]>(
        `/orgs/${ctx.orgId}/sandboxes?projectId=${testProjectId}&limit=500`
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)

      const ids = res.data.map((s: any) => s.id)
      // The sandbox linked to the project should be present
      expect(ids).toContain(createdSandboxIds[0])
      // The sandbox without project association should NOT appear in filtered results
      expect(ids).not.toContain(noProj.data.id)
    })

    test('GET list without ?projectId returns all', async () => {
      const res = await get<Record<string, any>[]>(
        `/orgs/${ctx.orgId}/sandboxes?limit=500`
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)

      const ids = res.data.map((s: any) => s.id)
      // Both sandboxes (with and without projectId) should be present
      for (const sbId of createdSandboxIds) {
        expect(ids).toContain(sbId)
      }
    })

    test('PUT updates sandbox projectId', async () => {
      if (!createdSandboxIds[1]) return expect(createdSandboxIds[1]).toBeTruthy()

      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[1]}`,
        { projectIds: [testProjectId] }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data.projects).toBeDefined()
      expect(res.data.projects.length).toBe(1)
      expect(res.data.projects[0].id).toBe(testProjectId)
    })

    test('PUT can set sandbox projectId to null', async () => {
      if (!createdSandboxIds[1]) return expect(createdSandboxIds[1]).toBeTruthy()

      const res = await put<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[1]}`,
        { projectIds: [] }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data.projects).toBeDefined()
      expect(res.data.projects.length).toBe(0)
    })

    // --- sshEnabled ---

    test('POST creates sandbox with sshEnabled=false', async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('sb-no-ssh'),
          config: { ...baseCfg, sshEnabled: false },
          orgId: ctx.orgId,
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data.config.sshEnabled).toBe(false)
      createdSandboxIds.push(res.data.id)
    })

    // --- idleTimeoutMinutes ---

    test('POST creates sandbox with idleTimeoutMinutes=60', async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('sb-idle'),
          config: { ...baseCfg, idleTimeoutMinutes: 60 },
          orgId: ctx.orgId,
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data.config.idleTimeoutMinutes).toBe(60)
      createdSandboxIds.push(res.data.id)
    })

    // --- Validation ---

    test('POST with idleTimeoutMinutes < 1 returns 400', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('sb-bad-idle'),
          config: { ...baseCfg, idleTimeoutMinutes: 0 },
          orgId: ctx.orgId,
        }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('PUT with idleTimeoutMinutes < 1 returns 400', async () => {
      if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

      const res = await put(
        `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`,
        { config: { ...baseCfg, idleTimeoutMinutes: -5 } }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('POST creates sandbox with maxInstances', async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('sb-max-inst'),
          config: { ...baseCfg, maxInstances: 3 },
          orgId: ctx.orgId,
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data.config.maxInstances).toBe(3)
      createdSandboxIds.push(res.data.id)
    })

    test('maxInstances is floored to positive integer', async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('sb-max-floor'),
          config: { ...baseCfg, maxInstances: 2.7 },
          orgId: ctx.orgId,
        }
      )

      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      expect(res.data.config.maxInstances).toBe(2)
      createdSandboxIds.push(res.data.id)
    })

    // --- Response shape ---

    test('GET sandbox includes providerLinks and gitProviderLinks arrays', async () => {
      if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

      const res = await get<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.providerLinks)).toBe(true)
      expect(Array.isArray(res.data.gitProviderLinks)).toBe(true)
    })

  })
})
