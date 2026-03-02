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

const { mockGetModels, mockFetchOllamaModels } = vi.hoisted(() => ({
  mockGetModels: vi.fn(),
  mockFetchOllamaModels: vi.fn(),
}))

vi.mock(`@TBE/services/providers/modelRegistry`, () => ({
  ModelRegistry: {
    getModels: mockGetModels,
    fetchOllamaModels: mockFetchOllamaModels,
  },
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
    mockGetModels.mockReturnValue([
      { id: `model-1`, name: `Model 1` },
      { id: `model-2`, name: `Model 2` },
    ])
    mockFetchOllamaModels.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it(`should have correct endpoint config`, () => {
    expect(fetchModels.path).toBe(`/:brand/models`)
    expect(fetchModels.method).toBe(EPMethod.Post)
  })

  it(`should return pi-mono models for anthropic`, async () => {
    mockReq.params = { brand: `anthropic` }
    mockGetModels.mockReturnValue([
      { id: `claude-sonnet-4-20250514`, name: `Claude Sonnet 4` },
      { id: `claude-haiku-3.5`, name: `Claude Haiku 3.5` },
    ])

    await fetchModels.action!(mockReq as TRequest, mockRes as Response)

    expect(mockGetModels).toHaveBeenCalledWith(`anthropic`)
    expect(mockStatus).toHaveBeenCalledWith(200)
    const result = mockJson.mock.calls[0][0]
    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toHaveProperty(`id`)
    expect(result.data[0]).toHaveProperty(`name`)
  })

  it(`should return pi-mono models for openai`, async () => {
    mockReq.params = { brand: `openai` }
    mockGetModels.mockReturnValue([
      { id: `gpt-4o`, name: `GPT-4o` },
      { id: `gpt-4o-mini`, name: `GPT-4o Mini` },
    ])

    await fetchModels.action!(mockReq as TRequest, mockRes as Response)

    expect(mockGetModels).toHaveBeenCalledWith(`openai`)
    expect(mockStatus).toHaveBeenCalledWith(200)
    const result = mockJson.mock.calls[0][0]
    expect(result.data).toHaveLength(2)
  })

  it(`should return pi-mono models for google`, async () => {
    mockReq.params = { brand: `google` }
    mockGetModels.mockReturnValue([
      { id: `gemini-2.0-flash`, name: `Gemini 2.0 Flash`, contextWindow: 1048576 },
    ])

    await fetchModels.action!(mockReq as TRequest, mockRes as Response)

    expect(mockGetModels).toHaveBeenCalledWith(`google`)
    expect(mockStatus).toHaveBeenCalledWith(200)
    const result = mockJson.mock.calls[0][0]
    expect(result.data).toHaveLength(1)
  })

  it(`should return pi-mono models for zai`, async () => {
    mockReq.params = { brand: `zai` }
    mockGetModels.mockReturnValue([{ id: `gpt-4o`, name: `GPT-4o` }])

    await fetchModels.action!(mockReq as TRequest, mockRes as Response)

    expect(mockGetModels).toHaveBeenCalledWith(`zai`)
    expect(mockStatus).toHaveBeenCalledWith(200)
    const result = mockJson.mock.calls[0][0]
    expect(result.data).toHaveLength(1)
  })

  it(`should return pi-mono models for openrouter`, async () => {
    mockReq.params = { brand: `openrouter` }
    mockGetModels.mockReturnValue([
      { id: `anthropic/claude-sonnet-4`, name: `Claude Sonnet 4` },
      { id: `openai/gpt-4o`, name: `GPT-4o` },
    ])

    await fetchModels.action!(mockReq as TRequest, mockRes as Response)

    expect(mockGetModels).toHaveBeenCalledWith(`openrouter`)
    expect(mockStatus).toHaveBeenCalledWith(200)
    const result = mockJson.mock.calls[0][0]
    expect(result.data).toHaveLength(2)
  })

  it(`should return empty array for custom provider`, async () => {
    mockReq.params = { brand: `custom` }

    await fetchModels.action!(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: [] })
    expect(mockGetModels).not.toHaveBeenCalled()
  })

  it(`should throw 400 for invalid brand`, async () => {
    mockReq.params = { brand: `invalid` }

    await expect(
      fetchModels.action!(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Invalid provider brand "invalid"`)
  })

  describe(`Ollama model fetching`, () => {
    it(`should fetch models from Ollama API with default URL`, async () => {
      mockReq.params = { brand: `ollama` }
      mockFetchOllamaModels.mockResolvedValue([
        { id: `llama3.2`, name: `llama3.2` },
        { id: `mistral:latest`, name: `mistral:latest` },
      ])

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      expect(mockFetchOllamaModels).toHaveBeenCalledWith(`http://localhost:11434/v1`)
      expect(mockStatus).toHaveBeenCalledWith(200)

      const result = mockJson.mock.calls[0][0]
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toEqual({ id: `llama3.2`, name: `llama3.2` })
      expect(result.data[1]).toEqual({ id: `mistral:latest`, name: `mistral:latest` })
    })

    it(`should use custom baseUrl when provided`, async () => {
      mockReq.params = { brand: `ollama` }
      mockReq.body = { baseUrl: `http://gpu-server:11434/v1` }
      mockFetchOllamaModels.mockResolvedValue([{ id: `llama3.2`, name: `llama3.2` }])

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      expect(mockFetchOllamaModels).toHaveBeenCalledWith(`http://gpu-server:11434/v1`)
    })

    it(`should return empty array when Ollama has no models installed`, async () => {
      mockReq.params = { brand: `ollama` }
      mockFetchOllamaModels.mockResolvedValue([])

      await fetchModels.action!(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: [] })
    })

    it(`should throw 502 when Ollama connection fails`, async () => {
      mockReq.params = { brand: `ollama` }
      mockFetchOllamaModels.mockRejectedValue(new Error(`fetch failed`))

      await expect(
        fetchModels.action!(mockReq as TRequest, mockRes as Response)
      ).rejects.toThrow(`Failed to fetch models from ollama`)
    })
  })
})
