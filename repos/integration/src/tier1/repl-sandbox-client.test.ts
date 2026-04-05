import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { createTestAuth } from '../utils/repl-auth'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { ApiClient } from '@tdsk/repl'

/**
 * Tier 1: REPL ApiClient — Sandbox Methods (live)
 *
 * Validates ApiClient.listSandboxes against the live backend:
 * URL construction, auth headers, envelope unwrapping.
 */
describe('Tier 1: REPL ApiClient Sandboxes (live)', () => {
  const ctx = readContext()
  let client: ApiClient

  let sandboxId = ''
  let sandboxName = ''
  let projectId = ''

  beforeAll(async () => {
    const auth = createTestAuth()
    client = new ApiClient(auth as any)

    // Create a project for the sandbox
    const projRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects`,
      { name: uniqueName('repl-sb-project'), orgId: ctx.orgId }
    )
    if (projRes.ok) projectId = projRes.data.id

    // Create a sandbox config via direct API so listSandboxes has data
    sandboxName = uniqueName('repl-sb-test')
    const sbRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes`,
      {
        name: sandboxName,
        config: {
          image: 'node:22-slim',
          ports: { '3000': { protocol: 'http' } },
          resources: {
            limits: { cpu: '500m', memory: '512Mi' },
            requests: { cpu: '100m', memory: '256Mi' },
          },
        },
        orgId: ctx.orgId,
        projectId,
      }
    )
    if (sbRes.ok) sandboxId = sbRes.data.id
  })

  afterAll(async () => {
    if (sandboxId) await tryDelete(`/orgs/${ctx.orgId}/sandboxes/${sandboxId}`)
    if (projectId) await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}`)
  })

  // ─── listSandboxes ─────────────────────────────────────────────────

  test('listSandboxes returns array', async () => {
    const sandboxes = await client.listSandboxes(ctx.orgId)
    expect(Array.isArray(sandboxes)).toBe(true)
  })

  test('listSandboxes includes created sandbox', async () => {
    if (!sandboxId) return expect(sandboxId).toBeTruthy()

    const sandboxes = await client.listSandboxes(ctx.orgId)
    const found = sandboxes.find((sb: any) => sb.id === sandboxId || sb.name === sandboxName)
    expect(found).toBeDefined()
  })

  test('listSandboxes with bad auth throws', async () => {
    const badAuth = createTestAuth({ apiKey: 'tdsk_invalid_key_12345' })
    const badClient = new ApiClient(badAuth as any)

    await expect(badClient.listSandboxes(ctx.orgId)).rejects.toThrow()
  })
})
