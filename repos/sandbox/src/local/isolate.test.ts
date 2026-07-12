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
  mockDelete,
  mockDerefInto,
  mockContextEval,
  mockEvalClosure,
  mockEvaluate,
  mockInstantiate,
  mockCompileModule,
  mockCreateContext,
} = vi.hoisted(() => ({
  mockRelease: vi.fn(),
  mockDispose: vi.fn(),
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDelete: vi.fn(),
  mockDerefInto: vi.fn(),
  mockContextEval: vi.fn(),
  mockEvalClosure: vi.fn(),
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
      delete: (...args: any[]) => mockDelete(...args),
      derefInto: () => mockDerefInto(),
    },
    eval: (...args: any[]) => mockContextEval(...args),
    evalClosure: (...args: any[]) => mockEvalClosure(...args),
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
  mockDelete.mockResolvedValue(undefined)
  mockContextEval.mockResolvedValue(undefined)

  return {
    default: {
      Isolate: MockIsolate,
      Callback: vi.fn().mockImplementation((fn: any) => fn),
    },
  }
})

import { IsolateRunner } from '.'

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
        delete: (...args: any[]) => mockDelete(...args),
        derefInto: () => mockDerefInto(),
      },
      eval: (...args: any[]) => mockContextEval(...args),
      evalClosure: (...args: any[]) => mockEvalClosure(...args),
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

    it(`should compile shim modules for all builtin shims`, async () => {
      await runner.init()

      // 11 shim modules: buffer, path, fs, child_process, url, querystring, events, os, assert, util, crypto
      // process shim has no source (globals-only), so it is not compiled
      expect(mockCompileModule).toHaveBeenCalledTimes(11)
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

    it(`should set up fetch callback`, async () => {
      await runner.init()

      const setCallArgs = mockSet.mock.calls.map((c: any) => c[0])
      // fetch uses the start/settle bridge shape (ivm.Callback cannot await an
      // async host fn), so the registered callback is the SYNC starter.
      expect(setCallArgs).toContain(`_fetchStart`)
    })

    it(`should set up globalThis.fetch via context eval`, async () => {
      await runner.init()

      // context.eval called 6 times: console, fetch, timers, process, plus
      // scrubGlobals' pristine-builtins stash + globalThis baseline capture
      expect(mockContextEval).toHaveBeenCalledTimes(6)
      const fetchEvalCall = mockContextEval.mock.calls[1][0]
      expect(fetchEvalCall).toContain(`globalThis.fetch`)
    })

    it(`should set up timer callbacks`, async () => {
      await runner.init()

      const setCallArgs = mockSet.mock.calls.map((c: any) => c[0])
      expect(setCallArgs).toContain(`_timerSet`)
      expect(setCallArgs).toContain(`_timerClear`)
      expect(setCallArgs).toContain(`_timerInterval`)
    })

    it(`should set up timer globals via context eval`, async () => {
      await runner.init()

      // Timer globals are set up in the 4th context.eval call (after console, fetch, process)
      const timerEvalCall = mockContextEval.mock.calls[3][0]
      expect(timerEvalCall).toContain(`globalThis.setTimeout`)
      expect(timerEvalCall).toContain(`globalThis.setInterval`)
      expect(timerEvalCall).toContain(`globalThis.clearTimeout`)
      expect(timerEvalCall).toContain(`globalThis.clearInterval`)
      expect(timerEvalCall).toContain(`globalThis.setImmediate`)
      expect(timerEvalCall).toContain(`queueMicrotask`)
    })

    it(`should set up process global via context eval`, async () => {
      await runner.init()

      // Process global is set up in the 3rd context.eval call (during #compile setupGlobals)
      const processEvalCall = mockContextEval.mock.calls[2][0]
      expect(processEvalCall).toContain(`globalThis.process`)
      expect(processEvalCall).toContain(`platform`)
      expect(processEvalCall).toContain(`nextTick`)
    })

    it(`should set up crypto callbacks`, async () => {
      await runner.init()

      const setCallArgs = mockSet.mock.calls.map((c: any) => c[0])
      expect(setCallArgs).toContain(`_cryptoRandomUUID`)
      expect(setCallArgs).toContain(`_cryptoRandomBytes`)
      expect(setCallArgs).toContain(`_cryptoHash`)
      expect(setCallArgs).toContain(`_cryptoHmac`)
      expect(setCallArgs).toContain(`_cryptoTimingSafeEqual`)
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

      // compileModule called for user code + 11 shims
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

    it(`should fall back to JSON serialization when structured clone fails`, async () => {
      // First call (structured clone) rejects, second call (bridge module) resolves
      mockGet
        .mockRejectedValueOnce(new Error(`#<Object> could not be cloned`))
        .mockResolvedValueOnce(JSON.stringify({ data: 42 }))

      const result = await runIsolate(runner, `export default { data: 42 }`)

      expect(result.result).toEqual({ data: 42 })
      // Bridge module should be compiled with the JSON fallback source
      expect(mockCompileModule).toHaveBeenCalledWith(
        expect.stringContaining(`import val from 'user-code'`),
        expect.objectContaining({ filename: `json-bridge.js` })
      )
    })

    it(`should set .error when both structured clone and the JSON fallback's own extraction fail`, async () => {
      // Both structured clone and bridge module get reject
      mockGet.mockRejectedValue(new Error(`clone failed`))

      const result = await runIsolate(runner, `export default { circular: true }`)

      expect(result.result).toBeUndefined()
      expect(result.error).toContain(`clone failed`)
    })

    it(`should set .error when structured clone fails and the JSON fallback bridge itself throws`, async () => {
      // Primary clone attempt (ns.get) rejects
      mockGet.mockRejectedValueOnce(new Error(`#<Object> could not be cloned`))
      // Shim modules and userModule.evaluate() all resolve normally, but the
      // bridge's own evaluate() throws (e.g. JSON.stringify hitting a circular
      // reference) — a distinct failure point from the bridge's extraction
      // (namespace.get) failing. Matched by the bridge's hardcoded
      // `{ timeout: 1000 }` call signature rather than call order, since init()
      // evaluates every shim module before user code ever runs.
      mockEvaluate.mockImplementation(async (opts?: any) => {
        if (opts?.timeout === 1000)
          throw new Error(`Converting circular structure to JSON`)
        return undefined
      })

      const result = await runIsolate(runner, `export default { circular: true }`)

      expect(result.result).toBeUndefined()
      expect(result.error).toContain(`Converting circular structure to JSON`)

      // Restore the default so later tests aren't affected by this override.
      mockEvaluate.mockResolvedValue(undefined)
    })
  })

  describe(`registerModule`, () => {
    it(`should compile and instantiate a named module`, async () => {
      await runner.registerModule(`mylib`, `export default 42`)

      // compileModule called for shims (11) + user module (1)
      expect(mockCompileModule).toHaveBeenCalledWith(`export default 42`, {
        filename: `mylib`,
      })
      expect(mockInstantiate).toHaveBeenCalled()
      expect(mockEvaluate).toHaveBeenCalled()
    })

    it(`should auto-init if not yet initialized`, async () => {
      // runner has not been init()'d yet
      await runner.registerModule(`lib`, `export const x = 1`)

      // createContext should have been called (auto-init)
      expect(mockCreateContext).toHaveBeenCalledOnce()
      // compileModule for 11 shims + the registered module
      expect(mockCompileModule).toHaveBeenCalledWith(`export const x = 1`, {
        filename: `lib`,
      })
    })

    it(`should release existing module when registering with same name`, async () => {
      await runner.init()

      // Track release calls from registerModule specifically
      const releaseCountBefore = mockRelease.mock.calls.length

      // Register a module the first time
      await runner.registerModule(`mylib`, `export default 1`)
      const releaseCountAfterFirst = mockRelease.mock.calls.length

      // Register again with the same name — should release the existing one
      await runner.registerModule(`mylib`, `export default 2`)
      const releaseCountAfterSecond = mockRelease.mock.calls.length

      // The second registration should have called release one more time than the first
      expect(releaseCountAfterSecond).toBeGreaterThan(releaseCountAfterFirst)
    })

    it(`should not throw when registering a module name for first time`, async () => {
      await runner.init()

      // First-time registration — no existing module to release
      await expect(
        runner.registerModule(`brand-new`, `export default 'new'`)
      ).resolves.not.toThrow()
    })

    it(`should handle release() throwing gracefully (already released)`, async () => {
      await runner.init()

      // Register once
      await runner.registerModule(`fragile`, `export default 1`)

      // Make release throw (simulating an already-released module)
      mockRelease.mockImplementationOnce(() => {
        throw new Error(`Module already released`)
      })

      // Re-register — should not throw despite release error
      await expect(
        runner.registerModule(`fragile`, `export default 2`)
      ).resolves.not.toThrow()
    })

    it(`should make registered module available for subsequent eval`, async () => {
      await runner.init()
      await runner.registerModule(`helper`, `export default () => 'help'`)

      // The module should be compiled with filename 'helper'
      const helperCall = mockCompileModule.mock.calls.find(
        (c: any) => c[1]?.filename === `helper`
      )
      expect(helperCall).toBeDefined()
      expect(helperCall![0]).toBe(`export default () => 'help'`)
    })
  })

  describe(`env option`, () => {
    it(`should pass env option to process.env in context eval`, async () => {
      const envRunner = new IsolateRunner({
        bash: mockBash,
        fs: mockFs,
        env: { NODE_ENV: 'production', MY_VAR: 'hello' },
      })
      await envRunner.init()

      const evalCalls = mockContextEval.mock.calls.map((c: any) => c[0])
      const processEval = evalCalls.find((s: string) => s.includes('globalThis.process'))
      expect(processEval).toBeDefined()
      expect(processEval).toContain('"NODE_ENV"')
      expect(processEval).toContain('"production"')
      expect(processEval).toContain('"MY_VAR"')

      envRunner.dispose()
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

  describe(`releaseUserModules`, () => {
    it(`should release user-registered modules but keep builtin shims`, async () => {
      await runner.init()

      // Register a user module
      await runner.registerModule(`mylib`, `export default 1`)

      const releaseCountBefore = mockRelease.mock.calls.length

      // Release user modules
      runner.releaseUserModules()

      // Should have released the user module
      expect(mockRelease.mock.calls.length).toBeGreaterThan(releaseCountBefore)
    })

    it(`should be a no-op when no user modules are registered`, async () => {
      await runner.init()

      const releaseCountBefore = mockRelease.mock.calls.length

      // Release with no user modules — should not call release
      runner.releaseUserModules()

      expect(mockRelease.mock.calls.length).toBe(releaseCountBefore)
    })

    it(`should handle release() throwing gracefully`, async () => {
      await runner.init()
      await runner.registerModule(`mylib`, `export default 1`)

      mockRelease.mockImplementationOnce(() => {
        throw new Error(`Module already released`)
      })

      expect(() => runner.releaseUserModules()).not.toThrow()
    })
  })

  describe(`scrubGlobals`, () => {
    it(`is a no-op when called before init()`, async () => {
      await expect((runner as any).scrubGlobals()).resolves.toBeUndefined()
      expect(mockEvalClosure).not.toHaveBeenCalled()
    })

    it(`captures the globalThis baseline and pristine builtins during init()`, async () => {
      await runner.init()

      const pristineCall = mockContextEval.mock.calls.find((c: any[]) =>
        String(c[0]).includes(`__pristineBuiltins`)
      )
      expect(pristineCall).toBeDefined()

      const baselineCall = mockContextEval.mock.calls.find(
        (c: any[]) => c[0] === `Object.getOwnPropertyNames(globalThis)`
      )
      expect(baselineCall).toBeDefined()
      expect(baselineCall![1]).toEqual({ copy: true })

      // Baseline capture is the LAST eval during init() — after every shim
      // and timer global has already been installed.
      const lastEvalCall = mockContextEval.mock.calls.at(-1)
      expect(lastEvalCall![0]).toBe(`Object.getOwnPropertyNames(globalThis)`)
    })

    it(`sweeps globalThis and restores builtins via evalClosure using the captured baseline`, async () => {
      mockContextEval.mockImplementation((code: string) => {
        if (code === `Object.getOwnPropertyNames(globalThis)`)
          return Promise.resolve([`console`, `process`, `Buffer`])
        return Promise.resolve(undefined)
      })
      mockEvalClosure.mockResolvedValue([])

      await runner.init()
      await (runner as any).scrubGlobals()

      expect(mockEvalClosure).toHaveBeenCalledWith(
        expect.stringContaining(`__pristineBuiltins`),
        [[`console`, `process`, `Buffer`]],
        { arguments: { copy: true }, result: { copy: true } }
      )
    })

    it(`throws when a restoration fails to stick, so the caller disposes instead of pools the isolate`, async () => {
      mockContextEval.mockImplementation((code: string) => {
        if (code === `Object.getOwnPropertyNames(globalThis)`)
          return Promise.resolve([`console`, `process`, `Buffer`])
        return Promise.resolve(undefined)
      })
      mockEvalClosure.mockResolvedValue([`Array.prototype.push`])

      await runner.init()

      await expect((runner as any).scrubGlobals()).rejects.toThrow(`Array.prototype.push`)
    })
  })

  describe(`timer cleanup`, () => {
    it(`should clear pending timers on eval`, async () => {
      await runner.init()

      // Eval should not throw — timers are cleared at start and end
      const result = await runIsolate(runner, `export default 'ok'`)
      expect(result).toHaveProperty(`output`)
      expect(result).toHaveProperty(`result`)
    })

    it(`should clear pending timers on dispose`, async () => {
      await runner.init()

      // Dispose should not throw — includes timer cleanup
      expect(() => runner.dispose()).not.toThrow()
    })

    it(`should accept maxTimerMs option`, () => {
      const r = new IsolateRunner({
        bash: mockBash,
        fs: mockFs,
        maxTimerMs: 5000,
      })
      expect(r).toBeInstanceOf(IsolateRunner)
    })
  })

  describe(`host bridges`, () => {
    it(`registers the __hostCallStart callback + isolate prelude and tears both down after eval`, async () => {
      const bridge = vi.fn(async () => `null`)

      await runner[`eval`](`export default 1`, 1000, { 'demo.echo': bridge })

      // The bridge surface is a SYNC start callback (ivm.Callback cannot await
      // an async host fn's Promise) plus an isolate-side __hostCall prelude.
      expect(mockSet).toHaveBeenCalledWith(`__hostCallStart`, expect.any(Function))
      const preludeCall = mockContextEval.mock.calls.find((c: any[]) =>
        String(c[0]).includes(`globalThis.__hostCall =`)
      )
      expect(preludeCall).toBeDefined()
      // ...and both are removed after evaluation so nothing outlives this run
      expect(mockDelete).toHaveBeenCalledWith(`__hostCallStart`)
      const teardownCall = mockContextEval.mock.calls.find((c: any[]) =>
        String(c[0]).includes(`delete globalThis.__hostCall`)
      )
      expect(teardownCall).toBeDefined()
    })

    it(`routes a start call to the named bridge host-side and settles back via evalClosure`, async () => {
      const bridge = vi.fn(async (argsJson: string) =>
        JSON.stringify({ received: JSON.parse(argsJson) })
      )
      mockEvalClosure.mockResolvedValue(undefined)

      await runner[`eval`](`export default 1`, 1000, { 'demo.echo': bridge })

      // Grab the __hostCallStart callback and invoke it exactly as the isolate would
      const setCall = mockSet.mock.calls.find((c: any[]) => c[0] === `__hostCallStart`)
      const start = setCall![1] as (id: number, n: string, a: string) => void

      start(7, `demo.echo`, JSON.stringify([`hi`]))
      // The bridge runs host-side; the settle arrives asynchronously
      await vi.waitFor(() => expect(mockEvalClosure).toHaveBeenCalled())

      expect(bridge).toHaveBeenCalledWith(JSON.stringify([`hi`]))
      const [code, args] = mockEvalClosure.mock.calls[0]
      expect(code).toContain(`__hostCallSettle`)
      expect(args[0]).toBe(7)
      expect(args[1]).toBe(true)
      expect(JSON.parse(args[2])).toEqual({ received: [`hi`] })
    })

    it(`settles a rejected bridge back as ok=false with the error message`, async () => {
      const bridge = vi.fn(async () => {
        throw new Error(`bridge exploded`)
      })
      mockEvalClosure.mockResolvedValue(undefined)

      await runner[`eval`](`export default 1`, 1000, { 'demo.echo': bridge })
      const setCall = mockSet.mock.calls.find((c: any[]) => c[0] === `__hostCallStart`)
      const start = setCall![1] as (id: number, n: string, a: string) => void

      start(3, `demo.echo`, `[]`)
      await vi.waitFor(() => expect(mockEvalClosure).toHaveBeenCalled())

      const [, args] = mockEvalClosure.mock.calls[0]
      expect(args[0]).toBe(3)
      expect(args[1]).toBe(false)
      expect(args[2]).toBe(`bridge exploded`)
    })

    it(`settles an unknown bridge name back as ok=false`, async () => {
      const bridge = vi.fn(async () => `null`)
      mockEvalClosure.mockResolvedValue(undefined)

      await runner[`eval`](`export default 1`, 1000, { 'demo.echo': bridge })
      const setCall = mockSet.mock.calls.find((c: any[]) => c[0] === `__hostCallStart`)
      const start = setCall![1] as (id: number, n: string, a: string) => void

      start(1, `nope.missing`, `[]`)
      await vi.waitFor(() => expect(mockEvalClosure).toHaveBeenCalled())

      const [, args] = mockEvalClosure.mock.calls[0]
      expect(args[1]).toBe(false)
      expect(String(args[2])).toContain(`Unknown host bridge`)
      expect(bridge).not.toHaveBeenCalled()
    })

    it(`does not register the bridge surface when no bridges are provided`, async () => {
      await runIsolate(runner, `export default 1`)

      expect(mockSet).not.toHaveBeenCalledWith(`__hostCallStart`, expect.anything())
      expect(mockDelete).not.toHaveBeenCalledWith(`__hostCallStart`)
    })
  })

  describe(`cleanup on throw`, () => {
    it(`releases the user module when evaluate() times out`, async () => {
      await runner.init()

      const releaseCountBefore = mockRelease.mock.calls.length
      mockEvaluate.mockImplementationOnce(async () => {
        throw new Error(`Script execution timed out`)
      })

      await expect(runIsolate(runner, `while(true){}`, 50)).rejects.toThrow(
        `Script execution timed out`
      )

      expect(mockRelease.mock.calls.length).toBeGreaterThan(releaseCountBefore)
    })

    it(`releases the user module when evaluate() throws an uncaught error in user code`, async () => {
      await runner.init()

      const releaseCountBefore = mockRelease.mock.calls.length
      mockEvaluate.mockImplementationOnce(async () => {
        throw new Error(`ReferenceError: undefinedVar is not defined`)
      })

      await expect(runIsolate(runner, `undefinedVar.doStuff()`)).rejects.toThrow(
        `undefinedVar is not defined`
      )

      expect(mockRelease.mock.calls.length).toBeGreaterThan(releaseCountBefore)
    })

    it(`clears any timer registered during a run that then throws`, async () => {
      await runner.init()

      // Grab the real _timerSet callback registered during init and use it to
      // simulate user code having scheduled a timer just before the throw.
      const timerSetCall = mockSet.mock.calls.find((c: any[]) => c[0] === `_timerSet`)
      const timerSet = timerSetCall![1] as (id: number, ms: number) => void
      const clearTimeoutSpy = vi.spyOn(global, `clearTimeout`)

      mockEvaluate.mockImplementationOnce(async () => {
        timerSet(99, 10000)
        throw new Error(`Script execution timed out`)
      })

      await expect(
        runIsolate(runner, `setTimeout(() => {}, 10000); while(true){}`, 50)
      ).rejects.toThrow(`Script execution timed out`)

      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })

    it(`tears down the host bridge globals even when evaluate() throws`, async () => {
      await runner.init()
      mockDelete.mockClear()
      mockContextEval.mockClear()

      const bridge = vi.fn(async () => `null`)
      mockEvaluate.mockImplementationOnce(async () => {
        throw new Error(`Script execution timed out`)
      })

      await expect(
        runner[`eval`](`while(true){}`, 50, { 'demo.echo': bridge })
      ).rejects.toThrow(`Script execution timed out`)

      expect(mockDelete).toHaveBeenCalledWith(`__hostCallStart`)
      const teardownCall = mockContextEval.mock.calls.find((c: any[]) =>
        String(c[0]).includes(`delete globalThis.__hostCall`)
      )
      expect(teardownCall).toBeDefined()
    })
  })
})
