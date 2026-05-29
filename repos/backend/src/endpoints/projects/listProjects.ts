import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { parsePagination } from '@TBE/utils/pagination'
import { hasMinRole, isSuperAdmin, ERoleType, Exception } from '@tdsk/domain'

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
    const orgId = req.params.orgId
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { limit, offset } = parsePagination(req)

    if (orgId) {
      const { data: orgRole, error: roleErr } = await db.services.role.getOrgRole(
        userId,
        orgId
      )
      if (roleErr)
        throw new Exception(500, `Failed to resolve org role: ${roleErr.message}`)

      if (
        isSuperAdmin(req.user?.role as ERoleType) ||
        (orgRole && hasMinRole(orgRole.type as ERoleType, ERoleType.admin))
      ) {
        const { data, error } = await db.services.project.list({
          limit,
          offset,
          where: { orgId },
        })
        if (error) throw new Exception(500, error.message)
        res.status(200).json({ data: data || [], limit, offset })
        return
      }
    }

    const { error: roleError, data: userProjectIds } =
      await db.services.role.getUserProjects(userId)

    if (roleError) throw new Exception(500, roleError.message)

    if (!userProjectIds?.length) {
      res.status(200).json({ data: [], limit, offset })
      return
    }

    const whereClause = orgId ? { orgId, id: userProjectIds } : { id: userProjectIds }

    const { data, error } = await db.services.project.list({
      limit,
      offset,
      where: whereClause,
    })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}
