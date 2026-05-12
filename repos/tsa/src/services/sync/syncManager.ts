import type {
  TSyncRule,
  TSyncSession,
  IMutagenClient,
  TSyncSessionLabels,
  TSandboxSyncDefaults,
} from '@tdsk/domain'

import { resolveIgnores } from '@TSA/services/sync/ignoreResolver'
import { DefSyncTarget, DefSyncMode } from '@TSA/constants/sync'

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
    skipDefaults?: boolean,
    instanceId?: string
  ): Promise<TSyncSession[]> {
    await this.#client.ensureDaemon()

    const filterLabels: Record<string, string> = { sandboxId }
    if (instanceId) filterLabels.instanceId = instanceId
    const existing = await this.#client.listSessions(filterLabels)

    const sessions: TSyncSession[] = []
    const sshHost = instanceId ? `${sandboxId}--${instanceId}` : sandboxId

    for (const rule of rules) {
      const hasExisting = existing.some((s) => s.name === rule.name)

      if (hasExisting) continue

      const ignores = resolveIgnores({
        skipDefaults,
        configDefaultIgnores,
        ruleIgnores: rule.ignores,
        sandboxIgnores: sandboxDefaults?.ignores,
      })

      const labels: TSyncSessionLabels = {
        orgId,
        sandboxId,
        ruleName: rule.name,
        ...(instanceId && { instanceId }),
      }

      const session = await this.#client.createSession({
        labels,
        ignores,
        name: rule.name,
        sandboxId: sshHost,
        source: rule.source,
        mode: rule.mode || DefSyncMode,
        target: rule.target || DefSyncTarget,
      })

      sessions.push(session)
    }

    return sessions
  }

  async stopAll(sandboxId: string, instanceId?: string): Promise<void> {
    const labels: Record<string, string> = { sandboxId }
    if (instanceId) labels.instanceId = instanceId
    const sessions = await this.#client.listSessions(labels)
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

  async flushAll(sandboxId: string, instanceId?: string): Promise<void> {
    const labels: Record<string, string> = { sandboxId }
    if (instanceId) labels.instanceId = instanceId
    const sessions = await this.#client.listSessions(labels)
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

  async status(sandboxId?: string, instanceId?: string): Promise<TSyncSession[]> {
    const labels: Record<string, string> | undefined = sandboxId
      ? instanceId
        ? { sandboxId, instanceId }
        : { sandboxId }
      : undefined
    return this.#client.listSessions(labels)
  }
}
