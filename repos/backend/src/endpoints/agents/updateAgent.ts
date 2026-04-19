import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { EProvider, Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /_/agents/:id - Update an agent
 * Can optionally update project associations by passing projectIds array
 */
export const updateAgent: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const {
      name,
      model,
      secretIds,
      maxTokens,
      temperature,
      description,
      instructions,
      systemPrompt,
      thinkingBudget,
      providerInputs,
      thinkingEnabled,
      projectIds = [],
    } = req.body

    const { data: existingAgent, error: getError } = await db.services.agent.get(id)
    if (getError || !existingAgent) throw new Exception(404, `Agent not found`)

    // Project context: update project-level overrides, not the base agent
    const { projectId } = req.params
    if (projectId) {
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

      await db.services.agent.upsertProjectConfig(id, projectId, config)

      // Return the effective (merged) agent
      const { data: updatedAgent } = await db.services.agent.get(id)
      if (!updatedAgent) throw new Exception(500, `Failed to load updated agent`)

      const effectiveAgent = updatedAgent.getEffectiveConfig(projectId)
      res.status(200).json({ data: effectiveAgent.sanitize() })
      return
    }

    const { data: projects, error: projErr } = projectIds?.length
      ? await db.services.project.list({ where: { id: projectIds } })
      : { data: [] }

    if (projErr) throw new Exception(500, projErr.message)

    const pins = await db.services.provider.validate({
      type: EProvider.ai,
      inputs: providerInputs,
      orgId: existingAgent.orgId,
    })

    const agentUpdate: Record<string, unknown> & { id: string } = { id }
    if (name !== undefined) agentUpdate.name = name
    if (model !== undefined) agentUpdate.model = model
    if (projects?.length) agentUpdate.projects = projects
    if (pins !== undefined) agentUpdate.providerInputs = pins
    if (maxTokens !== undefined) agentUpdate.maxTokens = maxTokens
    if (secretIds !== undefined) agentUpdate.secretIds = secretIds
    if (description !== undefined) agentUpdate.description = description
    if (temperature !== undefined) agentUpdate.temperature = temperature
    if (systemPrompt !== undefined) agentUpdate.systemPrompt = systemPrompt
    if (instructions !== undefined) agentUpdate.instructions = instructions
    if (thinkingBudget !== undefined) agentUpdate.thinkingBudget = thinkingBudget
    if (thinkingEnabled !== undefined) agentUpdate.thinkingEnabled = thinkingEnabled
    const { data, error } = await db.services.agent.update(agentUpdate)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
