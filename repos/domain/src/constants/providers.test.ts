import { describe, it, expect } from 'vitest'
import { ProviderTemplates } from './providers'
import { ELLMProviderBrand } from '@TDM/types'

describe(`ProviderTemplates`, () => {
  it(`should have templates for configured providers only`, () => {
    const configuredBrands = Object.keys(ProviderTemplates) as ELLMProviderBrand[]
    for (const brand of configuredBrands) {
      expect(ProviderTemplates[brand]).toBeDefined()
      expect(ProviderTemplates[brand]!.id).toBe(brand)
    }
  })

  it(`should have 7 provider entries`, () => {
    expect(Object.keys(ProviderTemplates)).toHaveLength(7)
  })

  it(`should be config-only templates (no models or defaultModel)`, () => {
    for (const tmpl of Object.values(ProviderTemplates)) {
      expect(tmpl).not.toHaveProperty(`models`)
      expect(tmpl).not.toHaveProperty(`defaultModel`)
      expect(tmpl).toHaveProperty(`id`)
      expect(tmpl).toHaveProperty(`name`)
      expect(tmpl).toHaveProperty(`baseUrl`)
      expect(tmpl).toHaveProperty(`defaultSecretName`)
      expect(tmpl).toHaveProperty(`apiKeyPlaceholder`)
    }
  })

  describe(`OpenRouter template`, () => {
    const tmpl = ProviderTemplates[ELLMProviderBrand.openrouter]

    it(`should have correct id and name`, () => {
      expect(tmpl.id).toBe(`openrouter`)
      expect(tmpl.name).toBe(`OpenRouter`)
    })

    it(`should have correct baseUrl`, () => {
      expect(tmpl.baseUrl).toBe(`https://openrouter.ai/api/v1`)
    })

    it(`should have correct apiKeyPattern`, () => {
      expect(tmpl.apiKeyPattern).toBe(`^sk-or-`)
    })
  })

  describe(`Ollama template`, () => {
    const tmpl = ProviderTemplates[ELLMProviderBrand.ollama]

    it(`should have correct id and name`, () => {
      expect(tmpl.id).toBe(`ollama`)
      expect(tmpl.name).toBe(`Ollama`)
    })

    it(`should have correct baseUrl`, () => {
      expect(tmpl.baseUrl).toBe(`http://localhost:11434/v1`)
    })

    it(`should have empty apiKeyPattern`, () => {
      expect(tmpl.apiKeyPattern).toBe(``)
    })
  })

  describe(`Provider baseUrls`, () => {
    it(`should have Anthropic with correct baseUrl`, () => {
      expect(ProviderTemplates[ELLMProviderBrand.anthropic].baseUrl).toBe(
        `https://api.anthropic.com`
      )
    })

    it(`should have OpenAI with correct baseUrl`, () => {
      expect(ProviderTemplates[ELLMProviderBrand.openai].baseUrl).toBe(
        `https://api.openai.com/v1`
      )
    })

    it(`should have Custom with empty baseUrl`, () => {
      expect(ProviderTemplates[ELLMProviderBrand.custom].baseUrl).toBe(``)
    })
  })
})
