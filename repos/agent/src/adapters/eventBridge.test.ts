import { describe, it, expect, vi } from 'vitest'
import type { AgentEvent } from '@earendil-works/pi-agent-core'

/**
 * Mock @tdsk/domain to avoid the transitive @TDM/constants/values
 * resolution issue in the vitest environment. Only the two enums
 * used by eventBridge.ts are needed.
 */
vi.mock(`@tdsk/domain`, () => ({
  EStreamEventType: {
    text: `text`,
    done: `done`,
    error: `error`,
    thinking: `thinking`,
    turnEnd: `turn_end`,
    toolResult: `tool_result`,
    toolCallArgs: `tool_call_args`,
    toolCallStart: `tool_call_start`,
    toolExecutionUpdate: `tool_execution_update`,
  },
  EStreamStopReason: {
    error: `error`,
    endTurn: `end_turn`,
    toolUse: `tool_use`,
    maxTokens: `max_tokens`,
  },
}))

import { mapAgentEvent } from './eventBridge'
import { EStreamEventType, EStreamStopReason } from '@tdsk/domain'

/**
 * Helper to build a minimal AssistantMessage partial for pi-mono events.
 */
const makePartial = (content: any[] = []) =>
  ({
    role: `assistant` as const,
    content,
    api: `anthropic-messages`,
    provider: `anthropic`,
    model: `claude-sonnet-4-20250514`,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: `stop` as const,
    timestamp: Date.now(),
  }) as any

describe(`mapAgentEvent`, () => {
  describe(`message_update - text_delta`, () => {
    it(`should return a text event with the delta string`, () => {
      const event: AgentEvent = {
        type: `message_update`,
        message: makePartial(),
        assistantMessageEvent: {
          type: `text_delta`,
          contentIndex: 0,
          delta: `Hello`,
          partial: makePartial(),
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.text,
        text: `Hello`,
      })
    })
  })

  describe(`message_update - toolcall_start`, () => {
    it(`should return a tool_call_start event with id and name from partial content`, () => {
      const toolCallContent = {
        type: `toolCall`,
        id: `tc-1`,
        name: `shellExec`,
        arguments: {},
      }
      const event: AgentEvent = {
        type: `message_update`,
        message: makePartial([toolCallContent]),
        assistantMessageEvent: {
          type: `toolcall_start`,
          contentIndex: 0,
          partial: makePartial([toolCallContent]),
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.toolCallStart,
        id: `tc-1`,
        name: `shellExec`,
      })
    })

    it(`should return empty id and name when contentIndex has no ToolCall`, () => {
      const event: AgentEvent = {
        type: `message_update`,
        message: makePartial([]),
        assistantMessageEvent: {
          type: `toolcall_start`,
          contentIndex: 0,
          partial: makePartial([]),
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.toolCallStart,
        id: ``,
        name: ``,
      })
    })
  })

  describe(`message_update - toolcall_delta`, () => {
    it(`should return a tool_call_args event with id and args delta`, () => {
      const toolCallContent = {
        type: `toolCall`,
        id: `tc-2`,
        name: `readFile`,
        arguments: {},
      }
      const event: AgentEvent = {
        type: `message_update`,
        message: makePartial([toolCallContent]),
        assistantMessageEvent: {
          type: `toolcall_delta`,
          contentIndex: 0,
          delta: `{"path":"/tmp/f"}`,
          partial: makePartial([toolCallContent]),
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.toolCallArgs,
        id: `tc-2`,
        args: `{"path":"/tmp/f"}`,
      })
    })

    it(`should return empty id when contentIndex has no ToolCall`, () => {
      const event: AgentEvent = {
        type: `message_update`,
        message: makePartial([]),
        assistantMessageEvent: {
          type: `toolcall_delta`,
          contentIndex: 0,
          delta: `{"x":1}`,
          partial: makePartial([]),
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.toolCallArgs,
        id: ``,
        args: `{"x":1}`,
      })
    })
  })

  describe(`message_update - done`, () => {
    it(`should map reason "toolUse" to stopReason tool_use`, () => {
      const msg = makePartial()
      const event: AgentEvent = {
        type: `message_update`,
        message: msg,
        assistantMessageEvent: {
          type: `done`,
          reason: `toolUse`,
          message: msg,
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.done,
        stopReason: EStreamStopReason.toolUse,
      })
    })

    it(`should map reason "length" to stopReason max_tokens`, () => {
      const msg = makePartial()
      const event: AgentEvent = {
        type: `message_update`,
        message: msg,
        assistantMessageEvent: {
          type: `done`,
          reason: `length`,
          message: msg,
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.done,
        stopReason: EStreamStopReason.maxTokens,
      })
    })

    it(`should map reason "stop" to stopReason end_turn`, () => {
      const msg = makePartial()
      const event: AgentEvent = {
        type: `message_update`,
        message: msg,
        assistantMessageEvent: {
          type: `done`,
          reason: `stop`,
          message: msg,
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.done,
        stopReason: EStreamStopReason.endTurn,
      })
    })
  })

  describe(`message_update - error`, () => {
    it(`should return an error event with the errorMessage`, () => {
      const errorMsg = {
        ...makePartial(),
        stopReason: `error` as const,
        errorMessage: `boom`,
      }
      const event: AgentEvent = {
        type: `message_update`,
        message: errorMsg,
        assistantMessageEvent: {
          type: `error`,
          reason: `error`,
          error: errorMsg,
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.error,
        error: `boom`,
      })
    })

    it(`should fall back to "LLM error" when errorMessage is undefined`, () => {
      const errorMsg = {
        ...makePartial(),
        stopReason: `error` as const,
      }
      const event: AgentEvent = {
        type: `message_update`,
        message: errorMsg,
        assistantMessageEvent: {
          type: `error`,
          reason: `error`,
          error: errorMsg,
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.error,
        error: `LLM error`,
      })
    })
  })

  describe(`message_update - thinking_delta`, () => {
    it(`should return a thinking event with the delta string`, () => {
      const event: AgentEvent = {
        type: `message_update`,
        message: makePartial(),
        assistantMessageEvent: {
          type: `thinking_delta`,
          contentIndex: 0,
          delta: `Let me consider this problem...`,
          partial: makePartial(),
        } as any,
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.thinking,
        thinking: `Let me consider this problem...`,
      })
    })
  })

  describe(`message_update - unhandled sub-types`, () => {
    const unhandledTypes = [
      `start`,
      `text_start`,
      `text_end`,
      `thinking_start`,
      `thinking_end`,
      `toolcall_end`,
    ] as const

    for (const ameType of unhandledTypes) {
      it(`should return undefined for "${ameType}"`, () => {
        const event: AgentEvent = {
          type: `message_update`,
          message: makePartial(),
          assistantMessageEvent: {
            type: ameType,
            contentIndex: 0,
            partial: makePartial(),
          } as any,
        }

        const result = mapAgentEvent(event)
        expect(result).toBeUndefined()
      })
    }
  })

  describe(`tool_execution_update`, () => {
    it(`should return a tool_execution_update event with toolUseId and extracted text content`, () => {
      const event: AgentEvent = {
        type: `tool_execution_update`,
        toolCallId: `tc-1`,
        toolName: `shellExec`,
        args: { command: `ls` },
        partialResult: {
          content: [{ type: `text`, text: `running...` }],
          details: {},
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.toolExecutionUpdate,
        toolUseId: `tc-1`,
        content: `running...`,
      })
    })

    it(`should join multiple text content items with newlines`, () => {
      const event: AgentEvent = {
        type: `tool_execution_update`,
        toolCallId: `tc-3`,
        toolName: `shellExec`,
        args: {},
        partialResult: {
          content: [
            { type: `text`, text: `line1` },
            { type: `text`, text: `line2` },
          ],
          details: {},
        },
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.toolExecutionUpdate,
        toolUseId: `tc-3`,
        content: `line1\nline2`,
      })
    })

    it(`should return empty string when partialResult has no content`, () => {
      const event: AgentEvent = {
        type: `tool_execution_update`,
        toolCallId: `tc-4`,
        toolName: `readFile`,
        args: {},
        partialResult: undefined,
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.toolExecutionUpdate,
        toolUseId: `tc-4`,
        content: ``,
      })
    })
  })

  describe(`tool_execution_end`, () => {
    it(`should return a tool_result event with toolUseId, content, and isError`, () => {
      const event: AgentEvent = {
        type: `tool_execution_end`,
        toolCallId: `tc-1`,
        toolName: `shellExec`,
        result: {
          content: [{ type: `text`, text: `done` }],
          details: {},
        },
        isError: false,
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.toolResult,
        toolUseId: `tc-1`,
        content: `done`,
        isError: false,
      })
    })

    it(`should set isError true when the tool execution failed`, () => {
      const event: AgentEvent = {
        type: `tool_execution_end`,
        toolCallId: `tc-5`,
        toolName: `writeFile`,
        result: {
          content: [{ type: `text`, text: `ENOENT: no such file` }],
          details: {},
        },
        isError: true,
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.toolResult,
        toolUseId: `tc-5`,
        content: `ENOENT: no such file`,
        isError: true,
      })
    })

    it(`should return empty content when result has no content`, () => {
      const event: AgentEvent = {
        type: `tool_execution_end`,
        toolCallId: `tc-6`,
        toolName: `deleteFile`,
        result: undefined,
        isError: false,
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.toolResult,
        toolUseId: `tc-6`,
        content: ``,
        isError: false,
      })
    })
  })

  describe(`agent_end`, () => {
    it(`should return a done event with stopReason end_turn`, () => {
      const event: AgentEvent = {
        type: `agent_end`,
        messages: [],
      }

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.done,
        stopReason: EStreamStopReason.endTurn,
      })
    })
  })

  describe(`turn_end`, () => {
    it(`should return a turnEnd event with usage data`, () => {
      const event = {
        type: `turn_end`,
        message: makePartial(),
        toolResults: [],
      } as unknown as AgentEvent

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.turnEnd,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      })
    })

    it(`should return empty usage when message is not an assistant message`, () => {
      const event = {
        type: `turn_end`,
        message: { role: `user`, content: `hi`, timestamp: 1 },
        toolResults: [],
      } as unknown as AgentEvent

      const result = mapAgentEvent(event)
      expect(result).toEqual({
        type: EStreamEventType.turnEnd,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      })
    })
  })

  describe(`events that return undefined`, () => {
    const silentEvents: Array<{ type: string; extra?: Record<string, any> }> = [
      { type: `agent_start` },
      { type: `turn_start` },
      { type: `message_start`, extra: { message: makePartial() } },
      { type: `message_end`, extra: { message: makePartial() } },
      {
        type: `tool_execution_start`,
        extra: { toolCallId: `tc-0`, toolName: `shellExec`, args: {} },
      },
    ]

    for (const { type, extra } of silentEvents) {
      it(`should return undefined for "${type}"`, () => {
        const event = { type, ...extra } as AgentEvent
        const result = mapAgentEvent(event)
        expect(result).toBeUndefined()
      })
    }
  })
})
