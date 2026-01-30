import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource, canAccessSecretValue } from '@tdsk/domain'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /agents - List all agents
 * Filter by projectId query param
 * User must be member of the project
 * Secrets are sanitized by default (members see only metadata)
 * Set ?sanitize=false to see full secret values (requires admin+ role)
 */
export const listAgents: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const projectId = req.query.projectId as string | undefined
    const sanitize = req.query.sanitize !== 'false'

    if (!projectId) throw new Exception(400, `projectId query parameter required`)

    // Check permission to read agents in this project
    await checkPermission(req, EPermAction.read, EPermResource.agent, {
      projectId,
    })

    // If user wants unsanitized secrets, check they have permission
    if (!sanitize) {
      const userRole = await getUserRole(req, { projectId })

      if (!canAccessSecretValue(userRole)) {
        throw new Exception(403, `Admin or higher role required to view secret values`)
      }
    }

    // List agents for the specified project (service handles sanitization)
    const { data, error } = await db.services.agent.list({
      where: { projectId },
      sanitize, // Pass sanitize flag to service
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [] })
  },
}
