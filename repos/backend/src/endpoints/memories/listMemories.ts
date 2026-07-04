import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/agents/:agentId/memories - List an agent's memories (paginated)
 */
export const listMemories: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.memory)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, agentId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
    if (agentErr) throw new Exception(500, agentErr.message)
    if (!agent || agent.orgId !== orgId) throw new Exception(404, `Agent not found`)

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.memory.list({
      limit,
      offset,
      where: { orgId, agentId },
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}
