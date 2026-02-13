import type { Bash } from 'just-bash'
import type { IFileSystem } from 'just-bash'
import type { Isolate, Context, Module } from 'isolated-vm'

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
  fs: IFileSystem
  memory?: number
}

/**
 * IsolateRunner wraps isolated-vm for safe JS code execution
 * Uses V8 isolates with configurable memory limits
 * Node.js API shims (fs, path, shell) route to just-bash
 */
export class IsolateRunner {
  #bash: Bash
  #memory: number
  #fs: IFileSystem
  #initialized = false
  #isolate: Isolate | null = null
  #context: Context | null = null
  #shims = new Map<string, Module>()

  #output: string[] = []

  constructor(opts: IsolateRunnerOptions) {
    this.#fs = opts.fs
    this.#bash = opts.bash
    this.#memory = opts.memory || 128
  }

  async init(): Promise<void> {
    if (this.#initialized) return

    const ivm = await loadIvm()
    this.#isolate = new ivm.Isolate({ memory: this.#memory })
    this.#context = await this.#isolate.createContext()
    const jail = this.#context.global
    await jail.set(`global`, jail.derefInto())

    // Console bridge — captures output for retrieval after eval
    await jail.set(
      `_log`,
      new ivm.Callback((...args: any[]) => {
        this.#output.push(args.map(String).join(` `))
      })
    )

    await this.#context.eval(`
      globalThis.console = {
        log: (...args) => _log(...args),
        error: (...args) => _log('ERROR:', ...args),
        warn: (...args) => _log('WARN:', ...args),
        info: (...args) => _log('INFO:', ...args),
      }
    `)

    // FS callbacks — async bridges to just-bash virtual filesystem
    await jail.set(
      `_fsReadFile`,
      new ivm.Callback(
        async (path: string) => {
          return await this.#fs.readFile(path, { encoding: `utf-8` })
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsWriteFile`,
      new ivm.Callback(
        async (path: string, content: string) => {
          await this.#fs.writeFile(path, content)
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsExists`,
      new ivm.Callback(
        async (path: string) => {
          try {
            await this.#fs.stat(path)
            return true
          } catch {
            return false
          }
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsMkdir`,
      new ivm.Callback(
        async (path: string) => {
          await this.#fs.mkdir(path, { recursive: true })
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsReaddir`,
      new ivm.Callback(
        async (path: string) => {
          return await this.#fs.readdir(path)
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsUnlink`,
      new ivm.Callback(
        async (path: string) => {
          await this.#fs.rm(path)
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsStat`,
      new ivm.Callback(
        async (path: string) => {
          const stat = await this.#fs.stat(path)
          return {
            isDirectory: stat.isDirectory,
            isFile: stat.isFile,
            size: stat.size || 0,
          }
        },
        { async: true }
      )
    )

    // Shell run callback — routes commands to just-bash virtual shell
    await jail.set(
      `_shellRun`,
      new ivm.Callback(
        async (cmd: string) => {
          const result = await this.#bash.exec(cmd)
          if (result.exitCode !== 0)
            throw new Error(result.stderr || `Command failed: ${cmd}`)
          return result.stdout
        },
        { async: true }
      )
    )

    await this.#compile()
    this.#initialized = true
  }

  async #compile(): Promise<void> {
    if (!this.#isolate || !this.#context) throw new Error(`Isolate not created`)

    // fs shim — all operations are async (return Promises)
    const fsSource = `
      export const readFile = globalThis._fsReadFile
      export const writeFile = globalThis._fsWriteFile
      export const existsSync = globalThis._fsExists
      export const exists = globalThis._fsExists
      export const mkdirSync = globalThis._fsMkdir
      export const mkdir = globalThis._fsMkdir
      export const readdirSync = globalThis._fsReaddir
      export const readdir = globalThis._fsReaddir
      export const unlinkSync = globalThis._fsUnlink
      export const unlink = globalThis._fsUnlink
      export const statSync = globalThis._fsStat
      export const stat = globalThis._fsStat
      export const readFileSync = globalThis._fsReadFile
      export const writeFileSync = globalThis._fsWriteFile
      export default {
        readFile, writeFile, exists, existsSync,
        mkdir, mkdirSync, readdir, readdirSync,
        unlink, unlinkSync, stat, statSync,
        readFileSync, writeFileSync,
      }
    `
    const fsMod = await this.#isolate.compileModule(fsSource, { filename: `node:fs` })
    await fsMod.instantiate(this.#context, () => {
      throw new Error(`fs shim has no dependencies`)
    })
    await fsMod.evaluate()
    this.#shims.set(`fs`, fsMod)
    this.#shims.set(`node:fs`, fsMod)

    // path shim — pure JS, no host bridge needed
    const pathSource = `
      export const join = (...parts) => parts.join('/').replace(/\\/\\/+/g, '/')
      export const resolve = (...parts) => {
        let resolved = ''
        for (const p of parts) {
          resolved = p.startsWith('/') ? p : (resolved ? resolved + '/' + p : p)
        }
        return resolved.replace(/\\/\\/+/g, '/')
      }
      export const dirname = (p) => {
        const parts = p.split('/')
        parts.pop()
        return parts.join('/') || '/'
      }
      export const basename = (p, ext) => {
        const b = p.split('/').pop() || ''
        return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b
      }
      export const extname = (p) => {
        const m = p.match(/\\.[^.]+$/)
        return m ? m[0] : ''
      }
      export const normalize = (p) => p.replace(/\\/\\/+/g, '/')
      export const sep = '/'
      export const posix = { sep: '/' }
      export default { join, resolve, dirname, basename, extname, normalize, sep, posix }
    `
    const pathMod = await this.#isolate.compileModule(pathSource, {
      filename: `node:path`,
    })
    await pathMod.instantiate(this.#context, () => {
      throw new Error(`path shim has no dependencies`)
    })
    await pathMod.evaluate()
    this.#shims.set(`path`, pathMod)
    this.#shims.set(`node:path`, pathMod)

    // Shell shim — routes commands to just-bash virtual shell
    // Named as child_process for Node.js API compatibility
    const shellSource = `
      const run = globalThis._shellRun
      export { run as execSync }
      export { run }
      export default { execSync: run, run }
    `
    const shellMod = await this.#isolate.compileModule(shellSource, {
      filename: `node:child_process`,
    })
    await shellMod.instantiate(this.#context, () => {
      throw new Error(`shell shim has no dependencies`)
    })
    await shellMod.evaluate()
    this.#shims.set(`child_process`, shellMod)
    this.#shims.set(`node:child_process`, shellMod)
  }

  async eval(code: string, timeout = 5000): Promise<{ output: string; result: any }> {
    if (!this.#initialized) await this.init()

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

    // Try to retrieve the default export
    let result: any
    try {
      const ns = userModule.namespace
      result = await ns.get(`default`, { copy: true })
    } catch {
      // No default export
    }

    userModule.release()

    return {
      output: this.#output.join(`\n`),
      result,
    }
  }

  dispose(): void {
    for (const mod of this.#shims.values()) {
      try {
        mod.release()
      } catch {
        /* already released */
      }
    }
    this.#shims.clear()

    if (this.#context) {
      try {
        this.#context.release()
      } catch {
        /* already released */
      }
      this.#context = null
    }

    if (this.#isolate) {
      try {
        this.#isolate.dispose()
      } catch {
        /* already disposed */
      }
      this.#isolate = null
    }

    this.#initialized = false
  }
}
