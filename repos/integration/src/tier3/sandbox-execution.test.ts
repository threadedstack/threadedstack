import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { setupRunningPod, execInPod, cleanupSandbox } from '../utils/sandbox-helpers'

describe('Tier 3: Sandbox Command Execution', () => {
  const ctx = readContext()

  let sandboxId = ''
  let podName = ''
  let projectId = ''
  let setupFailed = false

  beforeAll(async () => {
    try {
      const setup = await setupRunningPod(ctx.orgId)
      sandboxId = setup.sandboxId
      podName = setup.podName
      projectId = setup.projectId
    } catch (err) {
      console.error('[sandbox-execution] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 120_000)

  afterAll(async () => {
    await cleanupSandbox(ctx.orgId, { sandboxId, podName, projectId })
  })

  // --- Basic Command Execution ---

  test('exec simple echo command', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(ctx.orgId, projectId, sandboxId, podName, 'echo hello')

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(res.data.output.trim()).toBe('hello')
  })

  test('exec command with args', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(ctx.orgId, projectId, sandboxId, podName, 'echo', ['hello', 'world'])

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(res.data.output.trim()).toBe('hello world')
  })

  test('exec multiline output', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(
      ctx.orgId, projectId, sandboxId, podName,
      'node -e "for(let i=0;i<5;i++) console.log(i)"'
    )

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    const lines = res.data.output.trim().split('\n')
    expect(lines).toEqual(['0', '1', '2', '3', '4'])
  })

  test('exec node JSON evaluation', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(
      ctx.orgId, projectId, sandboxId, podName,
      'node -e "console.log(JSON.stringify({a:1,b:2}))"'
    )

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    const parsed = JSON.parse(res.data.output.trim())
    expect(parsed).toEqual({ a: 1, b: 2 })
  })

  // --- Error Handling ---

  test('exec returns error and exit code on failure', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(
      ctx.orgId, projectId, sandboxId, podName,
      'node -e "console.error(\'oops\'); process.exit(1)"'
    )

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(false)
    expect(res.data.exitCode).toBe(1)
    expect(res.data.error).toContain('oops')
  })

  test('exec nonexistent command returns error', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(
      ctx.orgId, projectId, sandboxId, podName,
      'nonexistentcommand_xyz_123'
    )

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(false)
  })

  // --- Validation ---

  test('exec without command returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/exec`,
      { podName }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('exec without podName returns 400', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await post(
      `/orgs/${ctx.orgId}/projects/${projectId}/sandboxes/${sandboxId}/exec`,
      { command: 'echo test' }
    )

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  // --- Filesystem Operations ---

  test('write and read file', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const writeRes = await execInPod(
      ctx.orgId, projectId, sandboxId, podName,
      "printf '%s' 'hello from integration test' > /workspace/test-read.txt"
    )
    expect(writeRes.data.success).toBe(true)

    const readRes = await execInPod(
      ctx.orgId, projectId, sandboxId, podName,
      'cat /workspace/test-read.txt'
    )
    expect(readRes.data.success).toBe(true)
    expect(readRes.data.output).toBe('hello from integration test')
  })

  test('create directory and verify', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const mkdirRes = await execInPod(
      ctx.orgId, projectId, sandboxId, podName,
      'mkdir -p /workspace/test-subdir/nested'
    )
    expect(mkdirRes.data.success).toBe(true)

    const checkRes = await execInPod(
      ctx.orgId, projectId, sandboxId, podName,
      'test -d /workspace/test-subdir/nested && echo exists'
    )
    expect(checkRes.data.success).toBe(true)
    expect(checkRes.data.output.trim()).toBe('exists')
  })

  test('list directory contents', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    await execInPod(ctx.orgId, projectId, sandboxId, podName, 'mkdir -p /workspace/list-test')
    await execInPod(ctx.orgId, projectId, sandboxId, podName,
      "printf '%s' 'a' > /workspace/list-test/file-a.txt"
    )
    await execInPod(ctx.orgId, projectId, sandboxId, podName,
      "printf '%s' 'b' > /workspace/list-test/file-b.txt"
    )

    const lsRes = await execInPod(
      ctx.orgId, projectId, sandboxId, podName,
      'ls -1 /workspace/list-test'
    )
    expect(lsRes.data.success).toBe(true)
    const files = lsRes.data.output.trim().split('\n')
    expect(files).toContain('file-a.txt')
    expect(files).toContain('file-b.txt')
  })

  test('delete file and verify gone', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    await execInPod(ctx.orgId, projectId, sandboxId, podName,
      "printf '%s' 'temp' > /workspace/to-delete.txt"
    )

    const existsRes = await execInPod(ctx.orgId, projectId, sandboxId, podName,
      "test -e /workspace/to-delete.txt && echo yes || echo no"
    )
    expect(existsRes.data.output.trim()).toBe('yes')

    const rmRes = await execInPod(ctx.orgId, projectId, sandboxId, podName,
      'rm /workspace/to-delete.txt'
    )
    expect(rmRes.data.success).toBe(true)

    const goneRes = await execInPod(ctx.orgId, projectId, sandboxId, podName,
      "test -e /workspace/to-delete.txt && echo yes || echo no"
    )
    expect(goneRes.data.output.trim()).toBe('no')
  })

  test('workspace directory exists and is writable', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(ctx.orgId, projectId, sandboxId, podName,
      'test -d /workspace -a -w /workspace && echo ok'
    )
    expect(res.data.success).toBe(true)
    expect(res.data.output.trim()).toBe('ok')
  })

  // --- JavaScript Code Evaluation ---

  test('write and execute JavaScript file', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const script = `const result = Array.from({length: 3}, (_, i) => i * 2);\nconsole.log(JSON.stringify(result));`
    const escaped = script.replace(/'/g, "'\\''")
    await execInPod(ctx.orgId, projectId, sandboxId, podName,
      `printf '%s' '${escaped}' > /workspace/test-eval.js`
    )

    const res = await execInPod(ctx.orgId, projectId, sandboxId, podName,
      'node /workspace/test-eval.js'
    )

    expect(res.data.success).toBe(true)
    const parsed = JSON.parse(res.data.output.trim())
    expect(parsed).toEqual([0, 2, 4])
  })

  test('write JSON and read it back with Node', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const json = JSON.stringify({ key: 'value', count: 42 })
    const escaped = json.replace(/'/g, "'\\''")
    await execInPod(ctx.orgId, projectId, sandboxId, podName,
      `printf '%s' '${escaped}' > /workspace/test-data.json`
    )

    const res = await execInPod(ctx.orgId, projectId, sandboxId, podName,
      "node -e \"const d = require('/workspace/test-data.json'); console.log(d.key, d.count)\""
    )

    expect(res.data.success).toBe(true)
    expect(res.data.output.trim()).toBe('value 42')
  })

  test('execute multi-module JavaScript', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    await execInPod(ctx.orgId, projectId, sandboxId, podName,
      'mkdir -p /workspace/mod-test'
    )
    const utilCode = `module.exports = { add: (a, b) => a + b };`
    const utilEscaped = utilCode.replace(/'/g, "'\\''")
    await execInPod(ctx.orgId, projectId, sandboxId, podName,
      `printf '%s' '${utilEscaped}' > /workspace/mod-test/util.js`
    )

    const mainCode = `const { add } = require('./util'); console.log(add(3, 4));`
    const mainEscaped = mainCode.replace(/'/g, "'\\''")
    await execInPod(ctx.orgId, projectId, sandboxId, podName,
      `printf '%s' '${mainEscaped}' > /workspace/mod-test/main.js`
    )

    const res = await execInPod(ctx.orgId, projectId, sandboxId, podName,
      'node /workspace/mod-test/main.js'
    )

    expect(res.data.success).toBe(true)
    expect(res.data.output.trim()).toBe('7')
  })
})
