import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource, canAccessSecretValue } from '@tdsk/domain'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import { parsePagination } from '@TBE/utils/pagination'

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
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, auth } = req.app.locals
    const orgId = auth.orgId
    const projectId = req.query.projectId as string | undefined
    const sanitize = req.query.sanitize !== `false`

    if (!orgId) throw new Exception(400, `orgId query parameter required`)

    // Check permission to read agents in this org
    await checkPermission(req, EPermAction.read, EPermResource.agent, {
      orgId,
    })

    // If user wants unsanitized secrets, check they have permission
    if (!sanitize) {
      const userRole = await getUserRole(req, { orgId })

      if (!canAccessSecretValue(userRole))
        throw new Exception(403, `Admin or higher role required to view secret values`)
    }

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.agent.list({
      limit,
      offset,
      sanitize,
      where: { orgId },
    })

    if (error) throw new Exception(500, error)

    // Filter by project if specified
    const filteredData = projectId
      ? data?.filter((agent) => agent.projects.some((p) => p.id === projectId)) || []
      : data || []

    res.status(200).json({ data: filteredData, limit, offset })
  },
}
