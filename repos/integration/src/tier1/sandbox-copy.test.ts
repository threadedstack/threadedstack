import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

describe('Tier 1: Sandbox Copy Operation', () => {
  const ctx = readContext()

  let projectId = ''
  let sourceSandboxId = ''
  let setupFailed = false
  const createdSandboxIds: string[] = []

  const baseCfg = {
    image: 'node:22-slim',
    ports: { '3000': { protocol: 'http' } },
    resources: {
      limits: { cpu: '500m', memory: '256Mi' },
      requests: { cpu: '100m', memory: '128Mi' },
    },
  }

  const sourceConfig = {
    ...baseCfg,
    runtime: 'claude-code',
    runtimeCommand: 'claude',
    initScript: 'echo "copy-test ready"',
    sshEnabled: true,
    idleTimeoutMinutes: 45,
    gitRepo: 'https://github.com/example/copy-test.git',
    gitBranch: 'main',
  }

  beforeAll(async () => {
    // Create a project for project-scoped tests
    const projRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('sb-copy-proj'), orgId: ctx.orgId }
    )
    if (projRes.ok) {
      projectId = projRes.data.id
    } else {
      console.warn(`[sandbox-copy] Failed to create project: HTTP ${projRes.status} — marking setup as failed`)
      setupFailed = true
      return
    }

    // Create source sandbox linked to the project
    const sbRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('copy-source'),
        config: sourceConfig,
        orgId: ctx.orgId,
        ...(projectId ? { projectIds: [projectId] } : {}),
      }
    )
    if (sbRes.ok) {
      sourceSandboxId = sbRes.data.id
    } else {
      console.warn(`[sandbox-copy] Failed to create sandbox: HTTP ${sbRes.status} — marking setup as failed`)
      setupFailed = true
    }
  }, 30_000)

  afterAll(async () => {
    for (const sbId of createdSandboxIds) {
      await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sbId}`)
    }
    if (sourceSandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sourceSandboxId}`)
    if (projectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}`)
  })

  // --- Basic Copy ---

  test('POST /:id/copy returns 201 with a new sandbox', async () => {
    if (setupFailed || !sourceSandboxId) return expect(setupFailed ? false : sourceSandboxId).toBeTruthy()

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sourceSandboxId}/copy`,
      { orgId: ctx.orgId }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()
    expect(res.data.id).not.toBe(sourceSandboxId)

    createdSandboxIds.push(res.data.id)
  })

  test('copied sandbox has builtIn: false', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`
    )

    expect(res.status).toBe(200)
    expect(res.data.builtIn).toBe(false)
  })

  test('copied sandbox preserves all config fields', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`
    )

    expect(res.status).toBe(200)
    const cfg = res.data.config
    expect(cfg.image).toBe(sourceConfig.image)
    expect(cfg.runtime).toBe(sourceConfig.runtime)
    expect(cfg.runtimeCommand).toBe(sourceConfig.runtimeCommand)
    expect(cfg.initScript).toBe(sourceConfig.initScript)
    expect(cfg.sshEnabled).toBe(sourceConfig.sshEnabled)
    expect(cfg.idleTimeoutMinutes).toBe(sourceConfig.idleTimeoutMinutes)
    expect(cfg.gitRepo).toBe(sourceConfig.gitRepo)
    expect(cfg.gitBranch).toBe(sourceConfig.gitBranch)
  })

  test('copied sandbox default name includes "(copy)"', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`
    )

    expect(res.status).toBe(200)
    expect(res.data.name).toContain('(copy)')
  })

  // --- Custom Name ---

  test('POST /:id/copy with custom name uses provided name', async () => {
    if (setupFailed || !sourceSandboxId) return expect(setupFailed ? false : sourceSandboxId).toBeTruthy()

    const customName = uniqueName('my-custom-copy')
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sourceSandboxId}/copy`,
      { orgId: ctx.orgId, name: customName }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.name).toBe(customName)

    createdSandboxIds.push(res.data.id)
  })

  // --- Project-Scoped Copy ---

  test('POST project-scoped /:id/copy returns 201', async () => {
    if (setupFailed || !sourceSandboxId || !projectId) {
      return expect(setupFailed ? false : sourceSandboxId && projectId).toBeTruthy()
    }

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sourceSandboxId}/copy`,
      { orgId: ctx.orgId }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.id).toBeDefined()
    expect(res.data.id).not.toBe(sourceSandboxId)
    expect(res.data.builtIn).toBe(false)
    expect(res.data.config.runtime).toBe(sourceConfig.runtime)

    createdSandboxIds.push(res.data.id)
  })

  // --- Auth & Error Cases ---

  test('POST /:id/copy without auth returns 401', async () => {
    if (setupFailed || !sourceSandboxId) return expect(setupFailed ? false : sourceSandboxId).toBeTruthy()

    const res = await post(
      `/orgs/${ctx.orgId}/sandboxes/${sourceSandboxId}/copy`,
      { orgId: ctx.orgId },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('POST /:id/copy for nonexistent sandbox returns 404', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/sandboxes/sb_00000000000000000000000000/copy`,
      { orgId: ctx.orgId }
    )

    expect(res.ok).toBe(false)
    expect([400, 404]).toContain(res.status)
  })
})
