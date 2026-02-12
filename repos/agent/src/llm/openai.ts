import type {
  ILLMAdapter,
  TLLMAdapterConfig,
  TLLMToolDef,
  TStreamEvent,
  TAIMessage,
} from '@tdsk/domain'

import OpenAI from 'openai'

/**
 * Convert unified messages to OpenAI format
 * Handles system, user, assistant, and tool result messages
 */
const toOpenAIMessages = (
  messages: TAIMessage[]
): OpenAI.ChatCompletionMessageParam[] => {
  const result: OpenAI.ChatCompletionMessageParam[] = []

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
      // User messages may contain tool results (OpenAI uses separate `tool` role messages)
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
          role: `tool` as const,
          tool_call_id: tr.toolUseId,
          content: tr.content,
        })
      }
      continue
    }

    // Assistant messages - may contain text and/or tool calls
    const textParts = msg.content.filter((c) => c.type === `text`)
    const toolParts = msg.content.filter((c) => c.type === `tool_use`)

    const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
      role: `assistant`,
      content: textParts.map((c) => c.text).join(``) || null,
    }

    if (toolParts.length > 0) {
      assistantMsg.tool_calls = toolParts.map((c) => ({
        id: c.id,
        type: `function` as const,
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
const toOpenAITools = (tools: TLLMToolDef[]): OpenAI.ChatCompletionTool[] => {
  return tools.map((t) => ({
    type: `function` as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }))
}

/**
 * OpenAI LLM adapter using native openai SDK
 * Streams via client.chat.completions.create({ stream: true })
 */
export class OpenAIAdapter implements ILLMAdapter {
  readonly provider = `openai` as const

  async *stream(
    messages: TAIMessage[],
    tools: TLLMToolDef[],
    config: TLLMAdapterConfig
  ): AsyncIterable<TStreamEvent> {
    const client = new OpenAI({ apiKey: config.apiKey })

    const params: OpenAI.ChatCompletionCreateParamsStreaming = {
      model: config.model,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature,
      messages: toOpenAIMessages(messages),
      stream: true,
    }

    if (tools.length > 0) {
      params.tools = toOpenAITools(tools)
    }

    const stream = await client.chat.completions.create(params)

    const toolCalls = new Map<number, { id: string; name: string; args: string }>()

    for await (const chunk of stream) {
      const choice = chunk.choices[0]
      if (!choice) continue

      const delta = choice.delta

      // Text content
      if (delta?.content) {
        yield { type: `text` as const, text: delta.content }
      }

      // Tool calls (streamed incrementally)
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index

          if (tc.id) {
            // New tool call starting
            toolCalls.set(idx, { id: tc.id, name: tc.function?.name || ``, args: `` })
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

      // Stream ended
      if (choice.finish_reason) {
        const stopReason =
          choice.finish_reason === `stop`
            ? (`end_turn` as const)
            : choice.finish_reason === `tool_calls`
              ? (`tool_use` as const)
              : choice.finish_reason === `length`
                ? (`max_tokens` as const)
                : (`end_turn` as const)

        yield { type: `done` as const, stopReason }
      }
    }
  }
}
