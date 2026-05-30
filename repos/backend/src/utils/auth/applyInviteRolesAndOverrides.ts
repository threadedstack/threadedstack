import type { TDatabase } from '@tdsk/database'

import { logger } from '@TBE/utils/logger'
import type { Invitation } from '@tdsk/domain'

/**
 * Applies project roles and permission overrides from an invitation to the user.
 * Both operations are non-fatal — failures are collected in warnings.
 */
export const applyInviteRolesAndOverrides = async (
  db: TDatabase,
  invitation: Invitation,
  userId: string,
  warnings: string[]
): Promise<void> => {
  if (invitation.projectRoles?.length) {
    for (const pr of invitation.projectRoles) {
      const { error: prErr } = await db.services.role.create({
        projectId: pr.projectId,
        userId,
        type: pr.roleType,
      })
      if (prErr) {
        logger.error(`Failed to create project role for ${pr.projectId}:`, prErr)
        warnings.push(`Failed to set up project access for ${pr.projectId}`)
      }
    }
  }

  if (invitation.permissionOverrides?.length) {
    for (const po of invitation.permissionOverrides) {
      const { error: poErr } = await db.services.permissionOverride.create({
        userId,
        effect: po.effect,
        reason: po.reason,
        expiresAt: po.expiresAt,
        permission: po.permission,
        grantedBy: invitation.invitedBy,
        ...(po.projectId ? { projectId: po.projectId } : { orgId: invitation.orgId }),
      })
      if (poErr) {
        logger.error(`Failed to create permission override:`, poErr)
        warnings.push(`Failed to set ${po.permission} permission override`)
      }
    }
  }
}
