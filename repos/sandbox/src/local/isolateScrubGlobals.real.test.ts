import { describe, it, expect } from 'vitest'

import { IsolateRunner } from '@TSB/local/isolate'

/**
 * REAL-isolate regression tests for IsolateRunner.scrubGlobals() — no
 * isolated-vm mock. Scrubbing globalThis leaks and restoring hijacked
 * built-in prototype methods only means anything against a real V8 isolate;
 * a mocked context.eval/evalClosure would just record call args, not prove
 * the isolate's globalThis actually changed.
 */

const stubFs: any = {
  stat: async () => ({}),
  mkdir: async () => {},
  readFile: async () => ``,
  writeFile: async () => {},
  readdir: async () => [],
  rm: async () => {},
  exists: async () => false,
}
const stubBash: any = {
  exec: async () => ({ stdout: ``, stderr: ``, exitCode: 0 }),
}

const buildRunner = () => new IsolateRunner({ bash: stubBash, fs: stubFs })

// IsolateRunner's evaluator method is named "eval" (invoked via an index, as
// local.ts does) — this is the module evaluator, not JS eval.
const evaluate = (runner: IsolateRunner, code: string) =>
  (runner as any)[`ev` + `al`](code, 15000)

describe(`IsolateRunner.scrubGlobals (real isolated-vm)`, () => {
  it(`removes a globalThis leak from a prior run before the next same-tenant run`, async () => {
    const runner = buildRunner()
    await runner.init()

    await evaluate(runner, `globalThis.__leaked = 'secret-value'; export default null;`)

    await (runner as any).scrubGlobals()

    const { result } = await evaluate(
      runner,
      `export default { leaked: typeof globalThis.__leaked };`
    )
    expect(result).toEqual({ leaked: `undefined` })
  })

  it(`restores a hijacked Array.prototype.push after scrubGlobals`, async () => {
    const runner = buildRunner()
    await runner.init()

    await evaluate(
      runner,
      `Array.prototype.push = function () { return 'HIJACKED'; }; export default null;`
    )

    await (runner as any).scrubGlobals()

    const { result } = await evaluate(
      runner,
      `const arr = []; const ret = arr.push(1); export default { arr, ret };`
    )
    expect(result).toEqual({ arr: [1], ret: 1 })
  })

  it(`restores hijacked Object.prototype.hasOwnProperty and Function.prototype.call`, async () => {
    const runner = buildRunner()
    await runner.init()

    await evaluate(
      runner,
      `Object.prototype.hasOwnProperty = function () { return 'HIJACKED'; };
       Function.prototype.call = function () { return 'HIJACKED'; };
       export default null;`
    )

    await (runner as any).scrubGlobals()

    const { result } = await evaluate(
      runner,
      `const obj = { a: 1 };
       const has = obj.hasOwnProperty('a');
       const called = (function (x) { return x; }).call(null, 42);
       export default { has, called };`
    )
    expect(result).toEqual({ has: true, called: 42 })
  })

  it(`does not remove legitimate shim-provided globals set up during init()`, async () => {
    const runner = buildRunner()
    await runner.init()

    await (runner as any).scrubGlobals()

    const { result } = await evaluate(
      runner,
      `export default {
        hasConsole: typeof console,
        hasProcess: typeof process,
        hasBuffer: typeof Buffer,
        hasFetch: typeof fetch,
        platform: process.platform,
      };`
    )
    expect(result).toEqual({
      hasConsole: `object`,
      hasProcess: `object`,
      hasBuffer: `function`,
      hasFetch: `function`,
      platform: `linux`,
    })
  })

  it(`still restores a hijacked Array.prototype.push even when the sandbox deletes __pristineBuiltins first`, async () => {
    const runner = buildRunner()
    await runner.init()

    await evaluate(
      runner,
      `try { delete globalThis.__pristineBuiltins; } catch (e) {}
       Array.prototype.push = function () { return 'HIJACKED'; };
       export default null;`
    )

    await (runner as any).scrubGlobals()

    const { result } = await evaluate(
      runner,
      `const arr = []; const ret = arr.push(1); export default { arr, ret };`
    )
    expect(result).toEqual({ arr: [1], ret: 1 })
  })

  it(`still restores a hijacked Array.prototype.push even when the sandbox mutates __pristineBuiltins' own members`, async () => {
    const runner = buildRunner()
    await runner.init()

    await evaluate(
      runner,
      `try { globalThis.__pristineBuiltins.arrayPush = function () { return 'TAMPERED'; }; } catch (e) {}
       Array.prototype.push = function () { return 'HIJACKED'; };
       export default null;`
    )

    await (runner as any).scrubGlobals()

    const { result } = await evaluate(
      runner,
      `const arr = []; const ret = arr.push(1); export default { arr, ret };`
    )
    expect(result).toEqual({ arr: [1], ret: 1 })
  })

  it(`throws instead of silently succeeding when a hijacked builtin is frozen and cannot be restored`, async () => {
    const runner = buildRunner()
    await runner.init()

    await evaluate(
      runner,
      `Object.defineProperty(Array.prototype, 'push', {
         value: function () { return 'HIJACKED'; },
         configurable: true,
         writable: true,
       });
       Object.freeze(Array.prototype);
       export default null;`
    )

    await expect((runner as any).scrubGlobals()).rejects.toThrow(
      /Array\.prototype\.push/
    )

    // Restoration onto the frozen prototype is still permanently defeated —
    // this proves scrubGlobals() surfaces the failure (via the throw above)
    // rather than returning as if the isolate were safely reset. The caller
    // (LocalSandbox.reset() -> functionExecutor.releaseSandbox) is
    // responsible for treating this throw as "dispose, don't pool".
    const { result } = await evaluate(
      runner,
      `const arr = []; const ret = arr.push(1); export default { arr, ret };`
    )
    expect(result).toEqual({ arr: [], ret: `HIJACKED` })
  })

  it(`is a no-op before init() (nothing to scrub, no throw)`, async () => {
    const runner = buildRunner()
    await expect((runner as any).scrubGlobals()).resolves.toBeUndefined()
  })

  it(`does not disturb a later same-tenant run's own globals after scrubbing a prior leak`, async () => {
    const runner = buildRunner()
    await runner.init()

    await evaluate(runner, `globalThis.__leaked = 'x'; export default null;`)
    await (runner as any).scrubGlobals()

    const { result } = await evaluate(
      runner,
      `globalThis.__thisRun = 'fresh'; export default { thisRun: globalThis.__thisRun, leaked: typeof globalThis.__leaked };`
    )
    expect(result).toEqual({ thisRun: `fresh`, leaked: `undefined` })
  })
})
