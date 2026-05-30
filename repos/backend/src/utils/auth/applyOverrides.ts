import type { TDatabase } from '@tdsk/database'
import type { TOverrideEntry } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'

export const applyOverrides = async (
  db: TDatabase,
  overrides: TOverrideEntry[],
  opts: { userId: string; projectId: string; grantedBy: string }
): Promise<string[]> => {
  const warnings: string[] = []
  for (const po of overrides) {
    const { error: poErr } = await db.services.permissionOverride.create({
      effect: po.effect,
      reason: po.reason,
      userId: opts.userId,
      expiresAt: po.expiresAt,
      projectId: opts.projectId,
      grantedBy: opts.grantedBy,
      permission: po.permission,
    })
    if (poErr) {
      logger.error(`Failed to create permission override:`, poErr)
      warnings.push(`Failed to set ${po.permission} override`)
    }
  }
  return warnings
}
