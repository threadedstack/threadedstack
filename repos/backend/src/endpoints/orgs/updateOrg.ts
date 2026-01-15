import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /orgs/:id - Update an existing org
 * Requires admin+ role in the org
 */
export const updateOrg: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id: orgId } = req.params
    const { db } = req.app.locals
    const orgData = req.body

    // Check permission first
    await checkPermission(req, EPermAction.update, EPermResource.org, { orgId })

    // Check if org exists
    const { data: existingOrg, error: getError } = await db.services.org.get(orgId)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existingOrg) {
      res.status(404).json({ error: `Org not found` })
      return
    }

    const { data, error } = await db.services.org.update({ ...orgData, id: orgId })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}
