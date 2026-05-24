import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /:orgId/agents/:agentId/threads - Create a new thread for an agent
 */
export const createThread: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.thread)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id
    const { orgId, agentId } = req.params

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    const threadData = {
      ...req.body,
      orgId,
      agentId,
      userId,
    }

    const { data, error } = await db.services.thread.create(threadData)

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
