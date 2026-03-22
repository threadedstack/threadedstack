import type { Response } from 'express'
import type { TEndpointConfig, TRequest, TOAIModel } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { ModelRegistry } from '@TBE/services/providers/modelRegistry'
import { formatOAIError } from '@TBE/services/openai/responseAdapter'
import { resolveProviderType } from '@TBE/utils/providers/resolveProviderType'

/**
 * GET /_/agents/:id/v1/models
 *
 * OpenAI-compatible models list endpoint.
 * Returns models available to the agent's configured providers
 * in the standard OpenAI model list format.
 */
export const oaiModels: TEndpointConfig = {
  path: `/:id/v1/models`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const agentId = req.params.id
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    try {
      const { data: agent, error: agentErr } = await db.services.agent.get(agentId, {
        sanitize: true,
      })

      if (agentErr || !agent) {
        const { status, body } = formatOAIError(new Exception(404, `Agent not found`))
        res.status(status).json(body)
        return
      }

      await checkPermission(req, EPermAction.read, EPermResource.agent, {
        orgId: agent.orgId,
      })

      const created = Math.floor(Date.now() / 1000)
      const models: TOAIModel[] = []

      for (const provider of agent.providers || []) {
        let brand: string
        try {
          brand = resolveProviderType(provider as any)
        } catch (err) {
          logger.warn(`[OAI Models] Cannot resolve provider type`, {
            agentId,
            providerId: provider.id,
            error: err instanceof Error ? err.message : err,
          })
          continue
        }

        try {
          const providerModels = ModelRegistry.getModels(brand)
          for (const m of providerModels) {
            models.push({
              id: m.id,
              created,
              object: `model`,
              owned_by: brand,
            })
          }
        } catch (err) {
          logger.error(`[OAI Models] Failed to get models for provider`, {
            brand,
            agentId,
            providerId: provider.id,
            error: err instanceof Error ? err.message : err,
          })
        }
      }

      res.status(200).json({ object: `list`, data: models })
    } catch (err) {
      logger.error(`[OAI Models] Error listing models`, {
        agentId,
        error: err instanceof Error ? err.message : err,
      })
      const { status, body } = formatOAIError(err)
      !res.headersSent && res.status(status).json(body)
    }
  },
}
