import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /orgs/:id - Update an existing org
 * Requires admin+ role in the org
 */
export const updateOrg: TEndpointConfig = {
  path: `/:orgId`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { db } = req.app.locals
    const orgData = req.body

    // Check permission first
    await checkPermission(req, EPermAction.update, EPermResource.org, { orgId })

    // Check if org exists
    const { data: existingOrg, error: getError } = await db.services.org.get(orgId)

    if (getError) throw new Exception(500, getError.message)

    if (!existingOrg) throw new Exception(404, `Org not found`)

    const { data, error } = await db.services.org.update({ ...orgData, id: orgId })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
