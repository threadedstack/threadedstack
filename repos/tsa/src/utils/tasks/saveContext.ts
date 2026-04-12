import type { TTsaConfig } from '@TSA/types'

import { ConfigService } from '@TSA/services/config'

/**
 * Persists resolved org + project IDs to the global TSA config.
 * No-op when both values already match the current config.
 */
export const saveContext = (
  config: TTsaConfig,
  orgId: string,
  projectId: string
): void => {
  if (config.org === orgId && config.project === projectId) return
  try {
    ConfigService.saveGlobal({ ...config, org: orgId, project: projectId })
  } catch (err) {
    process.stderr.write(`Warning: failed to save config: ${(err as Error).message}\n`)
  }
}
