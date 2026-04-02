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
      maxTimerMs: this.#maxTimerMs,
      onLog: (...args: any[]) => {
        this.#output.push(args.map(String).join(` `))
      },
    }
    for (const shim of shimRegistry)
      if (shim.setupCallbacks) await shim.setupCallbacks(jail, ivm, deps)

    await this.#compile(deps)
    await this.#setupTimers(jail, ivm)
    this.#initialized = true
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

  async eval(code: string, timeout = 5000): Promise<{ output: string; result: any }> {
    if (!this.#initialized) await this.init()

    this.#clearAllTimers()
    this.#output = []

    const userModule = await this.#isolate!.compileModule(code, {
      filename: `user-code.js`,
    })

    await userModule.instantiate(this.#context!, (specifier: string) => {
      const shim = this.#shims.get(specifier)
      if (!shim) throw new Error(`Module not found: ${specifier}`)
      return shim
    })

    await userModule.evaluate({ timeout })

    // Try to retrieve the default export via structured clone
    let result: any
    try {
      const ns = userModule.namespace
      result = await ns.get(`default`, { copy: true })
    } catch {
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
