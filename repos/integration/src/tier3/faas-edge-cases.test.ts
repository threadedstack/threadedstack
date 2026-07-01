import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { post, api } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'

/**
 * Tier 3: FaaS Edge Cases
 *
 * Tests error handling, timeout behavior, and edge cases for the
 * FaaS sandbox execution path (V8 isolate via IsolateRunner).
 */
describe('Tier 3: FaaS Edge Cases', () => {
  const ctx = readContext()
  const timestamp = Date.now()

  let setupFailed = false
  let fixtures: TFixtureResult = {}
  let projectId = ''

  // Track all created resources for cleanup
  const functionIds: string[] = []
  const endpointIds: string[] = []

  const createFunction = async (
    name: string,
    content: string,
    language = 'javascript'
  ): Promise<string | null> => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions`,
      { name, content, language, projectId }
    )
    if (res.status === 201 && res.data?.id) {
      functionIds.push(res.data.id)
      return res.data.id
    }
    return null
  }

  const createEndpoint = async (
    name: string,
    path: string,
    functionId: string
  ): Promise<string | null> => {
    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name,
        path,
        type: 'faas',
        method: 'post',
        projectId,
        options: { functionId },
      }
    )
    if (res.status === 201 && res.data?.id) {
      endpointIds.push(res.data.id)
      return res.data.id
    }
    return null
  }

  beforeAll(async () => {
    try {
      fixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'anthropic',
        projectName: uniqueName('FaaS Edge Project'),
        // `agents` flag is off platform-wide; only project + provider needed.
        createAgent: false,
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
  }, 30_000)

  afterAll(async () => {
    // Clean up endpoints first (depend on functions)
    for (const id of endpointIds.reverse()) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${id}`)
    }
    for (const id of functionIds.reverse()) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/functions/${id}`)
    }
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  test('function that throws returns 500 with error message', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const content = `export default async function handler() {
  throw new Error('intentional test error')
}`

    const fnId = await createFunction(uniqueName('Throwing Function'), content)
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('Throwing Endpoint'),
      `/faas/throw-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await api<any>(
      `/proxy/${projectId}/${epId}`,
      { method: 'POST', rawPath: true, body: {} }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(500)
  })

  test('function returning null is handled gracefully', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const content = `export default async function handler() {
  return null
}`

    const fnId = await createFunction(uniqueName('Null Return Function'), content)
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('Null Return Endpoint'),
      `/faas/null-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await api<any>(
      `/proxy/${projectId}/${epId}`,
      { method: 'POST', rawPath: true, body: {} }
    )

    // Function returning null: FaaSEndpoint maps null output → 200 with null body,
    // or FunctionExecutor wraps it as { success: true, output: null }
    // Either way it should not crash — 200 or 500 with structured error
    expect([200, 500]).toContain(res.status)
  })

  test('function returning plain value wraps correctly', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const content = `export default async function handler() {
  return { body: { answer: 42 } }
}`

    const fnId = await createFunction(uniqueName('Plain Return Function'), content)
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('Plain Return Endpoint'),
      `/faas/plain-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await api<any>(
      `/proxy/${projectId}/${epId}`,
      { method: 'POST', rawPath: true, body: {} }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.answer).toBe(42)
  })

  test('function with custom status code returns it', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const content = `export default async function handler() {
  return { statusCode: 201, body: { created: true } }
}`

    const fnId = await createFunction(uniqueName('Custom Status Function'), content)
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('Custom Status Endpoint'),
      `/faas/status-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await api<any>(
      `/proxy/${projectId}/${epId}`,
      { method: 'POST', rawPath: true, body: {} }
    )

    expect(res.status).toBe(201)
    expect(res.data).toBeDefined()
    expect(res.data.created).toBe(true)
  })

  test('TypeScript function with type annotations compiles and executes', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const content = `interface Result {
  sum: number
  inputs: number[]
}

export default async function handler(request: any): Promise<{ body: Result }> {
  const nums: number[] = request?.body?.numbers || [1, 2, 3]
  const sum: number = nums.reduce((a: number, b: number) => a + b, 0)
  return { body: { sum, inputs: nums } }
}`

    const fnId = await createFunction(
      uniqueName('TypeScript Typed Function'),
      content,
      'typescript'
    )
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('TypeScript Typed Endpoint'),
      `/faas/typed-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await api<any>(
      `/proxy/${projectId}/${epId}`,
      {
        method: 'POST',
        rawPath: true,
        body: { numbers: [10, 20, 30] },
      }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.sum).toBe(60)
    expect(res.data.inputs).toEqual([10, 20, 30])
  })

  test('function with syntax error returns 500', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const content = `export default async function handler() {
  this is not valid javascript {{{{
}`

    const fnId = await createFunction(uniqueName('Syntax Error Function'), content)
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('Syntax Error Endpoint'),
      `/faas/syntax-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await api<any>(
      `/proxy/${projectId}/${epId}`,
      { method: 'POST', rawPath: true, body: {} }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(500)
  })
})
