import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /:orgId/agents/:agentId/threads/:id - Delete a thread
 * Only the thread owner can delete it; validates it belongs to the agent
 */
export const deleteThread: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.thread)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id, agentId } = req.params
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data: thread, error: getError } = await db.services.thread.get(id)

    if (getError || !thread) throw new Exception(404, `Thread not found`)

    if (thread.agentId !== agentId) throw new Exception(404, `Thread not found`)

    if (thread.userId !== userId) throw new Exception(403, `Access denied`)

    const { data, error } = await db.services.thread.delete(id)

    if (error) throw new Exception(500, error)

    res.status(200).json({ data })
  },
}
