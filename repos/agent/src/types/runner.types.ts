import type { IMemoryProvider } from './memory.types'
import type { ISkillProvider } from './skill.types'
import type {
  Skill,
  TStreamEvent,
  TFileAttachment,
  TMessageContent,
  TImageAttachment,
  TLLMAdapterConfig,
  TAgentEnvironment,
  TAgentConfigFields,
  TFunctionExecResult,
  Function as FunctionModel,
} from '@tdsk/domain'

/**
 * Narrow interface for message persistence.
 * Backend implements this via direct DB calls.
 * TSA delegates all persistence to the backend (no local implementation).
 */
export interface IAgentRunnerDB {
  listMessages(opts: {
    where: { threadId: string }
    limit: number
    offset: number
  }): Promise<{
    data?: Array<{ type: string; content: TMessageContent[]; createdAt?: string | Date }>
  }>

  createMessage(data: {
    threadId: string
    type: string
    content: TMessageContent[]
    orgId: string
  }): Promise<unknown>
}

export type TAgentHandle = {
  steer: (message: string) => void
  followUp: (message: string) => void
  abort: () => void
  waitForIdle: () => Promise<void>
}

/**
 * Options for initializing a persistent AgentRunner instance.
 * Contains everything needed to create the agent, sandbox, and tools.
 * Per-turn options (prompt, images, signal) are passed to runTurn().
 */
export type TAgentInitOpts = {
  agentId: string
  threadId: string
  userId: string
  orgId: string
  /** Message persistence adapter */
  db: IAgentRunnerDB
  /** LLM config built from agent + provider */
  llmConfig: TLLMAdapterConfig
  /**
   * Priority-ordered provider failover chain. When present, index 0 MUST be
   * the active `llmConfig`. On a surfaced LLM failure the runner retries the
   * SAME turn once per remaining config (index 1..n) before rejecting.
   */
  llmConfigs?: TLLMAdapterConfig[]
  /** Sandbox config */
  sandboxConfig?: {
    provider: string
    timeout?: number
    envVars?: Record<string, string>
    /** Provider-specific options (e.g. { podName } for K8s) */
    options?: Record<string, unknown>
  }
  /** Allowed tools list (empty = all) */
  tools?: string[]
  /** Agent environment settings */
  environment?: TAgentEnvironment
  /** Callback for each streaming event */
  onEvent: (event: TStreamEvent) => void
  /** Custom functions attached to this agent */
  customFunctions?: FunctionModel[]
  /** Callback to execute a custom function (provided by backend) */
  onExecuteFunction?: (functionId: string, input: unknown) => Promise<TFunctionExecResult>
  /** Skills attached to this agent */
  skills?: Skill[]
  /** Durable identity/constitution, pinned to the top of the system prompt */
  soul?: string
  /**
   * Durable memory provider (backend-implemented). When present, the runner
   * exposes memorySearch/memoryWrite tools and persists compaction summaries.
   */
  memoryProvider?: IMemoryProvider
  /**
   * Skill self-improvement provider (backend-implemented). When present, the
   * runner exposes authorSkill/skillsList/skillView tools.
   */
  skillProvider?: ISkillProvider
}

/**
 * Per-turn options passed to runTurn().
 */
export type TAgentTurnOpts = {
  prompt: string
  /** Images to include with the prompt (vision models) */
  images?: TImageAttachment[]
  /** Attached files with extracted content */
  files?: TFileAttachment[]
  /** AbortSignal to cancel this turn */
  signal?: AbortSignal
}

/**
 * Runtime configuration that can be changed between turns
 * via updateConfig() or the UpdateConfig WS event.
 */
export type TAgentConfig = TAgentConfigFields

/**
 * One-shot run options (backward compat for SSE endpoint).
 * Combines init + turn opts into a single call.
 */
export type TAgentRunOpts = TAgentInitOpts &
  TAgentTurnOpts & {
    /** Max conversation loop steps (not yet enforced — awaiting pi-mono support) */
    maxSteps?: number
  }
