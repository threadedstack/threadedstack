import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /Projects/:id - Delete an Project
 * User must be an admin of the organization to delete projects
 */
export const deleteProject: TEndpointConfig = {
  path: `/:projectId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { projectId } = req.params
    const { db } = req.app.locals

    // First get the project to find its orgId
    const { data: existing, error: getError } = await db.services.project.get(projectId)
    if (getError) throw new Exception(500, getError.message)
    if (!existing) throw new Exception(404, `Project not found`)

    // Check permission - user must be admin of org to delete project
    await checkPermission(req, EPermAction.delete, EPermResource.project, {
      orgId: existing.orgId,
    })

    // Delete the project
    const { data, error } = await db.services.project.delete(projectId)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { success: true, id: projectId } })
  },
}
