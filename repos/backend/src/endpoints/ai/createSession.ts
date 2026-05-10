import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { signSessionToken } from '@TBE/services/sessionToken'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /ai/sessions - Create a session for proxied LLM calls
 * Body: { agentId: string }
 *
 * Validates the agent exists, checks permission, and returns a signed
 * session JWT. The client uses this token for subsequent /ai/ws WebSocket
 * connections. Secrets are resolved at WS connect time, not here.
 */
export const createSession: TEndpointConfig = {
  path: `/sessions`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.read, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id
    const { agentId, projectId } = req.body

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    // Load agent (sanitized — only need metadata for the response)
    const { data: agent, error: agentErr } = await db.services.agent.get(agentId)

    if (agentErr) throw new Exception(500, agentErr.message)
    if (!agent) throw new Exception(404, `Agent not found`)

    // Get primary provider from agent's providers array
    const provider = agent.primaryProvider
    if (!provider) throw new Exception(404, `Agent has no provider configured`)

    // Determine and validate provider type (throws 400 if brand is invalid)
    const providerType = db.services.provider.resolveAIBrand(provider)

    if (!provider.secretId)
      throw new Exception(
        400,
        `Provider "${provider.name || provider.id}" has no API key secret linked. Configure one in the provider settings.`
      )

    // Resolve model via 3-tier hierarchy: junction → agent → provider default
    const model = agent.resolveModel(provider.id, provider.options?.model)
    if (!model)
      throw new Exception(
        400,
        `No model configured for agent. Set a model on the agent, its provider, or the agent-provider link.`
      )

    // Sign a short-lived JWT with session identity claims
    const sessionToken = signSessionToken({
      userId,
      agentId: agent.id,
      orgId: agent.orgId,
      ...(projectId && { projectId }),
    })

    // Return token + non-sensitive config (no apiKey, no envVars)
    res.status(200).json({
      data: {
        model,
        sessionToken,
        tools: agent.tools,
        provider: providerType,
        environment: agent.environment,
        systemPrompt: agent.systemPrompt,
        // TODO: fix this default 4096 maxTokens? Why so low?
        maxTokens: agent.maxTokens || 4096,
      },
    })
  },
}
