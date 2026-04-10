import type { Component } from '@mariozechner/pi-tui'
import type { TConnectionStatus } from '@TSA/types'

import chalk from 'chalk'
import { themed } from '@TSA/theme'

export type TStatusMetadata = {
  orgName?: string
  agentName?: string
  threadId?: string | null
  connection: TConnectionStatus
  projectName?: string
  modelName?: string
  providerName?: string
}

const ConnectionDots: Record<TConnectionStatus, string> = {
  connected: chalk.green(`\u25CF`),
  reconnecting: chalk.yellow(`\u25CF`),
  disconnected: chalk.red(`\u25CF`),
}

/**
 * PiTuiStatus — renders a single-line status bar showing connection status,
 * agent name, thread ID, model, and provider.
 */
export class PiTuiStatus implements Component {
  #metadata: TStatusMetadata = {
    connection: `disconnected`,
  }

  setStatus(metadata: Partial<TStatusMetadata>): void {
    this.#metadata = { ...this.#metadata, ...metadata }
  }

  invalidate(): void {
    // No cache to invalidate
  }

  render(width: number): string[] {
    const parts: string[] = []

    // Connection dot
    const dot = ConnectionDots[this.#metadata.connection] || ConnectionDots.disconnected
    parts.push(dot)

    // Agent name
    if (this.#metadata.agentName) {
      parts.push(themed(`primary`, this.#metadata.agentName))
    }

    // Thread ID (truncated)
    if (this.#metadata.threadId) {
      const tid = this.#metadata.threadId
      const truncated = tid.length > 12 ? `${tid.slice(0, 12)}...` : tid
      parts.push(themed(`muted`, `thread:${truncated}`))
    }

    // Model name
    if (this.#metadata.modelName) {
      parts.push(themed(`secondary`, this.#metadata.modelName))
    }

    // Provider name
    if (this.#metadata.providerName) {
      parts.push(themed(`secondary`, this.#metadata.providerName))
    }

    const line = ` ${parts.join(themed(`border`, ` | `))} `
    const separator = themed(`border`, `\u2500`.repeat(Math.max(width, 1)))

    return [separator, line, separator]
  }
}
