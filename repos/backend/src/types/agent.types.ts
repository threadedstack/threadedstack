import type {
  IAgentRunnerDB,
  ITaskProvider,
  IEscalationProvider,
  IMemoryProvider,
  IRecordsProvider,
  IInvokeProvider,
  ISkillProvider,
  IDelegateProvider,
  IOpsProvider,
} from '@tdsk/agent'
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
  /**
   * Records provider (backend-implemented). Present only when the `collections`
   * feature flag is enabled and the agent is project-scoped; wired into the
   * AgentRunner so the api brain exposes the collectionQuery/collectionGet/
   * collectionUpsert/collectionDelete tools scoped to the project's collections.
   */
  recordsProvider?: IRecordsProvider
  /**
   * Invoke provider (backend-implemented) for the live effect surface
   * (generalization ②). Present only when the agent is project-scoped AND a
   * non-empty allowlist was supplied via `opts.actions`; wired into the
   * AgentRunner so the api brain exposes the `invoke` tool, routing through the
   * same `invokeAction` core as the deferred `tdsk-actions` block.
   */
  invokeProvider?: IInvokeProvider
  /**
   * Skill self-improvement provider (backend-implemented). Present only when the
   * `skills` feature flag is enabled; wired into the AgentRunner so the api brain
   * exposes the authorSkill/skillsList/skillView tools.
   */
  skillProvider?: ISkillProvider
  /**
   * Task self-direction provider (backend-implemented). Present only when the
   * `sensing` feature flag is enabled; wired into the AgentRunner so the api
   * brain exposes the proposeTask tool (api-brain parity of the runtime-brain
   * fenced `tdsk-tasks` capture).
   */
  taskProvider?: ITaskProvider
  /**
   * Escalation provider (backend-implemented). Present only when the
   * `escalation` feature flag is enabled; wired into the AgentRunner so the api
   * brain exposes the escalate tool (api-brain parity of the runtime-brain
   * fenced `tdsk-escalations` capture).
   */
  escalationProvider?: IEscalationProvider
  /**
   * Task delegation provider (backend-implemented). Present only when the
   * `delegation` feature flag is enabled; wired into the AgentRunner so the api
   * brain exposes the delegateTask tool (bounded in-pod child coding process).
   */
  delegateProvider?: IDelegateProvider
  /**
   * Ops provider (backend-implemented). Present only when the `ops` feature flag
   * is enabled; exposes READ tier (podStatus/podLogs/deployState/quotaUsage) plus
   * a stubbed WRITE tier that throws loudly until D6 wires real proposal machinery.
   */
  opsProvider?: IOpsProvider
}

/** Context handed to createDelegateProvider by resolveAgentConfig. */
export type TDelegateProviderCtx = {
  /** K8s pod running the agent's body sandbox (delegation exec target) */
  podName?: string
  /** Body sandbox config id, used to resolve the runtime prompt template */
  sandboxId?: string
  /** Project scope for effective sandbox config resolution */
  projectId?: string
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
  /**
   * Effect-surface allowlist (generalization ②): the set of project-scoped
   * Function names the live `invoke` tool may call. Non-empty + a resolved
   * project ⇒ the `invoke` tool is exposed; empty/absent ⇒ no tool (inert).
   */
  actions?: string[]
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
