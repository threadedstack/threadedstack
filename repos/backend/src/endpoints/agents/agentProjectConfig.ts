import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:agentId/config - Get agent project-level config overrides
 * Returns the agentProjects row for the given agent+project pair
 */
export const getAgentProjectConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { agentId, projectId } = req.params

    const { data: config, error } = await db.services.agent.getProjectConfig(
      agentId,
      projectId
    )

    if (error)
      throw new Exception(
        404,
        `No config found for agent ${agentId} in project ${projectId}`
      )

    res.status(200).json({ data: config })
  },
}

/**
 * PUT /:agentId/config - Upsert agent project-level config overrides
 * Updates override columns on the agentProjects row
 * Returns the full effective agent config
 */
export const upsertAgentProjectConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { agentId, projectId } = req.params

    const {
      model,
      tools,
      envVars,
      enabled,
      maxTokens,
      functionIds,
      environment,
      systemPrompt,
    } = req.body

    if (functionIds?.length) {
      for (const funcId of functionIds) {
        const { data: func, error: funcErr } = await db.services.function.get(funcId)
        if (funcErr || !func) throw new Exception(404, `Function ${funcId} not found`)
        if (func.projectId !== projectId)
          throw new Exception(
            400,
            `Function ${funcId} does not belong to project ${projectId}`
          )
      }
    }

    const config = Object.fromEntries(
      Object.entries({
        model,
        tools,
        envVars,
        enabled,
        maxTokens,
        functionIds,
        environment,
        systemPrompt,
      }).filter(([, v]) => v !== undefined)
    )

    const { error: upsertError } = await db.services.agent.upsertProjectConfig(
      agentId,
      projectId,
      config
    )

    if (upsertError) throw new Exception(500, upsertError.message)

    // Re-fetch the agent to get updated projectConfigs and return effective config
    const { data: updatedAgent, error: refetchError } =
      await db.services.agent.get(agentId)
    if (refetchError || !updatedAgent)
      throw new Exception(500, `Failed to fetch updated agent`)

    const effectiveAgent = updatedAgent.getEffectiveConfig(projectId)

    res.status(200).json({ data: effectiveAgent })
  },
}

/**
 * DELETE /:agentId/config - Reset agent project-level config overrides
 * Resets all override columns to null (enabled back to true)
 */
export const deleteAgentProjectConfig: TEndpointConfig = {
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
