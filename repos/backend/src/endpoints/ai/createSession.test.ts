import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createSession } from './createSession'
import { EPMethod } from '@TBE/types'
import { Agent } from '@tdsk/domain'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
}))

vi.mock(`@tdsk/domain`, async () => {
  const actual = await vi.importActual(`@tdsk/domain`)
  return {
    ...actual,
    deriveKey: vi.fn().mockResolvedValue(Buffer.alloc(32, `key`)),
    decryptValue: vi.fn().mockResolvedValue(`sk-test-key`),
  }
})

const fakeEncrypted = () =>
  Buffer.concat([
    Buffer.alloc(12, `iv`),
    Buffer.alloc(16, `tag`),
    Buffer.from(`ciphertext`),
  ]).toString(`base64`)

describe(`POST /ai/sessions - Create LLM session`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildApp = () => {
    return {
      locals: {
        config,
        payments: new PaymentsService(config.payments),
        auth: { orgId: `org-1` },
        db: {
          services: {
            agent: {
              get: vi.fn(),
            },
            secret: {
              list: vi.fn().mockResolvedValue({ data: [] }),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
            },
          },
        },
      },
    } as unknown as TApp
  }

  const buildAgent = (overrides: Record<string, any> = {}) =>
    new Agent({
      id: `agent-1`,
      orgId: `org-1`,
      name: `Test Agent`,
      providers: [
        { id: `prov-1`, type: `ai`, orgId: `org-1`, name: `anthropic`, options: { llmProvider: `anthropic` } },
      ],
      secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
      ...overrides,
    } as any)

  const getEndpointCfg = (ep?: TEndpoint) => getEpCfg(buildApp(), ep)

  beforeEach(() => {
    vi.clearAllMocks()

    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: buildApp(),
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
      } as any,
      params: { orgId: `org-1` },
      body: { agentId: `agent-1` },
      query: {},
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it(`should have correct endpoint config`, () => {
    expect(createSession.path).toBe(`/sessions`)
    expect(createSession.method).toBe(EPMethod.Post)
  })

  it(`should throw 401 when no userId`, async () => {
    const ep = getEndpointCfg(createSession as any)
    mockReq.user = undefined as any

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Authentication required`
    )
  })

  it(`should throw 400 when no agentId`, async () => {
    const ep = getEndpointCfg(createSession as any)
    mockReq.body = {}

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `agentId is required`
    )
  })

  it(`should throw 404 when agent not found`, async () => {
    const ep = getEndpointCfg(createSession as any)
    const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null, error: null })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Agent not found`
    )
  })

  it(`should throw 404 when agent has no provider`, async () => {
    const ep = getEndpointCfg(createSession as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: buildAgent({ providers: [] }),
    })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Agent has no provider configured`
    )
  })

  it(`should throw 400 when no API key found`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const ep = getEndpointCfg(createSession as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: buildAgent({
        secrets: [],
        providers: [
          { id: `prov-1`, type: `ai`, orgId: `org-1`, name: `anthropic`, options: { llmProvider: `anthropic` } },
        ],
      }),
    })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `No API key found for agent provider`
    )
  })

  it(`should throw 400 for unsupported LLM provider`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-key`)

    const ep = getEndpointCfg(createSession as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: buildAgent({
        providers: [
          {
            id: `prov-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `invalid-provider`,
            options: {},
          },
        ],
      }),
    })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Cannot determine LLM provider`
    )
  })

  it(`should resolve google provider from options.llmProvider`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-google-key`)

    const ep = getEndpointCfg(createSession as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: buildAgent({
        model: `gemini-2.0-flash`,
        providers: [
          { id: `prov-1`, type: `ai`, orgId: `org-1`, name: `Google AI`, options: { llmProvider: `google` } },
        ],
      }),
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockJson).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: `google`,
      }),
    })
  })

  it(`should use options.llmProvider regardless of provider name`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-key`)

    const ep = getEndpointCfg(createSession as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: buildAgent({
        providers: [
          {
            id: `prov-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `My Custom Name`,
            options: { llmProvider: `openai` },
          },
        ],
      }),
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockJson).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: `openai`,
      }),
    })
  })

  it(`should return session token without apiKey`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)

    const ep = getEndpointCfg(createSession as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: buildAgent({
        model: `claude-sonnet-4-20250514`,
        maxTokens: 2048,
        systemPrompt: `You are helpful.`,
        providers: [
          { id: `prov-1`, type: `ai`, orgId: `org-1`, name: `anthropic`, options: { llmProvider: `anthropic` } },
        ],
      }),
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)

    const responseData = mockJson.mock.calls[0][0]

    // Session token is a UUID string
    expect(responseData.data.sessionToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )

    // Non-sensitive config is returned
    expect(responseData.data.provider).toBe(`anthropic`)
    expect(responseData.data.model).toBe(`claude-sonnet-4-20250514`)
    expect(responseData.data.maxTokens).toBe(2048)
    expect(responseData.data.systemPrompt).toBe(`You are helpful.`)

    // apiKey is NEVER in the response
    expect(responseData.data).not.toHaveProperty(`apiKey`)
  })

  it(`should use default model when agent has none`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)

    const ep = getEndpointCfg(createSession as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: buildAgent({
        model: undefined,
        providers: [
          {
            id: `prov-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `openai`,
            options: { llmProvider: `openai`, model: `gpt-4o` },
          },
        ],
      }),
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockJson).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: `openai`,
        model: `gpt-4o`,
      }),
    })
  })
})
