import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'
import { parsePagination } from '@TBE/utils/pagination'

/**
 * GET /orgs/:orgId/projects/:projectId/members - List all members of a project
 * Requires org membership (any org member can view project members)
 */
export const listProjectMembers: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId, projectId } = req.params
    const { db } = req.app.locals

    // Check org membership first (any org member can see project members)
    await requireOrgMember(req, orgId)

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.role.getProjectMembers(projectId, {
      limit,
      offset,
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data, limit, offset })
  },
}
