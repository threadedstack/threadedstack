import type {
  ILLMAdapter,
  TAIMessage,
  TLLMToolDef,
  TStreamEvent,
  TLLMProviderType,
  TLLMAdapterConfig,
  TStreamStopReason,
} from '@tdsk/domain'

type TOpenAIMessage = {
  role: string
  content?: string | { type: string; text: string }[] | null
  tool_calls?: {
    id: string
    type: string
    function: { name: string; arguments: string }
  }[]
  tool_call_id?: string
}

type TOpenAITool = {
  type: string
  function: {
    name: string
    description: string
    parameters: TLLMToolDef[`inputSchema`]
  }
}

/**
 * Convert unified messages to OpenAI chat completions format
 */
export const toOpenAIMessages = (messages: TAIMessage[]): TOpenAIMessage[] => {
  const result: TOpenAIMessage[] = []

  for (const msg of messages) {
    if (msg.role === `system`) {
      const text = msg.content
        .filter((c) => c.type === `text`)
        .map((c) => c.text)
        .join(`\n`)
      result.push({ role: `system`, content: text })
      continue
    }

    if (msg.role === `user`) {
      const textParts = msg.content.filter((c) => c.type === `text`)
      const toolResults = msg.content.filter((c) => c.type === `tool_result`)

      if (textParts.length > 0) {
        const parts = textParts.map((c) => ({
          type: `text` as const,
          text: c.text,
        }))
        result.push({ role: `user`, content: parts })
      }

      for (const tr of toolResults) {
        result.push({
          role: `tool`,
          tool_call_id: tr.toolUseId,
          content: tr.content,
        })
      }
      continue
    }

    const textParts = msg.content.filter((c) => c.type === `text`)
    const toolParts = msg.content.filter((c) => c.type === `tool_use`)

    const assistantMsg: TOpenAIMessage = {
      role: `assistant`,
      content: textParts.map((c) => c.text).join(``) || null,
    }

    if (toolParts.length > 0) {
      assistantMsg.tool_calls = toolParts.map((c) => ({
        id: c.id,
        type: `function`,
        function: { name: c.name, arguments: JSON.stringify(c.input) },
      }))
    }

    result.push(assistantMsg)
  }

  return result
}

/**
 * Convert unified tool defs to OpenAI function calling format
 */
export const toOpenAITools = (tools: TLLMToolDef[]): TOpenAITool[] => {
  return tools.map((t) => ({
    type: `function`,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }))
}

/**
 * Abstract base class for OpenAI-compatible LLM providers.
 * Uses raw fetch + SSE parsing (no SDK dependency).
 * Subclasses override getBaseUrl, getHeaders, getExtraBody, mapFinishReason.
 */
export abstract class OpenAICompatibleAdapter implements ILLMAdapter {
  abstract readonly provider: TLLMProviderType

  protected abstract getBaseUrl(config: TLLMAdapterConfig): string

  protected getHeaders(config: TLLMAdapterConfig): Record<string, string> {
    return {
      'Content-Type': `application/json`,
      Authorization: `Bearer ${config.apiKey}`,
      ...config?.headers,
    }
  }

  protected getExtraBody(
    _config: TLLMAdapterConfig,
    _tools: TLLMToolDef[]
  ): Record<string, unknown> {
    return {}
  }

  protected mapFinishReason(reason: string): TStreamStopReason {
    switch (reason) {
      case `stop`:
        return `end_turn`
      case `tool_calls`:
        return `tool_use`
      case `length`:
        return `max_tokens`
      default:
        return `end_turn`
    }
  }

  async *stream(
    messages: TAIMessage[],
    tools: TLLMToolDef[],
    config: TLLMAdapterConfig
  ): AsyncIterable<TStreamEvent> {
    const url = `${this.getBaseUrl(config)}/chat/completions`
    const headers = this.getHeaders(config)
    const extraBody = this.getExtraBody(config, tools)

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature,
      messages: toOpenAIMessages(messages),
      stream: true,
      ...config.bodyParams,
      ...extraBody,
    }

    if (tools.length > 0 && !extraBody.tools) {
      body.tools = toOpenAITools(tools)
    }

    const res = await fetch(url, {
      method: `POST`,
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      yield {
        type: `error` as const,
        error: `${this.provider} API error ${res.status}: ${errText}`,
      }
      yield { type: `done` as const, stopReason: `error` as const }
      return
    }

    if (!res.body) {
      yield { type: `error` as const, error: `No response body` }
      yield { type: `done` as const, stopReason: `error` as const }
      return
    }

    const toolCalls = new Map<number, { id: string; name: string; args: string }>()
    let buffer = ``
    const decoder = new TextDecoder()
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(`\n`)
      buffer = lines.pop() || ``

      for (const line of lines) {
        if (!line.startsWith(`data: `)) continue
        const data = line.slice(6).trim()
        if (data === `[DONE]`) return

        const chunk = JSON.parse(data)
        const choice = chunk.choices?.[0]
        if (!choice) continue

        const delta = choice.delta

        if (delta?.content) {
          yield { type: `text` as const, text: delta.content }
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index

            if (tc.id) {
              toolCalls.set(idx, {
                id: tc.id,
                name: tc.function?.name || ``,
                args: ``,
              })
              yield {
                type: `tool_call_start` as const,
                id: tc.id,
                name: tc.function?.name || ``,
              }
            }

            if (tc.function?.arguments) {
              const existing = toolCalls.get(idx)
              if (existing) {
                existing.args += tc.function.arguments
                yield {
                  type: `tool_call_args` as const,
                  id: existing.id,
                  args: tc.function.arguments,
                }
              }
            }
          }
        }

        if (choice.finish_reason) {
          yield {
            type: `done` as const,
            stopReason: this.mapFinishReason(choice.finish_reason),
          }
        }
      }
    }
  }
}
