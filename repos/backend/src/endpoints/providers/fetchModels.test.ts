import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'

import { fetchModels } from './fetchModels'
import { EPMethod } from '@TBE/types'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const { mockOpenAI, mockGoogle, mockOpenRouter, mockOllama, mockZai } = vi.hoisted(
  () => ({
    mockOpenAI: vi.fn(),
    mockGoogle: vi.fn(),
    mockOpenRouter: vi.fn(),
    mockOllama: vi.fn(),
    mockZai: vi.fn(),
  })
)

vi.mock(`@TBE/services/providers/dynamicModels`, () => ({
  DynamicModels: vi.fn().mockImplementation(() => ({
    openAI: mockOpenAI,
    google: mockGoogle,
    openRouter: mockOpenRouter,
    ollama: mockOllama,
    zai: mockZai,
  })),
}))

describe(`POST /_/providers/:brand/models`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildApp = () =>
    ({
      locals: {
        config,
        payments: new PaymentsService(config.payments),
        db: { services: {} },
      },
    }) as unknown as TApp

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any
    mockRes = { status: mockStatus, json: mockJson } as Partial<Response>
    mockReq = {
      app: buildApp(),
      user: { id: `test-user`, email: `test@example.com` } as any,
      params: {},
      body: {},
      query: {},
      headers: {},
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it(`should have correct endpoint config`, () => {
    expect(fetchModels.path).toBe(`/:brand/models`)
    expect(fetchModels.method).toBe(EPMethod.Post)
  })

  it(`should return static models for anthropic`, async () => {
    mockReq.params = { brand: `anthropic` }

    await fetchModels.action!(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    const result = mockJson.mock.calls[0][0]
    expect(result.data.length).toBeGreaterThan(0)
    expect(result.data[0]).toHaveProperty(`id`)
    expect(result.data[0]).toHaveProperty(`name`)
  })

  it(`should return static models for openai when no provider key`, async () => {
    mockReq.params = { brand: `openai` }

    await fetchModels.action!(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    const result = mockJson.mock.calls[0][0]
    expect(result.data.length).toBeGreaterThan(0)
    expect(mockOpenAI).not.toHaveBeenCalled()
  })

  it(`should return static models for google when no provider key`, async () => {
    mockReq.params = { brand: `google` }

    await fetchModels.action!(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    const result = mockJson.mock.calls[0][0]
    expect(result.data.length).toBeGreaterThan(0)
    expect(mockGoogle).not.toHaveBeenCalled()
  })

  it(`should return empty array for custom provider`, async () => {
    mockReq.params = { brand: `custom` }

    await fetchModels.action!(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: [] })
  })

  it(`should throw 400 for invalid brand`, async () => {
    mockReq.params = { brand: `invalid` }

    await expect(
      fetchModels.action!(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Invalid provider brand "invalid"`)
  })

  describe(`OpenAI model fetching`, () => {
    it(`should fetch models from OpenAI API when provider key is given`, async () => {
      mockReq.params = { brand: `openai` }
      mockReq.body = { providerKey: `sk-test-key` }
      mockOpenAI.mockResolvedValue([
        { id: `gpt-4o`, name: `gpt-4o` },
        { id: `gpt-4o-mini`, name: `gpt-4o-mini` },
        { id: `o1-preview`, name: `o1-preview` },
      ])

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      expect(mockOpenAI).toHaveBeenCalledWith(`sk-test-key`)
      expect(mockStatus).toHaveBeenCalledWith(200)

      const result = mockJson.mock.calls[0][0]
      expect(result.data).toHaveLength(3)
      expect(result.data.map((m: any) => m.id)).toEqual([
        `gpt-4o`,
        `gpt-4o-mini`,
        `o1-preview`,
      ])
    })

    it(`should fall back to static models when OpenAI API fails`, async () => {
      mockReq.params = { brand: `openai` }
      mockReq.body = { providerKey: `sk-bad-key` }
      mockOpenAI.mockRejectedValue(new Error(`OpenAI API returned 401`))

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      // Should fall back to static models, not throw
      expect(mockStatus).toHaveBeenCalledWith(200)
      const result = mockJson.mock.calls[0][0]
      expect(result.data.length).toBeGreaterThan(0)
    })
  })

  describe(`Google model fetching`, () => {
    it(`should fetch models from Google API when provider key is given`, async () => {
      mockReq.params = { brand: `google` }
      mockReq.body = { providerKey: `AIza-test-key` }
      mockGoogle.mockResolvedValue([
        {
          id: `gemini-2.0-flash`,
          name: `Gemini 2.0 Flash`,
          maxTokens: 8192,
          contextWindow: 1048576,
          description: `Fast and versatile`,
        },
      ])

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      expect(mockGoogle).toHaveBeenCalledWith(`AIza-test-key`)
      expect(mockStatus).toHaveBeenCalledWith(200)

      const result = mockJson.mock.calls[0][0]
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toEqual({
        id: `gemini-2.0-flash`,
        name: `Gemini 2.0 Flash`,
        maxTokens: 8192,
        contextWindow: 1048576,
        description: `Fast and versatile`,
      })
    })

    it(`should fall back to static models when Google API fails`, async () => {
      mockReq.params = { brand: `google` }
      mockReq.body = { providerKey: `bad-key` }
      mockGoogle.mockRejectedValue(new Error(`Google API returned 400`))

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const result = mockJson.mock.calls[0][0]
      expect(result.data.length).toBeGreaterThan(0)
    })
  })

  describe(`OpenRouter model fetching`, () => {
    it(`should fetch models from OpenRouter API`, async () => {
      mockReq.params = { brand: `openrouter` }
      mockOpenRouter.mockResolvedValue([
        {
          id: `anthropic/claude-sonnet-4`,
          name: `Claude Sonnet 4`,
          maxTokens: 64000,
          contextWindow: 200000,
          description: `Balanced model`,
        },
        {
          id: `openai/gpt-4o`,
          name: `GPT-4o`,
          maxTokens: 16384,
          contextWindow: 128000,
        },
      ])

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      expect(mockOpenRouter).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)

      const result = mockJson.mock.calls[0][0]
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toEqual({
        id: `anthropic/claude-sonnet-4`,
        name: `Claude Sonnet 4`,
        maxTokens: 64000,
        contextWindow: 200000,
        description: `Balanced model`,
      })
    })

    it(`should fall back to static models when OpenRouter API fails`, async () => {
      mockReq.params = { brand: `openrouter` }
      mockOpenRouter.mockRejectedValue(new Error(`OpenRouter API returned 500`))

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      // OpenRouter has static preset models to fall back to
      expect(mockStatus).toHaveBeenCalledWith(200)
      const result = mockJson.mock.calls[0][0]
      expect(result.data.length).toBeGreaterThan(0)
    })
  })

  describe(`Ollama model fetching`, () => {
    it(`should fetch models from Ollama API with default URL`, async () => {
      mockReq.params = { brand: `ollama` }
      mockOllama.mockResolvedValue([
        { id: `llama3.2`, name: `llama3.2` },
        { id: `mistral:latest`, name: `mistral:latest` },
      ])

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      // Falls back to ProviderTemplates.ollama.baseUrl when no body baseUrl
      expect(mockOllama).toHaveBeenCalledWith(`http://localhost:11434/v1`)
      expect(mockStatus).toHaveBeenCalledWith(200)

      const result = mockJson.mock.calls[0][0]
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toEqual({ id: `llama3.2`, name: `llama3.2` })
      expect(result.data[1]).toEqual({ id: `mistral:latest`, name: `mistral:latest` })
    })

    it(`should use custom baseUrl when provided`, async () => {
      mockReq.params = { brand: `ollama` }
      mockReq.body = { baseUrl: `http://gpu-server:11434/v1` }
      mockOllama.mockResolvedValue([])

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      expect(mockOllama).toHaveBeenCalledWith(`http://gpu-server:11434/v1`)
    })

    it(`should throw 502 when Ollama is not running`, async () => {
      mockReq.params = { brand: `ollama` }
      mockOllama.mockRejectedValue(new Error(`connect ECONNREFUSED`))

      await expect(
        fetchModels.action!(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Failed to fetch models from ollama`)
    })
  })

  describe(`ZAI model fetching`, () => {
    it(`should fetch models from ZAI API when provider key is given`, async () => {
      mockReq.params = { brand: `zai` }
      mockReq.body = { providerKey: `zai-test-key` }
      mockZai.mockResolvedValue([{ id: `gpt-4o`, name: `gpt-4o` }])

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      expect(mockZai).toHaveBeenCalledWith(`zai-test-key`)
      expect(mockStatus).toHaveBeenCalledWith(200)

      const result = mockJson.mock.calls[0][0]
      expect(result.data).toHaveLength(1)
    })

    it(`should fall back to static models when no provider key`, async () => {
      mockReq.params = { brand: `zai` }

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      expect(mockZai).not.toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
      const result = mockJson.mock.calls[0][0]
      expect(result.data.length).toBeGreaterThan(0)
    })
  })
})
