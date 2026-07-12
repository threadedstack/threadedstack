import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { parsePagination, fetchAuthorizedPage } from '@TBE/utils/pagination'
import {
  Exception,
  ERoleType,
  hasMinRole,
  EPermAction,
  EPermResource,
} from '@tdsk/domain'

/**
 * GET /agents - List all agents
 * Filter by orgId query param (required)
 * Optionally filter by projectId query param to get agents for a specific project
 * User must be member of the organization
 * Secrets are sanitized by default (members see only metadata)
 * Set ?sanitize=false to see full secret values (requires admin+ role)
 */
export const listAgents: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params
    const projectId = req.params.projectId as string | undefined
    const queryProjectId = req.query.projectId
    if (queryProjectId && queryProjectId !== projectId)
      throw new Exception(
        400,
        `projectId query param does not match URL scope`,
        `SCOPE_MISMATCH`
      )
    const sanitize = req.query.sanitize !== `false`

    if (!orgId) throw new Exception(400, `orgId parameter required`)

    // Get user role once for both sanitize check and access filtering
    const userRole = await getUserRole(req, { orgId })

    // If user wants unsanitized secrets, check they have permission
    if (!sanitize) {
      if (!hasMinRole(userRole, ERoleType.admin))
        throw new Exception(403, `Admin or higher role required to view secret values`)
    }

    // Non-admins only see agents in projects they are members of
    let projectIdSet: Set<string> | undefined
    if (!hasMinRole(userRole, ERoleType.admin)) {
      const userId = req.user?.id
      if (!userId) throw new Exception(401, `Authentication required`, `UNAUTHORIZED`)

      const { data: userProjectIds, error: projErr } =
        await db.services.role.getUserProjects(userId)
      if (projErr) throw new Exception(500, `Failed to retrieve user projects`)

      projectIdSet = new Set(userProjectIds || [])
    }

    const { limit, offset } = parsePagination(req)

    const { data, error } = await fetchAuthorizedPage({
      limit,
      offset,
      fetchPage: (page) =>
        db.services.agent.list({
          limit: page.limit,
          offset: page.offset,
          sanitize,
          where: { orgId },
        }),
      isAuthorized: (agent) => {
        if (projectIdSet && !agent.projects?.some((p) => projectIdSet!.has(p.id)))
          return false

        if (projectId && !agent.projects?.some((p) => p.id === projectId)) return false

        return true
      },
    })

    if (error) throw new Exception(500, error.message)

    let filteredData = data || []

    // Merge project overrides into each agent when scoped to a specific project
    if (projectId)
      filteredData = filteredData.map((agent) => agent.getEffectiveConfig(projectId))

    res.status(200).json({ data: filteredData, limit, offset })
  },
}
