import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { runAgent } from './runAgent'
import { EPMethod } from '@TBE/types'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
}))

vi.mock(`@tdsk/agent`, () => ({
  AgentRunner: {
    run: vi.fn().mockResolvedValue(undefined),
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
              get: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
            provider: {
              get: vi.fn(),
            },
            secret: {
              list: vi.fn().mockResolvedValue({ data: [] }),
            },
            thread: {
              create: vi.fn(),
              get: vi.fn(),
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

  it(`should throw 404 when agent.get returns error`, async () => {
    const ep = getEndpointCfg(runAgent as any)
    const mockGet = mockReq.app?.locals.db.services.agent.get as ReturnType<typeof vi.fn>
    mockGet.mockResolvedValue({ data: null, error: new Error(`DB error`) })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Agent not found`
    )
  })

  it(`should throw 404 when provider not found`, async () => {
    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
      },
    })
    mockProvGet.mockResolvedValue({ data: null })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Agent provider not found`
    )
  })

  it(`should throw 400 when no API key found across all scopes`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
    })
    // secret.list returns empty for both provider and org scoped
    const mockSecretList = mockReq.app?.locals.db.services.secret.list as ReturnType<
      typeof vi.fn
    >
    mockSecretList.mockResolvedValue({ data: [] })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `No API key found for agent provider`
    )
  })

  it(`should resolve API key from agent-scoped secrets`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-agent-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-agent`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    // Should NOT query provider or org secrets when agent secret found
    const mockSecretList = mockReq.app?.locals.db.services.secret.list as ReturnType<
      typeof vi.fn
    >
    expect(mockSecretList).not.toHaveBeenCalled()
  })

  it(`should fall back to provider-scoped secrets when agent has none`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-provider-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockSecretList = mockReq.app?.locals.db.services.secret.list as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [],
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
    })
    mockSecretList.mockResolvedValueOnce({
      data: [{ encryptedValue: fakeEncrypted(), providerId: `prov-1` }],
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-prov`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockSecretList).toHaveBeenCalledWith({
      where: { providerId: `prov-1` },
    })
  })

  it(`should fall back to org-scoped secrets when provider has none`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-org-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockSecretList = mockReq.app?.locals.db.services.secret.list as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [],
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
    })
    // Provider secrets empty
    mockSecretList.mockResolvedValueOnce({ data: [] })
    // Org secrets found
    mockSecretList.mockResolvedValueOnce({
      data: [{ encryptedValue: fakeEncrypted(), orgId: `org-1` }],
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-org`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockSecretList).toHaveBeenCalledWith({
      where: { providerId: `prov-1` },
    })
    expect(mockSecretList).toHaveBeenCalledWith({
      where: { orgId: `org-1` },
    })
  })

  it(`should throw 400 for unsupported LLM provider`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `invalid-provider`, options: {} },
    })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Cannot determine LLM provider`
    )
  })

  it(`should resolve Google AI display name to google provider`, async () => {
    const { AgentRunner } = await import(`@tdsk/agent`)
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-google-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `Google AI`, options: {} },
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

  it(`should prefer options.llmProvider over name matching`, async () => {
    const { AgentRunner } = await import(`@tdsk/agent`)
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `My Custom Name`, options: { llmProvider: `openai` } },
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
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        model: `claude-sonnet-4-20250514`,
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
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
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        model: `claude-sonnet-4-20250514`,
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
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
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockReq.body = { prompt: `Continue`, threadId: `existing-thread` }

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
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
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
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
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        model: `claude-sonnet-4-20250514`,
        maxTokens: 2048,
        systemPrompt: `You are helpful.`,
        tools: [`web_search`],
        environment: { temperature: 0.7 },
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
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
        maxSteps: 10,
        llmConfig: expect.objectContaining({
          apiKey: `sk-test-key`,
          model: `claude-sonnet-4-20250514`,
          provider: `anthropic`,
          maxTokens: 2048,
          temperature: 0.7,
          systemPrompt: `You are helpful.`,
        }),
        sandboxConfig: expect.objectContaining({
          provider: `local`,
          timeout: 300000,
        }),
        onEvent: expect.any(Function),
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
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-default`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(AgentRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        sandboxConfig: expect.objectContaining({
          provider: `local`,
          timeout: 300000,
          apiKey: undefined,
          template: undefined,
        }),
      })
    )
  })

  it(`should use explicit sandbox provider when configured`, async () => {
    const { AgentRunner } = await import(`@tdsk/agent`)
    const { decryptValue } = await import(`@tdsk/domain`)
    ;(decryptValue as ReturnType<typeof vi.fn>).mockResolvedValue(`sk-test-key`)

    const ep = getEndpointCfg(runAgent as any)
    const mockAgentGet = mockReq.app?.locals.db.services.agent.get as ReturnType<
      typeof vi.fn
    >
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        tools: [],
        environment: {
          timeout: 600000,
          options: {
            sandbox: {
              provider: `e2b`,
              apiKey: `e2b-key-123`,
              template: `custom-template`,
            },
          },
        },
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `thread-e2b`, name: `Hello agent` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(AgentRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        sandboxConfig: expect.objectContaining({
          provider: `e2b`,
          apiKey: `e2b-key-123`,
          template: `custom-template`,
          timeout: 600000,
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
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
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
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
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
    const mockProvGet = mockReq.app?.locals.db.services.provider.get as ReturnType<
      typeof vi.fn
    >
    const mockThreadCreate = mockReq.app?.locals.db.services.thread.create as ReturnType<
      typeof vi.fn
    >

    mockAgentGet.mockResolvedValue({
      data: {
        id: `agent-1`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secrets: [{ encryptedValue: fakeEncrypted(), agentId: `agent-1` }],
        tools: [],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
    })
    mockThreadCreate.mockResolvedValue({
      data: { id: `t-close`, name: `test` },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockOn).toHaveBeenCalledWith(`close`, expect.any(Function))
  })
})
