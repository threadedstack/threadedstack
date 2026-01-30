import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PUT /_/agents/:id - Update an agent
 */
export const updateAgent: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
    const agentData = req.body

    // First get the agent to check permissions
    const { data: existingAgent, error: getError } = await db.services.agent.get(id)
    if (getError) throw new Exception(404, `Agent not found`)
    if (!existingAgent) throw new Exception(404, `Agent not found`)

    // Check permission to update agents in this project
    await checkPermission(req, EPermAction.update, EPermResource.agent, {
      projectId: existingAgent.projectId,
    })

    // Update the agent with id in the data
    agentData.id = id
    const { data, error } = await db.services.agent.update(agentData)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
