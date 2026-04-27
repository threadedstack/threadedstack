import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { post, put, del, api } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'

/**
 * Tier 3: FaaS Function Lifecycle
 *
 * Tests the relationship between function CRUD operations and
 * FaaS endpoint execution — verifying that updates to a function's
 * content are reflected when the endpoint is invoked, and that
 * deletion breaks the link properly.
 */
describe('Tier 3: FaaS Function Lifecycle', () => {
  const ctx = readContext()
  const timestamp = Date.now()

  let setupFailed = false
  let fixtures: TFixtureResult = {}
  let projectId = ''
  let functionId = ''
  let endpointId = ''

  const v1Content = `export default async function handler(request, context) {
  return { statusCode: 200, body: { version: 1, message: 'original' } }
}`

  const v2Content = `export default async function handler(request, context) {
  return { statusCode: 200, body: { version: 2, message: 'updated' } }
}`

  beforeAll(async () => {
    try {
      fixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'anthropic',
        projectName: uniqueName('FaaS Lifecycle Project'),
        agentName: uniqueName('FaaS Lifecycle Agent'),
      })
    }
    catch {
      setupFailed = true
      return
    }

    if (!fixtures.project?.id) {
      setupFailed = true
      return
    }

    projectId = fixtures.project.id

    // Create v1 function
    const fnRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions`,
      {
        name: uniqueName('Lifecycle Function'),
        content: v1Content,
        language: 'javascript',
        projectId,
      }
    )

    if (fnRes.status !== 201 || !fnRes.data?.id) {
      setupFailed = true
      return
    }

    functionId = fnRes.data.id

    // Create FaaS endpoint linked to the function
    const epRes = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('Lifecycle Endpoint'),
        path: `/faas/lifecycle-${timestamp}`,
        type: 'faas',
        method: 'post',
        projectId,
        options: { functionId },
      }
    )

    if (epRes.status !== 201 || !epRes.data?.id) {
      setupFailed = true
      return
    }

    endpointId = epRes.data.id
  }, 30_000)

  afterAll(async () => {
    if (endpointId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${endpointId}`)
    if (functionId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`)
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  test('v1 function executes with correct output', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${endpointId}`,
      { method: 'POST', rawPath: true, body: {} }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.version).toBe(1)
    expect(res.data.message).toBe('original')
  })

  test('updating function content changes execution result', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Update function to v2
    const updateRes = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`,
      { content: v2Content }
    )

    expect(updateRes.status).toBe(200)

    // Execute — should now return v2 output
    const res = await api<any>(
      `/proxy/${projectId}/${endpointId}`,
      { method: 'POST', rawPath: true, body: {} }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.version).toBe(2)
    expect(res.data.message).toBe('updated')
  })

  test('deleting function causes endpoint execution to fail', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Delete the function
    const deleteRes = await del<{ success: boolean }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`
    )

    // DELETE may require admin scope — if 403, the rest of this test doesn't apply
    if (deleteRes.status === 403) return

    expect(deleteRes.status).toBe(200)
    functionId = '' // Prevent afterAll from trying to delete again

    // Execute — should now fail because function is gone
    const res = await api<any>(
      `/proxy/${projectId}/${endpointId}`,
      { method: 'POST', rawPath: true, body: {} }
    )

    expect(res.ok).toBe(false)
    expect([404, 500]).toContain(res.status)
  })
})
