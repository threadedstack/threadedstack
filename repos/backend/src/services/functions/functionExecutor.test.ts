import { ESandboxType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks (accessible inside vi.mock factories) ──────────────

const { mockClose, mockEvaluate, mockSandbox, mockCreate } = vi.hoisted(() => {
  const mockClose = vi.fn().mockResolvedValue(undefined)
  const mockEvaluate = vi.fn().mockResolvedValue({
    output: ``,
    result: { success: true, output: { result: 42 } },
  })

  const mockSandbox = {
    evaluate: mockEvaluate,
    close: mockClose,
  }

  const mockCreate = vi.fn().mockResolvedValue(mockSandbox)

  return { mockClose, mockEvaluate, mockSandbox, mockCreate }
})

vi.mock(`@tdsk/sandbox`, () => ({
  createSandboxProvider: vi.fn().mockReturnValue({
    type: ESandboxType.local,
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
    mockEvaluate.mockResolvedValue({
      output: ``,
      result: { success: true, output: { result: 42 } },
    })
    mockClose.mockResolvedValue(undefined)
  })

  // ── Test 1: Execute a TypeScript function ────────────────────────

  it(`should transpile TypeScript, evaluate wrapper, and close sandbox`, async () => {
    const func = makeFunc()
    const result = await FunctionExecutor.execute(func)

    // esbuild should be called for TS
    expect(transform).toHaveBeenCalledWith(func.content, {
      loader: `ts`,
      format: `esm`,
    })

    // Sandbox provider should be created
    expect(createSandboxProvider).toHaveBeenCalledWith(ESandboxType.local)

    // Provider.create should receive config
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: ESandboxType.local,
        timeout: 30_000,
      })
    )

    // Should evaluate wrapper code with function module
    expect(mockEvaluate).toHaveBeenCalledWith(
      expect.stringContaining(`import handler from 'function'`),
      expect.objectContaining({
        timeout: 30_000,
        modules: { function: expect.any(String) },
      })
    )

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

    // Should pass the original content as the function module
    expect(mockEvaluate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        modules: { function: func.content },
      })
    )

    // Should still succeed
    expect(result.success).toBe(true)
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  // ── Test 3: Evaluate throws ────────────────────────────────────

  it(`should return error result when evaluate throws`, async () => {
    mockEvaluate.mockRejectedValue(new Error(`V8 isolate timeout`))

    const func = makeFunc()
    const result = await FunctionExecutor.execute(func)

    expect(result.success).toBe(false)
    expect(result.error).toBe(`V8 isolate timeout`)
    expect(result.output).toBeNull()
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  // ── Test 4: Always closes sandbox even on error ─────────────────

  it(`should close sandbox even when evaluate throws`, async () => {
    mockEvaluate.mockRejectedValueOnce(new Error(`Isolate crashed`))

    const func = makeFunc()
    const result = await FunctionExecutor.execute(func)

    expect(result.success).toBe(false)
    expect(result.error).toBe(`Isolate crashed`)
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  // ── Test 5: Passes request and context in wrapper code ──────────

  it(`should embed request and context in wrapper code`, async () => {
    const func = makeFunc()
    const request = { method: `POST`, path: `/test`, body: { key: `val` } }
    const context = { secrets: { API_KEY: `secret-123` } }

    await FunctionExecutor.execute(func, { request, context })

    // Wrapper code should contain the serialized request/context
    const wrapperCode = mockEvaluate.mock.calls[0][0]
    expect(wrapperCode).toContain(`import handler from 'function'`)
    expect(wrapperCode).toContain(`JSON.parse(`)
    expect(wrapperCode).toContain(`POST`)
    expect(wrapperCode).toContain(`/test`)
  })

  // ── Test 6: Output exceeds 1MB cap ─────────────────────────────

  it(`should return error when output exceeds 1MB`, async () => {
    const hugeOutput = `x`.repeat(1_048_577)
    mockEvaluate.mockResolvedValue({
      output: ``,
      result: { success: true, output: hugeOutput },
    })

    const func = makeFunc()
    const result = await FunctionExecutor.execute(func)

    expect(result.success).toBe(false)
    expect(result.error).toContain(`exceeded maximum size`)
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  // ── Test 7: Wrapper returns error ────────────────────────────

  it(`should propagate error from wrapper result`, async () => {
    mockEvaluate.mockResolvedValue({
      output: ``,
      result: { success: false, error: `TypeError: x is not a function` },
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
    expect(mockEvaluate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ timeout: 30_000 })
    )
  })

  // ── Test 9: Custom timeout is passed through ───────────────────

  it(`should use custom timeout when specified`, async () => {
    const func = makeFunc()
    await FunctionExecutor.execute(func, { timeout: 60_000 })

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ timeout: 60_000 }))
    expect(mockEvaluate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ timeout: 60_000 })
    )
  })

  // ── Test 10: No result from evaluate ──────────────────────────

  it(`should return error when evaluate produces no result`, async () => {
    mockEvaluate.mockResolvedValue({
      output: ``,
      result: undefined,
    })

    const func = makeFunc()
    const result = await FunctionExecutor.execute(func)

    expect(result.success).toBe(false)
    expect(result.error).toBe(`Function produced no result`)
  })
})
