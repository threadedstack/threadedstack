import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { ERoleType } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'
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
    const { db } = req.app.locals
    const { orgId } = req.query
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const userRole = await getUserRole(req, {})

    // Super admins see everything with DB filtering
    // TODO: need to figure out if super users actually see everything
    // This is a security issue and probably not a good idea
    if (userRole === ERoleType.super) {
      const { data, error } = orgId
        ? await db.services.project.list({ where: { orgId: orgId as string } })
        : await db.services.project.list()

      if (error) throw new Exception(500, error.message)

      res.status(200).json({ data: data || [] })
      return
    }

    // Regular users: get their orgs and filter projects at DB level
    const { data: userOrgIds } = await db.services.role.getUserOrgs(userId)

    if (!userOrgIds || userOrgIds.length === 0) {
      res.status(200).json({ data: [] })
      return
    }

    const whereClause = orgId ? { orgId: orgId } : { orgId: userOrgIds }
    const { data, error } = await db.services.project.list({ where: whereClause })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [] })
  },
}
