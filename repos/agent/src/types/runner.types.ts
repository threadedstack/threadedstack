import type {
  TStreamEvent,
  TMessageContent,
  TLLMAdapterConfig,
  TAgentEnvironment,
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
    apiKey?: string
    template?: string
    timeout?: number
    envVars?: Record<string, string>
  }
  /** Allowed tools list (empty = all) */
  tools?: string[]
  /** Agent environment settings */
  environment?: TAgentEnvironment
  /** Max conversation loop steps (prevents infinite tool-call loops) */
  maxSteps?: number
  /** Callback for each streaming event */
  onEvent: (event: TStreamEvent) => void
}
