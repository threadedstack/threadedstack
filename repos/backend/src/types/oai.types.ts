/**
 * OpenAI Chat Completions API types.
 * These mirror the shapes expected/returned by the `openai` npm package.
 */

export type TOAIContentPart =
  | { type: `text`; text: string }
  | { type: `image_url`; image_url: { url: string; detail?: string } }

export type TOAIToolCall = {
  id: string
  type: `function`
  function: { name: string; arguments: string }
}

export type TOAIMessage = {
  name?: string
  tool_call_id?: string
  tool_calls?: TOAIToolCall[]
  content: string | TOAIContentPart[] | null
  role: `system` | `user` | `assistant` | `tool` | `developer`
}

export type TOAIRequest = {
  model?: string
  seed?: number
  top_p?: number
  stream?: boolean
  max_tokens?: number
  temperature?: number
  messages: TOAIMessage[]
  stop?: string | string[]
  threadId?: string
  presence_penalty?: number
  frequency_penalty?: number
  max_completion_tokens?: number
  response_format?: { type: string }
}

export type TOAIUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export type TOAIChoiceMessage = {
  role: `assistant`
  content: string | null
  tool_calls?: TOAIToolCall[]
}

export type TOAIChoiceDelta = {
  role?: `assistant`
  content?: string | null
  tool_calls?: TOAIToolCall[]
}

export type TOAIFinishReason = `stop` | `length` | `tool_calls` | `content_filter`

export type TOAIChoice = {
  index: number
  message: TOAIChoiceMessage
  finish_reason: TOAIFinishReason | null
}

export type TOAIChunkChoice = {
  index: number
  delta: TOAIChoiceDelta
  finish_reason: TOAIFinishReason | null
}

export type TOAIResponse = {
  id: string
  model: string
  created: number
  usage: TOAIUsage
  choices: TOAIChoice[]
  object: `chat.completion`
}

export type TOAIChunk = {
  id: string
  model: string
  created: number
  usage?: TOAIUsage
  choices: TOAIChunkChoice[]
  object: `chat.completion.chunk`
}

export type TOAIErrorType =
  | `invalid_request_error`
  | `authentication_error`
  | `rate_limit_error`
  | `server_error`

export type TOAIErrorBody = {
  error: {
    message: string
    type: TOAIErrorType
    code: string | null
    param: string | null
  }
}

export type TOAIModel = {
  id: string
  object: `model`
  created: number
  owned_by: string
}

export type TOAIModelList = {
  object: `list`
  data: TOAIModel[]
}
