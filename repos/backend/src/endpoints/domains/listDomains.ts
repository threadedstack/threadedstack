import type { Response } from 'express'
import type { Domain } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { ERoleType } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'
import { parsePagination } from '@TBE/utils/pagination'
import { getUserRole } from '@TBE/utils/auth/checkPermission'

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
    const { orgId, projectId } = req.params
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    if (!orgId && !projectId)
      throw new Exception(400, `Either orgId or projectId is required`)

    const userRole = await getUserRole(req, {
      ...(orgId && { orgId }),
      ...(projectId && { projectId }),
    })
    const { limit, offset } = parsePagination(req)

    let domains: Domain[]
    // Super admins can list any domains
    if (userRole === ERoleType.super) {
      const { data, error } = orgId
        ? await db.services.domain.list({ where: { orgId }, limit, offset })
        : projectId
          ? await db.services.domain.list({ where: { projectId }, limit, offset })
          : { data: [] }

      if (error) throw new Exception(500, error.message)
      domains = data
    } else {
      // Regular users can only list domains from their orgs
      if (projectId) {
        // For project domains, verify user has access to the project
        const { data: project, error: proErr } = await db.services.project.get(projectId)
        if (proErr) throw new Exception(500, proErr.message)
        if (!project) throw new Exception(404, `Project not found`)

        // Check if user is member of the project's org
        const { data: orgIds, error: orgErr } = await db.services.role.getUserOrgs(userId)
        if (orgErr) throw new Exception(500, orgErr.message)
        if (!orgIds?.length || !orgIds.includes(project.orgId))
          throw new Exception(403, `Access denied`)

        const { data, error } = await db.services.domain.list({
          where: { projectId },
          limit,
          offset,
        })
        if (error) throw new Exception(500, error.message)
        domains = data
      } else if (orgId) {
        // For org domains, verify user is member of the org
        const { data: orgIds, error: orgErr } = await db.services.role.getUserOrgs(userId)
        if (orgErr) throw new Exception(500, orgErr.message)

        if (!orgIds?.length || !orgIds.includes(orgId))
          throw new Exception(403, `Access denied`)

        const { data, error } = await db.services.domain.list({
          where: { orgId },
          limit,
          offset,
        })
        if (error) throw new Exception(500, error.message)
        domains = data
      }
    }

    res.status(200).json({ data: domains || [], limit, offset })
  },
}
