import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /_/orgs/:orgId/roles/:roleId - Remove user from org
 * Requires admin+ role in the org
 */
export const deleteOrgRole: TEndpointConfig = {
  path: `/:orgId/roles/:roleId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, roleId } = req.params

    // Check permission - requires admin+ in the org
    await checkPermission(req, EPermAction.delete, EPermResource.role, {
      orgId,
    })

    // Get existing role
    const { data: existingRole, error: fetchError } = await db.services.role.get(roleId)
    if (fetchError) throw new Exception(500, fetchError.message)
    if (!existingRole) throw new Exception(404, `Role not found`)

    // Verify role belongs to this org
    if (existingRole.orgId !== orgId)
      throw new Exception(400, `Role does not belong to this organization`)

    const { error: deleteError } = await db.services.role.delete(roleId)

    if (deleteError) throw new Exception(500, deleteError.message)

    res.status(200).json({ data: { success: true } })
  },
}
