import { describe, it, expect } from 'vitest'
import { ProviderTemplates } from './providers'
import { ELLMProviderBrand } from '@TDM/types'

describe(`ProviderTemplates`, () => {
  it(`should have entries for all ELLMProviderBrand values`, () => {
    const brands = Object.values(ELLMProviderBrand)
    for (const brand of brands) {
      expect(ProviderTemplates[brand]).toBeDefined()
      expect(ProviderTemplates[brand].id).toBe(brand)
    }
  })

  it(`should have 7 provider entries`, () => {
    expect(Object.keys(ProviderTemplates)).toHaveLength(7)
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

    it(`should have a defaultModel set`, () => {
      expect(tmpl.defaultModel).toBeTruthy()
    })

    it(`should have static preset models`, () => {
      expect(tmpl.models.length).toBeGreaterThan(0)
      for (const model of tmpl.models) {
        expect(model.id).toBeTruthy()
        expect(model.name).toBeTruthy()
      }
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

    it(`should have empty models array for dynamic fetching`, () => {
      expect(tmpl.models).toEqual([])
    })

    it(`should have a defaultModel set`, () => {
      expect(tmpl.defaultModel).toBe(`llama3.2`)
    })
  })

  describe(`Existing providers unchanged`, () => {
    it(`should still have Anthropic with correct baseUrl`, () => {
      expect(ProviderTemplates[ELLMProviderBrand.anthropic].baseUrl).toBe(
        `https://api.anthropic.com`
      )
    })

    it(`should still have OpenAI with correct baseUrl`, () => {
      expect(ProviderTemplates[ELLMProviderBrand.openai].baseUrl).toBe(
        `https://api.openai.com/v1`
      )
    })

    it(`should still have Custom with empty baseUrl`, () => {
      expect(ProviderTemplates[ELLMProviderBrand.custom].baseUrl).toBe(``)
    })
  })
})
