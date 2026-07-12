import type {
  ISandbox,
  TSandboxConfig,
  TSandboxResult,
  ISandboxProvider,
  TSandboxEvalOpts,
  TSandboxEvalResult,
} from '@tdsk/domain'

import type { IFileSystem } from 'just-bash'

import { logger } from '@TSB/utils/logger'
import { Bash, InMemoryFs } from 'just-bash'
import { gitCommand } from '@TSB/git/gitCommand'
import { IsolateRunner } from '@TSB/local/isolate'
import { DefaultTempdir } from '@TSB/constants/values'
import { ESandboxType, DefaultWorkdir } from '@tdsk/domain'

/**
 * Local sandbox instance using just-bash virtual shell/filesystem
 * and isolated-vm for V8-isolated JS code execution
 * Implements ISandbox interface for local code/shell execution
 */
export class LocalSandbox implements ISandbox {
  private bash: Bash
  private cwd: string
  private fs: IFileSystem
  private isolateRunner: IsolateRunner | null

  constructor(
    bash: Bash,
    fs: IFileSystem,
    isolateRunner?: IsolateRunner | null,
    cwd = DefaultWorkdir
  ) {
    this.fs = fs
    this.bash = bash
    this.cwd = cwd
    this.isolateRunner = isolateRunner || null
  }

  // `signal` is accepted for ISandbox interface parity but is advisory/no-op here:
  // just-bash's ExecOptions has no cancellation mechanism, and racing a timeout
  // promise against `bash.exec()` would leave the underlying isolate execution
  // running in the background — a silently-orphaned isolate is worse than the
  // current explicit lack of support.
  exec = async (
    command: string,
    args: string[] = [],
    signal?: AbortSignal
  ): Promise<TSandboxResult> => {
    const fullCommand = args.length > 0 ? `${command} ${args.join(` `)}` : command
    const result = await this.bash.exec(fullCommand, { cwd: this.cwd })

    return {
      output: result.stdout,
      exitCode: result.exitCode,
      success: result.exitCode === 0,
      error: result.stderr || undefined,
    }
  }

  readFile = async (path: string): Promise<string> => {
    return await this.fs.readFile(path, { encoding: `utf-8` })
  }

  writeFile = async (path: string, content: string): Promise<void> => {
    await this.fs.writeFile(path, content)
  }

  listDir = async (path: string): Promise<string[]> => {
    const entries = await this.fs.readdir(path)
    const result: string[] = []

    for (const name of entries) {
      const entryPath = path.endsWith(`/`) ? `${path}${name}` : `${path}/${name}`

      try {
        const stat = await this.fs.stat(entryPath)
        result.push(stat.isDirectory ? `[DIR] ${name}` : name)
      } catch {
        result.push(name)
      }
    }

    return result
  }

  deleteFile = async (path: string): Promise<void> => {
    await this.fs.rm(path)
  }

  mkdir = async (path: string): Promise<void> => {
    await this.fs.mkdir(path, { recursive: true })
  }

  fileExists = async (path: string): Promise<boolean> => {
    try {
      await this.fs.stat(path)
      return true
    } catch {
      return false
    }
  }

  evaluate = async (
    code: string,
    opts?: TSandboxEvalOpts
  ): Promise<TSandboxEvalResult> => {
    if (!this.isolateRunner) {
      throw new Error(
        `Code execution not available — isolated-vm is required but not loaded`
      )
    }

    // Register any provided modules before evaluation
    if (opts?.modules) {
      for (const [name, moduleCode] of Object.entries(opts.modules)) {
        await this.isolateRunner.registerModule(name, moduleCode)
      }
    }

    return await this.isolateRunner[`eval`](code, opts?.timeout, opts?.bridges)
  }

  reset = async (): Promise<void> => {
    // Release user-registered modules to avoid V8 heap leaks on pool reuse
    this.isolateRunner?.releaseUserModules()

    // Scrub any leaked globalThis writes and hijacked built-in prototype
    // methods from a prior run before this isolate is handed to the next
    // same-tenant function — see IsolateRunner.scrubGlobals() for scope.
    await this.isolateRunner?.scrubGlobals()

    // Clear filesystem contents in /workspace and /tmp
    for (const dir of [DefaultWorkdir, DefaultTempdir]) {
      try {
        const entries = await this.fs.readdir(dir)
        for (const entry of entries) {
          try {
            await this.fs.rm(`${dir}/${entry}`)
          } catch (err: any) {
            // Non-empty directories are expected — only log unexpected errors
            const code = err?.code || err?.message || ``
            if (
              !String(code).includes(`not empty`) &&
              !String(code).includes(`ENOTEMPTY`)
            )
              logger.warn(`Unexpected error clearing ${dir}/${entry}:`, err)
          }
        }
      } catch {
        /* directory may not exist */
      }
    }
  }

  close = async (): Promise<void> => {
    this.isolateRunner?.dispose()
  }
}

/**
 * Local sandbox provider — creates sandbox instances using
 * just-bash (virtual shell/FS) + isolated-vm (V8 code isolation)
 * No external services required — works fully offline
 */
export class LocalSandboxProvider implements ISandboxProvider {
  readonly type = ESandboxType.local

  create = async (config: TSandboxConfig): Promise<ISandbox> => {
    const fs = new InMemoryFs()

    // Create standard directories
    await fs.mkdir(DefaultTempdir, { recursive: true })
    await fs.mkdir(DefaultWorkdir, { recursive: true })

    const bash = new Bash({
      fs,
      cwd: DefaultWorkdir,
      env: config.envVars || {},
      customCommands: [gitCommand],
    })

    // IsolateRunner is optional — sandbox works for shell/FS even without it
    // Call init() eagerly to validate isolated-vm is available
    let runner: IsolateRunner | null = null
    try {
      const memory = (config.options?.memory as number) || 128
      runner = new IsolateRunner({
        memory,
        bash,
        fs,
        env: config.envVars || {},
        maxTimerMs: (config.options?.maxTimerMs as number) || undefined,
      })
      await runner.init()
    } catch (err: any) {
      runner = null
      const msg = String(err?.message || ``)
      if (msg.includes(`Cannot find module`) || msg.includes(`isolated-vm`)) {
        logger.warn(
          `isolated-vm not available — sandbox running without code execution isolation`
        )
      } else {
        logger.error(
          `IsolateRunner init failed — sandbox running without code execution isolation:`,
          err
        )
      }
    }

    return new LocalSandbox(bash, fs, runner)
  }
}
