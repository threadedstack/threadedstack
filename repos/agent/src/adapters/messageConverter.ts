import type { TMessageContent } from '@tdsk/domain'
import type {
  Message,
  ToolCall,
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  TextContent as PiTextContent,
} from '@mariozechner/pi-ai'

import { EContentType } from '@tdsk/domain'

/**
 * Convert ThreadedStack TAIMessage[] to pi-mono Message[] for loading history.
 */
export const convertToLlmMessages = (
  messages: Array<{ type: string; content: TMessageContent[] }>
): Message[] => {
  const result: Message[] = []

  for (const msg of messages) {
    switch (msg.type) {
      case `user`: {
        // Check if this is a tool result message (content has tool_result blocks)
        const toolResults = msg.content.filter((c) => c.type === EContentType.toolResult)
        if (toolResults.length > 0) {
          // Each tool_result becomes a separate ToolResultMessage
          for (const tr of toolResults) {
            if (tr.type === EContentType.toolResult) {
              result.push({
                toolName: ``,
                role: `toolResult`,
                timestamp: Date.now(),
                toolCallId: tr.toolUseId,
                isError: tr.isError ?? false,
                content: [{ type: `text`, text: tr.content }],
              } satisfies ToolResultMessage)
            }
          }
        } else {
          // Regular user text message
          const text = msg.content
            .filter((c) => c.type === EContentType.text)
            .map((c) => (c as { text: string }).text)
            .join(`\n`)
          result.push({
            role: `user`,
            content: text,
            timestamp: Date.now(),
          } satisfies UserMessage)
        }
        break
      }

      case `assistant`: {
        const content: (PiTextContent | ToolCall)[] = []
        for (const block of msg.content) {
          if (block.type === EContentType.text) {
            content.push({ type: `text`, text: block.text })
          } else if (block.type === EContentType.toolUse) {
            content.push({
              type: `toolCall`,
              id: block.id,
              name: block.name,
              arguments: block.input,
            })
          }
        }
        result.push({
          role: `assistant`,
          content,
          api: `anthropic-messages`,
          provider: `anthropic`,
          model: ``,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: `stop`,
          timestamp: Date.now(),
        } satisfies AssistantMessage)
        break
      }

      case `system`:
        // System messages are handled via systemPrompt, skip
        break
    }
  }

  return result
}

/**
 * Convert a pi-mono AssistantMessage to ThreadedStack TMessageContent[] for DB persistence.
 */
export const convertAssistantToContent = (msg: AssistantMessage): TMessageContent[] => {
  const content: TMessageContent[] = []

  for (const block of msg.content) {
    if (block.type === `text`) {
      content.push({ type: EContentType.text, text: block.text })
    } else if (block.type === `toolCall`) {
      content.push({
        id: block.id,
        name: block.name,
        input: block.arguments,
        type: EContentType.toolUse,
      })
    }
    // thinking blocks are not persisted in ThreadedStack format
  }

  return content
}

/**
 * Convert a pi-mono ToolResultMessage to ThreadedStack TMessageContent for DB persistence.
 */
export const convertToolResultToContent = (tr: ToolResultMessage): TMessageContent => ({
  type: EContentType.toolResult,
  toolUseId: tr.toolCallId,
  content: tr.content
    .filter((c) => c.type === `text`)
    .map((c) => (c as PiTextContent).text)
    .join(`\n`),
  isError: tr.isError,
})
