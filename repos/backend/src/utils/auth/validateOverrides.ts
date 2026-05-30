import type { TRequest } from '@TBE/types'
import type { TOverrideEntry } from '@tdsk/domain'
import { resolveEffectivePermissions } from '@TBE/utils/auth/resolveEffectivePermissions'
import { Exception, isValidEffect, isValidPermission } from '@tdsk/domain'

export const validateOverrides = async (
  overrides: TOverrideEntry[],
  req: TRequest,
  orgId: string
): Promise<void> => {
  const callerPerms = overrides.some((po) => po.effect === 'grant')
    ? await resolveEffectivePermissions(req, { orgId })
    : null

  for (const po of overrides) {
    if (!isValidPermission(po.permission))
      throw new Exception(400, `Invalid permission: ${po.permission}`)
    if (!isValidEffect(po.effect))
      throw new Exception(400, `Invalid effect: ${po.effect}. Must be 'grant' or 'deny'`)
    if (po.effect === 'grant') {
      if (!callerPerms) throw new Exception(500, `Failed to resolve caller permissions`)
      if (callerPerms !== 'super' && !callerPerms.has(po.permission)) {
        throw new Exception(
          403,
          `Cannot grant a permission you do not have: ${po.permission}`,
          'FORBIDDEN'
        )
      }
    }
  }
}
