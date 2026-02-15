import { describe, it, expect } from 'vitest'
import { resolveProviderType } from './resolveProviderType'

describe(`resolveProviderType`, () => {
  describe(`Priority 1: explicit options.llmProvider`, () => {
    it(`should return llmProvider when set to a valid ELLMProvider value`, () => {
      expect(
        resolveProviderType({ name: `Anything`, options: { llmProvider: `anthropic` } })
      ).toBe(`anthropic`)
    })

    it(`should return google from options even when name is "Google AI"`, () => {
      expect(
        resolveProviderType({ name: `Google AI`, options: { llmProvider: `google` } })
      ).toBe(`google`)
    })

    it(`should return openai from options`, () => {
      expect(
        resolveProviderType({ name: `Foo`, options: { llmProvider: `openai` } })
      ).toBe(`openai`)
    })

    it(`should ignore invalid llmProvider and fall through to name matching`, () => {
      expect(
        resolveProviderType({ name: `anthropic`, options: { llmProvider: `invalid` } })
      ).toBe(`anthropic`)
    })

    it(`should ignore non-string llmProvider`, () => {
      expect(resolveProviderType({ name: `openai`, options: { llmProvider: 123 } })).toBe(
        `openai`
      )
    })
  })

  describe(`Priority 2: exact name match against ELLMProvider`, () => {
    it(`should match "anthropic" name (case-insensitive)`, () => {
      expect(resolveProviderType({ name: `Anthropic`, options: {} })).toBe(`anthropic`)
    })

    it(`should match "openai" name`, () => {
      expect(resolveProviderType({ name: `openai`, options: {} })).toBe(`openai`)
    })

    it(`should match "google" name`, () => {
      expect(resolveProviderType({ name: `google`, options: {} })).toBe(`google`)
    })
  })

  describe(`Priority 3: match against ProviderTemplate display names`, () => {
    it(`should match "Google AI" display name to google`, () => {
      expect(resolveProviderType({ name: `Google AI`, options: {} })).toBe(`google`)
    })

    it(`should match "OpenAI" display name to openai`, () => {
      expect(resolveProviderType({ name: `OpenAI`, options: {} })).toBe(`openai`)
    })

    it(`should match "Anthropic" display name to anthropic`, () => {
      expect(resolveProviderType({ name: `Anthropic`, options: {} })).toBe(`anthropic`)
    })

    it(`should be case-insensitive for template matching`, () => {
      expect(resolveProviderType({ name: `google ai`, options: {} })).toBe(`google`)
    })
  })

  describe(`Priority 4: throw for unresolvable provider`, () => {
    it(`should throw for unknown provider name`, () => {
      expect(() =>
        resolveProviderType({ name: `unknown-provider`, options: {} })
      ).toThrow(`Cannot determine LLM provider`)
    })

    it(`should throw for null name with no options`, () => {
      expect(() => resolveProviderType({ name: null, options: {} })).toThrow(
        `Cannot determine LLM provider`
      )
    })

    it(`should throw for empty name with no options`, () => {
      expect(() => resolveProviderType({ name: ``, options: {} })).toThrow(
        `Cannot determine LLM provider`
      )
    })

    it(`should throw for "Custom Provider" (custom template excluded)`, () => {
      expect(() => resolveProviderType({ name: `Custom Provider`, options: {} })).toThrow(
        `Cannot determine LLM provider`
      )
    })

    it(`should include supported providers in error message`, () => {
      expect(() => resolveProviderType({ name: `bad`, options: {} })).toThrow(
        `Set provider.options.llmProvider to one of:`
      )
    })

    it(`should include provider name in error message`, () => {
      expect(() => resolveProviderType({ name: `My Custom LLM`, options: {} })).toThrow(
        `"My Custom LLM"`
      )
    })

    it(`should show "unnamed" when name is missing`, () => {
      expect(() => resolveProviderType({ name: null, options: null })).toThrow(
        `"unnamed"`
      )
    })
  })
})
