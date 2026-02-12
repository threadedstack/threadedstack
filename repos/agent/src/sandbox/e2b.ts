import type {
  ISandbox,
  ISandboxProvider,
  TSandboxConfig,
  TSandboxResult,
} from '@tdsk/domain'

import { Sandbox as E2BSandbox } from 'e2b'

/**
 * E2B sandbox instance wrapper
 * Implements ISandbox interface using E2B Firecracker microVMs
 */
export class E2bSandbox implements ISandbox {
  private sandbox: E2BSandbox

  constructor(sandbox: E2BSandbox) {
    this.sandbox = sandbox
  }

  exec = async (command: string, args: string[] = []): Promise<TSandboxResult> => {
    const fullCommand = args.length > 0 ? `${command} ${args.join(` `)}` : command
    const result = await this.sandbox.commands.run(fullCommand)

    return {
      success: result.exitCode === 0,
      output: result.stdout,
      error: result.stderr || undefined,
      exitCode: result.exitCode,
    }
  }

  readFile = async (path: string): Promise<string> => {
    return await this.sandbox.files.read(path)
  }

  writeFile = async (path: string, content: string): Promise<void> => {
    await this.sandbox.files.write(path, content)
  }

  listDir = async (path: string): Promise<string[]> => {
    const entries = await this.sandbox.files.list(path)
    return entries.map((e) => (e.type === `dir` ? `[DIR] ${e.name}` : e.name))
  }

  deleteFile = async (path: string): Promise<void> => {
    await this.sandbox.files.remove(path)
  }

  mkdir = async (path: string): Promise<void> => {
    await this.sandbox.files.makeDir(path)
  }

  fileExists = async (path: string): Promise<boolean> => {
    try {
      await this.sandbox.files.read(path)
      return true
    } catch {
      return false
    }
  }

  close = async (): Promise<void> => {
    await this.sandbox.kill()
  }
}

/**
 * E2B sandbox provider
 * Creates E2B Firecracker microVM sandbox instances
 */
export class E2bSandboxProvider implements ISandboxProvider {
  readonly type = `e2b` as const

  create = async (config: TSandboxConfig): Promise<ISandbox> => {
    const sandbox = await E2BSandbox.create(config.template, {
      apiKey: config.apiKey,
      timeoutMs: config.timeout,
      envs: config.envVars,
    })

    return new E2bSandbox(sandbox)
  }
}
