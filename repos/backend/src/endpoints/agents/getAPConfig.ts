import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:agentId/config - Get agent project-level config overrides
 * Returns the agentProjects row for the given agent+project pair
 */
export const getAPConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { agentId, projectId } = req.params

    const { data: config, error } = await db.services.agent.getProjectConfig(
      agentId,
      projectId
    )

    if (error)
      throw new Exception(
        404,
        `No config found for agent ${agentId} in project ${projectId}`
      )

    res.status(200).json({ data: config })
  },
}
