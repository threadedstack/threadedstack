import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PUT /orgs/:orgId/roles/:roleId - Update user role in org
 * Requires admin+ role in the org
 *
 * Body: { roleType: string }
 */
export const updateOrgRole: TEndpointConfig = {
  path: `/:orgId/roles/:roleId`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, roleId } = req.params
    const { role: roleType } = req.body

    if (!roleType) throw new Exception(400, `Role type is required`)

    // Check permission - requires admin+ in the org
    await checkPermission(req, EPermAction.update, EPermResource.role, { orgId })

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
