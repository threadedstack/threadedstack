import type { TOAIMessage, TOAIRequest } from '@TBE/types'
import type { TMessageContent, TAgentRunOverrides } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { EMsgType, EContentType } from '@tdsk/domain'

type TConvertedMessage = {
  type: `${EMsgType}`
  content: TMessageContent[]
}

/**
 * Extract the text content from the last user message as the prompt for AgentRunner.
 */
export const extractPrompt = (messages: TOAIMessage[]): string | undefined => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== `user`) continue

    if (typeof msg.content === `string`) return msg.content
    if (Array.isArray(msg.content)) {
      const textPart = msg.content.find((p) => p.type === `text`)
      if (textPart && `text` in textPart) return textPart.text
    }
  }
  return undefined
}

/**
 * Convert a single OpenAI message content to TMessageContent[].
 */
const convertContent = (content: TOAIMessage[`content`]): TMessageContent[] => {
  if (content === null || content === undefined) return []
  if (typeof content === `string`) {
    return [{ type: EContentType.text, text: content }]
  }
  return content.map((part) => {
    if (part.type === `text`) {
      return { type: EContentType.text as const, text: part.text }
    }
    if (!part.image_url?.url) {
      logger.warn(
        `[OAI RequestAdapter] image_url content part has no URL, replacing with placeholder`
      )
      return { type: EContentType.text as const, text: `[unsupported content]` }
    }
    const url = part.image_url.url
    const isDataUri = url.startsWith(`data:`)
    const mimeType = isDataUri ? url.substring(5, url.indexOf(`;`)) : `image/png`
    const data = isDataUri ? url.substring(url.indexOf(`,`) + 1) : url
    return { type: EContentType.image as const, data, mimeType }
  })
}

/**
 * Convert OpenAI messages array to ThreadedStack message format for thread seeding.
 * System messages are excluded — they are extracted as systemPrompt in buildOverrides().
 */
export const convertOAIMessages = (messages: TOAIMessage[]): TConvertedMessage[] => {
  const result: TConvertedMessage[] = []

  for (const msg of messages) {
    if (msg.role === `system`) continue

    const roleMap: Record<string, `${EMsgType}`> = {
      user: EMsgType.user,
      assistant: EMsgType.assistant,
      tool: EMsgType.tool,
    }

    const type = roleMap[msg.role]
    if (!type) continue

    // Handle tool result messages
    if (msg.role === `tool` && msg.tool_call_id) {
      result.push({
        type,
        content: [
          {
            type: EContentType.toolResult,
            toolUseId: msg.tool_call_id,
            content: typeof msg.content === `string` ? msg.content : ``,
          },
        ],
      })
      continue
    }

    // Handle assistant messages with tool calls
    if (msg.role === `assistant` && msg.tool_calls?.length) {
      const content: TMessageContent[] = []
      if (msg.content) {
        content.push(...convertContent(msg.content))
      }
      for (const tc of msg.tool_calls) {
        let input: Record<string, unknown> = {}
        try {
          input = JSON.parse(tc.function.arguments || `{}`)
        } catch {
          logger.warn(`Malformed JSON in tool_call arguments for "${tc.function.name}"`)
        }
        content.push({
          type: EContentType.toolUse,
          id: tc.id,
          name: tc.function.name,
          input,
        })
      }
      result.push({ type, content })
      continue
    }

    result.push({ type, content: convertContent(msg.content) })
  }

  return result
}

/**
 * Build TAgentRunOverrides from OpenAI request parameters.
 * Extracts system messages as systemPrompt override.
 *
 * Supported: model, temperature, max_tokens, max_completion_tokens, system messages.
 * Silently ignored: top_p, frequency_penalty, presence_penalty, stop, seed, response_format.
 */
export const buildOverrides = (body: TOAIRequest): TAgentRunOverrides => {
  const overrides: TAgentRunOverrides = {}

  if (body.model) overrides.model = body.model
  if (body.temperature !== undefined) overrides.temperature = body.temperature
  if (body.max_tokens !== undefined) overrides.maxTokens = body.max_tokens
  if (body.max_completion_tokens !== undefined)
    overrides.maxTokens = body.max_completion_tokens

  // Concatenate all system messages as systemPrompt
  const systemMessages = body.messages.filter((m) => m.role === `system`)
  if (systemMessages.length) {
    overrides.systemPrompt = systemMessages
      .map((m) =>
        typeof m.content === `string`
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .filter((p) => p.type === `text`)
                .map((p) => (p as { text: string }).text)
                .join(`\n`)
            : ``
      )
      .filter(Boolean)
      .join(`\n`)
  }

  return overrides
}
