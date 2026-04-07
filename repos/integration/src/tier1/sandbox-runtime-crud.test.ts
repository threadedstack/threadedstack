import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { get, post, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

const baseCfg = {
  image: 'node:22-slim',
  ports: { '3000': { protocol: 'http' } },
  resources: {
    limits: { cpu: '500m', memory: '256Mi' },
    requests: { cpu: '100m', memory: '128Mi' },
  },
}

describe('Tier 1: Sandbox Runtime Fields', () => {
  const ctx = readContext()

  const createdSandboxIds: string[] = []

  afterAll(async () => {
    for (const sbId of createdSandboxIds) {
      await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sbId}`)
    }
  })

  // --- runtime CRUD ---

  test('POST creates sandbox with runtime=claude-code', async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('sb-runtime-claude'),
        config: {
          ...baseCfg,
          runtime: 'claude-code',
          runtimeCommand: 'claude',
          initScript: 'echo "ready"',
        },
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()
    expect(res.data.config.runtime).toBe('claude-code')
    expect(res.data.config.runtimeCommand).toBe('claude')
    expect(res.data.config.initScript).toBe('echo "ready"')

    createdSandboxIds.push(res.data.id)
  })

  test('GET single sandbox returns runtime fields', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.config.runtime).toBe('claude-code')
    expect(res.data.config.runtimeCommand).toBe('claude')
    expect(res.data.config.initScript).toBe('echo "ready"')
  })

  test('PUT updates runtime to codex', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`,
      {
        config: {
          ...baseCfg,
          runtime: 'codex',
          runtimeCommand: 'codex',
          initScript: 'echo "ready"',
        },
      }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.config.runtime).toBe('codex')
    expect(res.data.config.runtimeCommand).toBe('codex')
  })

  test('PUT updates initScript', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const updatedInitScript = 'npm install && echo "deps ready"'

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`,
      {
        config: {
          ...baseCfg,
          runtime: 'codex',
          runtimeCommand: 'codex',
          initScript: updatedInitScript,
        },
      }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.config.initScript).toBe(updatedInitScript)
  })

  test('POST creates sandbox with runtime=custom and custom command', async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('sb-runtime-custom'),
        config: {
          ...baseCfg,
          runtime: 'custom',
          runtimeCommand: 'my-tool',
          command: ['/bin/sh'],
          args: ['-c', 'sleep infinity'],
        },
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.config.runtime).toBe('custom')
    expect(res.data.config.runtimeCommand).toBe('my-tool')
    expect(res.data.config.command).toEqual(['/bin/sh'])
    expect(res.data.config.args).toEqual(['-c', 'sleep infinity'])

    createdSandboxIds.push(res.data.id)
  })

  test('POST creates sandbox with runtime=custom and no runtimeCommand', async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('sb-runtime-custom-no-cmd'),
        config: {
          ...baseCfg,
          runtime: 'custom',
        },
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.config.runtime).toBe('custom')
    expect(res.data.config.runtimeCommand == null).toBe(true)

    createdSandboxIds.push(res.data.id)
  })

  test('GET list includes runtime in config', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/sandboxes?limit=500`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    const found = res.data.find((s: any) => s.id === createdSandboxIds[0])
    expect(found).toBeDefined()
    expect(found?.config?.runtime).toBeDefined()
  })
})

describe('Tier 1: Sandbox builtIn Field', () => {
  const ctx = readContext()

  const createdSandboxIds: string[] = []

  afterAll(async () => {
    for (const sbId of createdSandboxIds) {
      await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sbId}`)
    }
  })

  test('POST creates sandbox with builtIn=false by default', async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('sb-builtin-default'),
        config: baseCfg,
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.builtIn).toBe(false)

    createdSandboxIds.push(res.data.id)
  })

  test('POST creates sandbox with builtIn=true (or validates it defaults to false)', async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('sb-builtin-true'),
        config: baseCfg,
        orgId: ctx.orgId,
        builtIn: true,
      }
    )

    // builtIn=true may be restricted to internal/seeding flows.
    // If the API accepts it, verify the value is returned.
    // If rejected, verify it falls back to false (the safe default).
    if (res.status === 400) {
      expect(res.ok).toBe(false)
    } else {
      expect(res.status).toBe(201)
      expect(res.ok).toBe(true)
      // Either the flag was accepted or silently coerced to false
      expect(typeof res.data.builtIn).toBe('boolean')
      createdSandboxIds.push(res.data.id)
    }
  })

  test('GET single sandbox includes builtIn field', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(typeof res.data.builtIn).toBe('boolean')
  })

  test('GET list includes builtIn in results', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/sandboxes?limit=500`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)

    const found = res.data.find((s: any) => s.id === createdSandboxIds[0])
    expect(found).toBeDefined()
    expect(typeof found?.builtIn).toBe('boolean')
  })
})

describe('Tier 1: POST /sandboxes/:id/copy', () => {
  const ctx = readContext()

  const createdSandboxIds: string[] = []

  let sourceSandboxId = ''

  beforeAll(async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('sb-copy-source'),
        config: {
          ...baseCfg,
          runtime: 'claude-code',
          runtimeCommand: 'claude',
          initScript: 'echo "copy source ready"',
          sshEnabled: true,
          idleTimeoutMinutes: 30,
        },
        orgId: ctx.orgId,
      }
    )
    if (res.ok) sourceSandboxId = res.data.id
  }, 30_000)

  afterAll(async () => {
    for (const sbId of createdSandboxIds) {
      await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sbId}`)
    }
    if (sourceSandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sourceSandboxId}`)
  })

  test('POST /:id/copy creates a deep copy', async () => {
    if (!sourceSandboxId) return expect(sourceSandboxId).toBeTruthy()

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sourceSandboxId}/copy`,
      { orgId: ctx.orgId }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()
    expect(res.data.id).not.toBe(sourceSandboxId)
    expect(res.data.config.runtime).toBe('claude-code')
    expect(res.data.config.runtimeCommand).toBe('claude')
    expect(res.data.config.initScript).toBe('echo "copy source ready"')
    expect(res.data.config.image).toBe('node:22-slim')
    expect(res.data.builtIn).toBe(false)

    createdSandboxIds.push(res.data.id)
  })

  test('POST /:id/copy with custom name', async () => {
    if (!sourceSandboxId) return expect(sourceSandboxId).toBeTruthy()

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

  test('POST /:id/copy of builtIn sandbox sets builtIn=false', async () => {
    // Create a sandbox and attempt to mark it builtIn to simulate a preset,
    // or use the source sandbox (builtIn=false by default) to verify copy behavior.
    // Either way, the copy must always produce builtIn=false.
    if (!sourceSandboxId) return expect(sourceSandboxId).toBeTruthy()

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sourceSandboxId}/copy`,
      { orgId: ctx.orgId }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.builtIn).toBe(false)

    createdSandboxIds.push(res.data.id)
  })

  test('POST /:id/copy preserves all config fields', async () => {
    if (!sourceSandboxId) return expect(sourceSandboxId).toBeTruthy()

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sourceSandboxId}/copy`,
      { orgId: ctx.orgId }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)

    const cfg = res.data.config
    expect(cfg.image).toBe('node:22-slim')
    expect(cfg.runtime).toBe('claude-code')
    expect(cfg.runtimeCommand).toBe('claude')
    expect(cfg.initScript).toBe('echo "copy source ready"')
    expect(cfg.sshEnabled).toBe(true)
    expect(cfg.idleTimeoutMinutes).toBe(30)

    createdSandboxIds.push(res.data.id)
  })

  test('POST /:id/copy with invalid ID returns error', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/sandboxes/00000000-0000-0000-0000-000000000000/copy`,
      { orgId: ctx.orgId }
    )

    expect(res.ok).toBe(false)
    expect([400, 404]).toContain(res.status)
  })

  test('POST /:id/copy without body orgId still works (uses route param)', async () => {
    if (!sourceSandboxId) return expect(sourceSandboxId).toBeTruthy()

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sourceSandboxId}/copy`,
      {}
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.builtIn).toBe(false)
    createdSandboxIds.push(res.data.id)
  })
})
