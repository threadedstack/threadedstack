import type { ISandboxProvider, ISandbox, TSandboxConfig } from '@tdsk/domain'

export type TTSAgentOpts = {
  sandboxProvider: ISandboxProvider
}

export class TSAgent {
  private sandboxProvider: ISandboxProvider
  private activeSandboxes = new Map<string, ISandbox>()

  constructor(opts: TTSAgentOpts) {
    this.sandboxProvider = opts.sandboxProvider
  }

  async createSandbox(sessionId: string, config: TSandboxConfig): Promise<ISandbox> {
    const existing = this.activeSandboxes.get(sessionId)
    if (existing) return existing

    const sandbox = await this.sandboxProvider.create(config)
    this.activeSandboxes.set(sessionId, sandbox)
    return sandbox
  }

  async getSandbox(sessionId: string): Promise<ISandbox | undefined> {
    return this.activeSandboxes.get(sessionId)
  }

  async destroySandbox(sessionId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(sessionId)
    if (sandbox) {
      try {
        await sandbox.close()
      } catch {
        // Sandbox may already be destroyed
      }
      this.activeSandboxes.delete(sessionId)
    }
  }

  async cleanup(): Promise<void> {
    const closePromises = Array.from(this.activeSandboxes.values()).map((sandbox) =>
      sandbox.close().catch(() => {})
    )
    await Promise.all(closePromises)
    this.activeSandboxes.clear()
  }

  getStats(): { activeSandboxes: number } {
    return {
      activeSandboxes: this.activeSandboxes.size,
    }
  }
}
