import type { Response } from 'express'
import type { TDatabase } from '@tdsk/database'
import type { IAgentRunnerDB } from '@tdsk/agent'
import type { TRequest, TAgentExecOpts } from '@TBE/types'
import type { Endpoint, TLLMProviderBrand, TSandboxConfig } from '@tdsk/domain'

import { BaseEndpoint } from './base'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@tdsk/domain'
import { AgentRunner } from '@tdsk/agent'
import { ESandboxType, EEndpointType } from '@tdsk/domain'
import { resolveAgentDeps } from '@TBE/utils/agent/resolveAgentDeps'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'
import { resolveProviderType } from '@TBE/utils/providers/resolveProviderType'

/**
 * Create an IAgentRunnerDB adapter wrapping backend database services
 */
const createDBAdapter = (db: TDatabase): IAgentRunnerDB => ({
  createMessage: (data) => db.services.message.create(data),
  listMessages: (opts) =>
    db.services.message.listByThread(opts.where.threadId, {
      limit: opts.limit,
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
    const {
      prompt,
      userId,
      agentId,
      overrides,
      projectId,
      providerId,
      threadId: existingThreadId,
    } = opts

    // Load the agent with provider and secrets (unsanitized to access secret values)
    const { data: agent, error: agentErr } = await db.services.agent.get(agentId, {
      sanitize: false,
    })

    if (agentErr || !agent) throw new Exception(404, `Agent not found`)

    // Apply project-level overrides if projectId is provided
    const effectiveAgent = projectId ? agent.getEffectiveConfig(projectId) : agent

    // Select provider: explicit override, or primary (first in priority order)
    let provider = agent.primaryProvider
    if (providerId) {
      const match = agent.providers.find((p) => p.id === providerId)
      if (!match)
        throw new Exception(
          400,
          `Provider ${providerId} is not configured for this agent`
        )
      provider = match
    }
    if (!provider) throw new Exception(404, `Agent has no provider configured`)

    // Resolve secrets
    const secrets = new SecretResolver(db)
    const apiKey = await secrets.resolveApiKey(agent, provider)

    if (!apiKey) throw new Exception(400, `No API key found for agent provider`)

    // Resolve provider headers and body params (with {{SECRET}} template substitution)
    const headers = await secrets.resolveHeaders(provider)
    const bodyParams = await secrets.resolveBodyParams(provider)

    // Resolve web provider API key + custom functions (shared with WS path)
    const deps = await resolveAgentDeps(effectiveAgent, db, secrets, projectId)
    effectiveAgent.environment = deps.environment
    const agentFunctions = deps.customFunctions

    // Build function lookup for the execution callback
    const functionMap = new Map(agentFunctions.map((fn: any) => [fn.id, fn]))

    // Get or create thread
    let threadId = existingThreadId
    if (!threadId) {
      const { data: thread, error: threadErr } = await db.services.thread.create({
        userId,
        agentId,
        orgId: agent.orgId,
        projectId,
        name: prompt.substring(0, 100),
      })

      if (threadErr || !thread) throw new Exception(500, `Failed to create thread`)
      threadId = thread.id
    }

    // Build LLM config with optional overrides
    const llmConfig = {
      apiKey,
      headers,
      bodyParams,
      baseUrl: provider.options?.baseUrl as string | undefined,
      temperature: effectiveAgent.environment?.temperature,
      maxTokens: overrides?.maxTokens || effectiveAgent.maxTokens,
      systemPrompt: overrides?.systemPrompt || effectiveAgent.systemPrompt,
      // Model resolution: overrides → junction → agent → provider default
      // Note: effectiveAgent.model may include project-level overrides
      model:
        overrides?.model ||
        effectiveAgent.resolveModel(provider!.id, provider!.options?.model),

      // TODO: fix these typescript types, need to add different Provider class types
      // I.E. need AIProvider, GitProvider, etc...
      provider: resolveProviderType<TLLMProviderBrand>(provider as any),
    }

    // Build sandbox config — done BEFORE SSE headers so errors return proper JSON responses
    const sandboxProvider = effectiveAgent.environment?.sandboxType || ESandboxType.local
    const sandboxConfig: TSandboxConfig = {
      provider: sandboxProvider,
      timeout: effectiveAgent.environment?.timeout ?? 300000,
      envVars: { ...effectiveAgent.envVars, ...overrides?.envVars },
    }

    if (sandboxProvider === ESandboxType.kubernetes) {
      const { config, sandbox } = req.app.locals
      const podName = effectiveAgent.environment?.podName as string
      if (podName) {
        sandboxConfig.options = { podName }
      } else if (sandbox && effectiveAgent.environment?.sandboxId) {
        const startedPodName = await sandbox.startPod({
          userId,
          orgId: agent.orgId,
          egressOpts: config.egress,
          projectId: projectId || ``,
          sandboxId: effectiveAgent.environment.sandboxId as string,
        })
        sandboxConfig.options = { podName: startedPodName }
      }

      if (!sandboxConfig.options?.podName) {
        throw new Exception(
          503,
          `K8s sandbox not available — no podName or sandbox found`
        )
      }
    }

    // Set up SSE headers — after sandbox setup so errors above return proper JSON
    res.setHeader(`X-Thread-Id`, threadId)
    res.setHeader(`Connection`, `keep-alive`)
    res.setHeader(`Cache-Control`, `no-cache`)
    res.setHeader(`Content-Type`, `text/event-stream`)
    res.flushHeaders()

    // Send thread ID as first event
    res.write(`data: ${JSON.stringify({ type: `thread`, threadId })}\n\n`)

    // Handle client disconnect
    let aborted = false
    req.on(`close`, () => {
      aborted = true
    })

    try {
      const handle = await AgentRunner.run({
        prompt,
        userId,
        agentId,
        threadId,
        llmConfig,
        sandboxConfig,
        orgId: agent.orgId,
        db: createDBAdapter(db),
        environment: effectiveAgent.environment,
        tools: (overrides?.tools || effectiveAgent.tools) as string[] | undefined,
        customFunctions: agentFunctions || [],
        onExecuteFunction: async (functionId, input) => {
          const func = functionMap.get(functionId)
          if (!func) {
            return {
              duration: 0,
              output: null,
              success: false,
              error: `Function not found`,
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
      await handle.waitForIdle()
    } catch (err) {
      const message = err instanceof Error ? err.message : `Agent execution failed`
      logger.error(`[AgentEndpoint] Agent run failed:`, message)
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: `error`, error: message })}\n\n`)
      }
    }

    // End the SSE stream.
    // SSE uses OpenAI-compatible `[DONE]` sentinel; WS uses typed JSON `{ type: "done" }`.
    if (!aborted) {
      res.write(`data: [DONE]\n\n`)
      res.end()
    }
  }
}
