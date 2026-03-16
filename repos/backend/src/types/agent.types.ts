import type {
  Skill,
  Function,
  Agent,
  TLLMAdapterConfig,
  TAgentEnvironment,
  TSandboxConfig,
  TAgentOverrides,
  TStreamEvent,
} from '@tdsk/domain'
import type { IAgentRunnerDB } from '@tdsk/agent'

export type TFunctionExecutionHandler = (
  functionId: string,
  input: unknown
) => Promise<{
  duration: number
  output: unknown
  success: boolean
  error?: string
}>

/** Extended overrides that include envVars (used by exec and resolve paths). */
export type TAgentExecOverrides = TAgentOverrides & {
  envVars?: Record<string, string>
}

/** Shared runtime fields between TSession and TResolvedAgentConfig. */
export type TAgentRuntimeConfig = {
  llmConfig: TLLMAdapterConfig
  sandboxConfig: TSandboxConfig
  environment?: TAgentEnvironment
  customFunctions: Function[]
  skills: Skill[]
  tools?: string[]
  envVars: Record<string, string>
  db: IAgentRunnerDB
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

/** Options for AgentEndpoint.runHeadless — adds onEvent callback to exec opts. */
export type THeadlessRunOpts = TAgentExecOpts & {
  onEvent: (event: TStreamEvent) => void
}
