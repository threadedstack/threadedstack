import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { ERoleType } from '@tdsk/domain'
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

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // Check if user is super admin
    const userRole = await getUserRole(req, {})
    const isSuperAdmin = userRole === ERoleType.superAdmin

    // Get all projects
    const { data, error } = await db.services.project.list()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    let projects = data || []

    // Super admins see everything
    if (isSuperAdmin) {
      if (orgId) {
        projects = projects.filter((p: any) => p.orgId === orgId)
      }
      res.status(200).json({ data: projects })
      return
    }

    // Regular users: get their orgs and filter projects
    const { data: userOrgIds } = await db.services.role.getUserOrgs(userId)

    if (!userOrgIds || userOrgIds.length === 0) {
      res.status(200).json({ data: [] })
      return
    }

    // Filter projects to only those in user's orgs
    projects = projects.filter((p: any) => userOrgIds.includes(p.orgId))

    // Further filter by orgId if provided
    if (orgId) {
      projects = projects.filter((p: any) => p.orgId === orgId)
    }

    res.status(200).json({ data: projects })
  },
}
