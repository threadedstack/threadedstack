import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PUT /Projects/:id - Update an existing Project
 * User must be a member of the organization to update projects
 */
export const updateProject: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const updates = req.body

    // First get the project to find its orgId
    const { data: existing, error: getError } = await db.services.project.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existing) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    // Check permission - user must be member of org to update project
    await checkPermission(req, EPermAction.update, EPermResource.project, {
      orgId: existing.orgId,
    })

    // Update the project
    const { data, error } = await db.services.project.update(id, updates)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}
