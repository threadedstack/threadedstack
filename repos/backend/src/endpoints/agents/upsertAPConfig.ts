import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { requireOrgSandbox } from '@TBE/utils/agent/requireOrgSandbox'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /:agentId/config - Upsert agent project-level config overrides
 * Updates override columns on the agentProjects row
 * Returns the full effective agent config
 */
export const upsertAPConfig: TEndpointConfig = {
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

    // Reject environment.sandboxId references to sandboxes outside the agent's org
    if ((environment as Record<string, unknown> | null | undefined)?.sandboxId) {
      const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
      if (agentErr) throw new Exception(500, agentErr.message)
      if (!agent) throw new Exception(404, `Agent not found`)
      await requireOrgSandbox(db, environment, agent.orgId)
    }

    if (functionIds?.length) {
      for (const funcId of functionIds) {
        const { data: func, error: funcErr } = await db.services.function.get(funcId)
        if (funcErr) throw new Exception(500, funcErr.message)
        if (!func) throw new Exception(404, `Function ${funcId} not found`)
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
    if (refetchError) throw new Exception(500, refetchError.message)
    if (!updatedAgent) throw new Exception(500, `Failed to fetch updated agent`)

    const effectiveAgent = updatedAgent.getEffectiveConfig(projectId)

    res.status(200).json({ data: effectiveAgent })
  },
}
