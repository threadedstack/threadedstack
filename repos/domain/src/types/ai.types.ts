export enum EMsgType {
  user = `user`,
  tool = `tool`,
  system = `system`,
  action = `action`,
  assistant = `assistant`,
}

export type TMsgType = `${EMsgType}`

export type TAgentEnvVars = Record<string, string>

export type TThinkingLevel = `off` | `minimal` | `low` | `medium` | `high` | `xhigh`

export type TThinkingBudgets = {
  minimal?: number
  low?: number
  medium?: number
  high?: number
}

export type TContextCompaction = {
  enabled: boolean
  strategy: `prune` | `compact`
  compactionModel?: string
}

export type TAgentEnvironment = {
  /** Maximum memory in MB */
  memory?: number
  /** Execution timeout in milliseconds */
  timeout?: number
  /** Whether to enable streaming responses */
  streaming?: boolean
  /** Maximum retries for transient LLM errors (default 2) */
  maxRetries?: number
  /** Temperature for response generation */
  temperature?: number
  /** Context budget as percentage of model context window (default 80) */
  contextBudgetPercent?: number
  /** Thinking/reasoning level for models that support it */
  thinkingLevel?: TThinkingLevel
  /** Token budgets per thinking level (token-based providers only) */
  thinkingBudgets?: TThinkingBudgets
  /** Context compaction configuration */
  contextCompaction?: TContextCompaction
  /** Prompt cache retention preference (none/short/long) — passed through to streaming providers */
  cacheRetention?: `none` | `short` | `long`
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

/** Shared config fields for runtime agent configuration updates. */
export type TAgentConfigFields = {
  model?: string
  provider?: string
  tools?: string[]
  systemPrompt?: string
  thinkingLevel?: TThinkingLevel
}

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
 * Supported LLM providers.
 * Includes all pi-mono KnownProvider values plus platform-specific providers (custom, ollama).
 */
export enum ELLMProviderBrand {
  zai = `zai`,
  xai = `xai`,
  groq = `groq`,
  openai = `openai`,
  google = `google`,
  custom = `custom`,
  ollama = `ollama`,
  mistral = `mistral`,
  minimax = `minimax`,
  cerebras = `cerebras`,
  opencode = `opencode`,
  anthropic = `anthropic`,
  openrouter = `openrouter`,
  huggingface = `huggingface`,
  kimiCoding = `kimi-coding`,
  minimaxCn = `minimax-cn`,
  openaiCodex = `openai-codex`,
  googleVertex = `google-vertex`,
  githubCopilot = `github-copilot`,
  amazonBedrock = `amazon-bedrock`,
  googleGeminiCli = `google-gemini-cli`,
  googleAntigravity = `google-antigravity`,
  vercelAiGateway = `vercel-ai-gateway`,
  azureOpenaiResponses = `azure-openai-responses`,
}

export type TLLMProviderBrand = `${ELLMProviderBrand}`

/**
 * Unified message content types
 */
export enum EContentType {
  text = `text`,
  image = `image`,
  thinking = `thinking`,
  toolUse = `tool_use`,
  toolResult = `tool_result`,
  file = `file`,
  artifact = `artifact`,
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

export type TImageContent = {
  data: string
  mimeType: string
  type: `${EContentType.image}`
}

export type TThinkingContent = {
  thinking: string
  type: `${EContentType.thinking}`
  thinkingSignature?: string
  redacted?: boolean
}

export type TToolResultContent = {
  content: string
  toolUseId: string
  isError?: boolean
  type: `${EContentType.toolResult}`
}

export type TFileContent = {
  type: `${EContentType.file}`
  assetId: string
  fileName: string
  fileType: string
  fileSize: number
  extractedText?: string
}

export type TArtifactType =
  | `html`
  | `svg`
  | `markdown`
  | `code`
  | `json`
  | `csv`
  | `yaml`
  | `xml`
  | `mermaid`
  | `latex`
  | `image`
  | `table`
  | `diff`
  | `plaintext`

export type TArtifactContent = {
  type: `${EContentType.artifact}`
  artifactType: TArtifactType
  content: string
  title?: string
  language?: string
}

/**
 * Shared attachment types used across WS messages and agent runner options
 */
export type TImageAttachment = { data: string; mimeType: string }

export type TFileAttachment = {
  assetId: string
  fileName: string
  mimeType: string
  extractedText?: string
  imageData?: string
}

/**
 * Shared cost shape used in model info and token usage
 */
export type TModelCost = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type TMessageContent =
  | TTextContent
  | TImageContent
  | TFileContent
  | TThinkingContent
  | TToolUseContent
  | TToolResultContent
  | TArtifactContent

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
  thinking = `thinking`,
  toolResult = `tool_result`,
  toolCallArgs = `tool_call_args`,
  toolCallStart = `tool_call_start`,
  turnEnd = `turn_end`,
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

export type TStreamThinkingEvent = {
  thinking: string
  type: `${EStreamEventType.thinking}`
}

export type TStreamToolExecutionUpdateEvent = {
  content: string
  toolUseId: string
  type: `${EStreamEventType.toolExecutionUpdate}`
}

/**
 * Token usage and cost tracking from pi-mono
 */
export type TTokenUsage = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cost: TModelCost & { total: number }
}

export type TStreamTurnEndEvent = {
  usage: TTokenUsage
  type: `${EStreamEventType.turnEnd}`
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
  | TStreamThinkingEvent
  | TStreamTurnEndEvent
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
  baseUrl?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  provider: TLLMProviderBrand
  options?: Record<string, unknown>
  headers?: Record<string, string>
  bodyParams?: Record<string, unknown>
}

/**
 * ILLMAdapter interface - implemented by each provider adapter
 */
export interface ILLMAdapter {
  readonly provider: TLLMProviderBrand
  stream(
    messages: TAIMessage[],
    tools: TLLMToolDef[],
    config: TLLMAdapterConfig
  ): AsyncIterable<TStreamEvent>
}
