import type { SyncManager } from '@TSA/services/sync/syncManager'

const entries = new Map<string, SyncManager>()

export const registerSyncCleanup = (sandboxId: string, manager: SyncManager): void => {
  entries.set(sandboxId, manager)
}

export const clearSyncCleanup = (): void => {
  entries.clear()
}

export const runSyncCleanup = async (): Promise<boolean> => {
  const snapshot = [...entries.entries()]
  entries.clear()

  if (snapshot.length === 0) return false

  for (const [sandboxId, manager] of snapshot) {
    try {
      await manager.stopAll(sandboxId)
    } catch (err) {
      process.stderr.write(
        `Warning: sync cleanup failed for ${sandboxId}: ${(err as Error).message}\n`
      )
    }
  }

  return true
}
