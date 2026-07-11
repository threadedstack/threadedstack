import type { TShimDeps } from '@TSB/types'
import type { Bash, IFileSystem } from 'just-bash'
import type { Isolate, Context, Module } from 'isolated-vm'
import { shimRegistry, builtinShimNames } from '@TSB/local/shims'

/**
 * Swallow "already released/disposed" errors from isolated-vm teardown.
 * Warns on genuinely unexpected failures.
 */
const safeRelease = (fn: () => void, keyword: string, label: string) => {
  try {
    fn()
  } catch (err: any) {
    if (!String(err?.message || ``).includes(keyword))
      console.warn(`Unexpected error ${label}:`, err)
  }
}

// Lazy-load isolated-vm via dynamic import() to:
// 1. Avoid crashing when native addon isn't compiled (Linux pod)
// 2. Allow vitest to intercept via vi.mock()
let _ivm: any = null
const loadIvm = async (): Promise<any> => {
  if (!_ivm) {
    const mod = await import('isolated-vm')
    _ivm = mod.default || mod
  }
  return _ivm
}

export type IsolateRunnerOptions = {
  bash: Bash
  memory?: number
  fs: IFileSystem
  maxTimerMs?: number
  env?: Record<string, string>
}

/**
 * IsolateRunner wraps isolated-vm for safe JS code execution
 * Uses V8 isolates with configurable memory limits
 * Node.js API shims (fs, path, shell) route to just-bash; fetch bridges to host
 */
export class IsolateRunner {
  #bash: Bash
  #memory: number
  #fs: IFileSystem
  #maxTimerMs: number
  #initialized = false
  #env: Record<string, string>
  #isolate: Isolate | null = null
  #context: Context | null = null
  #globalBaseline: Set<string> | null = null
  #shims = new Map<string, Module>()
  #pendingTimers = new Map<
    number,
    { handle: ReturnType<typeof setTimeout>; type: 'timeout' | 'interval' }
  >()

  #output: string[] = []

  #clearAllTimers(): void {
    for (const { handle, type } of this.#pendingTimers.values()) {
      type === `interval` ? clearInterval(handle) : clearTimeout(handle)
    }
    this.#pendingTimers.clear()
  }

  async #setupTimers(jail: any, ivm: any): Promise<void> {
    await jail.set(
      `_timerSet`,
      new ivm.Callback((id: number, ms: number) => {
        const clamped = Math.min(Math.max(0, ms), this.#maxTimerMs)
        const handle = setTimeout(() => {
          this.#pendingTimers.delete(id)
          const p = this.#context?.eval(
            `typeof __timerFire === "function" && __timerFire(${id})`
          )
          if (p && typeof p.catch === `function`) {
            p.catch((err: any) => {
              const msg = String(err?.message || ``)
              if (!msg.includes(`released`) && !msg.includes(`disposed`))
                console.warn(`Timer ${id} callback failed:`, err)
            })
          }
        }, clamped)
        this.#pendingTimers.set(id, { handle, type: `timeout` })
      })
    )

    await jail.set(
      `_timerClear`,
      new ivm.Callback((id: number) => {
        const entry = this.#pendingTimers.get(id)
        if (entry) {
          entry.type === `interval`
            ? clearInterval(entry.handle)
            : clearTimeout(entry.handle)
          this.#pendingTimers.delete(id)
        }
      })
    )

    await jail.set(
      `_timerInterval`,
      new ivm.Callback((id: number, ms: number) => {
        const clamped = Math.min(Math.max(0, ms), this.#maxTimerMs)
        const handle = setInterval(() => {
          const p = this.#context?.eval(
            `typeof __timerFire === "function" && __timerFire(${id})`
          )
          if (p && typeof p.catch === `function`) {
            p.catch((err: any) => {
              const msg = String(err?.message || ``)
              if (msg.includes(`released`) || msg.includes(`disposed`)) return
              console.warn(`Interval ${id} killed due to error:`, err)
              const h = this.#pendingTimers.get(id)
              if (h) {
                clearInterval(h.handle)
                this.#pendingTimers.delete(id)
              }
            })
          }
        }, clamped)
        this.#pendingTimers.set(id, { handle, type: `interval` })
      })
    )

    await this.#context!.eval(`
      (function() {
        var _callbacks = new Map()
        var _nextId = 1

        globalThis.__timerFire = function(id) {
          var entry = _callbacks.get(id)
          if (!entry) return
          if (!entry.interval) _callbacks.delete(id)
          try { entry.fn.apply(null, entry.args) } catch(e) { console.error(e) }
        }

        globalThis.setTimeout = function(fn, ms) {
          if (_callbacks.size >= 100) throw new Error('Too many concurrent timers')
          var args = Array.prototype.slice.call(arguments, 2)
          var id = _nextId++
          _callbacks.set(id, { fn: fn, args: args, interval: false })
          _timerSet(id, ms || 0)
          return id
        }

        globalThis.clearTimeout = function(id) {
          _callbacks.delete(id)
          _timerClear(id)
        }

        globalThis.setInterval = function(fn, ms) {
          if (_callbacks.size >= 100) throw new Error('Too many concurrent timers')
          var args = Array.prototype.slice.call(arguments, 2)
          var id = _nextId++
          _callbacks.set(id, { fn: fn, args: args, interval: true })
          _timerInterval(id, ms || 0)
          return id
        }

        globalThis.clearInterval = function(id) {
          _callbacks.delete(id)
          _timerClear(id)
        }

        globalThis.setImmediate = function(fn) {
          var args = Array.prototype.slice.call(arguments, 1)
          return globalThis.setTimeout.apply(null, [fn, 0].concat(args))
        }

        if (typeof globalThis.queueMicrotask === 'undefined') {
          globalThis.queueMicrotask = function(fn) {
            Promise.resolve().then(fn)
          }
        }
      })()
    `)
  }

  constructor(opts: IsolateRunnerOptions) {
    this.#fs = opts.fs
    this.#bash = opts.bash
    this.#env = opts.env || {}
    this.#memory = opts.memory || 128
    this.#maxTimerMs = opts.maxTimerMs || 30000
  }

  async init(): Promise<void> {
    if (this.#initialized) return

    const ivm = await loadIvm()
    this.#isolate = new ivm.Isolate({ memory: this.#memory })
    this.#context = await this.#isolate.createContext()
    const jail = this.#context.global
    await jail.set(`global`, jail.derefInto())

    // Set up host callbacks from shim registry
    const deps: TShimDeps = {
      fs: this.#fs,
      env: this.#env,
      bash: this.#bash,
      context: this.#context,
      maxTimerMs: this.#maxTimerMs,
      onLog: (...args: any[]) => {
        this.#output.push(args.map(String).join(` `))
      },
    }
    for (const shim of shimRegistry)
      if (shim.setupCallbacks) await shim.setupCallbacks(jail, ivm, deps)

    await this.#compile(deps)
    await this.#setupTimers(jail, ivm)

    // Stash fresh references to the built-ins scrubGlobals() restores, then
    // snapshot the post-setup globalThis key set as the baseline for the same
    // pass's deletion sweep. Both must happen here, after every shim/timer
    // global is installed — capturing the baseline any earlier would flag
    // legitimate shim globals (console, process, fetch, __timerFire, ...) as
    // user-added leaks and delete them on the very first reset().
    // Frozen and defined non-writable/non-configurable so sandboxed code can
    // neither delete nor reassign __pristineBuiltins (or its member refs) to
    // silently defeat scrubGlobals()'s restore step.
    await this.#context.eval(`
      Object.defineProperty(globalThis, '__pristineBuiltins', {
        value: Object.freeze({
          arrayPush: Array.prototype.push,
          arrayPop: Array.prototype.pop,
          arraySlice: Array.prototype.slice,
          arrayMap: Array.prototype.map,
          arrayForEach: Array.prototype.forEach,
          objectHasOwnProperty: Object.prototype.hasOwnProperty,
          functionCall: Function.prototype.call,
          functionApply: Function.prototype.apply,
          functionBind: Function.prototype.bind,
        }),
        writable: false,
        configurable: false,
      })
    `)
    const baselineNames: string[] = await this.#context.eval(
      `Object.getOwnPropertyNames(globalThis)`,
      { copy: true }
    )
    this.#globalBaseline = new Set(baselineNames)

    this.#initialized = true
  }

  /**
   * Bounded defense-in-depth for pooled reuse WITHIN the same tenant: deletes
   * any own-enumerable globalThis key a prior run added that wasn't present
   * at init() (e.g. a leaked `globalThis.secret = ...`), and restores a fixed
   * list of the most commonly-targeted built-in prototype methods from the
   * pristine references captured at init() — NOT a general prototype-integrity
   * guarantee, just the handful of methods a hijack is most likely to target.
   * The actual security boundary for cross-tenant isolation is the pool
   * partitioning in functionExecutor.ts; this only limits blast radius between
   * two functions that already share a tenant's trust boundary.
   */
  async scrubGlobals(): Promise<void> {
    if (!this.#context || !this.#globalBaseline) return

    const baseline = Array.from(this.#globalBaseline)
    await this.#context.evalClosure(
      `
        var baseline = new Set($0);
        var names = Object.getOwnPropertyNames(globalThis);
        for (var i = 0; i < names.length; i++) {
          if (baseline.has(names[i])) continue;
          try { delete globalThis[names[i]]; } catch (e) {}
        }
        var p = globalThis.__pristineBuiltins;
        if (p) {
          Array.prototype.push = p.arrayPush;
          Array.prototype.pop = p.arrayPop;
          Array.prototype.slice = p.arraySlice;
          Array.prototype.map = p.arrayMap;
          Array.prototype.forEach = p.arrayForEach;
          Object.prototype.hasOwnProperty = p.objectHasOwnProperty;
          Function.prototype.call = p.functionCall;
          Function.prototype.apply = p.functionApply;
          Function.prototype.bind = p.functionBind;
        }
      `,
      [baseline],
      { arguments: { copy: true } }
    )
  }

  async #compile(deps: TShimDeps): Promise<void> {
    if (!this.#isolate || !this.#context) throw new Error(`Isolate not created`)

    // Compile and register all shim modules from the registry
    for (const shim of shimRegistry) {
      if (!shim.source) continue

      const filename = `node:${shim.names[0]}`
      const mod = await this.#isolate.compileModule(shim.source, { filename })

      await mod.instantiate(this.#context, (specifier: string) => {
        const dep = this.#shims.get(specifier)
        if (dep) return dep
        throw new Error(`Module not found: ${specifier}`)
      })

      await mod.evaluate()

      for (const name of shim.names) {
        this.#shims.set(name, mod)
      }
    }

    // Run setupGlobals for shims that define them
    for (const shim of shimRegistry) {
      if (shim.setupGlobals) await shim.setupGlobals(this.#context, deps)
    }
  }

  /**
   * Register a named ES module that can be imported by user code.
   * The module's imports are resolved against existing shims (fs, path, shell).
   */
  async registerModule(name: string, code: string): Promise<void> {
    if (!this.#initialized) await this.init()

    // Release existing module with this name to avoid V8 heap leak on pool reuse
    const existing = this.#shims.get(name)
    if (existing) {
      safeRelease(() => existing.release(), `released`, `releasing module '${name}'`)
      this.#shims.delete(name)
    }

    const mod = await this.#isolate!.compileModule(code, { filename: name })
    await mod.instantiate(this.#context!, (specifier: string) => {
      const shim = this.#shims.get(specifier)
      if (!shim) throw new Error(`Module not found: ${specifier}`)
      return shim
    })
    await mod.evaluate()
    this.#shims.set(name, mod)
  }

  /**
   * Release all user-registered modules (but keep built-in shims).
   * Called during sandbox pool reset to avoid V8 heap leaks.
   */
  releaseUserModules(): void {
    for (const [name, mod] of this.#shims) {
      if (builtinShimNames.has(name)) continue
      safeRelease(() => mod.release(), `released`, `releasing module '${name}'`)
      this.#shims.delete(name)
    }
  }

  async eval(
    code: string,
    timeout = 5000,
    bridges?: Record<string, (argsJson: string) => Promise<string>>
  ): Promise<{ output: string; result: any }> {
    if (!this.#initialized) await this.init()

    this.#clearAllTimers()
    this.#output = []

    // Expose the provided host bridges to the evaluated code as a single async
    // surface (`__hostCall(name, argsJson) -> Promise<string>`). ivm.Callback
    // does NOT await an async host fn's returned Promise — it structured-clones
    // the raw return value, so an async fn yields "#<Promise> could not be
    // cloned" inside the isolate. The working shape (mirroring the timer shim)
    // is start/settle: a SYNC start callback kicks off the host work and the
    // host settles back into the isolate via evalClosure when it finishes. The
    // bridge fns run host-side; only JSON strings cross the boundary.
    const bridgeNames = bridges ? Object.keys(bridges) : []
    if (bridgeNames.length) {
      const ivm = await loadIvm()
      await this.#context!.global.set(
        `__hostCallStart`,
        new ivm.Callback((id: number, name: string, argsJson: string): void => {
          const settle = (ok: boolean, payload: string) => {
            // The isolate may have been torn down (timeout/close) before the
            // host work settled — dropping the settle is safe: the pending
            // promise dies with the context.
            this.#context
              ?.evalClosure(`__hostCallSettle($0, $1, $2)`, [id, ok, payload], {
                timeout: 1000,
                arguments: { copy: true },
              })
              .catch(() => {})
          }
          const fn = bridges![name]
          if (!fn) {
            settle(false, `Unknown host bridge: ${name}`)
            return
          }
          fn(argsJson).then(
            (result) => settle(true, result),
            (err) => settle(false, err instanceof Error ? err.message : String(err))
          )
        })
      )
      // Isolate-side prelude: __hostCall registers a pending promise and asks
      // the host to start; __hostCallSettle resolves/rejects it when the host
      // calls back in. Re-installed per evaluation (pooled isolates), so the
      // pending map never leaks across runs.
      await this.#context!.eval(`
        globalThis.__hostCallPending = new Map();
        globalThis.__hostCallSeq = 0;
        globalThis.__hostCall = (name, argsJson) =>
          new Promise((resolve, reject) => {
            const id = ++globalThis.__hostCallSeq;
            globalThis.__hostCallPending.set(id, { resolve, reject });
            __hostCallStart(id, name, argsJson);
          });
        globalThis.__hostCallSettle = (id, ok, payload) => {
          const pending = globalThis.__hostCallPending.get(id);
          if (!pending) return;
          globalThis.__hostCallPending.delete(id);
          ok ? pending.resolve(payload) : pending.reject(new Error(payload));
        };
      `)
    }

    const userModule = await this.#isolate!.compileModule(code, {
      filename: `user-code.js`,
    })

    await userModule.instantiate(this.#context!, (specifier: string) => {
      const shim = this.#shims.get(specifier)
      if (!shim) throw new Error(`Module not found: ${specifier}`)
      return shim
    })

    const deadline = Date.now() + timeout
    await userModule.evaluate({ timeout })

    // Try to retrieve the default export via structured clone.
    //
    // module.evaluate() resolves when a top-level-await module SUSPENDS (its
    // first await that isn't already settled), NOT when it completes — and
    // while suspended, ns.get('default') throws "default is not defined". A
    // module awaiting a slow host bridge is exactly that case, so when bridges
    // are in play we poll through that throw until the export materializes
    // (the settle resumed the module and it finished) or the eval deadline
    // passes. Bridge-free modules keep the old single-attempt semantics.
    let result: any
    let extractFailed = false
    const ns = userModule.namespace
    for (;;) {
      try {
        result = await ns.get(`default`, { copy: true })
        break
      } catch (err: any) {
        const msg = String(err?.message || ``)
        const stillEvaluating =
          msg.includes(`is not defined`) || msg.includes(`before initialization`)
        if (stillEvaluating && bridgeNames.length && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 15))
          continue
        }
        extractFailed = true
        break
      }
    }
    if (extractFailed) {
      // Structured clone failed (non-serializable properties) — try JSON fallback
      try {
        const bridge = await this.#isolate!.compileModule(
          `import val from 'user-code';\nexport default JSON.stringify(val ?? null);`,
          { filename: `json-bridge.js` }
        )
        await bridge.instantiate(this.#context!, (specifier: string) => {
          if (specifier === `user-code`) return userModule
          const shim = this.#shims.get(specifier)
          if (!shim) throw new Error(`Module not found: ${specifier}`)
          return shim
        })
        await bridge.evaluate({ timeout: 1000 })
        const json = await bridge.namespace.get(`default`, { copy: true })
        if (typeof json === `string`) result = JSON.parse(json)
        bridge.release()
      } catch (err: any) {
        // Both structured clone and JSON serialization failed — result stays undefined
        if (!String(err?.message || ``).includes(`released`))
          console.warn(`Failed to extract default export from user code:`, err)
      }
    }

    // Tear the host bridge down AFTER result extraction — extraction is what
    // waits out in-flight bridge calls (a suspended top-level-await module
    // resumes only when the host settles back in), so deleting the surface any
    // earlier would strand those calls. Nothing outlives this run on a pool.
    if (bridgeNames.length) {
      await this.#context!.global.delete(`__hostCallStart`).catch(() => {})
      await this.#context!.eval(
        `delete globalThis.__hostCall; delete globalThis.__hostCallSettle; delete globalThis.__hostCallPending; delete globalThis.__hostCallSeq;`
      ).catch(() => {})
    }

    userModule.release()
    this.#clearAllTimers()

    return {
      output: this.#output.join(`\n`),
      result,
    }
  }

  dispose(): void {
    this.#clearAllTimers()
    for (const mod of this.#shims.values()) {
      safeRelease(() => mod.release(), `released`, `releasing module during dispose`)
    }
    this.#shims.clear()

    if (this.#context) {
      safeRelease(
        () => this.#context!.release(),
        `released`,
        `releasing context during dispose`
      )
      this.#context = null
    }

    if (this.#isolate) {
      safeRelease(() => this.#isolate!.dispose(), `disposed`, `disposing isolate`)
      this.#isolate = null
    }

    this.#initialized = false
  }
}
