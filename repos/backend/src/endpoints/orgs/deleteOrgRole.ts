import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /_/orgs/:orgId/roles/:roleId - Remove user from org
 * Requires admin+ role in the org
 */
export const deleteOrgRole: TEndpointConfig = {
  path: `/:orgId/roles/:roleId`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.role)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, roleId } = req.params

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
