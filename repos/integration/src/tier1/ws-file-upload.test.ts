import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { env } from '../utils/env'
import { post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { createWSConnection, waitForMessage } from '../utils/ws-client'
import { EWSEventType } from '@tdsk/domain'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: WebSocket FileUpload & WorkspaceManifest
 *
 * Validates that the WS file upload and workspace manifest handlers
 * accept messages and respond correctly (no "not supported" errors).
 *
 * Uses a real LLM provider key via quickstart, or falls back to
 * pre-configured agents.
 */

const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

describe('Tier 1: WebSocket FileUpload & WorkspaceManifest', () => {
  const ctx = readContext()
  let agentId = ''
  let fixtures: TFixtureResult | null = null

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      fixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: uniqueName('WS FileUpload Test'),
        agentName: uniqueName('WS FileUpload Agent'),
      })

      if (fixtures.agent?.id) {
        agentId = fixtures.agent.id
      }
    }

    if (!agentId) {
      agentId = getAgentId()
    }
  })

  afterAll(async () => {
    if (!fixtures) return
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  const createSessionToken = async (): Promise<string | null> => {
    const res = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )
    if (res.status !== 200 || !res.data?.sessionToken) return null
    return res.data.sessionToken
  }

  // ─── FileUpload ─────────────────────────────────────────────────

  test.skipIf(!hasLLM())('file_upload returns FileUploadComplete for valid text file', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages } = await createWSConnection(token!, { timeout: 30_000 })

    ws.send(JSON.stringify({
      type: EWSEventType.FileUpload,
      requestId: 'test-r1',
      path: 'src/index.ts',
      content: 'export const hello = "world"',
    }))

    const uploadComplete = await waitForMessage(messages, EWSEventType.FileUploadComplete, 10_000)
    expect(uploadComplete).toBeDefined()
    expect(uploadComplete!.requestId).toBe('test-r1')
    expect(uploadComplete!.fileName).toBe('src/index.ts')
    expect(uploadComplete!.fileType).toBe('application/typescript')
    expect(uploadComplete!.fileSize).toBeGreaterThan(0)

    ws.close()
  }, 60_000)

  test.skipIf(!hasLLM())('file_upload returns error for path traversal', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages } = await createWSConnection(token!, { timeout: 30_000 })

    ws.send(JSON.stringify({
      type: EWSEventType.FileUpload,
      requestId: 'test-traversal',
      path: '../../etc/passwd',
      content: 'data',
    }))

    const errorMsg = await waitForMessage(messages, EWSEventType.Error, 10_000)
    expect(errorMsg).toBeDefined()
    expect(errorMsg!.message).toContain('Invalid file path')

    ws.close()
  }, 60_000)

  test.skipIf(!hasLLM())('file_upload returns error for disallowed MIME type', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages } = await createWSConnection(token!, { timeout: 30_000 })

    ws.send(JSON.stringify({
      type: EWSEventType.FileUpload,
      requestId: 'test-r2',
      path: 'binary.exe',
      content: 'MZ...',
    }))

    const errorMsg = await waitForMessage(messages, EWSEventType.Error, 10_000)
    expect(errorMsg).toBeDefined()
    expect(errorMsg!.message).toContain('Unsupported file type')

    ws.close()
  }, 60_000)

  test.skipIf(!hasLLM())('file_upload returns error when path is missing', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages } = await createWSConnection(token!, { timeout: 30_000 })

    ws.send(JSON.stringify({
      type: EWSEventType.FileUpload,
      requestId: 'test-r3',
      path: '',
      content: 'some content',
    }))

    const errorMsg = await waitForMessage(messages, EWSEventType.Error, 10_000)
    expect(errorMsg).toBeDefined()
    expect(errorMsg!.message).toContain('requires requestId, path, and content')

    ws.close()
  }, 60_000)

  // ─── WorkspaceManifest ──────────────────────────────────────────

  test.skipIf(!hasLLM())('workspace_manifest is accepted without error', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages } = await createWSConnection(token!, { timeout: 30_000 })

    // Send manifest then immediately send a file upload as a follow-up probe.
    // If the manifest caused a crash, the file upload will fail or the WS will close.
    ws.send(JSON.stringify({
      type: EWSEventType.WorkspaceManifest,
      rootDir: '/project',
      files: [
        { path: 'src/index.ts', hash: 'abc123', size: 42 },
        { path: 'package.json', hash: 'def456', size: 300 },
      ],
    }))

    ws.send(JSON.stringify({
      type: EWSEventType.FileUpload,
      requestId: 'manifest-probe',
      path: 'probe.ts',
      content: 'export const probe = true',
    }))

    // The file upload serves as proof the WS is still alive after the manifest
    const uploadComplete = await waitForMessage(messages, EWSEventType.FileUploadComplete, 10_000)
    expect(uploadComplete).toBeDefined()
    expect(uploadComplete!.requestId).toBe('manifest-probe')

    // Should NOT have an error in the messages
    const errorMsg = messages.find(m => m.type === EWSEventType.Error)
    expect(errorMsg).toBeUndefined()

    ws.close()
  }, 60_000)

  test.skipIf(!hasLLM())('workspace_manifest returns error when rootDir is missing', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages } = await createWSConnection(token!, { timeout: 30_000 })

    ws.send(JSON.stringify({
      type: EWSEventType.WorkspaceManifest,
      rootDir: '',
      files: [],
    }))

    const errorMsg = await waitForMessage(messages, EWSEventType.Error, 10_000)
    expect(errorMsg).toBeDefined()
    expect(errorMsg!.message).toContain('requires rootDir')

    ws.close()
  }, 60_000)

  // ─── FileUpload after Prompt (with thread) ──────────────────────

  test.skipIf(!hasLLM())('file_upload creates asset when sent after a prompt creates a thread', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages } = await createWSConnection(token!, { timeout: 90_000 })

    // Send a prompt to create a thread and initialize the runner
    ws.send(JSON.stringify({
      type: EWSEventType.Prompt,
      prompt: 'Respond with exactly: OK',
    }))

    // Wait for the Done message so the runner is idle
    const doneMsg = await waitForMessage(messages, EWSEventType.Done, 60_000)
    expect(doneMsg).toBeDefined()

    // Now send a file upload — runner exists, thread exists, asset should be created
    ws.send(JSON.stringify({
      type: EWSEventType.FileUpload,
      requestId: 'test-r4',
      path: 'src/utils.ts',
      content: 'export const add = (a: number, b: number) => a + b',
    }))

    const uploadComplete = await waitForMessage(messages, EWSEventType.FileUploadComplete, 10_000)
    expect(uploadComplete).toBeDefined()
    expect(uploadComplete!.requestId).toBe('test-r4')
    expect(uploadComplete!.fileName).toBe('src/utils.ts')
    expect(uploadComplete!.fileType).toBe('application/typescript')
    expect(uploadComplete!.assetId).toBeTruthy()
    expect(uploadComplete!.assetId).not.toBe('')

    ws.close()
  }, 120_000)
})
