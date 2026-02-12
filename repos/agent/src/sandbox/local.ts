import type {
  ISandbox,
  ISandboxProvider,
  TSandboxConfig,
  TSandboxResult,
} from '@tdsk/domain'

import type { IFileSystem } from 'just-bash'
import { Bash, InMemoryFs } from 'just-bash'
import { IsolateRunner } from './isolate'

/**
 * Local sandbox instance using just-bash virtual shell/filesystem
 * and isolated-vm for V8-isolated JS code execution
 * Implements ISandbox interface — drop-in replacement for E2B sandbox
 */
export class LocalSandbox implements ISandbox {
  private bash: Bash
  private fs: IFileSystem
  private isolateRunner: IsolateRunner | null
  private cwd: string

  constructor(
    bash: Bash,
    fs: IFileSystem,
    isolateRunner?: IsolateRunner | null,
    cwd = `/workspace`
  ) {
    this.bash = bash
    this.fs = fs
    this.isolateRunner = isolateRunner || null
    this.cwd = cwd
  }

  exec = async (command: string, args: string[] = []): Promise<TSandboxResult> => {
    const fullCommand = args.length > 0 ? `${command} ${args.join(` `)}` : command
    const result = await this.bash.exec(fullCommand, { cwd: this.cwd })

    return {
      success: result.exitCode === 0,
      output: result.stdout,
      error: result.stderr || undefined,
      exitCode: result.exitCode,
    }
  }

  readFile = async (path: string): Promise<string> => {
    const content = await this.fs.readFile(path, { encoding: `utf-8` })
    return typeof content === `string` ? content : content.toString()
  }

  writeFile = async (path: string, content: string): Promise<void> => {
    await this.fs.writeFile(path, content)
  }

  listDir = async (path: string): Promise<string[]> => {
    const entries = await this.fs.readdir(path)
    const result: string[] = []

    for (const entry of entries) {
      const name = typeof entry === `string` ? entry : entry.name
      const entryPath = path.endsWith(`/`) ? `${path}${name}` : `${path}/${name}`

      try {
        const stat = await this.fs.stat(entryPath)
        const isDir =
          typeof stat.isDirectory === `function` ? stat.isDirectory() : stat.isDirectory
        result.push(isDir ? `[DIR] ${name}` : name)
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
  readonly type = `local` as const

  create = async (config: TSandboxConfig): Promise<ISandbox> => {
    const fs = new InMemoryFs()

    // Create standard directories
    await fs.mkdir(`/workspace`, { recursive: true })
    await fs.mkdir(`/tmp`, { recursive: true })

    const bash = new Bash({
      fs,
      cwd: `/workspace`,
      env: config.envVars || {},
    })

    // IsolateRunner is optional — sandbox works for shell/FS even without it
    let isolateRunner: IsolateRunner | null = null
    try {
      const memoryLimit = (config.options?.memoryLimit as number) || 128
      isolateRunner = new IsolateRunner({ memoryLimit, bash, fs })
    } catch {
      // isolated-vm not available — sandbox works without code execution isolation
    }

    return new LocalSandbox(bash, fs, isolateRunner)
  }
}
