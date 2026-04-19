import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /:orgId/agents/:agentId/threads/:threadId/branch
 * Branch a thread at a specific message point
 */
export const branchThread: TEndpointConfig = {
  path: `/:threadId/branch`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.thread)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { threadId, agentId } = req.params
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { messageId } = req.body
    if (!messageId) throw new Exception(400, `messageId is required`)

    const { data: thread, error: tErr } = await db.services.thread.get(threadId)
    if (tErr || !thread) throw new Exception(404, `Thread not found`)

    if (thread.agentId !== agentId) throw new Exception(404, `Thread not found`)

    if (thread.userId !== userId) throw new Exception(403, `Access denied`)

    const { data, error } = await db.services.thread.branchThread(
      threadId,
      messageId,
      userId
    )

    if (error) throw new Exception(500, error)

    res.status(201).json({ data })
  },
}
