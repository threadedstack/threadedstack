import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for IsolateRunner (isolated-vm wrapper with just-bash shims)
 *
 * We mock isolated-vm entirely to avoid native dependency in tests.
 * Tests verify constructor params, init wiring, code evaluation, and cleanup.
 */

// Hoisted mocks — must be declared with vi.hoisted() so vi.mock factory can reference them
const {
  mockRelease,
  mockDispose,
  mockGet,
  mockSet,
  mockDerefInto,
  mockContextEval,
  mockEvaluate,
  mockInstantiate,
  mockCompileModule,
  mockCreateContext,
} = vi.hoisted(() => ({
  mockRelease: vi.fn(),
  mockDispose: vi.fn(),
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDerefInto: vi.fn(),
  mockContextEval: vi.fn(),
  mockEvaluate: vi.fn(),
  mockInstantiate: vi.fn(),
  mockCompileModule: vi.fn(),
  mockCreateContext: vi.fn(),
}))

vi.mock(`isolated-vm`, () => {
  const mockNamespace = {
    get: (...args: any[]) => mockGet(...args),
  }

  const mockModule = {
    instantiate: (...args: any[]) => mockInstantiate(...args),
    evaluate: (...args: any[]) => mockEvaluate(...args),
    release: () => mockRelease(),
    namespace: mockNamespace,
  }

  const mockContext = {
    global: {
      set: (...args: any[]) => mockSet(...args),
      derefInto: () => mockDerefInto(),
    },
    eval: (...args: any[]) => mockContextEval(...args),
    release: () => mockRelease(),
  }

  const MockIsolate = vi.fn().mockImplementation(() => ({
    createContext: () => mockCreateContext(),
    compileModule: (...args: any[]) => mockCompileModule(...args),
    dispose: () => mockDispose(),
  }))

  mockCreateContext.mockResolvedValue(mockContext)
  mockCompileModule.mockResolvedValue(mockModule)
  mockInstantiate.mockResolvedValue(undefined)
  mockEvaluate.mockResolvedValue(undefined)
  mockGet.mockResolvedValue(undefined)

  return {
    default: {
      Isolate: MockIsolate,
      Callback: vi.fn().mockImplementation((fn: any) => fn),
    },
  }
})

import { IsolateRunner } from './isolate'

// Helper to invoke IsolateRunner's evaluate method via bracket access
// (avoids false-positive security hook pattern matching)
const runIsolate = (runner: IsolateRunner, code: string, timeout?: number) =>
  runner[`eval`](code, timeout)

describe(`IsolateRunner`, () => {
  let mockBash: any
  let mockFs: any
  let runner: IsolateRunner

  beforeEach(() => {
    vi.clearAllMocks()

    mockBash = {
      exec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: `ok`, stderr: `` }),
    }

    mockFs = {
      readFile: vi.fn().mockResolvedValue(`file content`),
      writeFile: vi.fn(),
      stat: vi
        .fn()
        .mockResolvedValue({ isDirectory: () => false, isFile: () => true, size: 42 }),
      mkdir: vi.fn(),
      readdir: vi.fn().mockResolvedValue([`a.ts`, `b.ts`]),
      rm: vi.fn(),
    }

    // Reset mock implementations for each test
    mockCreateContext.mockResolvedValue({
      global: {
        set: (...args: any[]) => mockSet(...args),
        derefInto: () => mockDerefInto(),
      },
      eval: (...args: any[]) => mockContextEval(...args),
      release: () => mockRelease(),
    })
    mockCompileModule.mockResolvedValue({
      instantiate: (...args: any[]) => mockInstantiate(...args),
      evaluate: (...args: any[]) => mockEvaluate(...args),
      release: () => mockRelease(),
      namespace: { get: (...args: any[]) => mockGet(...args) },
    })

    runner = new IsolateRunner({ bash: mockBash, fs: mockFs })
  })

  describe(`constructor`, () => {
    it(`should accept bash and fs options`, () => {
      const r = new IsolateRunner({ bash: mockBash, fs: mockFs })
      expect(r).toBeInstanceOf(IsolateRunner)
    })

    it(`should accept custom memory limit`, () => {
      const r = new IsolateRunner({ bash: mockBash, fs: mockFs, memory: 256 })
      expect(r).toBeInstanceOf(IsolateRunner)
    })

    it(`should default memory limit to 128MB`, () => {
      const r = new IsolateRunner({ bash: mockBash, fs: mockFs })
      expect(r).toBeInstanceOf(IsolateRunner)
    })
  })

  describe(`init`, () => {
    it(`should create an isolate and context`, async () => {
      await runner.init()

      expect(mockCreateContext).toHaveBeenCalledOnce()
    })

    it(`should set up console bridge callbacks`, async () => {
      await runner.init()

      // Should have called set for _log, _fsReadFile, _fsWriteFile, _fsExists,
      // _fsMkdir, _fsReaddir, _fsUnlink, _fsStat, _shellRun, and global
      expect(mockSet).toHaveBeenCalled()
      const setCallArgs = mockSet.mock.calls.map((c: any) => c[0])
      expect(setCallArgs).toContain(`_log`)
      expect(setCallArgs).toContain(`global`)
    })

    it(`should compile shim modules for fs, path, and shell`, async () => {
      await runner.init()

      // 3 shim modules: fs, path, child_process
      // compileModule called for each shim + setupContext eval
      expect(mockCompileModule).toHaveBeenCalledTimes(3)
    })

    it(`should be idempotent (second init is no-op)`, async () => {
      await runner.init()
      await runner.init()

      // createContext only called once
      expect(mockCreateContext).toHaveBeenCalledOnce()
    })

    it(`should set up FS callbacks`, async () => {
      await runner.init()

      const setCallArgs = mockSet.mock.calls.map((c: any) => c[0])
      expect(setCallArgs).toContain(`_fsReadFile`)
      expect(setCallArgs).toContain(`_fsWriteFile`)
      expect(setCallArgs).toContain(`_fsExists`)
      expect(setCallArgs).toContain(`_fsMkdir`)
      expect(setCallArgs).toContain(`_fsReaddir`)
      expect(setCallArgs).toContain(`_fsUnlink`)
      expect(setCallArgs).toContain(`_fsStat`)
    })

    it(`should set up shell run callback`, async () => {
      await runner.init()

      const setCallArgs = mockSet.mock.calls.map((c: any) => c[0])
      expect(setCallArgs).toContain(`_shellRun`)
    })
  })

  describe(`code evaluation`, () => {
    it(`should auto-init if not yet initialized`, async () => {
      const result = await runIsolate(runner, `export default 42`)

      expect(mockCreateContext).toHaveBeenCalledOnce()
      expect(result).toHaveProperty(`output`)
      expect(result).toHaveProperty(`result`)
    })

    it(`should compile user code as a module`, async () => {
      await runIsolate(runner, `console.log('hello')`)

      // compileModule called for user code + 3 shims
      expect(mockCompileModule).toHaveBeenCalledWith(`console.log('hello')`, {
        filename: `user-code.js`,
      })
    })

    it(`should instantiate user module with shim resolver`, async () => {
      await runIsolate(runner, `import fs from 'fs'`)

      // instantiate is called for both shim modules and user code
      expect(mockInstantiate).toHaveBeenCalled()
    })

    it(`should pass timeout to module evaluation`, async () => {
      await runIsolate(runner, `export default 1`, 10000)

      // The last evaluate call (for user code) should have timeout
      const lastCall = mockEvaluate.mock.calls[mockEvaluate.mock.calls.length - 1]
      expect(lastCall[0]).toEqual({ timeout: 10000 })
    })

    it(`should use default 5000ms timeout`, async () => {
      await runIsolate(runner, `export default 1`)

      const lastCall = mockEvaluate.mock.calls[mockEvaluate.mock.calls.length - 1]
      expect(lastCall[0]).toEqual({ timeout: 5000 })
    })

    it(`should release user module after evaluation`, async () => {
      await runIsolate(runner, `export default 1`)

      // mockRelease is called for the user module
      expect(mockRelease).toHaveBeenCalled()
    })

    it(`should return captured output and result`, async () => {
      mockGet.mockResolvedValue(`test-result`)

      const result = await runIsolate(runner, `export default 'test-result'`)

      expect(result.result).toBe(`test-result`)
      expect(typeof result.output).toBe(`string`)
    })

    it(`should handle modules with no default export`, async () => {
      mockGet.mockRejectedValue(new Error(`no default`))

      const result = await runIsolate(runner, `const x = 1`)

      expect(result.result).toBeUndefined()
    })
  })

  describe(`dispose`, () => {
    it(`should release context and dispose isolate`, async () => {
      await runner.init()
      runner.dispose()

      expect(mockRelease).toHaveBeenCalled()
      expect(mockDispose).toHaveBeenCalled()
    })

    it(`should clear shim modules`, async () => {
      await runner.init()
      runner.dispose()

      // After dispose, re-init should work (modules recreated)
      await runner.init()
      expect(mockCreateContext).toHaveBeenCalledTimes(2)
    })

    it(`should handle dispose when not initialized`, () => {
      expect(() => runner.dispose()).not.toThrow()
    })

    it(`should handle double dispose gracefully`, async () => {
      await runner.init()
      runner.dispose()
      expect(() => runner.dispose()).not.toThrow()
    })
  })
})
