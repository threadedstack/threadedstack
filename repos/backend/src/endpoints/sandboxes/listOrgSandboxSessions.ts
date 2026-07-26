import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TSandboxSessionStatus } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const listOrgSandboxSessions: TEndpointConfig = {
  path: `/sessions`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params

    if (!orgId) throw new Exception(400, `orgId parameter required`)

    const status = (req.query.status as TSandboxSessionStatus) || `connected`
    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.sandboxSession.listByOrg(orgId, {
      limit,
      offset,
      where: { status },
    })

    if (error)
      throw new Exception(500, error instanceof Error ? error.message : String(error))

    res.status(200).json({ data: data || [], limit, offset })
  },
}
