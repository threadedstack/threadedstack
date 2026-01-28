import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { ERoleType } from '@tdsk/domain'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { isStr } from '@keg-hub/jsutils/isStr'

/**
 * GET /domains - List all domains for an organization or project
 * Super admins can see all domains
 * Regular users can only see domains from their organizations
 */
export const listDomains: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, projectId } = req.query
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ error: `Authentication required` })
      return
    }

    if (!orgId && !projectId) {
      res
        .status(400)
        .json({ error: 'Either orgId or projectId query parameter is required' })
      return
    }

    const userRole = await getUserRole(req, {})

    let domains
    // Super admins can list any domains
    if (userRole === ERoleType.super) {
      domains = isStr(orgId)
        ? await db.services.domain.list({ where: { orgId } })
        : isStr(projectId)
          ? await db.services.domain.list({ where: { projectId } })
          : []
    } else {
      // Regular users can only list domains from their orgs
      if (isStr(projectId)) {
        // For project domains, verify user has access to the project
        const { data: project } = await db.services.project.get(projectId)
        if (!project) {
          res.status(404).json({ error: `Project not found` })
          return
        }

        // Check if user is member of the project's org
        const { data: orgIds } = await db.services.role.getUserOrgs(userId)
        if (!orgIds?.length || !orgIds.includes(project.orgId)) {
          res.status(403).json({ error: `Access denied` })
          return
        }

        domains = await db.services.domain.list({ where: { projectId } })
      } else if (isStr(orgId)) {
        // For org domains, verify user is member of the org
        const { data: orgIds } = await db.services.role.getUserOrgs(userId)
        if (!orgIds?.length || !orgIds.includes(orgId)) {
          res.status(403).json({ error: `Access denied` })
          return
        }

        domains = await db.services.domain.list({ where: { orgId } })
      }
    }

    res.status(200).json({ data: domains || [] })
  },
}
