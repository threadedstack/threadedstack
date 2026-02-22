import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /:agentId/config - Get agent project-level config overrides
 * Returns the agentProjects row for the given agent+project pair
 */
export const getAgentProjectConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { agentId, projectId } = req.params

    // Get the agent to check permissions
    const { data: agent, error: getError } = await db.services.agent.get(agentId)
    if (getError || !agent) throw new Exception(404, `Agent not found`)

    // Check read permission on the agent's org
    await checkPermission(req, EPermAction.read, EPermResource.agent, {
      orgId: agent.orgId,
    })

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
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { agentId, projectId } = req.params

    // Validate the agent exists and get org info
    const { data: agent, error: getError } = await db.services.agent.get(agentId)
    if (getError || !agent) throw new Exception(404, `Agent not found`)

    // Check update permission on the agent's org
    await checkPermission(req, EPermAction.update, EPermResource.agent, {
      orgId: agent.orgId,
    })

    // Extract override fields from body
    const {
      model,
      maxTokens,
      systemPrompt,
      tools,
      functionIds,
      envVars,
      environment,
      enabled,
    } = req.body

    // If functionIds provided, validate each function belongs to the project
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

    const config: Record<string, unknown> = {}
    if (model !== undefined) config.model = model
    if (maxTokens !== undefined) config.maxTokens = maxTokens
    if (systemPrompt !== undefined) config.systemPrompt = systemPrompt
    if (tools !== undefined) config.tools = tools
    if (functionIds !== undefined) config.functionIds = functionIds
    if (envVars !== undefined) config.envVars = envVars
    if (environment !== undefined) config.environment = environment
    if (enabled !== undefined) config.enabled = enabled

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
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { agentId, projectId } = req.params

    // Validate the agent exists
    const { data: agent, error: getError } = await db.services.agent.get(agentId)
    if (getError || !agent) throw new Exception(404, `Agent not found`)

    // Check update permission on the agent's org
    await checkPermission(req, EPermAction.update, EPermResource.agent, {
      orgId: agent.orgId,
    })

    // Reset all override columns to null
    const { error } = await db.services.agent.upsertProjectConfig(agentId, projectId, {
      model: null,
      maxTokens: null,
      systemPrompt: null,
      tools: null,
      functionIds: null,
      envVars: null,
      environment: null,
      enabled: true,
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { id: agentId, configReset: true } })
  },
}
