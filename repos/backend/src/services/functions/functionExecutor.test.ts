import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks (accessible inside vi.mock factories) ──────────────

const { mockClose, mockWriteFile, mockExec, mockSandbox, mockCreate } = vi.hoisted(() => {
  const mockClose = vi.fn().mockResolvedValue(undefined)
  const mockWriteFile = vi.fn().mockResolvedValue(undefined)
  const mockExec = vi.fn().mockResolvedValue({
    success: true,
    output: JSON.stringify({ success: true, output: { result: 42 } }),
    exitCode: 0,
  })

  const mockSandbox = {
    writeFile: mockWriteFile,
    exec: mockExec,
    close: mockClose,
    readFile: vi.fn(),
    listDir: vi.fn(),
    deleteFile: vi.fn(),
    mkdir: vi.fn(),
    fileExists: vi.fn(),
  }

  const mockCreate = vi.fn().mockResolvedValue(mockSandbox)

  return { mockClose, mockWriteFile, mockExec, mockSandbox, mockCreate }
})

vi.mock(`@tdsk/sandbox`, () => ({
  createSandboxProvider: vi.fn().mockReturnValue({
    type: `local`,
    create: mockCreate,
  }),
}))

vi.mock(`esbuild`, () => ({
  transform: vi
    .fn()
    .mockResolvedValue({ code: `const stripped = true;\nexport default stripped;` }),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

import { FunctionExecutor } from './functionExecutor'
import { createSandboxProvider } from '@tdsk/sandbox'
import { transform } from 'esbuild'

// ── Helpers ──────────────────────────────────────────────────────────

const makeFunc = (
  overrides: Partial<{
    id: string
    name: string
    content: string
    language: string
    projectId: string
  }> = {}
) => ({
  id: `func-1`,
  name: `test-function`,
  content: `export default async (req, ctx) => ({ hello: 'world' });`,
  language: `typescript`,
  projectId: `proj-1`,
  ...overrides,
})

// ── Tests ────────────────────────────────────────────────────────────

describe(`FunctionExecutor`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue(mockSandbox)
    mockExec.mockResolvedValue({
      success: true,
      output: JSON.stringify({ success: true, output: { result: 42 } }),
      exitCode: 0,
    })
    mockWriteFile.mockResolvedValue(undefined)
    mockClose.mockResolvedValue(undefined)
  })

  // ── Test 1: Execute a TypeScript function ────────────────────────

  it(`should transpile TypeScript, write files, execute, and close sandbox`, async () => {
    const func = makeFunc()
    const result = await FunctionExecutor.execute(func)

    // esbuild should be called for TS
    expect(transform).toHaveBeenCalledWith(func.content, {
      loader: `ts`,
      format: `esm`,
    })

    // Sandbox provider should be created
    expect(createSandboxProvider).toHaveBeenCalledWith(`local`)

    // Provider.create should receive env vars with the input payload
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: `local`,
        envVars: expect.objectContaining({
          __FUNCTION_INPUT__: expect.any(String),
        }),
      })
    )

    // Should write two files: function.mjs (transpiled code) and runner.mjs
    expect(mockWriteFile).toHaveBeenCalledTimes(2)
    expect(mockWriteFile).toHaveBeenCalledWith(
      `/workspace/function.mjs`,
      expect.any(String) // transpiled code from esbuild
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      `/workspace/runner.mjs`,
      expect.stringContaining(`import handler from './function.mjs'`)
    )

    // Should execute node runner.mjs
    expect(mockExec).toHaveBeenCalledWith(`node`, [`runner.mjs`])

    // Should close sandbox
    expect(mockClose).toHaveBeenCalledTimes(1)

    // Should return parsed result
    expect(result.success).toBe(true)
    expect(result.output).toEqual({ result: 42 })
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeUndefined()
  })

  // ── Test 2: Execute a JavaScript function ────────────────────────

  it(`should NOT call esbuild for JavaScript functions`, async () => {
    const func = makeFunc({ language: `javascript` })
    const result = await FunctionExecutor.execute(func)

    // esbuild should NOT be called
    expect(transform).not.toHaveBeenCalled()

    // Should still write the original content as function.mjs
    expect(mockWriteFile).toHaveBeenCalledWith(`/workspace/function.mjs`, func.content)

    // Should still execute and succeed
    expect(result.success).toBe(true)
    expect(mockExec).toHaveBeenCalledWith(`node`, [`runner.mjs`])
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  // ── Test 3: Sandbox exec fails ────────────────────────────────

  it(`should return error result when sandbox exec fails`, async () => {
    mockExec.mockResolvedValue({
      success: false,
      output: ``,
      error: `Command not found: node`,
      exitCode: 127,
    })

    const func = makeFunc()
    const result = await FunctionExecutor.execute(func)

    expect(result.success).toBe(false)
    expect(result.error).toBe(`Command not found: node`)
    expect(result.output).toBeNull()
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  // ── Test 4: Always closes sandbox even on error ─────────────────

  it(`should close sandbox even when writeFile throws`, async () => {
    mockWriteFile.mockRejectedValueOnce(new Error(`Disk full`))

    const func = makeFunc()
    const result = await FunctionExecutor.execute(func)

    expect(result.success).toBe(false)
    expect(result.error).toBe(`Disk full`)
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  // ── Test 5: Passes request and context via env var ──────────────

  it(`should pass request and context via __FUNCTION_INPUT__ env var`, async () => {
    const func = makeFunc()
    const request = { method: `POST`, path: `/test`, body: { key: `val` } }
    const context = { secrets: { API_KEY: `secret-123` } }

    await FunctionExecutor.execute(func, { request, context })

    // Check that create was called with the correct env var payload
    const createCall = mockCreate.mock.calls[0][0]
    const inputPayload = JSON.parse(createCall.envVars.__FUNCTION_INPUT__)

    expect(inputPayload.request).toEqual(request)
    expect(inputPayload.context).toEqual(context)
  })

  // ── Test 6: Output exceeds 1MB cap ─────────────────────────────

  it(`should return error when output exceeds 1MB`, async () => {
    const hugeOutput = `x`.repeat(1_048_577)
    mockExec.mockResolvedValue({
      success: true,
      output: hugeOutput,
      exitCode: 0,
    })

    const func = makeFunc()
    const result = await FunctionExecutor.execute(func)

    expect(result.success).toBe(false)
    expect(result.error).toContain(`exceeded maximum size`)
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  // ── Test 7: Runner returns error JSON ──────────────────────────

  it(`should propagate runner error from JSON output`, async () => {
    mockExec.mockResolvedValue({
      success: true,
      output: JSON.stringify({ success: false, error: `TypeError: x is not a function` }),
      exitCode: 0,
    })

    const func = makeFunc()
    const result = await FunctionExecutor.execute(func)

    expect(result.success).toBe(false)
    expect(result.error).toBe(`TypeError: x is not a function`)
  })

  // ── Test 8: Default timeout is set ─────────────────────────────

  it(`should use default timeout when not specified`, async () => {
    const func = makeFunc()
    await FunctionExecutor.execute(func)

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ timeout: 30_000 }))
  })

  // ── Test 9: Custom timeout is passed through ───────────────────

  it(`should use custom timeout when specified`, async () => {
    const func = makeFunc()
    await FunctionExecutor.execute(func, { timeout: 60_000 })

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ timeout: 60_000 }))
  })

  // ── Test 10: Non-JSON output treated as raw ────────────────────

  it(`should return raw output when stdout is not valid JSON`, async () => {
    mockExec.mockResolvedValue({
      success: true,
      output: `Hello, World!`,
      exitCode: 0,
    })

    const func = makeFunc()
    const result = await FunctionExecutor.execute(func)

    expect(result.success).toBe(true)
    expect(result.output).toBe(`Hello, World!`)
  })
})
