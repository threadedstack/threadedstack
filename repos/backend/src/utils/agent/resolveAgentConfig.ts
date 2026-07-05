import type { TDatabase } from '@tdsk/database'
import type {
  IAgentRunnerDB,
  ITaskProvider,
  IEscalationProvider,
  IMemoryProvider,
  ISkillProvider,
} from '@tdsk/agent'
import type { TMemoryKind, TLLMAdapterConfig, TSandboxConfig } from '@tdsk/domain'
import type { TApp, TResolvedAgentConfig, TResolveAgentOpts } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { SetupReadyTimeoutMS } from '@TBE/constants/sandbox'
import { Exception, EMemoryKind, ESandboxType, isFeatureEnabled } from '@tdsk/domain'
import { resolveAgentDeps } from '@TBE/utils/agent/resolveAgentDeps'
import { createDelegateProvider } from '@TBE/utils/agent/delegation'
import { resolveSandboxProviderChain } from '@TBE/utils/sandbox/resolveSandboxChain'
import { authorSkillProposal } from '@TBE/utils/agent/skillPromotion'
import { authorTaskProposal } from '@TBE/utils/agent/taskPromotion'
import { openEscalation } from '@TBE/utils/agent/escalationPromotion'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'
import {
  clampImportance,
  truncateMemoryText,
  MemoryDefaultImportance,
} from '@TBE/utils/agent/memory'

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
 * Build the backend IMemoryProvider bridging the agent tools to the memory DB
 * service + EmbeddingService (null-safe embeddings). Mirrors createDBAdapter:
 * a pure closure over db + app scoped to one org/agent.
 */
export const createMemoryProvider = (
  app: TApp,
  db: TDatabase,
  orgId: string,
  agentId: string
): IMemoryProvider => ({
  search: async ({ query, limit, kinds }) => {
    const queryEmbedding = query
      ? ((await app.locals.embeddings?.embedOne(query, { orgId })) ?? undefined)
      : undefined

    const { data, error } = await db.services.memory.searchScored({
      orgId,
      agentId,
      query,
      queryEmbedding,
      limit,
      kinds: kinds as TMemoryKind[] | undefined,
    })
    if (error) {
      logger.warn(`memory_search failed for agent ${agentId}: ${error.message}`)
      return []
    }

    return (data || []).map((mem) => ({
      id: mem.id,
      text: mem.text,
      kind: mem.kind,
      score: mem.score,
      importance: mem.importance,
      createdAt: mem.createdAt ? new Date(mem.createdAt).toISOString() : undefined,
    }))
  },
  write: async ({ text, importance, kind, meta }) => {
    const cleanText = truncateMemoryText(text)
    const embedding =
      (await app.locals.embeddings?.embedOne(cleanText, { orgId })) ?? null

    const { data, error } = await db.services.memory.create({
      orgId,
      agentId,
      embedding,
      text: cleanText,
      meta: meta ?? null,
      kind: (kind as TMemoryKind) ?? EMemoryKind.fact,
      importance: clampImportance(importance ?? MemoryDefaultImportance),
    } as any)
    if (error || !data)
      throw new Exception(500, `Failed to write memory: ${error?.message ?? `unknown`}`)

    return { id: data.id }
  },
})

/**
 * Build the backend ISkillProvider bridging the api-brain skill tools to the
 * skill + skillProposal DB services + the security scan. Mirrors
 * createMemoryProvider: a pure closure over db scoped to one org/agent.
 */
export const createSkillProvider = (
  db: TDatabase,
  orgId: string,
  agentId: string
): ISkillProvider => ({
  authorSkill: async (input) =>
    authorSkillProposal(db, orgId, agentId, input, { authoredBy: agentId }),
  listSkills: async () => {
    const { data } = await db.services.skill.listForAgent(agentId)
    return (data || []).map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      alwaysActive: skill.alwaysActive,
      triggerKeywords: skill.triggerKeywords || [],
    }))
  },
  viewSkill: async (id) => {
    const { data } = await db.services.skill.listForAgent(agentId)
    const skill = (data || []).find((s) => s.id === id)
    if (!skill) return null
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      tools: skill.tools || [],
      triggerKeywords: skill.triggerKeywords || [],
      alwaysActive: skill.alwaysActive,
    }
  },
})

/**
 * Build the backend ITaskProvider bridging the api-brain proposeTask tool to
 * the taskProposal DB service + the deterministic security scan (via
 * authorTaskProposal). Mirrors createSkillProvider: a pure closure over db
 * scoped to one org/agent.
 */
export const createTaskProvider = (
  db: TDatabase,
  orgId: string,
  agentId: string
): ITaskProvider => ({
  proposeTask: async (input) =>
    authorTaskProposal(db, orgId, agentId, input as any, { authoredBy: agentId }),
})

/**
 * IEscalationProvider factory (api-brain P4b path). Mirrors createTaskProvider:
 * a pure closure over db scoped to one org/agent.
 */
export const createEscalationProvider = (
  db: TDatabase,
  orgId: string,
  agentId: string
): IEscalationProvider => ({
  escalate: async (input) =>
    openEscalation(db, orgId, agentId, input as any, { authoredBy: agentId }),
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
  const { userId, projectId, providerId, overrides, onPodStart } = opts || {}

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

  // 8b. Resolve the FULL priority-ordered provider chain into llmConfigs.
  // Index 0 is always the active llmConfig; the rest are failover candidates.
  // A broken fallback provider must never take down the primary path, so
  // fallback resolution failures are warn-logged and the provider is skipped.
  const llmConfigs: TLLMAdapterConfig[] = [llmConfig]
  for (const fallback of agent.providers || []) {
    if (fallback.id === provider.id) continue

    try {
      const fallbackKey = await secrets.resolveApiKey(agent, fallback)
      if (!fallbackKey) {
        logger.warn(
          `Skipping fallback provider ${fallback.id} for agent ${agentId} — no API key resolved`
        )
        continue
      }

      const fallbackModel = effectiveAgent.resolveModel(
        fallback.id,
        fallback.options?.model as string | undefined
      )
      if (!fallbackModel) {
        logger.warn(
          `Skipping fallback provider ${fallback.id} for agent ${agentId} — no model resolved`
        )
        continue
      }

      llmConfigs.push({
        apiKey: fallbackKey,
        model: fallbackModel,
        headers: await secrets.resolveHeaders(fallback),
        bodyParams: await secrets.resolveBodyParams(fallback),
        provider: db.services.provider.resolveAIBrand(fallback),
        baseUrl: fallback.options?.baseUrl as string | undefined,
        maxTokens: overrides?.maxTokens || effectiveAgent.maxTokens,
        systemPrompt: overrides?.systemPrompt || effectiveAgent.systemPrompt,
        temperature: overrides?.temperature ?? effectiveAgent.environment?.temperature,
      })
    } catch (err) {
      logger.warn(
        `Skipping fallback provider ${fallback.id} for agent ${agentId} — resolution failed: ${
          err instanceof Error ? err.message : err
        }`
      )
    }
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
      const bodySandboxId = effectiveAgent.environment.sandboxId as string

      // Pre-resolve the priority-ordered provider chain so the pod's default
      // env is deterministically the PRIMARY provider's. Without a chain,
      // startPod falls back to the legacy merged resolution (last writer wins
      // across links), where a low-priority fallback provider can hijack
      // colliding vars like ANTHROPIC_AUTH_TOKEN/ANTHROPIC_BASE_URL — which
      // breaks in-pod CLI children spawned by delegateTask.
      const { chain } = await resolveSandboxProviderChain(db, {
        projectId,
        orgId: agent.orgId,
        sandboxId: bodySandboxId,
        logContext: `[resolveAgentConfig] Agent ${agentId} —`,
      })

      const startedInstanceId = await sandbox.startPod({
        userId: userId || ``,
        orgId: agent.orgId,
        egressOpts: config.egress,
        projectId: projectId || ``,
        sandboxId: bodySandboxId,
        providerChain: {
          primaryEnv: chain.primaryEnv,
          placeholders: chain.placeholders,
        },
      })
      // Capture the pod name BEFORE anything below can throw, so the caller's
      // teardown path can always reap the pod (no orphan until the idle reaper)
      onPodStart?.(startedInstanceId)

      // The pod is created asynchronously (and clones repos before the
      // entrypoint command runs) — running the agent's first tool call before
      // it is ready fails with "not running". onPodStart already captured the
      // pod name, so callers can still reap the pod when this wait throws.
      await sandbox.waitForPodReady(startedInstanceId, {
        cloneCheck: true,
        timeoutMs: SetupReadyTimeoutMS,
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
    llmConfigs,
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
    // Only wire the memory tools when the feature is enabled
    memoryProvider: isFeatureEnabled(`memories`)
      ? createMemoryProvider(app, db, agent.orgId, agentId)
      : undefined,
    // Only wire the skill self-improvement tools when the feature is enabled
    skillProvider: isFeatureEnabled(`skills`)
      ? createSkillProvider(db, agent.orgId, agentId)
      : undefined,
    // Only wire the proposeTask self-direction tool when sensing is enabled
    taskProvider: isFeatureEnabled(`sensing`)
      ? createTaskProvider(db, agent.orgId, agentId)
      : undefined,
    // Only wire the escalate tool when the feature is enabled
    escalationProvider: isFeatureEnabled(`escalation`)
      ? createEscalationProvider(db, agent.orgId, agentId)
      : undefined,
    // Only wire the delegateTask tool when the feature is enabled
    delegateProvider: isFeatureEnabled(`delegation`)
      ? createDelegateProvider(app, db, agent.orgId, agentId, {
          projectId,
          podName: sandboxConfig.options?.podName as string | undefined,
          sandboxId: effectiveAgent.environment?.sandboxId as string | undefined,
        })
      : undefined,
  }
}
