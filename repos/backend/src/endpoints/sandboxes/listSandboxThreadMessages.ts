import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const listSandboxThreadMessages: TEndpointConfig = {
  path: `/:id/threads/:threadId/messages`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.message)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { threadId, id: sandboxId, orgId } = req.params
    const userId = req.user?.id

    if (!orgId) throw new Exception(400, `orgId parameter required`)
    if (!sandboxId) throw new Exception(400, `sandboxId parameter required`)
    if (!userId) throw new Exception(401, `Authentication required`)

    const { data: thread, error: tErr } = await db.services.thread.get(threadId)
    if (tErr) throw new Exception(500, tErr.message)
    if (!thread) throw new Exception(404, `Thread not found`)

    if (thread.orgId !== orgId) throw new Exception(404, `Thread not found`)
    if (thread.sandboxId !== sandboxId) throw new Exception(404, `Thread not found`)
    if (thread.userId !== userId) throw new Exception(403, `Access denied`)

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.message.listByThread(threadId, {
      limit,
      offset,
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}
