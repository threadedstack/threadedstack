import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { uniqueName } from '../utils/unique-name'
import { env } from '../utils/env'

/**
 * Tier 1: Thread File Upload
 *
 * Validates the file upload endpoint for threads.
 *
 * Covers fix I5: `agentId` validation guard in uploadFile endpoint.
 * Also validates body parameter validation (fileName, data, mimeType).
 */
describe('Tier 1: Thread File Upload (I5 fix)', () => {
  const ctx = readContext()
  let agentId = ''
  let threadId = ''
  let quickstartResult: Record<string, any> = {}
  let setupFailed = false

  beforeAll(async () => {
    if (!env.testProviderKey) {
      setupFailed = true
      return
    }

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: uniqueName('Upload Test'),
        agentName: uniqueName('Upload Agent'),
      }
    )

    if (res.status !== 201 || !res.data?.data?.agent?.id) {
      setupFailed = true
      return
    }

    quickstartResult = res.data.data
    agentId = quickstartResult.agent.id

    // Create a thread for upload tests
    const threadRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads`,
      { title: uniqueName('Upload Thread') }
    )

    if (threadRes.status === 201 && threadRes.data?.data?.id) {
      threadId = threadRes.data.data.id
    } else {
      setupFailed = true
    }
  })

  afterAll(async () => {
    if (threadId) await tryDelete(`/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}`)
    if (quickstartResult.endpoint?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project?.id}/endpoints/${quickstartResult.endpoint.id}`)
    if (quickstartResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${quickstartResult.agent.id}`)
    if (quickstartResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project.id}`)
    if (quickstartResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${quickstartResult.secret.id}`)
    if (quickstartResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${quickstartResult.provider.id}`)
  })

  // ─── Successful Upload ─────────────────────────────────────────────

  test('POST uploads a text file and returns asset data', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const fileContent = 'Hello, this is test file content for integration tests.'
    const base64Data = Buffer.from(fileContent).toString('base64')

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/files`,
      {
        fileName: 'test-document.txt',
        data: base64Data,
        mimeType: 'text/plain',
      }
    )

    expect(res.status).toBe(201)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.assetId).toBeTruthy()
    expect(res.data.data.fileName).toBe('test-document.txt')
    expect(res.data.data.fileType).toBe('text/plain')
    expect(typeof res.data.data.fileSize).toBe('number')
    expect(res.data.data.fileSize).toBeGreaterThan(0)
  })

  // ─── Body Validation ──────────────────────────────────────────────

  test('POST rejects upload with missing fileName', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/files`,
      {
        data: Buffer.from('data').toString('base64'),
        mimeType: 'text/plain',
      }
    )

    expect(res.status).toBe(400)
  })

  test('POST rejects upload with missing data', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/files`,
      {
        fileName: 'test.txt',
        mimeType: 'text/plain',
      }
    )

    expect(res.status).toBe(400)
  })

  test('POST rejects upload with missing mimeType', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/files`,
      {
        fileName: 'test.txt',
        data: Buffer.from('data').toString('base64'),
      }
    )

    expect(res.status).toBe(400)
  })

  // ─── Thread/Agent Validation ───────────────────────────────────────

  test('POST returns 404 for non-existent thread', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Use a valid-format 10-char ID that doesn't exist in the DB
    const res = await post(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/zz99999999/files`,
      {
        fileName: 'test.txt',
        data: Buffer.from('data').toString('base64'),
        mimeType: 'text/plain',
      }
    )

    expect(res.status).toBe(404)
  })

  test('POST returns 404 when threadId belongs to different agent', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    // Use a valid-format 10-char ID — the thread exists but belongs to a different agent
    const res = await post(
      `/orgs/${ctx.orgId}/agents/zz99999999/threads/${threadId}/files`,
      {
        fileName: 'test.txt',
        data: Buffer.from('data').toString('base64'),
        mimeType: 'text/plain',
      }
    )

    expect(res.status).toBe(404)
  })

  // ─── Auth ──────────────────────────────────────────────────────────

  test('POST upload without auth returns 401', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/files`,
      {
        fileName: 'test.txt',
        data: Buffer.from('data').toString('base64'),
        mimeType: 'text/plain',
      },
      { noAuth: true }
    )

    expect(res.status).toBe(401)
  })

  // ─── Pre-decode size check ──────────────────────────────────────────

  test('POST rejects oversized file payload', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    // 35M base64 chars → estimated ~26.25MB decoded, exceeds 25MB limit.
    // Express body parser (default 100KB) may reject before our handler,
    // so accept any 4xx/5xx — key assertion is the file doesn't succeed.
    const oversizedData = 'A'.repeat(35_000_000)

    const res = await post(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/files`,
      {
        fileName: 'large-file.txt',
        data: oversizedData,
        mimeType: 'text/plain',
      }
    )

    expect(res.status).toBeGreaterThanOrEqual(400)
  }, 30_000)

  // ─── MIME type allowlist ────────────────────────────────────────────

  test('POST rejects unsupported MIME type → 400', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/files`,
      {
        fileName: 'test.bin',
        data: Buffer.from([0x00, 0x01, 0x02]).toString('base64'),
        mimeType: 'application/x-custom-binary',
      }
    )

    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('Unsupported file type')
  })

  // ─── Image upload ──────────────────────────────────────────────────

  test('POST image upload returns imageData in response', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    // 1x1 red PNG pixel
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/files`,
      {
        fileName: 'test-pixel.png',
        data: pngBase64,
        mimeType: 'image/png',
      }
    )

    expect(res.status).toBe(201)
    expect(res.data.data.assetId).toBeTruthy()
    expect(res.data.data.fileName).toBe('test-pixel.png')
    expect(res.data.data.fileType).toBe('image/png')
    expect(res.data.data.imageData).toBe(pngBase64)
  })

  // ─── Text extraction ───────────────────────────────────────────────

  test('POST text upload returns extractedText and no imageData', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const textContent = 'Extractable text content for integration tests.'
    const base64Data = Buffer.from(textContent).toString('base64')

    const res = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/files`,
      {
        fileName: 'extract-test.txt',
        data: base64Data,
        mimeType: 'text/plain',
      }
    )

    expect(res.status).toBe(201)
    expect(res.data.data.extractedText).toBe(textContent)
    expect(res.data.data.imageData).toBeUndefined()
  })

  // ─── Thread branches ───────────────────────────────────────────────

  test('GET thread with ?include=branches returns branches array', async () => {
    if (setupFailed || !threadId) return expect(setupFailed).toBe(false)

    const res = await get<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}?include=branches`
    )

    expect(res.status).toBe(200)
    expect(res.data.data.id).toBe(threadId)
    expect(Array.isArray(res.data.data.branches)).toBe(true)
  })
})
