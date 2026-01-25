/**
 * Message types for communication between main thread and worker
 */

export type WorkerMessageType =
  | 'initialize'
  | 'execute'
  | 'terminate'
  | 'getStatus'
  | 'setEnv'
  | 'getEnv'

export type WorkerResponseType =
  | 'initialized'
  | 'result'
  | 'error'
  | 'stream'
  | 'status'
  | 'env'
  | 'terminated'

/**
 * Message sent from main thread to worker
 */
export interface WorkerRequest {
  id: string
  type: WorkerMessageType
  payload?: unknown
}

/**
 * Message sent from worker to main thread
 */
export interface WorkerResponse {
  id: string
  type: WorkerResponseType
  payload?: unknown
  error?: string
}

/**
 * Initialize shell worker
 */
export interface InitializeRequest {
  config?: {
    env?: Record<string, string>
    cwd?: string
    timeout?: number
  }
}

export interface InitializeResponse {
  success: boolean
  version?: string
}

/**
 * Execute command in shell
 */
export interface ExecuteRequest {
  command: string
  options?: {
    cwd?: string
    env?: Record<string, string>
    timeout?: number
    stream?: boolean
  }
}

export interface ExecuteResponse {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
}

/**
 * Stream data from command execution
 */
export interface StreamData {
  type: 'stdout' | 'stderr'
  data: string
  timestamp: number
}

/**
 * Shell status information
 */
export interface ShellStatus {
  ready: boolean
  busy: boolean
  currentCommand?: string
  uptime: number
  commandsExecuted: number
}

/**
 * Environment variable operations
 */
export interface SetEnvRequest {
  variables: Record<string, string>
}

export interface GetEnvRequest {
  keys?: string[]
}

export interface EnvResponse {
  variables: Record<string, string>
}
