import type { Response } from 'express'
import type { Endpoint } from '@tdsk/domain'
import type { TDatabase } from '@tdsk/database'
import type { IAgentRunnerDB } from '@tdsk/agent'
import type { TRequest, TAgentExecOpts } from '@TBE/types'

import { BaseEndpoint } from './base'
import { AgentRunner } from '@tdsk/agent'
import { EEndpointType } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'
import { resolveProviderType } from '@TBE/utils/providers/resolveProviderType'

/**
 * Create an IAgentRunnerDB adapter wrapping backend database services
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

export class AgentEndpoint extends BaseEndpoint {
  readonly type = EEndpointType.agent

  validateOptions(options: Record<string, any>): void {
    if (!options?.agentId)
      throw new Exception(400, `Agent endpoint requires an agentId in options`)
  }

  async execute(
    req: TRequest,
    res: Response,
    endpoint: Endpoint<EEndpointType.agent>,
    db: TDatabase
  ): Promise<void> {
    const userId = req.user?.id
    const opts = endpoint.options
    const { agentId, overrides } = opts
    const { prompt, threadId } = req.body

    if (!prompt) throw new Exception(400, `prompt is required`)
    if (!userId) throw new Exception(401, `Authentication required`)
    if (!agentId) throw new Exception(400, `Agent endpoint has no agentId configured`)

    await this.run(req, res, db, {
      agentId,
      prompt,
      userId,
      threadId,
      overrides,
    })
  }

  /**
   * Shared agent execution logic for both admin route and endpoint service.
   * Loads agent, resolves secrets, sets up SSE, and streams via AgentRunner.
   */
  run = async (
    req: TRequest,
    res: Response,
    db: TDatabase,
    opts: TAgentExecOpts
  ): Promise<void> => {
    const { agentId, prompt, userId, threadId: existingThreadId, overrides } = opts

    // Load the agent with provider and secrets (unsanitized to access secret values)
    const { data: agent, error: agentErr } = await db.services.agent.get(agentId, {
      sanitize: false,
    })

    if (agentErr || !agent) throw new Exception(404, `Agent not found`)

    // Load provider
    const { data: provider, error: provErr } = await db.services.provider.get(
      agent.providerId
    )

    if (provErr || !provider) throw new Exception(404, `Agent provider not found`)

    // Resolve secrets
    const secrets = new SecretResolver(db)
    const apiKey = await secrets.resolveApiKey(agent)

    if (!apiKey) throw new Exception(400, `No API key found for agent provider`)

    // Determine and validate LLM provider type
    const providerType = resolveProviderType(provider)

    // Resolve provider headers and body params (with {{SECRET}} template substitution)
    const headers = await secrets.resolveHeaders(provider)
    const bodyParams = await secrets.resolveBodyParams(provider)

    // Load custom functions attached to this agent via junction table
    const { data: agentFunctions } = await db.services.function.listByAgent(agent.id)

    // Build function lookup for the execution callback
    const functionMap = new Map((agentFunctions || []).map((fn: any) => [fn.id, fn]))

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

    // Build LLM config with optional overrides
    const llmConfig = {
      apiKey,
      headers,
      bodyParams,
      provider: providerType as any,
      systemPrompt: overrides?.systemPrompt || agent.systemPrompt,
      maxTokens: overrides?.maxTokens || agent.maxTokens || 4096,
      temperature: agent.environment?.temperature,
      model:
        overrides?.model ||
        agent.model ||
        provider.options?.model ||
        `claude-sonnet-4-20250514`,
    }

    // Build sandbox config
    const sandbox = agent.environment?.options?.sandbox as
      | Record<string, unknown>
      | undefined
    const sandboxConfig = {
      envVars: { ...agent.envVars, ...overrides?.envVars },
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
        tools: (overrides?.tools || agent.tools) as string[] | undefined,
        customFunctions: agentFunctions || [],
        onExecuteFunction: async (functionId, input) => {
          const func = functionMap.get(functionId)
          if (!func) {
            return {
              success: false,
              output: null,
              error: `Function not found`,
              duration: 0,
            }
          }
          return FunctionExecutor.execute(func, {
            context: { args: input as Record<string, any> },
          })
        },
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
  }
}
