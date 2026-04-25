import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /orgs/:orgId/projects/:projectId/members - List all members of a project
 * Requires org membership (any org member can view project members)
 */
export const listProjectMembers: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.role)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { projectId } = req.params
    const { db } = req.app.locals

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.role.getProjectMembers(projectId, {
      limit,
      offset,
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data, limit, offset })
  },
}
