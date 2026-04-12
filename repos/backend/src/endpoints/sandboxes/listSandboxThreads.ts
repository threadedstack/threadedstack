import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { parsePagination } from '@TBE/utils/pagination'

/**
 * GET /:orgId/sandboxes/:id/threads - List threads for a sandbox
 */
export const listSandboxThreads: TEndpointConfig = {
  path: `/:id/threads`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, id: sandboxId } = req.params
    const userId = req.user?.id

    if (!orgId) throw new Exception(400, `orgId parameter required`)
    if (!sandboxId) throw new Exception(400, `sandboxId parameter required`)
    if (!userId) throw new Exception(401, `Authentication required`)

    await checkPermission(req, EPermAction.read, EPermResource.thread, {
      orgId,
    })

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.thread.list({
      limit,
      offset,
      where: { orgId, sandboxId },
    })

    if (error)
      throw new Exception(500, error instanceof Error ? error.message : String(error))

    res.status(200).json({ data: data || [], limit, offset })
  },
}
