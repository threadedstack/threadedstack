import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TPermAction, TPermResource, TPermission } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { resolveEffectivePermissions } from '@TBE/utils/auth/resolveEffectivePermissions'

/**
 * POST /:orgId/overrides - Create a permission override
 * Requires role:manage permission (admin+)
 * Body: { userId, permission, effect, reason?, expiresAt?, projectId? }
 */
export const createOverride: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.manage, EPermResource.role)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params
    const { userId, permission, effect, reason, expiresAt, projectId } = req.body
    const resolvedProjectId = req.params.projectId || projectId

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!userId) throw new Exception(400, `userId is required`)
    if (!permission) throw new Exception(400, `permission is required`)
    if (!effect || !['grant', 'deny'].includes(effect))
      throw new Exception(400, `effect must be "grant" or "deny"`)

    // Validate permission format against known resource:action combinations
    const validResources = new Set<string>(Object.values(EPermResource))
    const validActions = new Set<string>(Object.values(EPermAction))
    const parts = permission.split(':')
    if (
      parts.length !== 2 ||
      !validResources.has(parts[0] as TPermResource) ||
      !validActions.has(parts[1] as TPermAction)
    )
      throw new Exception(
        400,
        `Invalid permission format: "${permission}". Must be "resource:action"`
      )

    // Verify the target user is a member of the org
    const { data: isMember, error: memberErr } = await db.services.role.isOrgMember(
      userId,
      orgId
    )
    if (memberErr)
      throw new Exception(500, `Failed to verify org membership: ${memberErr.message}`)
    if (!isMember)
      throw new Exception(400, `Target user is not a member of this organization`)

    // Verify the caller holds the permission they are trying to grant
    if (effect === 'grant') {
      const callerPerms = await resolveEffectivePermissions(req, { orgId })
      if (callerPerms !== 'super' && !callerPerms.has(permission as TPermission)) {
        throw new Exception(
          403,
          `Cannot grant a permission you do not have: ${permission}`,
          `FORBIDDEN`
        )
      }
    }

    const overrideData = {
      userId,
      effect,
      permission,
      grantedBy: req.user!.id,
      ...(resolvedProjectId ? { projectId: resolvedProjectId } : { orgId }),
      ...(reason && { reason }),
      ...(expiresAt && { expiresAt }),
    }

    const { data, error } = await db.services.permissionOverride.create(overrideData)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
