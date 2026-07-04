import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /:orgId/agents/:agentId/memories/:memoryId - Delete a memory.
 */
export const deleteMemory: TEndpointConfig = {
  path: `/:memoryId`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.memory)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, agentId, memoryId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)
    if (!memoryId) throw new Exception(400, `memoryId is required`)

    const { data: existing, error: getErr } = await db.services.memory.get(memoryId)
    if (getErr) throw new Exception(500, getErr.message)
    if (!existing || existing.orgId !== orgId || existing.agentId !== agentId)
      throw new Exception(404, `Memory not found`)

    const { error } = await db.services.memory.delete(memoryId)
    if (error) throw new Exception(500, error.message)

    res.json({ data: { id: memoryId } })
  },
}
