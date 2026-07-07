import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'

import { runAgent } from './runAgent'
import { EPMethod } from '@TBE/types'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'
import { ESandboxType, EAIProviderBrand, Exception } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
}))

vi.mock(`@TBE/utils/auth/requireAgentAccess`, () => ({
  requireAgentAccess: vi.fn().mockResolvedValue(undefined),
}))

const { mockResolveAgentConfig } = vi.hoisted(() => ({
  mockResolveAgentConfig: vi.fn(),
}))
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, async () => {
  const actual = await vi.importActual(`@TBE/utils/agent/resolveAgentConfig`)
  mockResolveAgentConfig.mockImplementation(actual.resolveAgentConfig as any)
  return {
    ...actual,
    resolveAgentConfig: (...args: any[]) => mockResolveAgentConfig(...args),
  }
})

vi.mock(`@tdsk/agent`, () => ({
  AgentRunner: {
    run: vi.fn().mockResolvedValue({
      waitForIdle: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn(),
    }),
  },
}))

vi.mock(`@tdsk/domain`, async () => {
  const actual = await vi.importActual(`@tdsk/domain`)
  return {
    ...actual,
    deriveKey: vi.fn().mockResolvedValue(Buffer.alloc(32, `key`)),
    decryptValue: vi.fn().mockResolvedValue(`sk-test-key`),
  }
})

/**
 * Helper to create a fake encrypted value that passes the minimum length check
 * Format: [iv:12][authTag:16][ciphertext:N] encoded as base64
 */
const fakeEncrypted = () =>
  Buffer.concat([
    Buffer.alloc(12, `iv`),
    Buffer.alloc(16, `tag`),
    Buffer.from(`ciphertext`),
  ]).toString(`base64`)

/** Wrap mock agent data with resolveModel (mirrors Agent class method) */
const withResolveModel = (data: Record<string, any>) => ({
  ...data,
  resolveModel: (_pid: string, provDefault?: string) => data.model || provDefault,
})

describe(`POST /agents/:id/run - Run agent (SSE)`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockWrite: ReturnType<typeof vi.fn>
  let mockEnd: ReturnType<typeof vi.fn>
  let mockSetHeader: ReturnType<typeof vi.fn>
  let mockFlushHeaders: ReturnType<typeof vi.fn>
  let mockOn: ReturnType<typeof vi.fn>

  const buildApp = () => {
    return {
      locals: {
        config,
        payments: new PaymentsService(config.payments),
        auth: {
          orgId: `org-1`,
        },
        db: {
          services: {
            agent: {
              list: vi.fn(),
              get: vi.fn().mockResolvedValue({
                data: { id: `agent-1`, orgId: `org-1`, projects: [] },
              }),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
            secret: {
              get: vi.fn().mockResolvedValue({
                data: { encryptedValue: fakeEncrypted(), orgId: `org-1` },
              }),
              list: vi.fn().mockResolvedValue({ data: [] }),
            },
            thread: {
              create: vi.fn(),
              get: vi.fn(),
            },
            function: {
              list: vi.fn().mockResolvedValue({ data: [] }),
              get: vi.fn().mockResolvedValue({ data: null }),
            },
            skill: {
              listForAgent: vi.fn().mockResolvedValue({ data: [] }),
            },
            role: {
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
              getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
            },
            provider: {
              resolveAIBrand: vi
                .fn()
                .mockImplementation((prov: { name?: string | null; brand?: string }) => {
                  const validBrands = Object.values(EAIProviderBrand) as string[]
                  if (typeof prov.brand === `string` && validBrands.includes(prov.brand))
                    return prov.brand
                  throw new Exception(
                    400,
                    `Cannot determine LLM provider for "${prov.name || `unnamed`}"`
                  )
                }),
            },
          },
        },
      },
    } as unknown as TApp
  }

  const getEndpointCfg = (ep?: TEndpoint) => getEpCfg(buildApp(), ep)

  beforeEach(() => {
    vi.clearAllMocks()

    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any
    mockWrite = vi.fn()
    mockEnd = vi.fn()
    mockSetHeader = vi.fn()
    mockFlushHeaders = vi.fn()
    mockOn = vi.fn()

    mockRes = {
      status: mockStatus,
      json: mockJson,
      write: mockWrite,
      end: mockEnd,
      setHeader: mockSetHeader,
      flushHeaders: mockFlushHeaders,
    } as Partial<Response>

    mockReq = {
      app: buildApp(),
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
      } as any,
      params: { id: `agent-1`, orgId: `org-1` },
      body: { prompt: `Hello agent` },
      query: {},
      on: mockOn as any,
    }
  })

  it(`should have correct endpoint config`, () => {
    expect(runAgent.path).toBe(`/:id/run`)
    expect(runAgent.method).toBe(EPMethod.Post)
  })

  it(`should throw 401 when no userId`, async () => {
    const ep = getEndpointCfg(runAgent as any)
    mockReq.user = undefined as any

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Authentication required`
    )
  })

  it(`should throw 400 when no prompt`, async () => {
    const ep = getEndpointCfg(runAgent as any)
    mockReq.body = {}

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `prompt is required`
    )
  })

  it(`should throw 404 when agent not found`, async () => {
    const ep = getEndpointCfg(runAgent as any)
    const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null, error: null })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Agent not found`
    )
  })

  it(`should throw 404 when agent.get returns no data`, async () => {
    const ep = getEndpointCfg(runAgent as any)
    const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({})

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Agent not found`
    )
  })

  it(`should throw 500 when agent.get returns error`, async () => {
    const ep = getEndpointCfg(runAgent as any)
    const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null, error: new Error(`DB error`) })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `DB error`
    )
  })

  it(`should throw 404 when agent has no providers`, async () => {
    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providers: [],
        primaryProvider: undefined,
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
      },
    })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Agent has no provider configured`
    )
  })

  it(`should throw 400 when no API key found`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `anthropic`,
            brand: `anthropic`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        secrets: [],
      },
    })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `No API key found for agent provider`
    )
  })

  it(`should resolve API key via direct secretId lookup`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-direct-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `anthropic`,
            brand: `anthropic`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        secrets: [],
        tools: [],
      }),
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-direct`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    // Should use secret.get (direct lookup), NOT secret.list (fallback)
    const mockSecretGet = mockReq.app?.locals.db.services.secret.get as ReturnType<
      typeof vi.fn
    >
    const mockSecretList = mockReq.app?.locals.db.services.secret.list as ReturnType<
      typeof vi.fn
    >
    expect(mockSecretGet).toHaveBeenCalledWith(`secret-1`)
    expect(mockSecretList).not.toHaveBeenCalled()
  })

  it(`should throw 400 for unsupported LLM provider`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `invalid-provider`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `invalid-provider`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
      }),
    })

    mockReq.body = { prompt: `Hello agent`, threadId: `thread-1` }

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Cannot determine LLM provider`
    )
  })

  it(`should resolve provider type from brand`, async () => {
    const { AgentRunner } = await import(`@tdsk/agent`)
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-google-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        model: `gemini-2.0-flash`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `Google AI`,
            brand: `google`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `Google AI`,
          brand: `google`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
        tools: [],
      }),
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-google`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(AgentRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        llmConfig: expect.objectContaining({
          provider: `google`,
        }),
      })
    )
  })

  it(`should prefer brand over name matching`, async () => {
    const { AgentRunner } = await import(`@tdsk/agent`)
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        model: `gpt-4o`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `My Custom Name`,
            brand: `openai`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `My Custom Name`,
          brand: `openai`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
        tools: [],
      }),
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-opts`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(AgentRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        llmConfig: expect.objectContaining({
          provider: `openai`,
        }),
      })
    )
  })

  it(`should set SSE headers correctly`, async () => {
    const { AgentRunner } = await import(`@tdsk/agent`)
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `anthropic`,
            brand: `anthropic`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
        model: `claude-sonnet-4-20250514`,
        tools: [],
      }),
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-sse`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockSetHeader).toHaveBeenCalledWith(`Content-Type`, `text/event-stream`)
    expect(mockSetHeader).toHaveBeenCalledWith(`Cache-Control`, `no-cache`)
    expect(mockSetHeader).toHaveBeenCalledWith(`Connection`, `keep-alive`)
    expect(mockSetHeader).toHaveBeenCalledWith(`X-Thread-Id`, `thread-sse`)
    expect(mockFlushHeaders).toHaveBeenCalled()
  })

  it(`should create a new thread when no threadId provided`, async () => {
    const { AgentRunner } = await import(`@tdsk/agent`)
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `anthropic`,
            brand: `anthropic`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
        model: `claude-sonnet-4-20250514`,
        tools: [],
      }),
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-new`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockThreadCreate).toHaveBeenCalledWith({
      userId: `test-user-id`,
      orgId: `org-1`,
      agentId: `agent-1`,
      name: `Hello agent`,
    })
  })

  it(`should use existing threadId when provided and skip thread creation`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockReq.body = { prompt: `Continue`, threadId: `existing-thread` }

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        model: `test-model`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `anthropic`,
            brand: `anthropic`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
        tools: [],
      }),
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockThreadCreate).not.toHaveBeenCalled()

    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: `thread`, threadId: `existing-thread` })}\n\n`
    )
  })

  it(`should send thread ID as first SSE event`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        model: `test-model`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `anthropic`,
            brand: `anthropic`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
        tools: [],
      }),
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-first`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    const firstWriteCall = mockWrite.mock.calls[0][0]
    expect(firstWriteCall).toBe(
      `data: ${JSON.stringify({ type: `thread`, threadId: `thread-first` })}\n\n`
    )
  })

  it(`should call AgentRunner.run with correct options`, async () => {
    const { AgentRunner } = await import(`@tdsk/agent`)
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `anthropic`,
            brand: `anthropic`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
        model: `claude-sonnet-4-20250514`,
        maxTokens: 2048,
        systemPrompt: `You are helpful.`,
        tools: [`web_search`],
        environment: { temperature: 0.7 },
      }),
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-run`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(AgentRunner.run).toHaveBeenCalledOnce()
    expect(AgentRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: `agent-1`,
        threadId: `thread-run`,
        prompt: `Hello agent`,
        userId: `test-user-id`,
        orgId: `org-1`,
        tools: [`web_search`],
        customFunctions: [],
        environment: { temperature: 0.7 },
        db: expect.objectContaining({
          createMessage: expect.any(Function),
          listMessages: expect.any(Function),
        }),
        llmConfig: expect.objectContaining({
          apiKey: `sk-test-key`,
          model: `claude-sonnet-4-20250514`,
          provider: `anthropic`,
          maxTokens: 2048,
          temperature: 0.7,
          systemPrompt: `You are helpful.`,
        }),
        sandboxConfig: expect.objectContaining({
          provider: ESandboxType.local,
          timeout: 300000,
        }),
        onEvent: expect.any(Function),
        onExecuteFunction: expect.any(Function),
      })
    )
  })

  it(`should default sandbox provider to local when no explicit sandbox config`, async () => {
    const { AgentRunner } = await import(`@tdsk/agent`)
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        model: `test-model`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `anthropic`,
            brand: `anthropic`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
        tools: [],
      }),
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-default`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(AgentRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        sandboxConfig: expect.objectContaining({
          provider: ESandboxType.local,
          timeout: 300000,
        }),
      })
    )
  })

  it(`should write DONE event and call res.end on success`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        model: `test-model`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `anthropic`,
            brand: `anthropic`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
        tools: [],
      }),
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-done`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockWrite).toHaveBeenCalledWith(`data: [DONE]\n\n`)
    expect(mockEnd).toHaveBeenCalled()
  })

  it(`should send error event when AgentRunner.run throws`, async () => {
    const { AgentRunner } = await import(`@tdsk/agent`)
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)
    ;(AgentRunner.run as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error(`LLM crashed`)
    )

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        model: `test-model`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `anthropic`,
            brand: `anthropic`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
        tools: [],
      }),
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `t-err`, name: `test` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: `error`, error: `LLM crashed` })}\n\n`
    )
    expect(mockWrite).toHaveBeenCalledWith(`data: [DONE]\n\n`)
    expect(mockEnd).toHaveBeenCalled()
  })

  it(`should register close handler on request`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: withResolveModel({
        id: `agent-1`,
        orgId: `org-1`,
        model: `test-model`,
        providers: [
          {
            id: `prov-1`,
            secretId: `secret-1`,
            type: `ai`,
            orgId: `org-1`,
            name: `anthropic`,
            brand: `anthropic`,
            options: {},
          },
        ],
        primaryProvider: {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        secrets: [
          { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
        ],
        tools: [],
      }),
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `t-close`, name: `test` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockOn).toHaveBeenCalledWith(`close`, expect.any(Function))
  })
})

describe(`AgentEndpoint.runHeadless - direct tests`, () => {
  let AgentEndpoint: typeof import('@TBE/services/endpoints/agentEndpoint').AgentEndpoint

  const mockOnEvent = vi.fn()

  const buildMockDb = () => ({
    services: {
      agent: { get: vi.fn() },
      secret: {
        get: vi.fn().mockResolvedValue({
          data: { encryptedValue: fakeEncrypted(), orgId: `org-1` },
        }),
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
      thread: {
        create: vi.fn().mockResolvedValue({ data: { id: `thread-new` } }),
        get: vi.fn(),
      },
      message: {
        create: vi.fn().mockResolvedValue({ data: {} }),
        listByThread: vi.fn().mockResolvedValue({ data: [] }),
      },
      function: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        get: vi.fn().mockResolvedValue({ data: null }),
      },
      skill: {
        listForAgent: vi.fn().mockResolvedValue({ data: [] }),
      },
    },
  })

  const buildMockResolvedConfig = () => ({
    agent: { id: `agent-1` },
    effectiveAgent: { id: `agent-1` },
    orgId: `org-1`,
    llmConfig: {
      apiKey: `sk-test`,
      provider: `anthropic`,
      model: `claude-sonnet-4-20250514`,
    },
    sandboxConfig: { provider: `local`, timeout: 300000 },
    environment: undefined,
    customFunctions: [],
    skills: [],
    tools: undefined,
    envVars: {},
    db: { createMessage: vi.fn(), listMessages: vi.fn() },
    onExecuteFunction: vi.fn(),
  })

  beforeEach(async () => {
    vi.clearAllMocks()

    const { AgentRunner } = await import(`@tdsk/agent`)
    ;(AgentRunner.run as ReturnType<typeof vi.fn>).mockResolvedValue({
      waitForIdle: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn(),
    })

    // Override default pass-through with controlled mock for runHeadless tests
    mockResolveAgentConfig.mockImplementation(() =>
      Promise.resolve(buildMockResolvedConfig())
    )

    const mod = await import(`@TBE/services/endpoints/agentEndpoint`)
    AgentEndpoint = mod.AgentEndpoint
  })

  it(`should resolve config, create thread, run agent, and return threadId`, async () => {
    const { AgentRunner } = await import(`@tdsk/agent`)
    const db = buildMockDb()
    const agent = new AgentEndpoint(db as any)
    const mockReq = { app: { locals: { config: {} } } } as any

    const result = await agent.runHeadless(mockReq, {
      agentId: `agent-1`,
      prompt: `Hello`,
      userId: `test-user`,
      onEvent: mockOnEvent,
    })

    expect(result.threadId).toBe(`thread-new`)
    expect(mockResolveAgentConfig).toHaveBeenCalledWith(
      `agent-1`,
      db,
      mockReq.app,
      expect.objectContaining({ userId: `test-user` })
    )
    expect(db.services.thread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: `test-user`,
        agentId: `agent-1`,
        orgId: `org-1`,
      })
    )
    expect(AgentRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: `Hello`,
        userId: `test-user`,
        agentId: `agent-1`,
        threadId: `thread-new`,
        onEvent: mockOnEvent,
      })
    )
  })

  it(`should skip resolveAgentConfig when resolvedConfig is provided`, async () => {
    const db = buildMockDb()
    const agent = new AgentEndpoint(db as any)
    const mockReq = { app: { locals: { config: {} } } } as any
    const preResolved = buildMockResolvedConfig()

    const result = await agent.runHeadless(mockReq, {
      agentId: `agent-1`,
      prompt: `Hello`,
      userId: `test-user`,
      resolvedConfig: preResolved as any,
      onEvent: mockOnEvent,
    })

    expect(result.threadId).toBe(`thread-new`)
    expect(mockResolveAgentConfig).not.toHaveBeenCalled()
  })

  it(`should reuse existing thread when threadId is provided`, async () => {
    const db = buildMockDb()
    const agent = new AgentEndpoint(db as any)
    const mockReq = { app: { locals: { config: {} } } } as any

    const result = await agent.runHeadless(mockReq, {
      agentId: `agent-1`,
      prompt: `Continue`,
      userId: `test-user`,
      threadId: `existing-thread`,
      onEvent: mockOnEvent,
    })

    expect(result.threadId).toBe(`existing-thread`)
    expect(db.services.thread.create).not.toHaveBeenCalled()
  })

  it(`should throw 500 when thread creation fails`, async () => {
    const db = buildMockDb()
    const agent = new AgentEndpoint(db as any)
    ;(db.services.thread.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: new Error(`DB error`),
    })
    const mockReq = { app: { locals: { config: {} } } } as any

    await expect(
      agent.runHeadless(mockReq, {
        agentId: `agent-1`,
        prompt: `Hello`,
        userId: `test-user`,
        onEvent: mockOnEvent,
      })
    ).rejects.toThrow(`Failed to create thread`)
  })
})
