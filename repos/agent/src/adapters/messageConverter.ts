import type { TMessageContent } from '@tdsk/domain'
import type {
  Message,
  ToolCall,
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  TextContent as PiTextContent,
  ImageContent as PiImageContent,
  ThinkingContent as PiThinkingContent,
} from '@earendil-works/pi-ai'

import { EContentType } from '@tdsk/domain'

/**
 * Convert Threaded Stack TAIMessage[] to pi-mono Message[] for loading history.
 * Accepts optional defaults for api/provider/model to avoid hardcoded Anthropic values
 * when reconstructing AssistantMessages from DB.
 */
export const convertToLlmMessages = (
  messages: Array<{
    type: string
    content: TMessageContent[]
    createdAt?: string | Date
  }>,
  defaults?: { api?: string; provider?: string; model?: string }
): Message[] => {
  const result: Message[] = []

  for (const msg of messages) {
    const ts = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now()
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
                timestamp: ts,
                toolCallId: tr.toolUseId,
                isError: tr.isError ?? false,
                content: [{ type: `text`, text: tr.content }],
              } satisfies ToolResultMessage)
            }
          }
        } else {
          // Regular user text/image/file message
          const hasImages = msg.content.some((c) => c.type === EContentType.image)
          const hasFiles = msg.content.some((c) => c.type === EContentType.file)
          if (hasImages || hasFiles) {
            // Mixed content: text + images/files → use array form
            const userContent: (PiTextContent | PiImageContent)[] = []
            for (const block of msg.content) {
              if (block.type === EContentType.text) {
                userContent.push({ type: `text`, text: block.text })
              } else if (block.type === EContentType.image) {
                userContent.push({
                  type: `image`,
                  data: block.data,
                  mimeType: block.mimeType,
                })
              } else if (block.type === EContentType.file) {
                const fileBlock = block as any
                if (fileBlock.extractedText) {
                  userContent.push({
                    type: `text`,
                    text: `[Attached file: ${fileBlock.fileName}]\n<extracted_content>\n${fileBlock.extractedText}\n</extracted_content>`,
                  })
                }
              }
            }
            result.push({
              role: `user`,
              content: userContent,
              timestamp: ts,
            } satisfies UserMessage)
          } else {
            // Text-only → use string form
            const text = msg.content
              .filter((c) => c.type === EContentType.text)
              .map((c) => (c as { text: string }).text)
              .join(`\n`)
            result.push({
              role: `user`,
              content: text,
              timestamp: ts,
            } satisfies UserMessage)
          }
        }
        break
      }

      case `assistant`: {
        const content: (PiTextContent | PiThinkingContent | ToolCall)[] = []
        for (const block of msg.content) {
          if (block.type === EContentType.text) {
            content.push({ type: `text`, text: block.text })
          } else if (block.type === EContentType.thinking) {
            content.push({
              type: `thinking`,
              thinking: block.thinking,
              thinkingSignature: block.thinkingSignature,
              redacted: block.redacted,
            })
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
          api: defaults?.api ?? `anthropic-messages`,
          provider: defaults?.provider ?? `anthropic`,
          model: defaults?.model ?? ``,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: `stop`,
          timestamp: ts,
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
 * Convert a pi-mono AssistantMessage to Threaded Stack TMessageContent[] for DB persistence.
 */
export const convertAssistantToContent = (msg: AssistantMessage): TMessageContent[] => {
  const content: TMessageContent[] = []

  for (const block of msg.content) {
    if (block.type === `text`) {
      content.push({ type: EContentType.text, text: block.text })
    } else if (block.type === `thinking`) {
      content.push({
        type: EContentType.thinking,
        thinking: block.thinking,
        thinkingSignature: block.thinkingSignature,
        redacted: block.redacted,
      })
    } else if (block.type === `toolCall`) {
      content.push({
        id: block.id,
        name: block.name,
        input: block.arguments,
        type: EContentType.toolUse,
      })
    }
  }

  return content
}

/**
 * Convert a pi-mono ToolResultMessage to Threaded Stack TMessageContent for DB persistence.
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
