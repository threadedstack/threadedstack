import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { requireAgentAccess } from '@TBE/utils/auth/requireAgentAccess'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /_/agents/:id - Delete an agent
 */
export const deleteAgent: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    const { data: agent, error: getError } = await db.services.agent.get(id)
    if (getError) throw new Exception(500, getError.message)
    if (!agent) throw new Exception(404, `Agent not found`)

    await requireAgentAccess(req, id, agent.orgId, agent)

    // Project context: unlink agent from project (don't delete the org-level agent)
    const { projectId } = req.params
    if (projectId) {
      await db.services.agent.removeProject(id, projectId)
      res.status(200).json({ data: { id, unlinked: true } })
      return
    }

    // Delete the agent
    const { data, error } = await db.services.agent.delete(id)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
