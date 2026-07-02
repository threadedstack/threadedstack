import type { TDatabase } from '@tdsk/database'
import type { IAgentRunnerDB } from '@tdsk/agent'
import type { TLLMAdapterConfig, TSandboxConfig } from '@tdsk/domain'
import type { TApp, TResolvedAgentConfig, TResolveAgentOpts } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { Exception, ESandboxType } from '@tdsk/domain'
import { resolveAgentDeps } from '@TBE/utils/agent/resolveAgentDeps'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'

/**
 * Create an IAgentRunnerDB adapter wrapping backend database services.
 * Shared by SSE, WebSocket, and OpenAI-compat paths.
 */
export const createDBAdapter = (db: TDatabase): IAgentRunnerDB => ({
  createMessage: (data) => db.services.message.create(data),
  listMessages: (opts) =>
    db.services.message.listByThread(opts.where.threadId, {
      limit: opts.limit,
      offset: opts.offset,
    }),
})

/**
 * Resolve all configuration needed to run an agent.
 *
 * Consolidates agent setup logic shared by:
 * - SSE agent execution path (AgentEndpoint)
 * - WebSocket session resolution (onWSConnect)
 * - OpenAI-compat endpoints (oaiChatCompletions)
 *
 * Returns everything needed for both one-shot (AgentRunner.run) and
 * persistent (AgentRunner.init + runTurn) execution modes.
 */
export const resolveAgentConfig = async (
  agentId: string,
  db: TDatabase,
  app: TApp,
  opts?: TResolveAgentOpts
): Promise<TResolvedAgentConfig> => {
  const { userId, projectId, providerId, overrides } = opts || {}

  // 1. Load agent with provider and secrets (unsanitized to access secret values)
  const { data: agent, error: agentErr } = await db.services.agent.get(agentId, {
    sanitize: false,
  })

  if (agentErr) throw new Exception(500, agentErr.message)
  if (!agent) throw new Exception(404, `Agent not found`)

  // 2. Apply project-level overrides if projectId is provided
  const effectiveAgent = projectId ? agent.getEffectiveConfig(projectId) : agent

  // 3. Select provider: explicit override, or primary (first in priority order)
  let provider = agent.primaryProvider
  if (providerId) {
    const match = agent.providers.find((p) => p.id === providerId)
    if (!match)
      throw new Exception(400, `Provider ${providerId} is not configured for this agent`)
    provider = match
  }
  if (!provider) throw new Exception(404, `Agent has no provider configured`)

  // 4. Resolve secrets
  const secrets = new SecretResolver(db)
  const apiKey = await secrets.resolveApiKey(agent, provider)
  if (!apiKey) throw new Exception(400, `No API key found for agent provider`)

  const headers = await secrets.resolveHeaders(provider)
  const bodyParams = await secrets.resolveBodyParams(provider)

  // 5. Resolve web provider API key + custom functions
  const deps = await resolveAgentDeps(effectiveAgent, db, secrets, projectId)
  effectiveAgent.environment = deps.environment
  const customFunctions = deps.customFunctions

  // 6. Fetch skills
  const { data: skills, error: skillsErr } = await db.services.skill.listForAgent(agentId)
  if (skillsErr) {
    logger.error(`Failed to load skills for agent ${agentId}`, { error: skillsErr })
  }

  // 7. Build function lookup for execution callback
  const functionMap = new Map(customFunctions.map((fn: any) => [fn.id, fn]))

  // 8. Build LLM config with optional overrides
  const llmConfig: TLLMAdapterConfig = {
    apiKey,
    headers,
    bodyParams,
    provider: db.services.provider.resolveAIBrand(provider),
    baseUrl: provider.options?.baseUrl as string | undefined,
    maxTokens: overrides?.maxTokens || effectiveAgent.maxTokens,
    systemPrompt: overrides?.systemPrompt || effectiveAgent.systemPrompt,
    temperature: overrides?.temperature ?? effectiveAgent.environment?.temperature,
    model:
      overrides?.model ||
      effectiveAgent.resolveModel(provider!.id, provider!.options?.model),
  }

  // 9. Build sandbox config
  const sandboxProvider = effectiveAgent.environment?.sandboxType || ESandboxType.local
  const sandboxConfig: TSandboxConfig = {
    provider: sandboxProvider,
    timeout: effectiveAgent.environment?.timeout ?? 300000,
    envVars: { ...effectiveAgent.envVars, ...opts?.overrides?.envVars },
  }

  if (sandboxProvider === ESandboxType.kubernetes) {
    const { config, sandbox } = app.locals
    const instanceId = effectiveAgent.environment?.instanceId as string
    if (instanceId) {
      sandboxConfig.options = { podName: instanceId }
    } else if (sandbox && effectiveAgent.environment?.sandboxId) {
      const startedInstanceId = await sandbox.startPod({
        userId: userId || ``,
        orgId: agent.orgId,
        egressOpts: config.egress,
        projectId: projectId || ``,
        sandboxId: effectiveAgent.environment.sandboxId as string,
      })
      sandboxConfig.options = { podName: startedInstanceId }
    }

    if (!sandboxConfig.options?.podName) {
      throw new Exception(
        503,
        `K8s sandbox not available — no instanceId or sandbox found`
      )
    }
  }

  // 10. Build onExecuteFunction callback
  const onExecuteFunction = async (functionId: string, input: unknown) => {
    const func = functionMap.get(functionId)
    if (!func) {
      return { duration: 0, output: null, success: false, error: `Function not found` }
    }
    return FunctionExecutor.execute(func, {
      context: { args: input as Record<string, any> },
    })
  }

  return {
    agent,
    soul: effectiveAgent.soul,
    llmConfig,
    sandboxConfig,
    effectiveAgent,
    customFunctions,
    onExecuteFunction,
    orgId: agent.orgId,
    skills: skills || [],
    db: createDBAdapter(db),
    environment: effectiveAgent.environment,
    envVars: (effectiveAgent.envVars as Record<string, string>) ?? {},
    tools: (overrides?.tools || effectiveAgent.tools) as string[] | undefined,
  }
}
