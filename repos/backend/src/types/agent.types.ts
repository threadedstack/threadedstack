import type { IAgentRunnerDB } from '@tdsk/agent'
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
  db: IAgentRunnerDB
  customFunctions: Function[]
  llmConfig: TLLMAdapterConfig
  sandboxConfig: TSandboxConfig
  environment?: TAgentEnvironment
  envVars: Record<string, string>
  onExecuteFunction: TFunctionExecutionHandler
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
