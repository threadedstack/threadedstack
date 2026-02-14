import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { aiChatProxy } from './chatProxy'
import { EPMethod } from '@TBE/types'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'
import { llm } from '@TBE/services/llm'
import { createSession, resetSessionStore } from '@TBE/services/sessionStore'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

describe(`POST /ai/chat - LLM chat proxy`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockWrite: ReturnType<typeof vi.fn>
  let mockEnd: ReturnType<typeof vi.fn>
  let mockSetHeader: ReturnType<typeof vi.fn>
  let mockFlushHeaders: ReturnType<typeof vi.fn>
  let mockOn: ReturnType<typeof vi.fn>
  let mockStream: ReturnType<typeof vi.fn>
  let sessionToken: string

  const buildApp = () => {
    return {
      locals: {
        config,
        payments: new PaymentsService(config.payments),
        db: { services: {} },
      },
    } as unknown as TApp
  }

  const getEndpointCfg = (ep?: TEndpoint) => getEpCfg(buildApp(), ep)

  beforeEach(() => {
    vi.clearAllMocks()
    resetSessionStore()

    mockStream = vi.fn()

    // Spy on the llm service object to intercept createLLMAdapter
    vi.spyOn(llm, `createLLMAdapter`).mockReturnValue({
      provider: `anthropic`,
      stream: (...args: any[]) => mockStream(...args),
    } as any)

    // Create a real session for testing
    sessionToken = createSession({
      agentId: `agent-1`,
      orgId: `org-1`,
      userId: `user-1`,
      llmConfig: {
        apiKey: `sk-test-key`,
        model: `claude-sonnet-4-20250514`,
        provider: `anthropic`,
        maxTokens: 4096,
      },
    })

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
      headers: {
        authorization: `Session ${sessionToken}`,
      },
      body: {
        messages: [{ role: `user`, content: [{ type: `text`, text: `Hello` }] }],
        tools: [],
      },
      query: {},
      params: {},
      on: mockOn as any,
    }

    // Default: stream yields nothing (empty conversation)
    mockStream.mockReturnValue((async function* () {})())
  })

  afterEach(() => {
    resetSessionStore()
    vi.restoreAllMocks()
  })

  it(`should have correct endpoint config`, () => {
    expect(aiChatProxy.path).toBe(`/chat`)
    expect(aiChatProxy.method).toBe(EPMethod.Post)
  })

  it(`should throw 401 when no session token`, async () => {
    const ep = getEndpointCfg(aiChatProxy as any)
    mockReq.headers = {}

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Session token required`
    )
  })

  it(`should throw 401 when Authorization header is not Session type`, async () => {
    const ep = getEndpointCfg(aiChatProxy as any)
    mockReq.headers = { authorization: `Bearer some-jwt` }

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Session token required`
    )
  })

  it(`should throw 401 for invalid session token`, async () => {
    const ep = getEndpointCfg(aiChatProxy as any)
    mockReq.headers = { authorization: `Session invalid-token` }

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Invalid or expired session`
    )
  })

  it(`should throw 400 when messages is missing`, async () => {
    const ep = getEndpointCfg(aiChatProxy as any)
    mockReq.body = {}

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `messages is required`
    )
  })

  it(`should throw 400 when messages is not an array`, async () => {
    const ep = getEndpointCfg(aiChatProxy as any)
    mockReq.body = { messages: `not-an-array` }

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `messages is required`
    )
  })

  it(`should set SSE headers`, async () => {
    const ep = getEndpointCfg(aiChatProxy as any)

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockSetHeader).toHaveBeenCalledWith(`Content-Type`, `text/event-stream`)
    expect(mockSetHeader).toHaveBeenCalledWith(`Cache-Control`, `no-cache`)
    expect(mockSetHeader).toHaveBeenCalledWith(`Connection`, `keep-alive`)
    expect(mockFlushHeaders).toHaveBeenCalled()
  })

  it(`should stream events from LLM adapter`, async () => {
    const events = [
      { type: `text`, text: `Hello ` },
      { type: `text`, text: `world` },
      { type: `done`, stopReason: `end_turn` },
    ]

    mockStream.mockReturnValue(
      (async function* () {
        for (const e of events) yield e
      })()
    )

    const ep = getEndpointCfg(aiChatProxy as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: `text`, text: `Hello ` })}\n\n`
    )
    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: `text`, text: `world` })}\n\n`
    )
    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: `done`, stopReason: `end_turn` })}\n\n`
    )
    expect(mockWrite).toHaveBeenCalledWith(`data: [DONE]\n\n`)
    expect(mockEnd).toHaveBeenCalled()
  })

  it(`should pass messages and tools to adapter.stream`, async () => {
    mockStream.mockReturnValue((async function* () {})())

    const ep = getEndpointCfg(aiChatProxy as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockStream).toHaveBeenCalledWith(
      [{ role: `user`, content: [{ type: `text`, text: `Hello` }] }],
      [],
      expect.objectContaining({
        apiKey: `sk-test-key`,
        model: `claude-sonnet-4-20250514`,
        provider: `anthropic`,
      })
    )
  })

  it(`should default tools to empty array when not provided`, async () => {
    mockStream.mockReturnValue((async function* () {})())
    mockReq.body = {
      messages: [{ role: `user`, content: [{ type: `text`, text: `Hi` }] }],
    }

    const ep = getEndpointCfg(aiChatProxy as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockStream).toHaveBeenCalledWith(expect.any(Array), [], expect.any(Object))
  })

  it(`should write error event when adapter throws`, async () => {
    mockStream.mockReturnValue(
      (async function* () {
        throw new Error(`Provider timeout`)
      })()
    )

    const ep = getEndpointCfg(aiChatProxy as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: `error`, error: `Provider timeout` })}\n\n`
    )
    expect(mockWrite).toHaveBeenCalledWith(`data: [DONE]\n\n`)
    expect(mockEnd).toHaveBeenCalled()
  })

  it(`should register close handler on request`, async () => {
    const ep = getEndpointCfg(aiChatProxy as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockOn).toHaveBeenCalledWith(`close`, expect.any(Function))
  })

  it(`should create adapter with correct provider from session`, async () => {
    mockStream.mockReturnValue((async function* () {})())

    const ep = getEndpointCfg(aiChatProxy as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(llm.createLLMAdapter).toHaveBeenCalledWith(`anthropic`)
  })
})
