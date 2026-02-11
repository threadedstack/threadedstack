import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { ERoleType } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'
import { parsePagination } from '@TBE/utils/pagination'
import { getUserRole } from '@TBE/utils/auth/checkPermission'

/**
 * GET /Projects - List all Projects
 * Filters projects based on user's org membership
 * Super admins see all projects
 */
export const listProjects: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, auth } = req.app.locals
    const orgId = req.params.orgId
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const userRole = await getUserRole(req, {})

    const { limit, offset } = parsePagination(req)

    // Note: Super admins intentionally see all projects across all orgs.
    // This is by design for platform administration. Regular users
    // are filtered to only see projects in their member orgs.
    if (userRole === ERoleType.super) {
      const { data, error } = orgId
        ? await db.services.project.list({
            where: { orgId: orgId as string },
            limit,
            offset,
          })
        : await db.services.project.list({ limit, offset })

      if (error) throw new Exception(500, error.message)

      res.status(200).json({ data: data || [], limit, offset })
      return
    }

    // Regular users: get their orgs and filter projects at DB level
    const { data: userOrgIds } = await db.services.role.getUserOrgs(userId)

    if (!userOrgIds || userOrgIds.length === 0) {
      res.status(200).json({ data: [], limit, offset })
      return
    }

    const whereClause = orgId ? { orgId: orgId } : { orgId: userOrgIds }
    const { data, error } = await db.services.project.list({
      limit,
      offset,
      where: whereClause,
    })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}
