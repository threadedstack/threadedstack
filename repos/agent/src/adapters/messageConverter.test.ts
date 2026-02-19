import { describe, it, expect } from 'vitest'
import type { AssistantMessage, ToolResultMessage } from '@mariozechner/pi-ai'
import { EContentType } from '@tdsk/domain'
import type { TMessageContent } from '@tdsk/domain'

import {
  convertToLlmMessages,
  convertAssistantToContent,
  convertToolResultToContent,
} from '@TAG/adapters/messageConverter'

const mkAssistantMsg = (content: AssistantMessage['content']): AssistantMessage => ({
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
})

const mkToolResultMsg = (
  overrides: Partial<ToolResultMessage> = {}
): ToolResultMessage => ({
  role: `toolResult`,
  toolCallId: `tc-1`,
  toolName: `readFile`,
  content: [{ type: `text`, text: `result` }],
  isError: false,
  timestamp: Date.now(),
  ...overrides,
})

describe(`messageConverter`, () => {
  describe(`convertToLlmMessages`, () => {
    it(`should convert a user text message to a UserMessage`, () => {
      const input = [
        {
          type: `user`,
          content: [
            { type: EContentType.text, text: `hello world` },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe(`user`)
      expect((result[0] as any).content).toBe(`hello world`)
    })

    it(`should convert a user message with tool_result content to ToolResultMessage`, () => {
      const input = [
        {
          type: `user`,
          content: [
            {
              type: EContentType.toolResult,
              toolUseId: `call-123`,
              content: `file contents here`,
              isError: false,
            },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe(`toolResult`)
      const tr = result[0] as ToolResultMessage
      expect(tr.toolCallId).toBe(`call-123`)
      expect(tr.content).toEqual([{ type: `text`, text: `file contents here` }])
      expect(tr.isError).toBe(false)
    })

    it(`should convert an assistant message with text content to AssistantMessage`, () => {
      const input = [
        {
          type: `assistant`,
          content: [
            { type: EContentType.text, text: `I can help with that` },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe(`assistant`)
      const assistant = result[0] as AssistantMessage
      expect(assistant.content).toEqual([{ type: `text`, text: `I can help with that` }])
    })

    it(`should convert an assistant message with toolCall content to AssistantMessage with ToolCall`, () => {
      const input = [
        {
          type: `assistant`,
          content: [
            {
              type: EContentType.toolUse,
              id: `tool-1`,
              name: `readFile`,
              input: { path: `/tmp/test.txt` },
            },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe(`assistant`)
      const assistant = result[0] as AssistantMessage
      expect(assistant.content).toHaveLength(1)
      expect(assistant.content[0]).toEqual({
        type: `toolCall`,
        id: `tool-1`,
        name: `readFile`,
        arguments: { path: `/tmp/test.txt` },
      })
    })

    it(`should skip system messages`, () => {
      const input = [
        {
          type: `system`,
          content: [
            { type: EContentType.text, text: `system prompt` },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(0)
    })

    it(`should convert mixed messages in correct order`, () => {
      const input = [
        {
          type: `user`,
          content: [{ type: EContentType.text, text: `hi` }] as TMessageContent[],
        },
        {
          type: `assistant`,
          content: [{ type: EContentType.text, text: `hello` }] as TMessageContent[],
        },
        {
          type: `system`,
          content: [{ type: EContentType.text, text: `ignored` }] as TMessageContent[],
        },
        {
          type: `user`,
          content: [
            {
              type: EContentType.toolResult,
              toolUseId: `tc-99`,
              content: `tool output`,
              isError: false,
            },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(3)
      expect(result[0].role).toBe(`user`)
      expect(result[1].role).toBe(`assistant`)
      expect(result[2].role).toBe(`toolResult`)
    })

    it(`should return an empty array for empty input`, () => {
      const result = convertToLlmMessages([])
      expect(result).toEqual([])
    })
  })

  describe(`convertAssistantToContent`, () => {
    it(`should convert text content to TTextContent`, () => {
      const msg = mkAssistantMsg([{ type: `text`, text: `response text` }])
      const result = convertAssistantToContent(msg)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ type: EContentType.text, text: `response text` })
    })

    it(`should convert toolCall content to TToolUseContent`, () => {
      const msg = mkAssistantMsg([
        {
          type: `toolCall`,
          id: `call-abc`,
          name: `writeFile`,
          arguments: { path: `/tmp/out.txt`, content: `data` },
        },
      ])
      const result = convertAssistantToContent(msg)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: EContentType.toolUse,
        id: `call-abc`,
        name: `writeFile`,
        input: { path: `/tmp/out.txt`, content: `data` },
      })
    })

    it(`should convert mixed text and toolCall content`, () => {
      const msg = mkAssistantMsg([
        { type: `text`, text: `Let me read that file` },
        {
          type: `toolCall`,
          id: `call-xyz`,
          name: `readFile`,
          arguments: { path: `/tmp/file.ts` },
        },
      ])
      const result = convertAssistantToContent(msg)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        type: EContentType.text,
        text: `Let me read that file`,
      })
      expect(result[1]).toEqual({
        type: EContentType.toolUse,
        id: `call-xyz`,
        name: `readFile`,
        input: { path: `/tmp/file.ts` },
      })
    })

    it(`should skip thinking blocks`, () => {
      const msg = mkAssistantMsg([
        { type: `thinking` as any, thinking: `let me consider...` } as any,
        { type: `text`, text: `Here is my answer` },
      ])
      const result = convertAssistantToContent(msg)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ type: EContentType.text, text: `Here is my answer` })
    })
  })

  describe(`convertToolResultToContent`, () => {
    it(`should convert a simple tool result to TToolResultContent`, () => {
      const tr = mkToolResultMsg({
        toolCallId: `call-100`,
        content: [{ type: `text`, text: `file data here` }],
        isError: false,
      })
      const result = convertToolResultToContent(tr)

      expect(result).toEqual({
        type: EContentType.toolResult,
        toolUseId: `call-100`,
        content: `file data here`,
        isError: false,
      })
    })

    it(`should join multiple text blocks with newline`, () => {
      const tr = mkToolResultMsg({
        content: [
          { type: `text`, text: `line one` },
          { type: `text`, text: `line two` },
        ],
      })
      const result = convertToolResultToContent(tr)

      expect(result.type).toBe(EContentType.toolResult)
      expect((result as any).content).toBe(`line one\nline two`)
    })

    it(`should preserve isError true`, () => {
      const tr = mkToolResultMsg({
        toolCallId: `call-err`,
        content: [{ type: `text`, text: `Error: file not found` }],
        isError: true,
      })
      const result = convertToolResultToContent(tr)

      expect(result).toEqual({
        type: EContentType.toolResult,
        toolUseId: `call-err`,
        content: `Error: file not found`,
        isError: true,
      })
    })
  })
})
