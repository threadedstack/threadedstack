import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /Projects/:id - Delete an Project
 * User must be an admin of the organization to delete projects
 */
export const deleteProject: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    // First get the project to find its orgId
    const { data: existing, error: getError } = await db.services.project.get(id)
    if (getError) throw new Exception(500, getError.message)
    if (!existing) throw new Exception(404, `Project not found`)

    // Check permission - user must be admin of org to delete project
    await checkPermission(req, EPermAction.delete, EPermResource.project, {
      orgId: existing.orgId,
    })

    // Delete the project
    const { data, error } = await db.services.project.delete(id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { success: true, id } })
  },
}
