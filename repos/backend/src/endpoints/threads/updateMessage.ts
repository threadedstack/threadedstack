import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /:orgId/agents/:agentId/threads/:threadId/messages/:messageId
 * Update a message within a thread
 */
export const updateMessage: TEndpointConfig = {
  path: `/:threadId/messages/:messageId`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.message)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { threadId, messageId, agentId } = req.params
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data: thread, error: tErr } = await db.services.thread.get(threadId)
    if (tErr) throw new Exception(500, tErr.message)
    if (!thread) throw new Exception(404, `Thread not found`)

    if (thread.agentId !== agentId) throw new Exception(404, `Thread not found`)

    if (thread.userId !== userId) throw new Exception(403, `Access denied`)

    const { data: message, error: mErr } = await db.services.message.get(messageId)
    if (mErr) throw new Exception(500, mErr.message)
    if (!message) throw new Exception(404, `Message not found`)

    if (message.threadId !== threadId)
      throw new Exception(404, `Message not found in this thread`)

    const { content, type, meta } = req.body
    const updateData = {
      id: messageId,
      ...(content !== undefined && { content }),
      ...(type !== undefined && { type }),
      ...(meta !== undefined && { meta }),
    }

    const { data, error } = await db.services.message.update(updateData)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
