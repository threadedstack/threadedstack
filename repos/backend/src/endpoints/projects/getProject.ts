import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /Projects/:id - Get Project by ID
 * User must be a member of the project's organization
 */
export const getProject: TEndpointConfig = {
  path: `/:projectId`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.project)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { projectId } = req.params
    const { db } = req.app.locals

    const projectResult = await db.services.project.get(projectId)

    if (projectResult.error) throw new Exception(500, projectResult.error.message)
    if (!projectResult.data) throw new Exception(404, `Project not found`)

    const countsResult = await db.services.project.getCounts(projectId)

    res.status(200).json({
      data: {
        ...projectResult.data,
        counts: countsResult.data,
      },
    })
  },
}
