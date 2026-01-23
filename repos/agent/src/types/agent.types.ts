export type TRole = `system` | `user` | `assistant`
export type TMessage = {
  role: TRole
  content: string
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

export interface ILLMProvider {
  key: string
  url: string
  model: string
  path?: string
  type: TLLMProvider
  complete(system: string, user: string): Promise<string>
}

export type TContextOpts = {
  max?: number
}

export type TAgentConfig = {
  url: string
  path?: string
  model: string
  apiKey: string
  provider: TLLMProvider
  maxTokens?: number
}

export type TInitOpts = {
  prompt: string
  config: TAgentConfig
  projectId: string
  onTokenCallback: (token: string) => void
}

export type TTSAgentOpts = {
  tempDir?: string
  mutex?: TMutexOpts
  exec?: TExecutorOpts
  bridge?: TWasmBridgeOpts
}

import type { TMutexOpts } from './mutex.types'
import type { TExecutorOpts } from './executor.types'
import type { TWasmBridgeOpts } from './wasm.types'
