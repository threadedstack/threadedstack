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
  /** Maximum memory in MB */
  memory?: number
  /** Execution timeout in milliseconds */
  timeout?: number
  /** Whether to enable streaming responses */
  streaming?: boolean
  /** Maximum retries for API calls */
  maxRetries?: number
  /** Temperature for response generation */
  temperature?: number
  /** Agent-specific options */
  options?: Record<string, any>
}

/**
 * Built-in agent tools
 */
export enum EAgentTool {
  mkdir = `mkdir`,
  listDir = `listDir`,
  readFile = `readFile`,
  shellExec = `shellExec`,
  webSearch = `webSearch`,
  writeFile = `writeFile`,
  deleteFile = `deleteFile`,
  fileExists = `fileExists`,
}

export type TAgentToolType = `${EAgentTool}`

export type TAgentRunOverrides = {
  model?: string
  tools?: string[]
  maxSteps?: number
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export type TAgentRunRequest = {
  orgId: string
  prompt: string
  agentId: string
  threadId?: string
  projectId?: string
  providerId?: string
  overrides?: TAgentRunOverrides
}

/**
 * TODO: Figure out a good way to expand this list
 * Support xai, zai, huggingface, open-router, vercel, etc.
 *
 * Supported LLM providers
 */
export enum ELLMProvider {
  zai = `zai`,
  openai = `openai`,
  google = `google`,
  anthropic = `anthropic`,
}

export type TLLMProviderType = `${ELLMProvider}`

/**
 * Unified message content types
 */
export enum EContentType {
  text = `text`,
  toolUse = `tool_use`,
  toolResult = `tool_result`,
}

export type TTextContent = {
  text: string
  type: `${EContentType.text}`
}

export type TToolUseContent = {
  id: string
  name: string
  input: Record<string, unknown>
  type: `${EContentType.toolUse}`
}

export type TToolResultContent = {
  content: string
  toolUseId: string
  isError?: boolean
  type: `${EContentType.toolResult}`
}

export type TMessageContent = TTextContent | TToolUseContent | TToolResultContent

export enum EMessageRole {
  user = `user`,
  system = `system`,
  assistant = `assistant`,
}

export type TMessageRole = `${EMessageRole}`

/**
 * Unified message format across all LLM providers
 */
export type TAIMessage = {
  role: TMessageRole
  content: TMessageContent[]
}

/**
 * Streaming event types
 */
export enum EStreamEventType {
  text = `text`,
  done = `done`,
  error = `error`,
  toolResult = `tool_result`,
  toolCallArgs = `tool_call_args`,
  toolCallStart = `tool_call_start`,
  toolExecutionUpdate = `tool_execution_update`,
}

export type TStreamEventType = `${EStreamEventType}`

export type TStreamTextEvent = {
  text: string
  type: `${EStreamEventType.text}`
}

export type TStreamToolCallStartEvent = {
  id: string
  name: string
  type: `${EStreamEventType.toolCallStart}`
}

export type TStreamToolCallArgsEvent = {
  id: string
  args: string
  type: `${EStreamEventType.toolCallArgs}`
}

export type TStreamToolResultEvent = {
  content: string
  toolUseId: string
  isError?: boolean
  type: `${EStreamEventType.toolResult}`
}

export type TStreamErrorEvent = {
  error: string
  type: `${EStreamEventType.error}`
}

export type TStreamToolExecutionUpdateEvent = {
  content: string
  toolUseId: string
  type: `${EStreamEventType.toolExecutionUpdate}`
}

export enum EStreamStopReason {
  error = `error`,
  endTurn = `end_turn`,
  toolUse = `tool_use`,
  maxTokens = `max_tokens`,
}

export type TStreamStopReason = `${EStreamStopReason}`

export type TStreamDoneEvent = {
  stopReason: TStreamStopReason
  type: `${EStreamEventType.done}`
}

export type TStreamEvent =
  | TStreamDoneEvent
  | TStreamErrorEvent
  | TStreamTextEvent
  | TStreamToolResultEvent
  | TStreamToolCallArgsEvent
  | TStreamToolCallStartEvent
  | TStreamToolExecutionUpdateEvent

/**
 * Tool definition for LLM providers (JSON Schema format)
 */
export type TLLMToolParam = {
  type: string
  enum?: string[]
  required?: string[]
  description?: string
  items?: TLLMToolParam
  properties?: Record<string, TLLMToolParam>
}

export type TLLMToolDef = {
  name: string
  description: string
  inputSchema: {
    type: `object`
    required?: string[]
    properties: Record<string, TLLMToolParam>
  }
}

/**
 * LLM adapter configuration
 */
export type TLLMAdapterConfig = {
  model: string
  apiKey?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  provider: TLLMProviderType
  options?: Record<string, unknown>
  headers?: Record<string, string>
  bodyParams?: Record<string, unknown>
}

/**
 * ILLMAdapter interface - implemented by each provider adapter
 */
export interface ILLMAdapter {
  readonly provider: TLLMProviderType
  stream(
    messages: TAIMessage[],
    tools: TLLMToolDef[],
    config: TLLMAdapterConfig
  ): AsyncIterable<TStreamEvent>
}
