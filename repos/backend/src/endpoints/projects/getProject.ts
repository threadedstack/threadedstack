import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'

/**
 * GET /Projects/:id - Get Project by ID
 * User must be a member of the project's organization
 */
export const getProject: TEndpointConfig = {
  path: `/:projectId`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { projectId } = req.params
    const { db } = req.app.locals

    // First get the project to find its orgId
    const { data, error } = await db.services.project.get(projectId)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Project not found`)

    // Check if user is member of the project's org
    await requireOrgMember(req, data.orgId)

    res.status(200).json({ data })
  },
}
