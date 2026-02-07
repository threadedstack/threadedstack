import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource, canAccessSecretValue } from '@tdsk/domain'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /_/agents/:id - Get an agent by ID
 * Secrets are sanitized by default (members see only metadata)
 * Set ?sanitize=false to see full secret values (requires admin+ role)
 */
export const getAgent: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
    const sanitize = req.query.sanitize !== 'false'

    // First get the agent to check permissions (without sanitization for permission check)
    const { data: agent, error: getError } = await db.services.agent.get(id, {
      sanitize: false, // Get full data to check permissions
    })

    if (getError) throw new Exception(404, `Agent not found`)
    if (!agent) throw new Exception(404, `Agent not found`)

    // Check permission to read agents in this org
    await checkPermission(req, EPermAction.read, EPermResource.agent, {
      orgId: agent.orgId,
    })

    // If user wants unsanitized secrets, check they have permission
    if (!sanitize) {
      const userRole = await getUserRole(req, { orgId: agent.orgId })

      if (!canAccessSecretValue(userRole))
        throw new Exception(403, `Admin or higher role required to view secret values`)

      res.status(200).json({ data: agent })
    } else {
      res.status(200).json({ data: agent.sanitize() })
    }
  },
}
