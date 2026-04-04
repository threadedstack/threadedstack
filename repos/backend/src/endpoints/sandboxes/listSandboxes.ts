import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { parsePagination } from '@TBE/utils/pagination'

export const listSandboxes: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const orgId = req.params.orgId || (req.query.orgId as string)

    if (!orgId) throw new Exception(400, `orgId is required`)

    await checkPermission(req, EPermAction.read, EPermResource.sandbox, { orgId })

    const { limit, offset } = parsePagination(req)
    const projectId = req.query.projectId as string | undefined

    const where: Record<string, any> = { orgId }
    if (projectId) where.projectId = projectId

    const { data, error } = await db.services.sandbox.list({
      limit,
      offset,
      where,
    })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}
