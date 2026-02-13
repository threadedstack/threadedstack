import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { AgentRunner } from '@TBE/services/agent/agent'
import {
  ELLMProvider,
  EPermAction,
  EPermResource,
  deriveKey,
  decryptValue,
} from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * Decrypt a secret's encryptedValue using the appropriate scope owner ID.
 * Falls back to orgId if decryption with the owner ID fails (handles
 * quickstart secrets that were encrypted with orgId but stored as provider-scoped).
 */
const decryptSecret = async (
  secret: {
    encryptedValue: string
    orgId?: string
    projectId?: string
    providerId?: string
    agentId?: string
  },
  orgId: string
): Promise<string | null> => {
  if (!secret.encryptedValue) return null

  const combined = Buffer.from(secret.encryptedValue, `base64`)
  if (combined.length < 29) return null // 12 (iv) + 16 (authTag) + 1 (min ciphertext)

  const iv = combined.subarray(0, 12)
  const authTag = combined.subarray(12, 28)
  const ciphertext = combined.subarray(28)

  // Determine the scope owner for key derivation
  const refId = secret.agentId || secret.providerId || secret.projectId || secret.orgId

  // Try the scope owner first
  if (refId) {
    try {
      const key = await deriveKey(refId)
      return await decryptValue(key, ciphertext, iv, authTag)
    } catch {
      // Decryption failed with scope owner — may be encrypted with a different key
    }
  }

  // Fallback: try orgId (handles quickstart encryption mismatch)
  if (orgId && orgId !== refId) {
    try {
      const key = await deriveKey(orgId)
      return await decryptValue(key, ciphertext, iv, authTag)
    } catch {
      // Both attempts failed
    }
  }

  return null
}

/**
 * POST /agents/:id/run - Run an agent with SSE streaming
 * Body: { prompt: string, threadId?: string }
 *
 * If threadId is provided, continues an existing conversation.
 * If not, creates a new thread.
 *
 * Response: Server-Sent Events stream
 */
export const runAgent: TEndpointConfig = {
  path: `/:id/run`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const agentId = req.params.id
    const userId = req.user?.id
    const { prompt, threadId: existingThreadId } = req.body

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!prompt) throw new Exception(400, `prompt is required`)

    // Load the agent with provider and secrets (unsanitized to access secret values)
    const { data: agent, error: agentErr } = await db.services.agent.get(agentId, {
      sanitize: false,
    })

    if (agentErr || !agent) throw new Exception(404, `Agent not found`)

    // Check permission to run agents in this org
    await checkPermission(req, EPermAction.read, EPermResource.agent, {
      orgId: agent.orgId,
    })

    // Load provider
    const { data: provider, error: provErr } = await db.services.provider.get(
      agent.providerId
    )

    if (provErr || !provider) throw new Exception(404, `Agent provider not found`)

    // Resolve API key secret with fallback chain:
    // 1. Agent-scoped secrets (loaded via agent relation)
    // 2. Provider-scoped secrets (query by providerId)
    // 3. Org-scoped secrets (query by orgId)
    let apiKey = ``

    // 1. Try agent-scoped secrets
    if (agent.secrets?.length) {
      for (const secret of agent.secrets) {
        const value = await decryptSecret(secret, agent.orgId)
        if (value) {
          apiKey = value
          break
        }
      }
    }

    // 2. Try provider-scoped secrets
    if (!apiKey) {
      const { data: providerSecrets } = await db.services.secret.list({
        where: { providerId: agent.providerId },
      })
      if (providerSecrets?.length) {
        for (const secret of providerSecrets) {
          const value = await decryptSecret(secret, agent.orgId)
          if (value) {
            apiKey = value
            break
          }
        }
      }
    }

    // 3. Try org-scoped secrets
    if (!apiKey) {
      const { data: orgSecrets } = await db.services.secret.list({
        where: { orgId: agent.orgId },
      })
      if (orgSecrets?.length) {
        for (const secret of orgSecrets) {
          const value = await decryptSecret(secret, agent.orgId)
          if (value) {
            apiKey = value
            break
          }
        }
      }
    }

    if (!apiKey) throw new Exception(400, `No API key found for agent provider`)

    // Determine LLM provider type from provider options or name
    const providerType = (provider.options?.llmProvider ||
      provider.name?.toLowerCase() ||
      `anthropic`) as string

    // Validate provider type
    const validProviders = Object.values(ELLMProvider) as string[]
    if (!validProviders.includes(providerType)) {
      throw new Exception(
        400,
        `Unsupported LLM provider: ${providerType}. Supported: ${validProviders.join(`, `)}`
      )
    }

    // Get or create thread
    let threadId = existingThreadId
    if (!threadId) {
      const { data: thread, error: threadErr } = await db.services.thread.create({
        userId,
        orgId: agent.orgId,
        agentId,
        name: prompt.substring(0, 100),
      })

      if (threadErr || !thread) throw new Exception(500, `Failed to create thread`)
      threadId = thread.id
    }

    // Set up SSE headers
    res.setHeader(`X-Thread-Id`, threadId)
    res.setHeader(`Connection`, `keep-alive`)
    res.setHeader(`Cache-Control`, `no-cache`)
    res.setHeader(`Content-Type`, `text/event-stream`)
    res.flushHeaders()

    // Send thread ID as first event
    res.write(`data: ${JSON.stringify({ type: `thread`, threadId })}\n\n`)

    // Build LLM config
    const llmConfig = {
      apiKey,
      provider: providerType as any,
      systemPrompt: agent.systemPrompt,
      maxTokens: agent.maxTokens || 4096,
      temperature: agent.environment?.temperature,
      model: agent.model || provider.options?.model || `claude-sonnet-4-20250514`,
    }

    // Build sandbox config — defaults to local provider when no explicit sandbox set
    const sandbox = agent.environment?.options?.sandbox as
      | Record<string, unknown>
      | undefined
    const sandboxConfig = {
      envVars: agent.envVars,
      timeout: agent.environment?.timeout ?? 300000,
      apiKey: sandbox?.apiKey as string | undefined,
      template: sandbox?.template as string | undefined,
      provider: (sandbox?.provider as string) || `local`,
    }

    // Handle client disconnect
    let aborted = false
    req.on(`close`, () => {
      aborted = true
    })

    try {
      await AgentRunner.run({
        db,
        prompt,
        userId,
        agentId,
        threadId,
        llmConfig,
        maxSteps: 10,
        sandboxConfig,
        orgId: agent.orgId,
        environment: agent.environment,
        tools: agent.tools as string[] | undefined,
        onEvent: (event) => {
          if (aborted) return
          res.write(`data: ${JSON.stringify(event)}\n\n`)
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Agent execution failed`
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: `error`, error: message })}\n\n`)
      }
    }

    // End the SSE stream
    if (!aborted) {
      res.write(`data: [DONE]\n\n`)
      res.end()
    }
  },
}
