import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { enforceQuota } from '@TBE/middleware/enforceQuota'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /:orgId/agents/:agentId/threads/:threadId/messages - Create a message
 *
 * Used by TSA to persist messages during local agent execution.
 * Body: { type: "user"|"assistant", content: TMessageContent[] }
 */
export const createMessage: TEndpointConfig = {
  path: `/:threadId/messages`,
  method: EPMethod.Post,
  middleware: [
    authorize(EPermAction.create, EPermResource.message),
    enforceQuota(`messages`),
  ],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id
    const { threadId, agentId } = req.params

    if (!userId) throw new Exception(401, `Authentication required`)

    // Validate thread exists and belongs to this agent
    const { data: thread, error: tErr } = await db.services.thread.get(threadId)
    if (tErr) throw new Exception(500, tErr.message)
    if (!thread) throw new Exception(404, `Thread not found`)

    if (thread.agentId !== agentId) throw new Exception(404, `Thread not found`)

    if (thread.userId !== userId) throw new Exception(403, `Access denied`)

    const { type, content } = req.body
    if (!type) throw new Exception(400, `type is required`)
    if (!content) throw new Exception(400, `content is required`)

    const { data, error } = await db.services.message.create({
      threadId,
      type,
      content,
      orgId: thread.orgId,
    })

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
