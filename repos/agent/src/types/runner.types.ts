import type {
  TStreamEvent,
  TMessageContent,
  TLLMAdapterConfig,
  TAgentEnvironment,
  TFunctionExecResult,
  Function as FunctionModel,
} from '@tdsk/domain'

/**
 * Narrow interface for message persistence.
 * Backend implements this via direct DB calls,
 * REPL implements this via HTTP calls to the backend API.
 */
export interface IAgentRunnerDB {
  listMessages(opts: {
    where: { threadId: string }
    limit: number
    offset: number
  }): Promise<{ data?: Array<{ type: string; content: TMessageContent[] }> }>

  createMessage(data: {
    threadId: string
    type: string
    content: TMessageContent[]
    orgId: string
  }): Promise<unknown>
}

/**
 * Config for routing LLM calls through the backend SSE proxy.
 * Used by REPL to avoid requiring the LLM API key directly.
 */
export type TProxyConfig = {
  backendUrl: string
  sessionToken: string
}

export type TAgentRunOpts = {
  agentId: string
  threadId: string
  prompt: string
  userId: string
  orgId: string
  /** Message persistence adapter */
  db: IAgentRunnerDB
  /** LLM config built from agent + provider */
  llmConfig: TLLMAdapterConfig
  /** Sandbox config */
  sandboxConfig?: {
    provider: string
    timeout?: number
    envVars?: Record<string, string>
  }
  /** Allowed tools list (empty = all) */
  tools?: string[]
  /** Agent environment settings */
  environment?: TAgentEnvironment
  /** Max conversation loop steps (prevents infinite tool-call loops) */
  maxSteps?: number
  /** Config for routing LLM calls through the backend SSE proxy */
  proxyConfig?: TProxyConfig
  /** Callback for each streaming event */
  onEvent: (event: TStreamEvent) => void
  /** AbortSignal to cancel the agent run */
  signal?: AbortSignal
  /** Custom functions attached to this agent */
  customFunctions?: FunctionModel[]
  /** Callback to execute a custom function (provided by backend) */
  onExecuteFunction?: (functionId: string, input: unknown) => Promise<TFunctionExecResult>
}
