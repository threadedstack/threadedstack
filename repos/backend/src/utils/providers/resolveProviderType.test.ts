import { describe, it, expect } from 'vitest'
import { resolveProviderType } from './resolveProviderType'

describe(`resolveProviderType`, () => {
  describe(`resolves from brand`, () => {
    it(`should return anthropic`, () => {
      expect(resolveProviderType({ name: `Anything`, brand: `anthropic` })).toBe(
        `anthropic`
      )
    })

    it(`should return openai`, () => {
      expect(resolveProviderType({ name: `Foo`, brand: `openai` })).toBe(`openai`)
    })

    it(`should return google`, () => {
      expect(resolveProviderType({ name: `Bar`, brand: `google` })).toBe(`google`)
    })

    it(`should return zai`, () => {
      expect(resolveProviderType({ name: `Baz`, brand: `zai` })).toBe(`zai`)
    })

    it(`should work regardless of provider name`, () => {
      expect(resolveProviderType({ name: `Custom LLM Gateway`, brand: `openai` })).toBe(
        `openai`
      )
    })
  })

  describe(`throws for missing or invalid brand`, () => {
    it(`should throw for unknown brand value`, () => {
      expect(() =>
        // @ts-ignore
        resolveProviderType({ name: `test`, brand: `invalid` })
      ).toThrow(`Cannot determine LLM provider`)
    })

    it(`should throw for non-string brand`, () => {
      expect(() => resolveProviderType({ name: `test`, brand: 123 as any })).toThrow(
        `Cannot determine LLM provider`
      )
    })

    it(`should throw when brand is null`, () => {
      expect(() => resolveProviderType({ name: `Anthropic`, brand: null })).toThrow(
        `Cannot determine LLM provider`
      )
    })

    it(`should throw when brand is undefined`, () => {
      expect(() => resolveProviderType({ name: `openai`, brand: undefined })).toThrow(
        `Cannot determine LLM provider`
      )
    })

    it(`should throw when name matches a provider but brand is missing`, () => {
      expect(() => resolveProviderType({ name: `anthropic`, brand: undefined })).toThrow(
        `Cannot determine LLM provider`
      )
    })

    it(`should throw for null name with no brand`, () => {
      expect(() => resolveProviderType({ name: null, brand: undefined })).toThrow(
        `Cannot determine LLM provider`
      )
    })

    it(`should include supported providers in error message`, () => {
      expect(() => resolveProviderType({ name: `bad`, brand: undefined })).toThrow(
        `Set provider.brand to one of:`
      )
    })

    it(`should include provider name in error message`, () => {
      expect(() =>
        resolveProviderType({ name: `My Custom LLM`, brand: undefined })
      ).toThrow(`"My Custom LLM"`)
    })

    it(`should show "unnamed" when name is missing`, () => {
      expect(() => resolveProviderType({ name: null, brand: null })).toThrow(`"unnamed"`)
    })
  })
})
