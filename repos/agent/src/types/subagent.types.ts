import type { TAgentConfig } from './agent.types'
import type { TWasmInstance } from './wasm.types'

/**
 * Configuration options for spawning a sub-agent
 */
export type TSubAgentOpts = {
  subAgentId: string
  prompt: string
  config: TAgentConfig
  maxQueueSize?: number
  onToken?: (token: string) => void
}

/**
 * Message types for sub-agent communication
 */
export type TSubAgentMessageType = `prompt` | `tool_result` | `control`

/**
 * Message structure for sub-agent communication queue
 */
export type TSubAgentMessage = {
  id: string
  type: TSubAgentMessageType
  content: string
  timestamp: number
  metadata?: Record<string, any>
}

/**
 * Sub-agent execution state
 */
export type TSubAgentState =
  | `initializing`
  | `ready`
  | `processing`
  | `idle`
  | `terminated`
  | `error`

/**
 * Internal sub-agent instance metadata
 */
export type TSubAgentInstance = {
  id: string
  state: TSubAgentState
  instance: TWasmInstance
  config: TAgentConfig
  messageQueue: TSubAgentMessage[]
  maxQueueSize: number
  createdAt: number
  lastActivityAt: number
  onToken?: (token: string) => void
}

/**
 * Options for SubAgentManager initialization
 */
export type TSubAgentManagerOpts = {
  maxSubAgents?: number
  defaultQueueSize?: number
  cleanupInterval?: number
  idleTimeout?: number
}

/**
 * Sub-agent spawn result
 */
export type TSubAgentSpawnResult = {
  subAgentId: string
  state: TSubAgentState
  createdAt: number
}

/**
 * Sub-agent status information
 */
export type TSubAgentStatus = {
  id: string
  state: TSubAgentState
  queueLength: number
  createdAt: number
  lastActivityAt: number
  idleMs: number
}
