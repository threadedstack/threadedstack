import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PUT /_/agents/:id - Update an agent
 * Can optionally update project associations by passing projectIds array
 */
export const updateAgent: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const {
      projectIds = [],
      secretIds,
      providerIds: rawProviderIds = [],
      providers: providersWithPriority,
      ...agent
    } = req.body

    // Support both formats: providerIds[] (ordered array) or providers[{id, priority, model?}]
    const sortedProviders = providersWithPriority?.length
      ? [...providersWithPriority].sort(
          (a: { priority?: number }, b: { priority?: number }) =>
            (a.priority ?? 0) - (b.priority ?? 0)
        )
      : null

    const providerIds = sortedProviders
      ? sortedProviders.map((p: { id: string }) => p.id)
      : rawProviderIds

    // Build providerModels map from providers array items that have a model
    const providerModels = sortedProviders
      ? sortedProviders.reduce(
          (acc: Record<string, string>, p: { id: string; model?: string }) => {
            if (p.model) acc[p.id] = p.model
            return acc
          },
          {} as Record<string, string>
        )
      : undefined

    // First get the agent to check permissions
    const { data: existingAgent, error: getError } = await db.services.agent.get(id)
    if (getError) throw new Exception(404, `Agent not found`)
    if (!existingAgent) throw new Exception(404, `Agent not found`)

    // Check permission to update agents in this org
    await checkPermission(req, EPermAction.update, EPermResource.agent, {
      orgId: existingAgent.orgId,
    })

    // Project context: update project-level overrides, not the base agent
    const { projectId } = req.params
    if (projectId) {
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

      // Validate functionIds belong to the project if provided
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

      const config: Record<string, any> = {}
      if (model !== undefined) config.model = model
      if (maxTokens !== undefined) config.maxTokens = maxTokens
      if (systemPrompt !== undefined) config.systemPrompt = systemPrompt
      if (tools !== undefined) config.tools = tools
      if (functionIds !== undefined) config.functionIds = functionIds
      if (envVars !== undefined) config.envVars = envVars
      if (environment !== undefined) config.environment = environment
      if (enabled !== undefined) config.enabled = enabled

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

    // If providerIds are being changed, validate all are AI type and same org
    if (providerIds?.length) {
      for (const providerId of providerIds) {
        const { data: provider, error: provErr } =
          await db.services.provider.get(providerId)
        if (provErr || !provider)
          throw new Exception(404, `Provider ${providerId} not found`)
        if (provider.type !== `ai`)
          throw new Exception(
            400,
            `Agent must be linked to AI providers (provider ${providerId} has type: "${provider.type}")`
          )
        if (provider.orgId !== existingAgent.orgId)
          throw new Exception(
            403,
            `Provider ${providerId} does not belong to organization ${existingAgent.orgId}`
          )
      }
    }

    agent.id = id
    if (projects?.length) agent.projects = projects
    if (providerIds?.length) agent.providerIds = providerIds
    if (providerModels) agent.providerModels = providerModels
    if (secretIds !== undefined) agent.secretIds = secretIds
    const { data, error } = await db.services.agent.update(agent)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
