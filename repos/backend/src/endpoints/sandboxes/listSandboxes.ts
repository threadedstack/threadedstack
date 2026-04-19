import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import {
  Exception,
  ERoleType,
  hasMinRole,
  EPermAction,
  EPermResource,
} from '@tdsk/domain'

/**
 * GET /sandboxes - List all sandboxes
 * Filter by orgId query param (required)
 * Optionally filter by projectId param/query to get sandboxes for a specific project
 * User must be member of the organization
 * Non-admins only see sandboxes in projects they are members of
 */
export const listSandboxes: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const orgId = req.params.orgId || (req.query.orgId as string)
    // TODO: investigate if the `req.query.projectId` should actually be used
    // Should come from the URL when getting project sandboxes list
    const projectId = (req.params.projectId || req.query.projectId) as string | undefined

    if (!orgId) throw new Exception(400, `orgId parameter required`)

    // Get user role once for access filtering
    const userRole = await getUserRole(req, { orgId })

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.sandbox.list({
      limit,
      offset,
      where: { orgId },
    })

    if (error)
      throw new Exception(500, error instanceof Error ? error.message : String(error))

    let filteredData = data || []

    // Non-admins only see sandboxes in projects they are members of
    if (!hasMinRole(userRole, ERoleType.admin)) {
      const userId = req.user?.id
      if (!userId) throw new Exception(401, `Authentication required`, `UNAUTHORIZED`)

      const { data: userProjectIds, error: projErr } =
        await db.services.role.getUserProjects(userId)
      if (projErr) throw new Exception(500, `Failed to retrieve user projects`)

      const projectIdSet = new Set(userProjectIds || [])
      // Built-in sandboxes (org-level, no project links) are visible to all org members
      filteredData = filteredData.filter(
        (sandbox) =>
          !sandbox.projects?.length ||
          sandbox.projects.some((p) => projectIdSet.has(p.id))
      )
    }

    // Further filter by specific projectId if requested
    if (projectId) {
      filteredData = filteredData.filter((sandbox) =>
        sandbox.projects?.some((p) => p.id === projectId)
      )
      // Merge project overrides into each sandbox
      filteredData = filteredData.map((sandbox) => sandbox.getEffectiveConfig(projectId))
    }

    res.status(200).json({ data: filteredData, limit, offset })
  },
}
