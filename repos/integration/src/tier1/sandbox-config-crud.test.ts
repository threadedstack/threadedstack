import { describe, test, expect, afterAll } from 'vitest'
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
    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: sandboxName,
        config: sandboxConfig,
        orgId: ctx.orgId,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBeDefined()
    expect(res.data.data.name).toBe(sandboxName)
    expect(res.data.data.config).toBeDefined()
    expect(res.data.data.config.image).toBe('node:22-slim')

    sandboxId = res.data.data.id
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

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()

    const sandbox = res.data.data
    expect(sandbox.id).toBe(sandboxId)
    expect(sandbox.name).toBe(sandboxName)
    expect(sandbox.config.image).toBe('node:22-slim')
    expect(sandbox.orgId).toBe(ctx.orgId)
    expect(sandbox.createdAt).toBeDefined()
  })

  // --- List ---

  test('GET /sandboxes returns 200 with data array', async () => {
    const res = await get<{ data: Record<string, any>[]; limit: number; offset: number }>(
      `/orgs/${ctx.orgId}/sandboxes`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
    expect(typeof res.data.limit).toBe('number')
    expect(typeof res.data.offset).toBe('number')
  })

  test('GET list includes created sandbox', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await get<{ data: Record<string, any>[]; limit: number; offset: number }>(
      `/orgs/${ctx.orgId}/sandboxes?limit=500`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.data)).toBe(true)

    const found = res.data.data.find((s: any) => s.id === sandboxId)
    expect(found).toBeDefined()
    expect(found?.name).toBe(sandboxName)
  })

  // --- Update ---

  test('PUT updates sandbox name', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await put<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
      { name: updatedName }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.name).toBe(updatedName)
  })

  test('PUT updates sandbox config', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await put<{ data: Record<string, any> }>(
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
    expect(res.data.data.config.image).toBe('python:3.12-slim')
    expect(res.data.data.config.envVars).toEqual({ NODE_ENV: 'test' })
  })

  // --- Delete ---

  test('DELETE removes sandbox', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const res = await del<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`
    )

    if (res.status === 403) {
      expect(res.ok).toBe(false)
      return
    }

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()

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
})
