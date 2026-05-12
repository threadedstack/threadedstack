import type { SyncManager } from '@TSA/services/sync/syncManager'

type TCleanupEntry = { manager: SyncManager; instanceId?: string }

const entries = new Map<string, TCleanupEntry>()

export const registerSyncCleanup = (
  sandboxId: string,
  manager: SyncManager,
  instanceId?: string
): void => {
  entries.set(sandboxId, { manager, instanceId })
}

export const clearSyncCleanup = (): void => {
  entries.clear()
}

export const runSyncCleanup = async (): Promise<boolean> => {
  const snapshot = [...entries.entries()]
  entries.clear()

  if (snapshot.length === 0) return false

  for (const [sandboxId, { manager, instanceId }] of snapshot) {
    try {
      await manager.stopAll(sandboxId, instanceId)
    } catch (err) {
      process.stderr.write(
        `Warning: sync cleanup failed for ${sandboxId}: ${(err as Error).message}\n`
      )
    }
  }

  return true
}
