import { describe, it, expect } from 'vitest'
import { buildFallbackModel } from './buildFallbackModel'
import type { TLLMAdapterConfig } from '@TDM/types'

describe(`buildFallbackModel`, () => {
  const baseConfig: TLLMAdapterConfig = {
    model: `llama3.2`,
    provider: `ollama`,
    baseUrl: `http://localhost:11434/v1`,
    maxTokens: 4096,
  }

  it(`should return a valid model object for ollama config`, () => {
    const model = buildFallbackModel(baseConfig)

    expect(model).toBeDefined()
    expect(model?.id).toBe(`llama3.2`)
    expect(model?.name).toBe(`llama3.2`)
    expect(model?.api).toBe(`openai-completions`)
    expect(model?.provider).toBe(`ollama`)
    expect(model?.baseUrl).toBe(`http://localhost:11434/v1`)
    expect(model?.maxTokens).toBe(4096)
    expect(model?.reasoning).toBe(false)
    expect(model?.contextWindow).toBe(128000)
  })

  it(`should return a valid model object for openrouter config`, () => {
    const config: TLLMAdapterConfig = {
      model: `anthropic/claude-sonnet-4`,
      provider: `openrouter`,
      baseUrl: `https://openrouter.ai/api/v1`,
    }

    const model = buildFallbackModel(config)

    expect(model).toBeDefined()
    expect(model?.id).toBe(`anthropic/claude-sonnet-4`)
    expect(model?.provider).toBe(`openrouter`)
    expect(model?.baseUrl).toBe(`https://openrouter.ai/api/v1`)
    expect(model?.api).toBe(`openai-completions`)
  })

  it(`should return a valid model for custom provider config`, () => {
    const config: TLLMAdapterConfig = {
      model: `my-model`,
      provider: `custom`,
      baseUrl: `https://api.example.com/v1`,
    }

    const model = buildFallbackModel(config)

    expect(model).toBeDefined()
    expect(model?.id).toBe(`my-model`)
    expect(model?.provider).toBe(`custom`)
  })

  it(`should use default maxTokens of 8192 when not provided`, () => {
    const config: TLLMAdapterConfig = {
      model: `test-model`,
      provider: `ollama`,
      baseUrl: `http://localhost:11434/v1`,
    }

    const model = buildFallbackModel(config)
    expect(model?.maxTokens).toBe(8192)
  })

  it(`should include headers when provided`, () => {
    const config: TLLMAdapterConfig = {
      ...baseConfig,
      headers: { 'X-Custom': `value` },
    }

    const model = buildFallbackModel(config)
    expect(model?.headers).toEqual({ 'X-Custom': `value` })
  })

  it(`should return undefined when model is missing`, () => {
    const config = { ...baseConfig, model: `` } as TLLMAdapterConfig
    expect(buildFallbackModel(config)).toBeUndefined()
  })

  it(`should return undefined when provider is missing`, () => {
    // @ts-ignore
    const config = { ...baseConfig, provider: `` } as TLLMAdapterConfig
    expect(buildFallbackModel(config)).toBeUndefined()
  })

  it(`should return undefined when baseUrl is missing`, () => {
    const config = { ...baseConfig, baseUrl: undefined } as TLLMAdapterConfig
    expect(buildFallbackModel(config)).toBeUndefined()
  })

  it(`should include cost fields for compatibility`, () => {
    const model = buildFallbackModel(baseConfig)

    expect(model?.cost).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    })
  })

  it(`should set input to text`, () => {
    const model = buildFallbackModel(baseConfig)
    expect(model?.input).toEqual([`text`])
  })
})
