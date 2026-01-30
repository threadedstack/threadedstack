export enum EMsgType {
  user = `user`,
  tool = `tool`,
  system = `system`,
  action = `action`,
  assistant = `assistant`,
}

export type TMsgType = `${EMsgType}`

export type TAgentEnvVars = Record<string, string>

export type TAgentEnvironment = {
  /** Execution timeout in milliseconds */
  timeout?: number
  /** Maximum memory in MB */
  memory?: number
  /** Whether to enable streaming responses */
  streaming?: boolean
  /** Temperature for response generation */
  temperature?: number
  /** Maximum retries for API calls */
  maxRetries?: number
  /** Agent-specific options */
  options?: Record<string, any>
}
