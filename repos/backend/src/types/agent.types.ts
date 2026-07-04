import type { IAgentRunnerDB, IMemoryProvider } from '@tdsk/agent'
import type {
  Skill,
  Agent,
  Function,
  TStreamEvent,
  TSandboxConfig,
  TAgentOverrides,
  TLLMAdapterConfig,
  TAgentEnvironment,
} from '@tdsk/domain'

export type TFunctionExecutionHandler = (
  functionId: string,
  input: unknown
) => Promise<{
  error?: string
  output: unknown
  duration: number
  success: boolean
}>

/** Extended overrides that include envVars (used by exec and resolve paths). */
export type TAgentExecOverrides = TAgentOverrides & {
  envVars?: Record<string, string>
}

/** Shared runtime fields between TSession and TResolvedAgentConfig. */
export type TAgentRuntimeConfig = {
  skills: Skill[]
  tools?: string[]
  soul?: string
  db: IAgentRunnerDB
  customFunctions: Function[]
  llmConfig: TLLMAdapterConfig
  /**
   * Priority-ordered provider failover chain — index 0 is always `llmConfig`.
   * Passed to the AgentRunner so a surfaced LLM failure retries the same turn
   * on the next provider in the chain.
   */
  llmConfigs?: TLLMAdapterConfig[]
  sandboxConfig: TSandboxConfig
  environment?: TAgentEnvironment
  envVars: Record<string, string>
  onExecuteFunction: TFunctionExecutionHandler
  /**
   * Durable memory provider (backend-implemented). Present only when the
   * `memories` feature flag is enabled; wired into the AgentRunner so the api
   * brain exposes the memory_search/memory_write tools.
   */
  memoryProvider?: IMemoryProvider
}

export type TResolvedAgentConfig = TAgentRuntimeConfig & {
  agent: Agent
  effectiveAgent: Agent
  orgId: string
}

export type TResolveAgentOpts = {
  userId?: string
  projectId?: string
  providerId?: string
  overrides?: TAgentExecOverrides
  /**
   * Invoked immediately after resolveAgentConfig starts a pod, BEFORE the
   * readiness wait or any later step can throw — callers capture the pod name
   * here so their teardown path can always reap the pod.
   */
  onPodStart?: (podName: string) => void
}

export type TAgentExecOpts = {
  agentId: string
  prompt: string
  userId: string
  threadId?: string
  projectId?: string
  providerId?: string
  overrides?: TAgentExecOverrides
  resolvedConfig?: TResolvedAgentConfig
}

export type TAgentEnsureThread = {
  name?: string
  orgId: string
  userId: string
  prompt?: string
  agentId: string
  threadId?: string
  projectId?: string
}

/** Options for AgentEndpoint.runHeadless — adds onEvent callback to exec opts. */
export type THeadlessRunOpts = TAgentExecOpts & {
  onEvent: (event: TStreamEvent) => void
}
