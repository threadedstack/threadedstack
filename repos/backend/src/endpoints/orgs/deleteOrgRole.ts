import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

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

    if (fetchError) {
      res.status(500).json({ error: fetchError.message })
      return
    }

    if (!existingRole) {
      res.status(404).json({ error: 'Role not found' })
      return
    }

    // Verify role belongs to this org
    if (existingRole.orgId !== orgId) {
      res.status(400).json({ error: 'Role does not belong to this organization' })
      return
    }

    const { error: deleteError } = await db.services.role.delete(roleId)

    if (deleteError) {
      res.status(500).json({ error: deleteError.message })
      return
    }

    res.status(200).json({ success: true })
  },
}
