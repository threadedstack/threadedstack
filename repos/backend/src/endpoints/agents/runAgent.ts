import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireAgentAccess } from '@TBE/utils/auth/requireAgentAccess'
import { AgentEndpoint } from '@TBE/services/endpoints/agentEndpoint'

/**
 * POST /agents/:id/run - Run an agent with SSE streaming
 * Body: { prompt: string, threadId?: string }
 *
 * If threadId is provided, continues an existing conversation.
 * If not, creates a new thread.
 *
 * Response: Server-Sent Events stream
 */
export const runAgent: TEndpointConfig = {
  path: `/:id/run`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.exec, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const agentId = req.params.id
    const userId = req.user?.id
    const { prompt, threadId, providerId, projectId: bodyProjectId } = req.body
    const projectId = req.params.projectId || bodyProjectId

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!prompt) throw new Exception(400, `prompt is required`)

    const { data: agentData, error: agentErr } = await db.services.agent.get(agentId)
    if (agentErr) throw new Exception(500, agentErr.message)
    if (!agentData) throw new Exception(404, `Agent not found`)

    await requireAgentAccess(req, agentId, agentData.orgId, agentData)

    const agentEndpoint = new AgentEndpoint(db)
    await agentEndpoint.run(req, res, {
      agentId,
      prompt,
      userId,
      threadId,
      projectId,
      providerId,
    })
  },
}
