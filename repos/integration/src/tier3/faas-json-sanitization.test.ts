import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { post, api } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'

/**
 * Tier 3: FaaS JSON Sanitization
 *
 * Validates the structured clone fix in the FaaS execution path.
 *
 * Before the fix, user functions returning non-serializable values
 * (functions, undefined, symbols) caused a V8 structured clone error
 * at the isolate boundary, resulting in a confusing
 * "Function produced no result" 500 error.
 *
 * The fix adds JSON.parse(JSON.stringify()) sanitization inside the
 * wrapper code, stripping non-serializable properties before the
 * result crosses the V8 isolate boundary.
 *
 * Flow: quickstart → create function → create FaaS endpoint → execute via /proxy
 */
describe('FaaS JSON Sanitization (structured clone)', () => {
  const ctx = readContext()
  const timestamp = Date.now()

  let setupFailed = false
  let fixtures: TFixtureResult = {}
  let projectId = ''

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

  const executeEndpoint = async (endpointId: string, body: unknown = {}) => {
    return api<any>(
      `/proxy/${projectId}/${endpointId}`,
      { method: 'POST', rawPath: true, body }
    )
  }

  beforeAll(async () => {
    try {
      fixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'anthropic',
        projectName: uniqueName('FaaS Sanitize Project'),
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
    for (const id of endpointIds.reverse()) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${id}`)
    }
    for (const id of functionIds.reverse()) {
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/functions/${id}`)
    }
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  // ─── Non-serializable output: function properties ──────────────────

  test('function returning object with function properties succeeds (functions stripped)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Before the fix, this would cause a structured clone error at the
    // V8 isolate boundary → "Function produced no result" → 500
    const content = `export default async function handler() {
  return {
    body: {
      data: 42,
      label: 'test',
      helper: function doSomething() { return 1 },
      arrow: () => 2,
    }
  }
}`

    const fnId = await createFunction(uniqueName('Fn Props Function'), content)
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('Fn Props Endpoint'),
      `/faas/fn-props-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await executeEndpoint(epId!)

    // Should succeed — function properties are stripped by JSON sanitization
    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.data).toBe(42)
    expect(res.data.label).toBe('test')
    // Function properties should be absent (stripped by JSON.stringify)
    expect(res.data.helper).toBeUndefined()
    expect(res.data.arrow).toBeUndefined()
  })

  // ─── Non-serializable output: undefined values ─────────────────────

  test('function returning object with undefined values succeeds (undefined stripped)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const content = `export default async function handler() {
  return {
    body: {
      present: 'yes',
      missing: undefined,
      nested: { exists: true, gone: undefined },
    }
  }
}`

    const fnId = await createFunction(uniqueName('Undef Props Function'), content)
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('Undef Props Endpoint'),
      `/faas/undef-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await executeEndpoint(epId!)

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.present).toBe('yes')
    // undefined values stripped by JSON.stringify
    expect(res.data).not.toHaveProperty('missing')
    expect(res.data.nested.exists).toBe(true)
    expect(res.data.nested).not.toHaveProperty('gone')
  })

  // ─── Non-serializable output: mixed types ──────────────────────────

  test('function returning mixed serializable and non-serializable data succeeds', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const content = `export default async function handler() {
  return {
    body: {
      name: 'integration-test',
      count: 100,
      tags: ['a', 'b', 'c'],
      nested: { deep: { value: true } },
      callback: function() {},
      transformer: (x) => x * 2,
      notDefined: undefined,
      nullValue: null,
      zero: 0,
      emptyString: '',
      boolFalse: false,
    }
  }
}`

    const fnId = await createFunction(uniqueName('Mixed Types Function'), content)
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('Mixed Types Endpoint'),
      `/faas/mixed-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await executeEndpoint(epId!)

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    // Serializable values preserved
    expect(res.data.name).toBe('integration-test')
    expect(res.data.count).toBe(100)
    expect(res.data.tags).toEqual(['a', 'b', 'c'])
    expect(res.data.nested).toEqual({ deep: { value: true } })
    expect(res.data.nullValue).toBeNull()
    expect(res.data.zero).toBe(0)
    expect(res.data.emptyString).toBe('')
    expect(res.data.boolFalse).toBe(false)
    // Non-serializable values stripped
    expect(res.data).not.toHaveProperty('callback')
    expect(res.data).not.toHaveProperty('transformer')
    expect(res.data).not.toHaveProperty('notDefined')
  })

  // ─── Circular reference → error ────────────────────────────────────

  test('function with circular reference returns 500 (caught by JSON.stringify)', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // JSON.stringify throws on circular references. The wrapper's try-catch
    // captures this as { success: false, error: "..." }, so FaaSEndpoint → 500.
    const content = `export default async function handler() {
  const obj = { data: 42 }
  obj.self = obj
  return { body: obj }
}`

    const fnId = await createFunction(uniqueName('Circular Ref Function'), content)
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('Circular Ref Endpoint'),
      `/faas/circular-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await executeEndpoint(epId!)

    expect(res.ok).toBe(false)
    expect(res.status).toBe(500)
  })

  // ─── TypeScript with non-serializable output ──────────────────────

  test('TypeScript function with non-serializable properties succeeds after transpile', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const content = `interface Result {
  value: number
  label: string
}

export default async function handler(request: any): Promise<any> {
  const result: Result = { value: 99, label: 'ts-test' }
  return {
    body: {
      ...result,
      compute: (x: number) => x * 2,
      processor: function process() { return 'done' },
    }
  }
}`

    const fnId = await createFunction(
      uniqueName('TS NonSerial Function'),
      content,
      'typescript'
    )
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('TS NonSerial Endpoint'),
      `/faas/ts-nonserial-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await executeEndpoint(epId!)

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.value).toBe(99)
    expect(res.data.label).toBe('ts-test')
    // Function properties stripped
    expect(res.data).not.toHaveProperty('compute')
    expect(res.data).not.toHaveProperty('processor')
  })

  // ─── Regression: normal function still works ───────────────────────

  test('normal function with fully serializable output still succeeds', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const content = `export default async function handler(request) {
  return {
    statusCode: 200,
    body: {
      message: 'regression check',
      input: request?.body?.key || 'none',
      numbers: [1, 2, 3],
      nested: { ok: true },
    }
  }
}`

    const fnId = await createFunction(uniqueName('Regression Function'), content)
    expect(fnId).toBeTruthy()

    const epId = await createEndpoint(
      uniqueName('Regression Endpoint'),
      `/faas/regression-${timestamp}`,
      fnId!
    )
    expect(epId).toBeTruthy()

    const res = await executeEndpoint(epId!, { key: 'test-input' })

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.message).toBe('regression check')
    expect(res.data.input).toBe('test-input')
    expect(res.data.numbers).toEqual([1, 2, 3])
    expect(res.data.nested).toEqual({ ok: true })
  })
})
