import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { Exception, ERoleType, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /domains - List all domains for an organization or project
 * Super admins can see all domains
 * Regular users can only see domains from their organizations
 */
export const listDomains: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.domain)],
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

    const where = orgId ? { orgId } : { projectId }

    // Super admins can list any domains without membership checks
    if (userRole !== ERoleType.super) {
      const { data: orgIds, error: orgErr } = await db.services.role.getUserOrgs(userId)
      if (orgErr) throw new Exception(500, orgErr.message)

      if (projectId) {
        const { data: project, error: proErr } = await db.services.project.get(projectId)
        if (proErr) throw new Exception(500, proErr.message)
        if (!project) throw new Exception(404, `Project not found`)
        if (!orgIds?.length || !orgIds.includes(project.orgId))
          throw new Exception(403, `Access denied`)
      } else if (!orgIds?.length || !orgIds.includes(orgId)) {
        throw new Exception(403, `Access denied`)
      }
    }

    const { data, error } = await db.services.domain.list({ where, limit, offset })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}
