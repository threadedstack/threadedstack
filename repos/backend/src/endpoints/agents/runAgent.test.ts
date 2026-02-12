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

vi.mock(`@TBE/services/agent/agent`, () => ({
  AgentRunner: {
    run: vi.fn().mockResolvedValue(undefined),
  },
}))

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
        secrets: [{ value: `sk-key` }],
      },
    })
    mockProvGet.mockResolvedValue({ data: null })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Agent provider not found`
    )
  })

  it(`should throw 400 when no API key found in agent secrets`, async () => {
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

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `No API key found for agent provider`
    )
  })

  it(`should throw 400 when secrets have no value property`, async () => {
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
        secrets: [{ key: `API_KEY`, value: `` }],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `anthropic`, options: {} },
    })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `No API key found for agent provider`
    )
  })

  it(`should throw 400 for unsupported LLM provider`, async () => {
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
        secrets: [{ value: `sk-key` }],
      },
    })
    mockProvGet.mockResolvedValue({
      data: { id: `prov-1`, name: `invalid-provider`, options: {} },
    })

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Unsupported LLM provider`
    )
  })

  it(`should set SSE headers correctly`, async () => {
    const { AgentRunner } = await import(`@TBE/services/agent/agent`)

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
        secrets: [{ value: `sk-test-key` }],
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
    const { AgentRunner } = await import(`@TBE/services/agent/agent`)

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
        secrets: [{ value: `sk-test-key` }],
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
        secrets: [{ value: `sk-test-key` }],
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
        secrets: [{ value: `sk-test-key` }],
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
    const { AgentRunner } = await import(`@TBE/services/agent/agent`)

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
        secrets: [{ value: `sk-test-key` }],
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
        onEvent: expect.any(Function),
      })
    )
  })

  it(`should write DONE event and call res.end on success`, async () => {
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
        secrets: [{ value: `sk-test-key` }],
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
    const { AgentRunner } = await import(`@TBE/services/agent/agent`)
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
        secrets: [{ value: `sk-test-key` }],
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
        secrets: [{ value: `sk-test-key` }],
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
