import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PUT /Projects/:id - Update an existing Project
 * User must be a member of the organization to update projects
 */
export const updateProject: TEndpointConfig = {
  path: `/:projectId`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { projectId } = req.params
    const { db } = req.app.locals
    const updates = req.body

    // First get the project to find its orgId
    const { data: existing, error: getError } = await db.services.project.get(projectId)

    if (getError) throw new Exception(500, getError.message)

    if (!existing) throw new Exception(404, `Project not found`)

    // Check permission - user must be member of org to update project
    await checkPermission(req, EPermAction.update, EPermResource.project, {
      orgId: existing.orgId,
    })

    // Update the project
    const { data, error } = await db.services.project.update({
      ...updates,
      id: projectId,
    })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
