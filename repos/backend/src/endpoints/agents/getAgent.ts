import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { requireAgentAccess } from '@TBE/utils/auth/requireAgentAccess'
import { Exception, EPermAction, EPermResource, canAccessSecretValue } from '@tdsk/domain'

/**
 * GET /_/agents/:id - Get an agent by ID
 * Secrets are sanitized by default (members see only metadata)
 * Set ?sanitize=false to see full secret values (requires admin+ role)
 */
export const getAgent: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
    const sanitize = req.query.sanitize !== 'false'

    const { data: agent, error: getError } = await db.services.agent.get(id, {
      sanitize: false,
    })
    if (getError || !agent) throw new Exception(404, `Agent not found`)

    // Enforce project-level access for non-admin users
    await requireAgentAccess(req, id, agent.orgId, agent)

    const { projectId } = req.params
    const responseAgent = projectId ? agent.getEffectiveConfig(projectId) : agent
    const projectConfig = projectId ? agent.getProjectConfig(projectId) : null

    if (!sanitize) {
      const userRole = await getUserRole(req, { orgId: agent.orgId })
      if (!canAccessSecretValue(userRole))
        throw new Exception(403, `Admin or higher role required to view secret values`)
    }

    const data = sanitize ? responseAgent.sanitize() : responseAgent
    res.status(200).json({ data, overrides: projectConfig })
  },
}
