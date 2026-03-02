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

    it(`should use custom defaults for assistant message api/provider/model`, () => {
      const input = [
        {
          type: `assistant`,
          content: [{ type: EContentType.text, text: `response` }] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input, {
        api: `openai-completions`,
        provider: `openai`,
        model: `gpt-4o`,
      })

      expect(result).toHaveLength(1)
      const assistant = result[0] as AssistantMessage
      expect(assistant.api).toBe(`openai-completions`)
      expect(assistant.provider).toBe(`openai`)
      expect(assistant.model).toBe(`gpt-4o`)
    })

    it(`should fall back to anthropic defaults when no defaults provided`, () => {
      const input = [
        {
          type: `assistant`,
          content: [{ type: EContentType.text, text: `response` }] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      const assistant = result[0] as AssistantMessage
      expect(assistant.api).toBe(`anthropic-messages`)
      expect(assistant.provider).toBe(`anthropic`)
      expect(assistant.model).toBe(``)
    })

    it(`should use partial defaults with fallbacks for missing fields`, () => {
      const input = [
        {
          type: `assistant`,
          content: [{ type: EContentType.text, text: `response` }] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input, { api: `google-generative-ai` })

      expect(result).toHaveLength(1)
      const assistant = result[0] as AssistantMessage
      expect(assistant.api).toBe(`google-generative-ai`)
      expect(assistant.provider).toBe(`anthropic`)
      expect(assistant.model).toBe(``)
    })

    it(`should restore thinking blocks from assistant messages`, () => {
      const input = [
        {
          type: `assistant`,
          content: [
            {
              type: EContentType.thinking,
              thinking: `reasoning...`,
              thinkingSignature: `sig-1`,
              redacted: false,
            },
            { type: EContentType.text, text: `My answer` },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe(`assistant`)
      const assistant = result[0] as AssistantMessage
      expect(assistant.content).toHaveLength(2)
      expect(assistant.content[0]).toEqual({
        type: `thinking`,
        thinking: `reasoning...`,
        thinkingSignature: `sig-1`,
        redacted: false,
      })
      expect(assistant.content[1]).toEqual({ type: `text`, text: `My answer` })
    })

    it(`should convert user messages with image content to array form`, () => {
      const input = [
        {
          type: `user`,
          content: [
            { type: EContentType.text, text: `What is in this image?` },
            { type: EContentType.image, data: `base64data`, mimeType: `image/png` },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe(`user`)
      const user = result[0] as any
      expect(Array.isArray(user.content)).toBe(true)
      expect(user.content).toHaveLength(2)
      expect(user.content[0]).toEqual({ type: `text`, text: `What is in this image?` })
      expect(user.content[1]).toEqual({
        type: `image`,
        data: `base64data`,
        mimeType: `image/png`,
      })
    })

    it(`should convert user messages with file content to array form with extracted_content tags`, () => {
      const input = [
        {
          type: `user`,
          content: [
            { type: EContentType.text, text: `Please review this document` },
            {
              type: EContentType.file,
              assetId: `asset-1`,
              fileName: `report.pdf`,
              fileType: `application/pdf`,
              fileSize: 1024,
              extractedText: `This is the extracted report content`,
            },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe(`user`)
      const user = result[0] as any
      expect(Array.isArray(user.content)).toBe(true)
      expect(user.content).toHaveLength(2)
      expect(user.content[0]).toEqual({
        type: `text`,
        text: `Please review this document`,
      })
      expect(user.content[1]).toEqual({
        type: `text`,
        text: `[Attached file: report.pdf]\n<extracted_content>\nThis is the extracted report content\n</extracted_content>`,
      })
    })

    it(`should skip file blocks without extractedText`, () => {
      const input = [
        {
          type: `user`,
          content: [
            { type: EContentType.text, text: `Check this file` },
            {
              type: EContentType.file,
              assetId: `asset-2`,
              fileName: `empty.pdf`,
              fileType: `application/pdf`,
              fileSize: 0,
            },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe(`user`)
      const user = result[0] as any
      expect(Array.isArray(user.content)).toBe(true)
      expect(user.content).toHaveLength(1)
      expect(user.content[0]).toEqual({ type: `text`, text: `Check this file` })
    })

    it(`should handle mixed text + file content`, () => {
      const input = [
        {
          type: `user`,
          content: [
            { type: EContentType.text, text: `Compare these files` },
            {
              type: EContentType.file,
              assetId: `asset-3`,
              fileName: `doc1.txt`,
              fileType: `text/plain`,
              fileSize: 512,
              extractedText: `First document content`,
            },
            {
              type: EContentType.file,
              assetId: `asset-4`,
              fileName: `doc2.txt`,
              fileType: `text/plain`,
              fileSize: 256,
              extractedText: `Second document content`,
            },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      const user = result[0] as any
      expect(Array.isArray(user.content)).toBe(true)
      expect(user.content).toHaveLength(3)
      expect(user.content[0]).toEqual({ type: `text`, text: `Compare these files` })
      expect(user.content[1]).toEqual({
        type: `text`,
        text: `[Attached file: doc1.txt]\n<extracted_content>\nFirst document content\n</extracted_content>`,
      })
      expect(user.content[2]).toEqual({
        type: `text`,
        text: `[Attached file: doc2.txt]\n<extracted_content>\nSecond document content\n</extracted_content>`,
      })
    })

    it(`should handle file-only messages (no text)`, () => {
      const input = [
        {
          type: `user`,
          content: [
            {
              type: EContentType.file,
              assetId: `asset-5`,
              fileName: `data.csv`,
              fileType: `text/csv`,
              fileSize: 2048,
              extractedText: `col1,col2\nval1,val2`,
            },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      const user = result[0] as any
      expect(Array.isArray(user.content)).toBe(true)
      expect(user.content).toHaveLength(1)
      expect(user.content[0]).toEqual({
        type: `text`,
        text: `[Attached file: data.csv]\n<extracted_content>\ncol1,col2\nval1,val2\n</extracted_content>`,
      })
    })

    it(`should handle mixed text + image + file content`, () => {
      const input = [
        {
          type: `user`,
          content: [
            { type: EContentType.text, text: `Analyze this image and document` },
            { type: EContentType.image, data: `imgbase64`, mimeType: `image/jpeg` },
            {
              type: EContentType.file,
              assetId: `asset-6`,
              fileName: `notes.md`,
              fileType: `text/markdown`,
              fileSize: 768,
              extractedText: `# Notes\nSome important notes`,
            },
          ] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      const user = result[0] as any
      expect(Array.isArray(user.content)).toBe(true)
      expect(user.content).toHaveLength(3)
      expect(user.content[0]).toEqual({
        type: `text`,
        text: `Analyze this image and document`,
      })
      expect(user.content[1]).toEqual({
        type: `image`,
        data: `imgbase64`,
        mimeType: `image/jpeg`,
      })
      expect(user.content[2]).toEqual({
        type: `text`,
        text: `[Attached file: notes.md]\n<extracted_content>\n# Notes\nSome important notes\n</extracted_content>`,
      })
    })

    it(`should use string form for user messages without images`, () => {
      const input = [
        {
          type: `user`,
          content: [{ type: EContentType.text, text: `just text` }] as TMessageContent[],
        },
      ]
      const result = convertToLlmMessages(input)

      expect(result).toHaveLength(1)
      const user = result[0] as any
      expect(typeof user.content).toBe(`string`)
      expect(user.content).toBe(`just text`)
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

    it(`should persist thinking blocks`, () => {
      const msg = mkAssistantMsg([
        {
          type: `thinking`,
          thinking: `let me consider...`,
          thinkingSignature: `sig-abc`,
          redacted: false,
        } as any,
        { type: `text`, text: `Here is my answer` },
      ])
      const result = convertAssistantToContent(msg)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        type: EContentType.thinking,
        thinking: `let me consider...`,
        thinkingSignature: `sig-abc`,
        redacted: false,
      })
      expect(result[1]).toEqual({ type: EContentType.text, text: `Here is my answer` })
    })

    it(`should persist thinking blocks without optional fields`, () => {
      const msg = mkAssistantMsg([
        { type: `thinking`, thinking: `reasoning here` } as any,
        { type: `text`, text: `result` },
      ])
      const result = convertAssistantToContent(msg)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        type: EContentType.thinking,
        thinking: `reasoning here`,
        thinkingSignature: undefined,
        redacted: undefined,
      })
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
