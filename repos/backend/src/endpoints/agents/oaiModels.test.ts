import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { oaiModels } from './oaiModels'
import { EPMethod } from '@TBE/types'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock(`@TBE/services/providers/modelRegistry`, () => ({
  ModelRegistry: {
    getModels: vi.fn().mockReturnValue([]),
  },
}))

vi.mock(`@TBE/utils/auth/requireAgentAccess`, () => ({
  requireAgentAccess: vi.fn().mockResolvedValue(undefined),
}))

vi.mock(`@TBE/services/openai/responseAdapter`, () => ({
  formatOAIError: vi.fn().mockReturnValue({
    status: 500,
    body: {
      error: {
        message: `Internal server error`,
        type: `server_error`,
        param: null,
        code: null,
      },
    },
  }),
}))

describe(`GET /agents/:id/v1/models - OpenAI models list`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildApp = (agentOverride?: any) =>
    ({
      locals: {
        db: {
          services: {
            agent: {
              get: vi.fn().mockResolvedValue({
                data: agentOverride ?? {
                  id: `agent-1`,
                  orgId: `org-1`,
                  providers: [
                    {
                      id: `prov-1`,
                      brand: `anthropic`,
                      name: `Anthropic`,
                      type: `ai`,
                      options: {},
                    },
                  ],
                },
              }),
            },
            provider: {
              resolveAIBrand: vi.fn((p: any) => {
                const validBrands = [
                  `anthropic`,
                  `openai`,
                  `google`,
                  `custom`,
                  `ollama`,
                  `zai`,
                  `xai`,
                  `groq`,
                  `deepseek`,
                  `cerebras`,
                ]
                if (p?.brand && validBrands.includes(p.brand)) return p.brand
                throw new Error(
                  `Cannot determine LLM provider for "${p?.name || `unnamed`}"`
                )
              }),
            },
          },
        },
      },
    }) as unknown as TApp

  const getEndpointCfg = (app?: TApp, ep?: TEndpoint) => getEpCfg(app ?? buildApp(), ep)

  beforeEach(() => {
    vi.clearAllMocks()
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
      headersSent: false,
    } as Partial<Response>

    mockReq = {
      app: buildApp(),
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
      } as any,
      params: { id: `agent-1` },
      query: {},
    }
  })

  it(`should have correct endpoint config`, () => {
    expect(oaiModels.path).toBe(`/:id/v1/models`)
    expect(oaiModels.method).toBe(EPMethod.Get)
  })

  it(`should throw 401 when no userId`, async () => {
    const ep = getEndpointCfg(mockReq.app as TApp, oaiModels as any)
    mockReq.user = undefined as any

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Authentication required`
    )
  })

  it(`should return 404 when agent not found (data is null)`, async () => {
    const { formatOAIError } = await import(`@TBE/services/openai/responseAdapter`)
    const mockFormat = formatOAIError as ReturnType<typeof vi.fn>
    mockFormat.mockReturnValue({
      status: 404,
      body: {
        error: {
          message: `Agent not found`,
          type: `invalid_request_error`,
          param: null,
          code: null,
        },
      },
    })

    const app = buildApp()
    const mockGet = app.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null, error: null })
    mockReq.app = app

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(404)
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: `Agent not found` }),
      })
    )
  })

  it(`should return 404 when agent.get returns error`, async () => {
    const { formatOAIError } = await import(`@TBE/services/openai/responseAdapter`)
    const mockFormat = formatOAIError as ReturnType<typeof vi.fn>
    mockFormat.mockReturnValue({
      status: 404,
      body: {
        error: {
          message: `Agent not found`,
          type: `invalid_request_error`,
          param: null,
          code: null,
        },
      },
    })

    const app = buildApp()
    const mockGet = app.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null, error: new Error(`DB error`) })
    mockReq.app = app

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(404)
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: `Agent not found` }),
      })
    )
  })

  it(`should return models in OpenAI list format`, async () => {
    const { ModelRegistry } = await import(`@TBE/services/providers/modelRegistry`)
    const mockGetModels = ModelRegistry.getModels as ReturnType<typeof vi.fn>
    mockGetModels.mockReturnValue([
      { id: `claude-sonnet-4-20250514`, name: `Claude 3.5 Sonnet` },
      { id: `claude-3-haiku-20240307`, name: `Claude 3 Haiku` },
    ])

    const ep = getEndpointCfg(mockReq.app as TApp, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({
      object: `list`,
      data: expect.arrayContaining([
        expect.objectContaining({
          id: `claude-sonnet-4-20250514`,
          object: `model`,
          created: expect.any(Number),
          owned_by: `anthropic`,
        }),
        expect.objectContaining({
          id: `claude-3-haiku-20240307`,
          object: `model`,
          created: expect.any(Number),
          owned_by: `anthropic`,
        }),
      ]),
    })
    expect(mockJson.mock.calls[0][0].data).toHaveLength(2)
  })

  it(`should return models from multiple providers`, async () => {
    const { ModelRegistry } = await import(`@TBE/services/providers/modelRegistry`)
    const mockGetModels = ModelRegistry.getModels as ReturnType<typeof vi.fn>

    mockGetModels
      .mockReturnValueOnce([{ id: `claude-sonnet-4-20250514`, name: `Claude` }])
      .mockReturnValueOnce([{ id: `gpt-4o`, name: `GPT-4o` }])

    const app = buildApp({
      id: `agent-1`,
      orgId: `org-1`,
      providers: [
        { id: `prov-1`, brand: `anthropic`, name: `Anthropic`, type: `ai`, options: {} },
        { id: `prov-2`, brand: `openai`, name: `OpenAI`, type: `ai`, options: {} },
      ],
    })
    mockReq.app = app

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    const responseData = mockJson.mock.calls[0][0]
    expect(responseData.object).toBe(`list`)
    expect(responseData.data).toHaveLength(2)
    expect(responseData.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `claude-sonnet-4-20250514`,
          owned_by: `anthropic`,
        }),
        expect.objectContaining({ id: `gpt-4o`, owned_by: `openai` }),
      ])
    )
  })

  it(`should return empty list when agent has no providers`, async () => {
    const app = buildApp({
      id: `agent-1`,
      orgId: `org-1`,
      providers: [],
    })
    mockReq.app = app

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ object: `list`, data: [] })
  })

  it(`should skip providers with unresolvable type and log warning`, async () => {
    const { logger } = await import(`@TBE/utils/logger`)
    const { ModelRegistry } = await import(`@TBE/services/providers/modelRegistry`)

    const mockGetModels = ModelRegistry.getModels as ReturnType<typeof vi.fn>
    mockGetModels.mockReturnValue([{ id: `gpt-4o`, name: `GPT-4o` }])

    const app = buildApp({
      id: `agent-1`,
      orgId: `org-1`,
      providers: [
        { id: `prov-bad`, brand: `unknown`, name: `Unknown`, type: `ai`, options: {} },
        { id: `prov-2`, brand: `openai`, name: `OpenAI`, type: `ai`, options: {} },
      ],
    })
    mockReq.app = app

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(logger.warn).toHaveBeenCalledWith(
      `[OAI Models] Cannot resolve provider type`,
      expect.objectContaining({ providerId: `prov-bad`, agentId: `agent-1` })
    )

    expect(mockStatus).toHaveBeenCalledWith(200)
    const responseData = mockJson.mock.calls[0][0]
    expect(responseData.data).toHaveLength(1)
    expect(responseData.data[0]).toEqual(
      expect.objectContaining({ id: `gpt-4o`, owned_by: `openai` })
    )
  })

  it(`should return OAI error when unexpected error occurs`, async () => {
    const { formatOAIError } = await import(`@TBE/services/openai/responseAdapter`)
    const { logger } = await import(`@TBE/utils/logger`)

    const mockFormat = formatOAIError as ReturnType<typeof vi.fn>
    mockFormat.mockReturnValue({
      status: 500,
      body: {
        error: {
          message: `Something broke`,
          type: `server_error`,
          param: null,
          code: null,
        },
      },
    })

    const app = buildApp()
    const mockGet = app.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockGet.mockRejectedValue(new Error(`Something broke`))
    mockReq.app = app

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(logger.error).toHaveBeenCalledWith(
      `[OAI Models] Error listing models`,
      expect.objectContaining({ agentId: `agent-1`, error: `Something broke` })
    )
    expect(mockStatus).toHaveBeenCalledWith(500)
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: `Something broke` }),
      })
    )
  })

  it(`should not send response if headers already sent`, async () => {
    const app = buildApp()
    const mockGet = app.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockGet.mockRejectedValue(new Error(`Late error`))
    mockReq.app = app

    mockRes.headersSent = true

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).not.toHaveBeenCalled()
    expect(mockJson).not.toHaveBeenCalled()
  })

  it(`should call agent.get with sanitize option`, async () => {
    const app = buildApp()
    mockReq.app = app

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    const mockGet = app.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    expect(mockGet).toHaveBeenCalledWith(`agent-1`, { sanitize: false })
  })

  it(`should log error and skip provider when ModelRegistry.getModels throws`, async () => {
    const { logger } = await import(`@TBE/utils/logger`)
    const { ModelRegistry } = await import(`@TBE/services/providers/modelRegistry`)

    const mockGetModels = ModelRegistry.getModels as ReturnType<typeof vi.fn>

    mockGetModels
      .mockImplementationOnce(() => {
        throw new Error(`Registry lookup failed`)
      })
      .mockReturnValueOnce([{ id: `gpt-4o`, name: `GPT-4o` }])

    const app = buildApp({
      id: `agent-1`,
      orgId: `org-1`,
      providers: [
        { id: `prov-1`, brand: `anthropic`, name: `Anthropic`, type: `ai`, options: {} },
        { id: `prov-2`, brand: `openai`, name: `OpenAI`, type: `ai`, options: {} },
      ],
    })
    mockReq.app = app

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(logger.error).toHaveBeenCalledWith(
      `[OAI Models] Failed to get models for provider`,
      expect.objectContaining({
        providerId: `prov-1`,
        brand: `anthropic`,
        agentId: `agent-1`,
        error: `Registry lookup failed`,
      })
    )

    expect(mockStatus).toHaveBeenCalledWith(200)
    const responseData = mockJson.mock.calls[0][0]
    expect(responseData.data).toHaveLength(1)
    expect(responseData.data[0]).toEqual(
      expect.objectContaining({ id: `gpt-4o`, owned_by: `openai` })
    )
  })

  it(`should return empty list when agent has no providers property (undefined)`, async () => {
    const app = buildApp({
      id: `agent-1`,
      orgId: `org-1`,
    })
    mockReq.app = app

    const ep = getEndpointCfg(app, oaiModels as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ object: `list`, data: [] })
  })
})
