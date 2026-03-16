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
  role: `system` | `user` | `assistant` | `tool` | `developer`
  content: string | TOAIContentPart[] | null
  name?: string
  tool_calls?: TOAIToolCall[]
  tool_call_id?: string
}

export type TOAIRequest = {
  model?: string
  messages: TOAIMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  max_completion_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string | string[]
  seed?: number
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
  object: `chat.completion`
  created: number
  model: string
  choices: TOAIChoice[]
  usage: TOAIUsage
}

export type TOAIChunk = {
  id: string
  object: `chat.completion.chunk`
  created: number
  model: string
  choices: TOAIChunkChoice[]
  usage?: TOAIUsage
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
    param: string | null
    code: string | null
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
