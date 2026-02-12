import type { ISandboxProvider, ISandbox, TSandboxConfig } from '@tdsk/domain'
import type { TMutexOpts } from './types/mutex.types'

import { Mutex } from './services/mutex'

export type TTSAgentOpts = {
  sandboxProvider: ISandboxProvider
  mutex?: TMutexOpts
}

export class TSAgent {
  mutex: Mutex
  private sandboxProvider: ISandboxProvider
  private activeSandboxes = new Map<string, ISandbox>()

  constructor(opts: TTSAgentOpts) {
    this.sandboxProvider = opts.sandboxProvider
    this.mutex = new Mutex(opts.mutex)
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
    this.mutex.clearAll()
  }

  getStats(): { activeLocks: number; activeSandboxes: number } {
    return {
      activeLocks: this.mutex.getActiveLocks(),
      activeSandboxes: this.activeSandboxes.size,
    }
  }
}
