import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { parsePagination } from '@TBE/utils/pagination'

/**
 * GET /providers - List all providers
 * Filter by orgId or projectId query param
 * User must be member of the org/project
 */
export const listProviders: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, auth } = req.app.locals
    const orgId = auth.orgId
    const projectId = req.query.projectId as string | undefined

    if (!orgId && !projectId)
      throw new Exception(400, `orgId or projectId query parameter required`)

    // Check permission to read providers in this scope
    await checkPermission(req, EPermAction.read, EPermResource.provider, {
      orgId,
      projectId,
    })

    const { limit, offset } = parsePagination(req)

    // List providers for the specified scope
    const { data, error } = await db.services.provider.list({
      where: projectId ? { projectId } : { orgId },
      limit,
      offset,
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}
