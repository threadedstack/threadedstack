import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * POST /:orgId/agents/:agentId/threads - Create a new thread for an agent
 */
export const createThread: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id
    const { orgId, agentId } = req.params

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    await checkPermission(req, EPermAction.create, EPermResource.thread, {
      orgId,
    })

    const threadData = {
      ...req.body,
      orgId,
      agentId,
      userId,
    }

    const { data, error } = await db.services.thread.create(threadData)

    if (error) throw new Exception(500, error)

    res.status(201).json({ data })
  },
}
