import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { requireAgentAccess } from '@TBE/utils/auth/requireAgentAccess'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource, canAccessSecretValue } from '@tdsk/domain'

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

    // Enforce project-level access for non-admin users
    await requireAgentAccess(req, id, agent.orgId, agent)

    const { projectId } = req.params
    const responseAgent = projectId ? agent.getEffectiveConfig(projectId) : agent
    const projectConfig = projectId ? agent.getProjectConfig(projectId) : null

    // If user wants unsanitized secrets, check they have permission
    if (!sanitize) {
      const userRole = await getUserRole(req, { orgId: agent.orgId })

      if (!canAccessSecretValue(userRole))
        throw new Exception(403, `Admin or higher role required to view secret values`)

      res.status(200).json({ data: responseAgent, overrides: projectConfig })
    } else {
      res.status(200).json({ data: responseAgent.sanitize(), overrides: projectConfig })
    }
  },
}
