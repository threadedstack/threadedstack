import { describe, test, expect, afterAll } from 'vitest'
import { get, post, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'

describe('Tier 1: Sandbox config.sync round-trip', () => {
  const ctx = readContext()

  const createdSandboxIds: string[] = []

  const baseCfg = {
    image: 'node:22-slim',
    ports: { '3000': { protocol: 'http' } },
    resources: {
      limits: { cpu: '500m', memory: '256Mi' },
      requests: { cpu: '100m', memory: '128Mi' },
    },
  }

  const syncDefaults = {
    targetBase: '/workspace/app',
    mode: 'one-way-replica' as const,
    ignores: ['dist/', '*.log'],
  }

  afterAll(async () => {
    for (const sbId of createdSandboxIds) {
      await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sbId}`)
    }
  })

  // --- Create with config.sync ---

  test('POST creates sandbox with config.sync', async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('sb-sync-create'),
        config: { ...baseCfg, sync: syncDefaults },
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.config.sync).toBeDefined()
    expect(res.data.config.sync.targetBase).toBe('/workspace/app')
    expect(res.data.config.sync.mode).toBe('one-way-replica')
    expect(res.data.config.sync.ignores).toEqual(['dist/', '*.log'])
    createdSandboxIds.push(res.data.id)
  })

  // --- Read config.sync ---

  test('GET returns config.sync correctly', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`
    )

    expect(res.status).toBe(200)
    expect(res.data.config.sync).toBeDefined()
    expect(res.data.config.sync.targetBase).toBe('/workspace/app')
    expect(res.data.config.sync.mode).toBe('one-way-replica')
    expect(res.data.config.sync.ignores).toEqual(['dist/', '*.log'])
  })

  // --- Update config.sync ---

  test('PUT updates config.sync', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const updatedSync = {
      targetBase: '/workspace/custom',
      mode: 'two-way-safe' as const,
      ignores: ['node_modules/', '.env'],
    }

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`,
      { config: { ...baseCfg, sync: updatedSync } }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.config.sync.targetBase).toBe('/workspace/custom')
    expect(res.data.config.sync.mode).toBe('two-way-safe')
    expect(res.data.config.sync.ignores).toEqual(['node_modules/', '.env'])
  })

  test('GET reflects updated config.sync', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`
    )

    expect(res.status).toBe(200)
    expect(res.data.config.sync.targetBase).toBe('/workspace/custom')
    expect(res.data.config.sync.mode).toBe('two-way-safe')
  })

  // --- Clear config.sync ---

  test('PUT can clear config.sync by omitting it', async () => {
    if (!createdSandboxIds[0]) return expect(createdSandboxIds[0]).toBeTruthy()

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${createdSandboxIds[0]}`,
      { config: baseCfg }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.config.sync).toBeUndefined()
  })

  // --- No regression: create without config.sync ---

  test('POST creates sandbox without config.sync (no regression)', async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('sb-no-sync'),
        config: baseCfg,
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.config.sync).toBeUndefined()
    createdSandboxIds.push(res.data.id)
  })

  // --- Partial config.sync ---

  test('POST creates sandbox with partial config.sync (only targetBase)', async () => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: uniqueName('sb-sync-partial'),
        config: { ...baseCfg, sync: { targetBase: '/app' } },
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.config.sync.targetBase).toBe('/app')
    expect(res.data.config.sync.mode).toBeUndefined()
    expect(res.data.config.sync.ignores).toBeUndefined()
    createdSandboxIds.push(res.data.id)
  })
})
