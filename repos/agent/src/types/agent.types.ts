import type { TMutexOpts } from './mutex.types'
import type { TWasmBridgeOpts } from './wasm.types'
import type { TExecutorOpts } from './executor.types'
import type { TSandboxMetadata } from './sandbox.types'

export type TRole = `system` | `user` | `assistant` | `tool`
export type TMessage = {
  role: TRole
  content: string
  tool_call_id?: string
  tool_calls?: TToolCall[]
}

export type TToolCall = {
  id: string
  type: `function`
  function: {
    name: string
    arguments: string
  }
}

export type TToolResult = {
  tool_call_id: string
  output: string
  error?: string
}

export type TLLMProvider = `openai` | `gemini` | `anthropic` | `grok` | `zai`

export type TLLMBaseOpts = {
  key: string
  url: string
  path?: string
  model: string
  type: TLLMProvider
}

export type TLLMProviderOpts = Omit<TLLMBaseOpts, `url` | `path` | `model`> & {
  url?: string
  path?: string
  model?: string
}

export type TLLMResponse = {
  content: string
  tool_calls?: TToolCall[]
  finish_reason?: `stop` | `tool_calls` | `length`
}

export interface ILLMProvider {
  key: string
  url: string
  model: string
  path?: string
  type: TLLMProvider
  complete(system: string, messages: TMessage[], tools: any[]): Promise<TLLMResponse>
}

export type TContextOpts = {
  max?: number
}

export type TAgentConfig = {
  url: string
  path?: string
  model: string
  apiKey: string
  maxTokens?: number
  provider: TLLMProvider
  tools?: {
    allow?: string[] // If specified, only these tools are allowed
    disallow?: string[] // These tools are explicitly disallowed
    custom?: TSandboxMetadata[] // User-supplied custom tools
  }
}

export type TInitOpts = {
  prompt: string
  projectId: string
  config: TAgentConfig
  history?: TMessage[] // Optional previous conversation messages
  onToken: (token: string) => void
}

export type TTSAgentOpts = {
  tempDir?: string
  mutex?: TMutexOpts
  exec?: TExecutorOpts
  bridge?: TWasmBridgeOpts
}
