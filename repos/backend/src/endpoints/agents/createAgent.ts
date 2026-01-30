import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * POST /_/agents - Create a new agent
 * Requires projectId in body
 * Requires admin+ role in that project
 */
export const createAgent: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const agentData = req.body
    const { projectId, providerId } = agentData

    // Validate required fields
    if (!projectId)
      throw new Exception(400, `Agent must belong to a project (projectId required)`)

    if (!providerId)
      throw new Exception(400, `Agent must have a provider (providerId required)`)

    // Check permission to create agents in this project
    await checkPermission(req, EPermAction.create, EPermResource.agent, {
      projectId,
    })

    // Create the agent
    const { data, error } = await db.services.agent.create(agentData)

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
