import type {
  IMutagenClient,
  TSyncRule,
  TSandboxSyncDefaults,
  TSyncSession,
} from '@tdsk/domain'

import { resolveIgnores } from '@TRL/services/sync/ignoreResolver'
import { DefSyncTarget, DefSyncMode } from '@TRL/constants/sync'

export class SyncManager {
  #client: IMutagenClient

  constructor(client: IMutagenClient) {
    this.#client = client
  }

  async startAll(
    sandboxId: string,
    orgId: string,
    rules: TSyncRule[],
    sandboxDefaults: TSandboxSyncDefaults | undefined,
    configDefaultIgnores?: string[],
    skipDefaults?: boolean
  ): Promise<TSyncSession[]> {
    await this.#client.ensureDaemon()

    const existing = await this.#client.listSessions({ sandboxId })

    const sessions: TSyncSession[] = []

    for (const rule of rules) {
      // listSessions already filters by sandboxId via label selector.
      // Match by name since session name === rule name.
      const hasExisting = existing.some((s) => s.name === rule.name)

      if (hasExisting) continue

      const ignores = resolveIgnores({
        skipDefaults,
        configDefaultIgnores,
        ruleIgnores: rule.ignores,
        sandboxIgnores: sandboxDefaults?.ignores,
      })

      const session = await this.#client.createSession({
        ignores,
        sandboxId,
        name: rule.name,
        source: rule.source,
        mode: rule.mode || DefSyncMode,
        target: rule.target || DefSyncTarget,
        labels: { sandboxId, ruleName: rule.name, orgId },
      })

      sessions.push(session)
    }

    return sessions
  }

  async stopAll(sandboxId: string): Promise<void> {
    const sessions = await this.#client.listSessions({ sandboxId })
    const errors: string[] = []
    for (const session of sessions) {
      try {
        await this.#client.terminateSession(session.id)
      } catch (err) {
        errors.push(`${session.name || session.id}: ${(err as Error).message}`)
      }
    }
    if (errors.length) {
      throw new Error(
        `Failed to terminate ${errors.length} session(s): ${errors.join(`; `)}`
      )
    }
  }

  async flushAll(sandboxId: string): Promise<void> {
    const sessions = await this.#client.listSessions({ sandboxId })
    const errors: string[] = []
    for (const session of sessions) {
      try {
        await this.#client.flushSession(session.id)
      } catch (err) {
        errors.push(`${session.name || session.id}: ${(err as Error).message}`)
      }
    }
    if (errors.length) {
      throw new Error(`Failed to flush ${errors.length} session(s): ${errors.join(`; `)}`)
    }
  }

  async status(sandboxId?: string): Promise<TSyncSession[]> {
    const labels = sandboxId ? { sandboxId } : undefined
    return this.#client.listSessions(labels)
  }
}
