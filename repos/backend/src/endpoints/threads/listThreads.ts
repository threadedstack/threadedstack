import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/agents/:agentId/threads - List threads for an agent
 * Scoped to the authenticated user and the specified agent
 */
export const listThreads: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.thread)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, agentId } = req.params
    const userId = req.user?.id

    if (!orgId) throw new Exception(400, `orgId parameter required`)
    if (!agentId) throw new Exception(400, `agentId parameter required`)
    if (!userId) throw new Exception(401, `Authentication required`)

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.thread.list({
      limit,
      offset,
      where: { orgId, userId, agentId },
    })

    if (error) throw new Exception(500, error)

    res.status(200).json({ data: data || [], limit, offset })
  },
}
