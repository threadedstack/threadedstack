import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /:agentId/config - Reset agent project-level config overrides
 * Resets all override columns to null (enabled back to true)
 */
export const deleteAPConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.update, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { agentId, projectId } = req.params

    // Reset all override columns to null
    const { error } = await db.services.agent.upsertProjectConfig(agentId, projectId, {
      model: null,
      tools: null,
      envVars: null,
      enabled: true,
      maxTokens: null,
      functionIds: null,
      environment: null,
      systemPrompt: null,
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { id: agentId, configReset: true } })
  },
}
