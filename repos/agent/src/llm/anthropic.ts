import type {
  ILLMAdapter,
  TLLMAdapterConfig,
  TLLMToolDef,
  TStreamEvent,
  TAIMessage,
} from '@tdsk/domain'

import Anthropic from '@anthropic-ai/sdk'

/**
 * Convert unified messages to Anthropic format
 * Filters out system messages (handled separately via the `system` param)
 */
const toAnthropicMessages = (messages: TAIMessage[]): Anthropic.MessageParam[] => {
  return messages
    .filter((m) => m.role !== `system`)
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content.map((c) => {
        if (c.type === `text`) return { type: `text` as const, text: c.text }
        if (c.type === `tool_use`)
          return { type: `tool_use` as const, id: c.id, name: c.name, input: c.input }
        return {
          content: c.content,
          is_error: c.isError,
          tool_use_id: c.toolUseId,
          type: `tool_result` as const,
        }
      }),
    }))
}

/**
 * Convert unified tool defs to Anthropic format
 */
const toAnthropicTools = (tools: TLLMToolDef[]): Anthropic.Tool[] => {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }))
}

/**
 * Anthropic LLM adapter using native @anthropic-ai/sdk
 * Streams via client.messages.stream()
 */
export class AnthropicAdapter implements ILLMAdapter {
  readonly provider = `anthropic` as const

  async *stream(
    messages: TAIMessage[],
    tools: TLLMToolDef[],
    config: TLLMAdapterConfig
  ): AsyncIterable<TStreamEvent> {
    const client = new Anthropic({
      apiKey: config.apiKey,
      defaultHeaders: config?.headers,
    })

    const systemPrompt =
      config.systemPrompt ||
      messages
        .find((m) => m.role === `system`)
        ?.content.filter((c) => c.type === `text`)
        .map((c) => c.text)
        .join(`\n`)

    const stream = client.messages.stream({
      model: config.model,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature,
      system: systemPrompt,
      messages: toAnthropicMessages(messages),
      tools: tools.length > 0 ? toAnthropicTools(tools) : undefined,
      ...config.bodyParams,
    })

    let currentToolId = ``

    for await (const event of stream) {
      if (event.type === `content_block_start`) {
        const block = event.content_block
        if (block.type === `tool_use`) {
          currentToolId = block.id
          yield {
            type: `tool_call_start` as const,
            id: block.id,
            name: block.name,
          }
        }
      } else if (event.type === `content_block_delta`) {
        const delta = event.delta
        if (delta.type === `text_delta`) {
          yield { type: `text` as const, text: delta.text }
        } else if (delta.type === `input_json_delta`) {
          yield {
            type: `tool_call_args` as const,
            id: currentToolId,
            args: delta.partial_json,
          }
        }
      } else if (event.type === `message_stop`) {
        const finalMessage = await stream.finalMessage()
        const stopReason =
          finalMessage.stop_reason === `end_turn`
            ? (`end_turn` as const)
            : finalMessage.stop_reason === `tool_use`
              ? (`tool_use` as const)
              : finalMessage.stop_reason === `max_tokens`
                ? (`max_tokens` as const)
                : (`end_turn` as const)

        yield { type: `done` as const, stopReason }
      }
    }
  }
}
