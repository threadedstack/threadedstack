import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'

/**
 * GET /orgs/:id - Get org by ID
 * User must be a member of the org to view it
 */
export const getOrg: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id: orgId } = req.params
    const { db } = req.app.locals

    // Check membership first
    await requireOrgMember(req, orgId)

    const { data, error } = await db.services.org.get(orgId)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      res.status(404).json({ error: `Org not found` })
      return
    }

    res.status(200).json({ data })
  },
}
