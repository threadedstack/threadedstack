import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/agents/:agentId/threads/:threadId/messages
 * List messages for a thread, scoped to the agent
 */
export const listMessages: TEndpointConfig = {
  path: `/:threadId/messages`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.message)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { threadId, agentId } = req.params
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data: thread, error: tErr } = await db.services.thread.get(threadId)
    if (tErr || !thread) throw new Exception(404, `Thread not found`)

    if (thread.agentId !== agentId) throw new Exception(404, `Thread not found`)

    if (thread.userId !== userId) throw new Exception(403, `Access denied`)

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.message.listByThread(threadId, {
      limit,
      offset,
    })

    if (error) throw new Exception(500, error)

    res.status(200).json({ data: data || [], limit, offset })
  },
}
