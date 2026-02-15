import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { ELLMProvider, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { resolveApiKey } from '@TBE/utils/secrets/decryptSecret'
import { createSession } from '@TBE/services/sessionStore'

/**
 * POST /ai/sessions - Create a session for proxied LLM calls
 * Body: { agentId: string }
 *
 * Resolves the agent's API key server-side, caches it in memory,
 * and returns an opaque session token. The client uses this token
 * for subsequent /ai/chat requests without ever receiving the API key.
 */
export const aiCreateSession: TEndpointConfig = {
  path: `/sessions`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id
    const { agentId } = req.body

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    // Load agent with secrets (unsanitized)
    const { data: agent, error: agentErr } = await db.services.agent.get(agentId, {
      sanitize: false,
    })

    if (agentErr || !agent) throw new Exception(404, `Agent not found`)

    // Check permission
    await checkPermission(req, EPermAction.read, EPermResource.agent, {
      orgId: agent.orgId,
    })

    // Load provider
    const { data: provider, error: provErr } = await db.services.provider.get(
      agent.providerId
    )

    if (provErr || !provider) throw new Exception(404, `Agent provider not found`)

    // Resolve API key via 3-tier fallback
    const apiKey = await resolveApiKey(agent, db)

    if (!apiKey) throw new Exception(400, `No API key found for agent provider`)

    // Determine and validate provider type
    const providerType = (provider.options?.llmProvider ||
      provider.name?.toLowerCase() ||
      `anthropic`) as string

    const validProviders = Object.values(ELLMProvider) as string[]
    if (!validProviders.includes(providerType)) {
      throw new Exception(
        400,
        `Unsupported LLM provider: ${providerType}. Supported: ${validProviders.join(`, `)}`
      )
    }

    // Build LLM config (apiKey stays server-side)
    const llmConfig = {
      apiKey,
      provider: providerType as any,
      systemPrompt: agent.systemPrompt,
      maxTokens: agent.maxTokens || 4096,
      temperature: agent.environment?.temperature,
      model: agent.model || provider.options?.model || `claude-sonnet-4-20250514`,
    }

    // Create session with cached config
    const sessionToken = createSession({
      agentId: agent.id,
      orgId: agent.orgId,
      userId,
      llmConfig,
    })

    // Return token + non-sensitive config (no apiKey)
    res.status(200).json({
      data: {
        sessionToken,
        provider: providerType,
        model: llmConfig.model,
        maxTokens: llmConfig.maxTokens,
        systemPrompt: llmConfig.systemPrompt,
      },
    })
  },
}
