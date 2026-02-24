import type { AgentEvent } from '@mariozechner/pi-agent-core'
import type { ToolCall } from '@mariozechner/pi-ai'
import type { TStreamEvent } from '@tdsk/domain'

import { EStreamEventType, EStreamStopReason } from '@tdsk/domain'

/**
 * pi-mono internal event type strings.
 * Kept local to the agent repo to decouple the WS protocol enum
 * from pi-mono's internal event naming.
 */
const PiMonoEventType = {
  // AssistantMessageEvent.type values
  TextDelta: `text_delta`,
  ToolCallStart: `toolcall_start`,
  ToolCallDelta: `toolcall_delta`,
  Done: `done`,
  Error: `error`,
  // AgentEvent.type values
  ToolExecutionUpdate: `tool_execution_update`,
  ToolExecutionEnd: `tool_execution_end`,
  AgentEnd: `agent_end`,
} as const

/**
 * Maps a pi-mono AgentEvent to ThreadedStack's TStreamEvent for WebSocket output.
 * Returns undefined for events that have no ThreadedStack equivalent.
 */
export const mapAgentEvent = (event: AgentEvent): TStreamEvent | undefined => {
  switch (event.type) {
    case `message_update`: {
      const ame = event.assistantMessageEvent
      switch (ame.type) {
        case PiMonoEventType.TextDelta:
          return {
            type: EStreamEventType.text,
            text: ame.delta,
          }

        case PiMonoEventType.ToolCallStart: {
          const tc = ame.partial.content[ame.contentIndex] as ToolCall | undefined
          return {
            type: EStreamEventType.toolCallStart,
            id: tc?.id ?? ``,
            name: tc?.name ?? ``,
          }
        }

        case PiMonoEventType.ToolCallDelta:
          return {
            type: EStreamEventType.toolCallArgs,
            id: (ame.partial.content[ame.contentIndex] as ToolCall | undefined)?.id ?? ``,
            args: ame.delta,
          }

        case PiMonoEventType.Done:
          return {
            type: EStreamEventType.done,
            stopReason:
              ame.reason === `toolUse`
                ? EStreamStopReason.toolUse
                : ame.reason === `length`
                  ? EStreamStopReason.maxTokens
                  : EStreamStopReason.endTurn,
          }

        case PiMonoEventType.Error:
          return {
            type: EStreamEventType.error,
            error: ame.error.errorMessage ?? `LLM error`,
          }

        default:
          return undefined
      }
    }

    case PiMonoEventType.ToolExecutionUpdate:
      return {
        type: EStreamEventType.toolExecutionUpdate,
        toolUseId: event.toolCallId,
        content: extractTextFromContent(event.partialResult?.content),
      }

    case PiMonoEventType.ToolExecutionEnd:
      return {
        type: EStreamEventType.toolResult,
        toolUseId: event.toolCallId,
        content: extractTextFromContent(event.result?.content),
        isError: event.isError,
      }

    case PiMonoEventType.AgentEnd:
      return {
        type: EStreamEventType.done,
        stopReason: EStreamStopReason.endTurn,
      }

    // Events we don't need to forward to WebSocket
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
