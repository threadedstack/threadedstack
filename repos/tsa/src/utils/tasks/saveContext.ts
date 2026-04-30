import type { TTsaConfig } from '@TSA/types'

import { ConfigService } from '@TSA/services/config'

export const saveContext = (
  config: TTsaConfig,
  orgId: string,
  projectId: string,
  sandboxId?: string
): void => {
  const updates: Partial<TTsaConfig> = {}

  if (orgId !== config.org) {
    updates.org = orgId
    updates.project = projectId
    updates.sandboxId = sandboxId
  } else if (projectId !== config.project) {
    updates.project = projectId
    updates.sandboxId = sandboxId
  } else if (sandboxId && sandboxId !== config.sandboxId) {
    updates.sandboxId = sandboxId
  }

  if (Object.keys(updates).length === 0) return

  try {
    ConfigService.saveGlobal({ ...config, ...updates })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Warning: failed to save config: ${msg}\n`)
  }
}
