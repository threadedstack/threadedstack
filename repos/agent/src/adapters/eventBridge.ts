import type { AgentEvent } from '@mariozechner/pi-agent-core'
import type { ToolCall } from '@mariozechner/pi-ai'
import type { TStreamEvent } from '@tdsk/domain'

import { EStreamEventType, EStreamStopReason } from '@tdsk/domain'

/**
 * Maps a pi-mono AgentEvent to ThreadedStack's TStreamEvent for SSE output.
 * Returns undefined for events that have no ThreadedStack equivalent.
 */
export const mapAgentEvent = (event: AgentEvent): TStreamEvent | undefined => {
  switch (event.type) {
    case `message_update`: {
      const ame = event.assistantMessageEvent
      switch (ame.type) {
        case `text_delta`:
          return {
            type: EStreamEventType.text,
            text: ame.delta,
          }

        case `toolcall_start`: {
          const tc = ame.partial.content[ame.contentIndex] as ToolCall | undefined
          return {
            type: EStreamEventType.toolCallStart,
            id: tc?.id ?? ``,
            name: tc?.name ?? ``,
          }
        }

        case `toolcall_delta`:
          return {
            type: EStreamEventType.toolCallArgs,
            id: (ame.partial.content[ame.contentIndex] as ToolCall | undefined)?.id ?? ``,
            args: ame.delta,
          }

        case `done`:
          return {
            type: EStreamEventType.done,
            stopReason:
              ame.reason === `toolUse`
                ? EStreamStopReason.toolUse
                : ame.reason === `length`
                  ? EStreamStopReason.maxTokens
                  : EStreamStopReason.endTurn,
          }

        case `error`:
          return {
            type: EStreamEventType.error,
            error: ame.error.errorMessage ?? `LLM error`,
          }

        default:
          return undefined
      }
    }

    case `tool_execution_update`:
      return {
        type: EStreamEventType.toolExecutionUpdate,
        toolUseId: event.toolCallId,
        content: extractTextFromContent(event.partialResult?.content),
      }

    case `tool_execution_end`:
      return {
        type: EStreamEventType.toolResult,
        toolUseId: event.toolCallId,
        content: extractTextFromContent(event.result?.content),
        isError: event.isError,
      }

    case `agent_end`:
      return {
        type: EStreamEventType.done,
        stopReason: EStreamStopReason.endTurn,
      }

    // Events we don't need to forward to SSE
    case `agent_start`:
    case `turn_start`:
    case `turn_end`:
    case `message_start`:
    case `message_end`:
    case `tool_execution_start`:
      return undefined

    default:
      return undefined
  }
}

/**
 * Extract text from pi-mono content array (TextContent | ImageContent)
 */
const extractTextFromContent = (
  content?: Array<{ type: string; text?: string }>
): string => {
  if (!content) return ``
  return content
    .filter((c) => c.type === `text` && c.text)
    .map((c) => c.text)
    .join(`\n`)
}
