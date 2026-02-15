import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { AgentRunner } from '@tdsk/agent'
import type { IAgentRunnerDB } from '@tdsk/agent'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { resolveApiKey } from '@TBE/utils/secrets/decryptSecret'
import { resolveProviderType } from '@TBE/utils/providers/resolveProviderType'

/**
 * Create an IAgentRunnerDB adapter that wraps the backend's
 * direct database services into the narrow interface AgentRunner expects.
 */
const createDBAdapter = (db: any): IAgentRunnerDB => ({
  createMessage: (data) => db.services.message.create(data),
  listMessages: (opts) =>
    db.services.message.list({
      limit: opts.limit,
      where: opts.where,
      offset: opts.offset,
    }),
})

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

    // Resolve API key using 3-tier fallback
    const apiKey = await resolveApiKey(agent, db)

    if (!apiKey) throw new Exception(400, `No API key found for agent provider`)

    // Determine and validate LLM provider type
    const providerType = resolveProviderType(provider)

    // Get or create thread
    let threadId = existingThreadId
    if (!threadId) {
      const { data: thread, error: threadErr } = await db.services.thread.create({
        userId,
        agentId,
        orgId: agent.orgId,
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
        prompt,
        userId,
        agentId,
        threadId,
        llmConfig,
        maxSteps: 10,
        sandboxConfig,
        orgId: agent.orgId,
        db: createDBAdapter(db),
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
