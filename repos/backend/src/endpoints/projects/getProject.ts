import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'

/**
 * GET /Projects/:id - Get Project by ID
 * User must be a member of the project's organization
 */
export const getProject: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    // First get the project to find its orgId
    const { data, error } = await db.services.project.get(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      res.status(404).json({ error: `Project not found` })
      return
    }

    // Check if user is member of the project's org
    await requireOrgMember(req, data.orgId)

    res.status(200).json({ data })
  },
}
