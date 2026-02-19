import { describe, it, expect } from 'vitest'
import { validateLLMProvider } from './validateLLMProvider'

describe(`validateLLMProvider`, () => {
  describe(`skips non-AI provider types`, () => {
    it(`should not throw for git providers`, () => {
      expect(() => validateLLMProvider(`git`, undefined)).not.toThrow()
    })

    it(`should not throw for auth providers`, () => {
      expect(() => validateLLMProvider(`auth`, null)).not.toThrow()
    })

    it(`should not throw for storage providers`, () => {
      expect(() => validateLLMProvider(`storage`, undefined)).not.toThrow()
    })

    it(`should not throw when type is undefined`, () => {
      expect(() => validateLLMProvider(undefined, undefined)).not.toThrow()
    })
  })

  describe(`validates AI providers`, () => {
    it(`should accept anthropic`, () => {
      expect(() => validateLLMProvider(`ai`, `anthropic`)).not.toThrow()
    })

    it(`should accept openai`, () => {
      expect(() => validateLLMProvider(`ai`, `openai`)).not.toThrow()
    })

    it(`should accept google`, () => {
      expect(() => validateLLMProvider(`ai`, `google`)).not.toThrow()
    })

    it(`should accept zai`, () => {
      expect(() => validateLLMProvider(`ai`, `zai`)).not.toThrow()
    })

    it(`should throw when brand is missing`, () => {
      expect(() => validateLLMProvider(`ai`, undefined)).toThrow(
        `AI providers require brand`
      )
    })

    it(`should throw when brand is null`, () => {
      expect(() => validateLLMProvider(`ai`, null)).toThrow(`AI providers require brand`)
    })

    it(`should throw when brand is invalid`, () => {
      expect(() => validateLLMProvider(`ai`, `invalid`)).toThrow(`Got: "invalid"`)
    })

    it(`should throw when brand is not a string`, () => {
      expect(() => validateLLMProvider(`ai`, 123 as any)).toThrow(
        `AI providers require brand`
      )
    })
  })
})
