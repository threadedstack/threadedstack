import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { parsePagination } from '@TBE/utils/pagination'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /providers - List all providers for an org
 * Requires orgId in params
 */
export const listProviders: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)

    await checkPermission(req, EPermAction.read, EPermResource.provider, {
      orgId,
    })

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.provider.list({
      where: { orgId },
      limit,
      offset,
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}
