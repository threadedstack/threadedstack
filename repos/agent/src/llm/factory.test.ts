import { OpenAIAdapter } from './openai'
import { GoogleAdapter } from './google'
import { createLLMAdapter } from './factory'
import { AnthropicAdapter } from './anthropic'
import { describe, it, expect, vi } from 'vitest'

vi.mock(`@TAG/llm/anthropic`, () => ({
  AnthropicAdapter: vi.fn().mockImplementation(() => ({
    provider: `anthropic`,
    stream: vi.fn(),
  })),
}))

vi.mock(`@TAG/llm/openai`, () => ({
  OpenAIAdapter: vi.fn().mockImplementation(() => ({
    provider: `openai`,
    stream: vi.fn(),
  })),
}))

vi.mock(`@TAG/llm/google`, () => ({
  GoogleAdapter: vi.fn().mockImplementation(() => ({
    provider: `google`,
    stream: vi.fn(),
  })),
}))

describe(`createLLMAdapter`, () => {
  it(`should create an AnthropicAdapter for 'anthropic'`, () => {
    const adapter = createLLMAdapter(`anthropic`)
    expect(adapter).toBeInstanceOf(AnthropicAdapter)
    expect(adapter.provider).toBe(`anthropic`)
  })

  it(`should create an OpenAIAdapter for 'openai'`, () => {
    const adapter = createLLMAdapter(`openai`)
    expect(adapter).toBeInstanceOf(OpenAIAdapter)
    expect(adapter.provider).toBe(`openai`)
  })

  it(`should create a GoogleAdapter for 'google'`, () => {
    const adapter = createLLMAdapter(`google`)
    expect(adapter).toBeInstanceOf(GoogleAdapter)
    expect(adapter.provider).toBe(`google`)
  })

  it(`should throw for unknown provider`, () => {
    expect(() => createLLMAdapter(`cohere` as any)).toThrow(
      `Unknown LLM provider: cohere`
    )
  })

  it(`should create new instances on each call`, () => {
    const a1 = createLLMAdapter(`anthropic`)
    const a2 = createLLMAdapter(`anthropic`)
    expect(a1).not.toBe(a2)
  })

  it(`should return adapters that implement ILLMAdapter`, () => {
    for (const provider of [`anthropic`, `openai`, `google`] as const) {
      const adapter = createLLMAdapter(provider)
      expect(adapter).toHaveProperty(`provider`)
      expect(adapter).toHaveProperty(`stream`)
      expect(typeof adapter.stream).toBe(`function`)
    }
  })
})
