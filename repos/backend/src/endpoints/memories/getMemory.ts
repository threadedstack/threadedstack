import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/agents/:agentId/memories/:memoryId - Fetch one memory (org + agent scoped).
 */
export const getMemory: TEndpointConfig = {
  path: `/:memoryId`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.memory)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, agentId, memoryId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)
    if (!memoryId) throw new Exception(400, `memoryId is required`)

    const { data, error } = await db.services.memory.get(memoryId)
    if (error) throw new Exception(500, error.message)
    if (!data || data.orgId !== orgId || data.agentId !== agentId)
      throw new Exception(404, `Memory not found`)

    res.json({ data })
  },
}
