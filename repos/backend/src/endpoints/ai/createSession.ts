import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { signSessionToken } from '@TBE/services/sessionToken'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { resolveProviderType } from '@TBE/utils/providers/resolveProviderType'

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
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id
    const { agentId } = req.body

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    // Load agent (sanitized — only need metadata for the response)
    const { data: agent, error: agentErr } = await db.services.agent.get(agentId)

    if (agentErr || !agent) throw new Exception(404, `Agent not found`)

    // Check permission
    await checkPermission(req, EPermAction.read, EPermResource.agent, {
      orgId: agent.orgId,
    })

    // Get primary provider from agent's providers array
    const provider = agent.primaryProvider
    if (!provider) throw new Exception(404, `Agent has no provider configured`)

    // Determine and validate provider type
    const providerType = resolveProviderType(provider)

    // Sign a short-lived JWT with session identity claims
    const sessionToken = signSessionToken({
      userId,
      agentId: agent.id,
      orgId: agent.orgId,
    })

    // Return token + non-sensitive config (no apiKey, no envVars)
    res.status(200).json({
      data: {
        sessionToken,
        tools: agent.tools,
        model: agent.model || provider.options?.model,
        provider: providerType,
        maxTokens: agent.maxTokens || 4096,
        environment: agent.environment,
        systemPrompt: agent.systemPrompt,
      },
    })
  },
}
