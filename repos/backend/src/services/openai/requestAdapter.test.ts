import { describe, it, expect, vi } from 'vitest'
import { extractPrompt, convertOAIMessages, buildOverrides } from './requestAdapter'
import { EMsgType, EContentType } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}))

describe(`extractPrompt`, () => {
  it(`should extract text from last user message (string)`, () => {
    const result = extractPrompt([
      { role: `user`, content: `first` },
      { role: `assistant`, content: `reply` },
      { role: `user`, content: `second` },
    ])
    expect(result).toBe(`second`)
  })

  it(`should extract text from content parts array`, () => {
    const result = extractPrompt([
      {
        role: `user`,
        content: [
          { type: `image_url`, image_url: { url: `data:image/png;base64,abc` } },
          { type: `text`, text: `describe this` },
        ],
      },
    ])
    expect(result).toBe(`describe this`)
  })

  it(`should return undefined when no user messages`, () => {
    const result = extractPrompt([{ role: `system`, content: `you are helpful` }])
    expect(result).toBeUndefined()
  })

  it(`should return undefined for content parts with no text`, () => {
    const result = extractPrompt([
      {
        role: `user`,
        content: [
          { type: `image_url`, image_url: { url: `http://example.com/img.png` } },
        ],
      },
    ])
    expect(result).toBeUndefined()
  })
})

describe(`convertOAIMessages`, () => {
  it(`should skip system messages`, () => {
    const result = convertOAIMessages([
      { role: `system`, content: `you are helpful` },
      { role: `user`, content: `hello` },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe(EMsgType.user)
  })

  it(`should convert user string content`, () => {
    const result = convertOAIMessages([{ role: `user`, content: `hello` }])
    expect(result[0].content).toEqual([{ type: EContentType.text, text: `hello` }])
  })

  it(`should convert image_url with data URI`, () => {
    const result = convertOAIMessages([
      {
        role: `user`,
        content: [
          { type: `image_url`, image_url: { url: `data:image/jpeg;base64,/9j/4AA` } },
        ],
      },
    ])
    expect(result[0].content[0]).toEqual({
      type: EContentType.image,
      data: `/9j/4AA`,
      mimeType: `image/jpeg`,
    })
  })

  it(`should handle image_url with regular URL`, () => {
    const result = convertOAIMessages([
      {
        role: `user`,
        content: [
          { type: `image_url`, image_url: { url: `https://example.com/img.png` } },
        ],
      },
    ])
    expect(result[0].content[0]).toEqual({
      type: EContentType.image,
      data: `https://example.com/img.png`,
      mimeType: `image/png`,
    })
  })

  it(`should handle missing image_url field gracefully`, () => {
    const result = convertOAIMessages([
      {
        role: `user`,
        content: [{ type: `image_url` } as any],
      },
    ])
    expect(result[0].content[0]).toEqual({
      type: EContentType.text,
      text: `[unsupported content]`,
    })
  })

  it(`should convert tool messages with tool_call_id`, () => {
    const result = convertOAIMessages([
      { role: `tool`, content: `result data`, tool_call_id: `call-1` },
    ])
    expect(result[0].type).toBe(EMsgType.tool)
    expect(result[0].content[0]).toEqual({
      type: EContentType.toolResult,
      toolUseId: `call-1`,
      content: `result data`,
    })
  })

  it(`should convert assistant messages with tool_calls`, () => {
    const result = convertOAIMessages([
      {
        role: `assistant`,
        content: `Let me check`,
        tool_calls: [
          {
            id: `call-1`,
            type: `function` as const,
            function: { name: `search`, arguments: `{"q":"test"}` },
          },
        ],
      },
    ])
    expect(result[0].content).toHaveLength(2)
    expect(result[0].content[0]).toEqual({
      type: EContentType.text,
      text: `Let me check`,
    })
    expect(result[0].content[1]).toEqual({
      type: EContentType.toolUse,
      id: `call-1`,
      name: `search`,
      input: { q: `test` },
    })
  })

  it(`should handle malformed tool_call arguments gracefully`, () => {
    const result = convertOAIMessages([
      {
        role: `assistant`,
        content: null,
        tool_calls: [
          {
            id: `call-1`,
            type: `function` as const,
            function: { name: `search`, arguments: `{invalid json` },
          },
        ],
      },
    ])
    expect(result[0].content[0]).toEqual({
      type: EContentType.toolUse,
      id: `call-1`,
      name: `search`,
      input: {},
    })
  })

  it(`should handle null content`, () => {
    const result = convertOAIMessages([{ role: `assistant`, content: null }])
    expect(result[0].content).toEqual([])
  })
})

describe(`buildOverrides`, () => {
  it(`should extract model override`, () => {
    const result = buildOverrides({ messages: [], model: `gpt-4` })
    expect(result.model).toBe(`gpt-4`)
  })

  it(`should extract temperature`, () => {
    const result = buildOverrides({ messages: [], temperature: 0.5 })
    expect(result.temperature).toBe(0.5)
  })

  it(`should prefer max_completion_tokens over max_tokens`, () => {
    const result = buildOverrides({
      messages: [],
      max_tokens: 100,
      max_completion_tokens: 200,
    })
    expect(result.maxTokens).toBe(200)
  })

  it(`should concatenate system messages as systemPrompt`, () => {
    const result = buildOverrides({
      messages: [
        { role: `system`, content: `You are helpful.` },
        { role: `system`, content: `Be concise.` },
        { role: `user`, content: `hello` },
      ],
    })
    expect(result.systemPrompt).toBe(`You are helpful.\nBe concise.`)
  })

  it(`should return empty overrides for minimal body`, () => {
    const result = buildOverrides({ messages: [{ role: `user`, content: `hi` }] })
    expect(result).toEqual({})
  })

  it(`should extract text from array-format system messages`, () => {
    const result = buildOverrides({
      messages: [
        {
          role: `system`,
          content: [
            { type: `text`, text: `You are helpful.` },
            { type: `text`, text: `Be concise.` },
          ],
        },
        { role: `user`, content: `hello` },
      ],
    })
    expect(result.systemPrompt).toBe(`You are helpful.\nBe concise.`)
  })

  it(`should handle mixed string and array system messages`, () => {
    const result = buildOverrides({
      messages: [
        { role: `system`, content: `First instruction.` },
        {
          role: `system`,
          content: [{ type: `text`, text: `Second instruction.` }],
        },
        { role: `user`, content: `hello` },
      ],
    })
    expect(result.systemPrompt).toBe(`First instruction.\nSecond instruction.`)
  })

  it(`should extract max_tokens as maxTokens`, () => {
    const result = buildOverrides({ messages: [], max_tokens: 500 })
    expect(result.maxTokens).toBe(500)
  })
})

describe(`convertOAIMessages — unknown roles`, () => {
  it(`should skip messages with unrecognized roles`, () => {
    const result = convertOAIMessages([
      { role: `developer` as any, content: `system instruction` },
      { role: `user`, content: `hello` },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe(EMsgType.user)
  })
})
