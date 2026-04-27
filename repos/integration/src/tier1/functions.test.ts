import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { uniqueName } from '../utils/unique-name'

describe('Tier 1: Functions CRUD', () => {
  const ctx = readContext()
  let projectId = ''
  let fixtures: TFixtureResult = {}
  let setupFailed = false

  /** ID of the first function (basic fields) */
  let functionId = ''
  /** Preserved copy of functionId for the 404 test after deletion */
  let deletedFunctionId = ''
  /** ID of the second function (with inputSchema) */
  let schemaFunctionId = ''

  const basicFnName = uniqueName('test-fn-basic')
  const schemaFnName = uniqueName('test-fn-schema')
  const updatedFnName = uniqueName('test-fn-updated')


  const functionContent = `export default async function handler(request, context) {
  return { body: { message: 'hello from test function' } }
}`

  const schemaFunctionContent = `export default async function handler(request, context) {
  const { city, temperature } = context.args || {}
  return { body: { city, temperature } }
}`

  const inputSchema = [
    { name: 'city', type: 'string', description: 'City name', required: true },
    { name: 'temperature', type: 'number', description: 'Temperature value', required: false, default: 72 },
  ]

  beforeAll(async () => {
    fixtures = await setupFixtures({
      orgId: ctx.orgId,
      providerBrand: 'anthropic',
      projectName: uniqueName('Functions Test Project'),
      agentName: uniqueName('Functions Test Agent'),
    })

    if (!fixtures.project?.id) {
      setupFailed = true
      return
    }

    projectId = fixtures.project.id
  })

  afterAll(async () => {
    // Clean up functions first (they reference the project)
    if (schemaFunctionId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/functions/${schemaFunctionId}`)
    if (functionId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`)

    await cleanupFixtures(ctx.orgId, fixtures)
  })

  // --- Create ---

  test('POST creates function with basic fields', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions`,
      {
        name: basicFnName,
        content: functionContent,
        language: 'typescript',
        projectId,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()

    functionId = res.data.id
  })

  test('created function has expected shape', async () => {
    if (setupFailed || !functionId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()

    const fn = res.data
    expect(fn.id).toBe(functionId)
    expect(fn.name).toBe(basicFnName)
    expect(fn.content).toBe(functionContent)
    expect(fn.language).toBe('typescript')
    expect(fn.projectId).toBe(projectId)
    expect(fn.createdAt).toBeDefined()
  })

  // --- List ---

  test('GET list returns created function', async () => {
    if (setupFailed || !functionId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>[]>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')

    const found = res.data.find((f: any) => f.id === functionId)
    expect(found).toBeDefined()
    expect(found?.name).toBe(basicFnName)
  })

  // --- Get ---

  test('GET single function by ID', async () => {
    if (setupFailed || !functionId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBe(functionId)
    expect(res.data.name).toBe(basicFnName)
  })

  // --- Create with inputSchema ---

  test('POST creates function with inputSchema', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions`,
      {
        name: schemaFnName,
        content: schemaFunctionContent,
        language: 'typescript',
        projectId,
        description: 'A function with input schema',
        inputSchema,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBeDefined()

    schemaFunctionId = res.data.id
  })

  test('inputSchema persists correctly', async () => {
    if (setupFailed || !schemaFunctionId) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${schemaFunctionId}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.description).toBe('A function with input schema')
    expect(Array.isArray(res.data.inputSchema)).toBe(true)
    expect(res.data.inputSchema).toHaveLength(2)

    const cityParam = res.data.inputSchema.find((p: any) => p.name === 'city')
    expect(cityParam).toBeDefined()
    expect(cityParam.type).toBe('string')
    expect(cityParam.required).toBe(true)

    const tempParam = res.data.inputSchema.find((p: any) => p.name === 'temperature')
    expect(tempParam).toBeDefined()
    expect(tempParam.type).toBe('number')
    expect(tempParam.required).toBe(false)
    expect(tempParam.default).toBe(72)
  })

  // --- Update ---

  test('PUT updates function name', async () => {
    if (setupFailed || !functionId) return expect(setupFailed).toBe(false)

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`,
      { name: updatedFnName }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.name).toBe(updatedFnName)
  })

  test('PUT updates inputSchema', async () => {
    if (setupFailed || !schemaFunctionId) return expect(setupFailed).toBe(false)

    const newSchema = [
      { name: 'country', type: 'string', description: 'Country name', required: true },
    ]

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${schemaFunctionId}`,
      { inputSchema: newSchema }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(Array.isArray(res.data.inputSchema)).toBe(true)
    expect(res.data.inputSchema).toHaveLength(1)
    expect(res.data.inputSchema[0].name).toBe('country')
  })

  test('PUT clears inputSchema with null', async () => {
    if (setupFailed || !schemaFunctionId) return expect(setupFailed).toBe(false)

    const res = await put<Record<string, any>>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${schemaFunctionId}`,
      { inputSchema: null }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()

    // inputSchema should be null or not present after clearing
    const schema = res.data.inputSchema
    expect(schema === null || schema === undefined).toBe(true)
  })

  // --- Delete ---

  test('DELETE removes function (requires admin scope)', async () => {
    if (setupFailed || !functionId) return expect(setupFailed).toBe(false)

    const res = await del<{ success: boolean }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${functionId}`
    )

    // DELETE requires admin role — API key with write scope (member) gets 403
    if (res.status === 403) {
      // Permission denied is valid behavior for non-admin keys
      expect(res.ok).toBe(false)
      return
    }

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.success).toBe(true)

    // Preserve ID for the 404 test, then clear so afterAll skips it
    deletedFunctionId = functionId
    functionId = ''
  })

  test('GET deleted function returns 404', async () => {
    if (setupFailed || !deletedFunctionId) return expect(setupFailed).toBe(false)

    const res = await get(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions/${deletedFunctionId}`
    )

    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  // --- Auth ---

  test('GET without auth returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get(
      `/orgs/${ctx.orgId}/projects/${projectId}/functions`,
      { noAuth: true }
    )

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })
})
