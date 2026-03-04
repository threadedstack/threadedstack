import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PUT /:orgId/agents/:agentId/threads/:id
 * Update a thread (name, meta, public)
 */
export const updateThread: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id, agentId } = req.params
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data: thread, error: tErr } = await db.services.thread.get(id)
    if (tErr)
      throw new Exception(500, tErr instanceof Error ? tErr.message : String(tErr))
    if (!thread) throw new Exception(404, `Thread not found`)

    if (thread.agentId !== agentId) throw new Exception(404, `Thread not found`)

    await checkPermission(req, EPermAction.update, EPermResource.thread, {
      orgId: thread.orgId,
    })

    if (thread.userId !== userId) throw new Exception(403, `Access denied`)

    const { name, meta, public: isPublic } = req.body
    const updateData = {
      id,
      ...(name !== undefined && { name }),
      ...(meta !== undefined && { meta }),
      ...(isPublic !== undefined && { public: isPublic }),
    }

    const { data, error } = await db.services.thread.update(updateData as any)

    if (error)
      throw new Exception(500, error instanceof Error ? error.message : String(error))

    res.status(200).json({ data })
  },
}
