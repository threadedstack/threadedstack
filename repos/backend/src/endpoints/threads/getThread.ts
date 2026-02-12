import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /:orgId/agents/:agentId/threads/:id - Get a thread by ID
 * Validates the thread belongs to the agent and the user
 */
export const getThread: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id, agentId } = req.params
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data: thread, error } = await db.services.thread.get(id)

    if (error || !thread) throw new Exception(404, `Thread not found`)

    // Validate thread belongs to this agent
    if (thread.agentId !== agentId) throw new Exception(404, `Thread not found`)

    await checkPermission(req, EPermAction.read, EPermResource.thread, {
      orgId: thread.orgId,
    })

    if (thread.userId !== userId) throw new Exception(403, `Access denied`)

    res.status(200).json({ data: thread })
  },
}
