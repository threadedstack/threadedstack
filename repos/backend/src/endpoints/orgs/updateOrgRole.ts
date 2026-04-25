import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import {
  ERoleType,
  Exception,
  EPermAction,
  EPermResource,
  canManageRole,
} from '@tdsk/domain'

/**
 * PUT /orgs/:orgId/roles/:roleId - Update user role in org
 * Requires admin+ role in the org
 *
 * Body: { roleType: string }
 */
export const updateOrgRole: TEndpointConfig = {
  path: `/:orgId/roles/:roleId`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.role)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, roleId } = req.params
    const { roleType } = req.body

    if (!roleType) throw new Exception(400, `Role type is required`)

    const validRoles = Object.values(ERoleType) as string[]
    if (!validRoles.includes(roleType))
      throw new Exception(
        400,
        `Invalid role type. Must be one of: ${validRoles.join(', ')}`
      )

    // Validate role hierarchy — can only assign roles below your own
    const currentUserRole = await getUserRole(req, { orgId })
    if (!canManageRole(currentUserRole, roleType))
      throw new Exception(
        403,
        `You cannot assign ${roleType} role. You can only assign roles below your own.`
      )

    const { data: existing, error: fetchError } = await db.services.role.get(roleId)

    if (fetchError) throw new Exception(500, fetchError.message)

    if (!existing) throw new Exception(404, `Role not found`)

    if (existing.orgId !== orgId)
      throw new Exception(400, `Role does not belong to this organization`)

    const { data: updatedRole, error: updateError } = await db.services.role.update({
      ...existing,
      type: roleType,
    })

    if (updateError) throw new Exception(500, updateError.message)

    res.status(200).json({ data: updatedRole })
  },
}
