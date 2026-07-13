import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { ModelRegistry } from '@TBE/services/providers/modelRegistry'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// Shrinks ProviderFetchTimeoutMS so the hang/timeout test below completes in
// milliseconds instead of the real 10s.
vi.mock(`@TBE/constants/values`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('@TBE/constants/values')>()
  return { ...actual, ProviderFetchTimeoutMS: 50 }
})

const { mockGetModels, mockGetModel } = vi.hoisted(() => ({
  mockGetModels: vi.fn(),
  mockGetModel: vi.fn(),
}))

vi.mock(`@earendil-works/pi-ai`, () => ({
  getModels: mockGetModels,
  getModel: mockGetModel,
}))

describe(`ModelRegistry`, () => {
  beforeEach(() => {
    mockGetModels.mockReset()
    mockGetModel.mockReset()
  })

  describe(`getModels`, () => {
    it(`maps pi-ai models to TProviderModel shape`, () => {
      mockGetModels.mockReturnValue([
        {
          id: `gpt-4o`,
          name: `GPT-4o`,
          maxTokens: 4096,
          contextWindow: 128000,
          reasoning: true,
          cost: { input: 5, output: 15 },
          input: [`text`, `image`],
        },
      ])

      const result = ModelRegistry.getModels(`openai`)

      expect(mockGetModels).toHaveBeenCalledWith(`openai`)
      expect(result).toEqual([
        {
          id: `gpt-4o`,
          name: `GPT-4o`,
          maxTokens: 4096,
          contextWindow: 128000,
          reasoning: true,
          cost: { input: 5, output: 15 },
          inputTypes: [`text`, `image`],
        },
      ])
    })

    it(`falls back to the model id when name is missing`, () => {
      mockGetModels.mockReturnValue([{ id: `bare-model` }])

      const result = ModelRegistry.getModels(`openai`)

      expect(result[0].name).toBe(`bare-model`)
    })

    it(`leaves optional fields undefined when absent from the source model`, () => {
      mockGetModels.mockReturnValue([{ id: `bare-model`, name: `Bare` }])

      const result = ModelRegistry.getModels(`openai`)

      expect(result[0]).toEqual({
        id: `bare-model`,
        name: `Bare`,
        maxTokens: undefined,
        contextWindow: undefined,
        reasoning: undefined,
        cost: undefined,
        inputTypes: undefined,
      })
    })

    it(`returns an empty array and swallows the error when pi-ai throws`, () => {
      mockGetModels.mockImplementation(() => {
        throw new Error(`unknown provider`)
      })

      const result = ModelRegistry.getModels(`not-a-provider`)

      expect(result).toEqual([])
    })
  })

  describe(`getModel`, () => {
    it(`maps a single model when found`, () => {
      mockGetModel.mockReturnValue({
        id: `gpt-4o`,
        name: `GPT-4o`,
        maxTokens: 4096,
      })

      const result = ModelRegistry.getModel(`openai`, `gpt-4o`)

      expect(mockGetModel).toHaveBeenCalledWith(`openai`, `gpt-4o`)
      expect(result?.id).toBe(`gpt-4o`)
    })

    it(`returns undefined when pi-ai finds no matching model`, () => {
      mockGetModel.mockReturnValue(undefined)

      const result = ModelRegistry.getModel(`openai`, `nonexistent`)

      expect(result).toBeUndefined()
    })

    it(`returns undefined and swallows the error when pi-ai throws`, () => {
      mockGetModel.mockImplementation(() => {
        throw new Error(`boom`)
      })

      const result = ModelRegistry.getModel(`openai`, `gpt-4o`)

      expect(result).toBeUndefined()
    })
  })

  describe(`getDefaultModelId`, () => {
    it(`returns the id of the first model in the list`, () => {
      mockGetModels.mockReturnValue([{ id: `first-model` }, { id: `second-model` }])

      expect(ModelRegistry.getDefaultModelId(`openai`)).toBe(`first-model`)
    })

    it(`returns undefined when the provider has no models`, () => {
      mockGetModels.mockReturnValue([])

      expect(ModelRegistry.getDefaultModelId(`openai`)).toBeUndefined()
    })

    it(`returns undefined when getModels fails`, () => {
      mockGetModels.mockImplementation(() => {
        throw new Error(`unknown provider`)
      })

      expect(ModelRegistry.getDefaultModelId(`not-a-provider`)).toBeUndefined()
    })
  })

  describe(`fetchOllamaModels`, () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it(`fetches from the default Ollama URL and maps models by name`, async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            models: [{ name: `llama3` }, { name: `mistral` }],
          }),
      })
      vi.stubGlobal(`fetch`, mockFetch)

      const result = await ModelRegistry.fetchOllamaModels()

      expect(mockFetch).toHaveBeenCalledWith(`http://localhost:11434/api/tags`, {
        signal: expect.any(AbortSignal),
      })
      expect(result).toEqual([
        { id: `llama3`, name: `llama3` },
        { id: `mistral`, name: `mistral` },
      ])
    })

    it(`rewrites a custom base URL's /v1 suffix to /api/tags`, async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      })
      vi.stubGlobal(`fetch`, mockFetch)

      await ModelRegistry.fetchOllamaModels(`http://custom-host:11434/v1`)

      expect(mockFetch).toHaveBeenCalledWith(`http://custom-host:11434/api/tags`, {
        signal: expect.any(AbortSignal),
      })
    })

    it(`returns an empty array when the response has no models`, async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })
      vi.stubGlobal(`fetch`, mockFetch)

      const result = await ModelRegistry.fetchOllamaModels()

      expect(result).toEqual([])
    })

    it(`throws when the Ollama API responds with a non-ok status`, async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 })
      vi.stubGlobal(`fetch`, mockFetch)

      await expect(ModelRegistry.fetchOllamaModels()).rejects.toThrow(
        `Ollama API returned 503`
      )
    })

    it(`propagates a network-level fetch rejection`, async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error(`ECONNREFUSED`))
      vi.stubGlobal(`fetch`, mockFetch)

      await expect(ModelRegistry.fetchOllamaModels()).rejects.toThrow(`ECONNREFUSED`)
    })

    it(`rejects with a clear timeout message when the request never settles`, async () => {
      // Mimics real fetch's AbortSignal semantics: never resolves on its own,
      // only rejects (with the real TimeoutError DOMException name Node's
      // AbortSignal.timeout actually produces) once the passed signal fires.
      const mockFetch = vi.fn((_url: string, opts: RequestInit = {}) => {
        return new Promise((_resolve, reject) => {
          opts.signal?.addEventListener(`abort`, () => {
            reject(
              new DOMException(`The operation was aborted due to timeout`, `TimeoutError`)
            )
          })
        })
      })
      vi.stubGlobal(`fetch`, mockFetch)

      await expect(ModelRegistry.fetchOllamaModels()).rejects.toThrow(
        `Ollama API request timed out after 50ms`
      )
    })
  })
})
