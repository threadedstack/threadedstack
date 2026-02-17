import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { streamChat } from './streamChat'
import { EPMethod } from '@TBE/types'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'
import { createSession, resetSessionStore } from '@TBE/services/sessionStore'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const mockGetModel = vi.fn()
const mockStreamSimple = vi.fn()

vi.mock(`@mariozechner/pi-ai`, () => ({
  getModel: (...args: any[]) => mockGetModel(...args),
  streamSimple: (...args: any[]) => mockStreamSimple(...args),
}))

describe(`POST /ai/stream - LLM stream proxy`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockWrite: ReturnType<typeof vi.fn>
  let mockEnd: ReturnType<typeof vi.fn>
  let mockSetHeader: ReturnType<typeof vi.fn>
  let mockFlushHeaders: ReturnType<typeof vi.fn>
  let mockOn: ReturnType<typeof vi.fn>
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

    mockGetModel.mockReturnValue({
      provider: `anthropic`,
      model: `claude-sonnet-4-20250514`,
    })

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
      end: mockEnd,
      json: mockJson,
      write: mockWrite,
      on: mockOn as any,
      status: mockStatus,
      setHeader: mockSetHeader,
      flushHeaders: mockFlushHeaders,
    } as Partial<Response>

    mockReq = {
      app: buildApp(),
      headers: {
        authorization: `Session ${sessionToken}`,
      },
      body: {
        context: {
          messages: [{ role: `user`, content: [{ type: `text`, text: `Hello` }] }],
          tools: [],
        },
      },
      query: {},
      params: {},
    }

    // Default: streamSimple yields nothing (empty conversation)
    mockStreamSimple.mockReturnValue((async function* () {})())
  })

  afterEach(() => {
    resetSessionStore()
    vi.restoreAllMocks()
  })

  it(`should have correct endpoint config`, () => {
    expect(streamChat.path).toBe(`/stream`)
    expect(streamChat.method).toBe(EPMethod.Post)
  })

  it(`should throw 401 when no session token`, async () => {
    const ep = getEndpointCfg(streamChat as any)
    mockReq.headers = {}

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Session token required`
    )
  })

  it(`should throw 401 when Authorization header is not Session type`, async () => {
    const ep = getEndpointCfg(streamChat as any)
    mockReq.headers = { authorization: `Bearer some-jwt` }

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Session token required`
    )
  })

  it(`should throw 401 for invalid session token`, async () => {
    const ep = getEndpointCfg(streamChat as any)
    mockReq.headers = { authorization: `Session invalid-token` }

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Invalid or expired session`
    )
  })

  it(`should throw 400 when context.messages is missing`, async () => {
    const ep = getEndpointCfg(streamChat as any)
    mockReq.body = {}

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `context.messages is required and must be an array`
    )
  })

  it(`should throw 400 when context.messages is not an array`, async () => {
    const ep = getEndpointCfg(streamChat as any)
    mockReq.body = { context: { messages: `not-an-array` } }

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `context.messages is required and must be an array`
    )
  })

  it(`should set SSE headers`, async () => {
    const ep = getEndpointCfg(streamChat as any)

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockSetHeader).toHaveBeenCalledWith(`Content-Type`, `text/event-stream`)
    expect(mockSetHeader).toHaveBeenCalledWith(`Cache-Control`, `no-cache`)
    expect(mockSetHeader).toHaveBeenCalledWith(`Connection`, `keep-alive`)
    expect(mockFlushHeaders).toHaveBeenCalled()
  })

  it(`should stream events from pi-ai streamSimple`, async () => {
    const piAiEvents = [
      { type: `start`, partial: { content: [] } },
      {
        type: `text_delta`,
        contentIndex: 0,
        delta: `Hello `,
        partial: { content: [{ type: `text`, text: `Hello ` }] },
      },
      {
        type: `text_delta`,
        contentIndex: 0,
        delta: `world`,
        partial: { content: [{ type: `text`, text: `Hello world` }] },
      },
      {
        type: `done`,
        reason: `end_turn`,
        message: { usage: { input: 10, output: 5 } },
        partial: { content: [] },
      },
    ]

    mockStreamSimple.mockReturnValue(
      (async function* () {
        for (const e of piAiEvents) yield e
      })()
    )

    const ep = getEndpointCfg(streamChat as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: `start` })}\n\n`
    )
    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: `text_delta`, contentIndex: 0, delta: `Hello ` })}\n\n`
    )
    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: `text_delta`, contentIndex: 0, delta: `world` })}\n\n`
    )
    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: `done`, reason: `end_turn`, usage: { input: 10, output: 5 } })}\n\n`
    )
    expect(mockEnd).toHaveBeenCalled()
  })

  it(`should pass messages and tools to streamSimple with correct context`, async () => {
    mockStreamSimple.mockReturnValue((async function* () {})())

    const ep = getEndpointCfg(streamChat as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockGetModel).toHaveBeenCalledWith(`anthropic`, `claude-sonnet-4-20250514`)

    expect(mockStreamSimple).toHaveBeenCalledWith(
      { provider: `anthropic`, model: `claude-sonnet-4-20250514` },
      expect.objectContaining({
        messages: [{ role: `user`, content: [{ type: `text`, text: `Hello` }] }],
        tools: [],
      }),
      expect.objectContaining({
        apiKey: `sk-test-key`,
        maxTokens: 4096,
      })
    )
  })

  it(`should write error event when streamSimple throws`, async () => {
    mockStreamSimple.mockReturnValue(
      (async function* () {
        throw new Error(`Provider timeout`)
      })()
    )

    const ep = getEndpointCfg(streamChat as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        type: `error`,
        reason: `error`,
        errorMessage: `Provider timeout`,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      })}\n\n`
    )
    expect(mockEnd).toHaveBeenCalled()
  })

  it(`should register close handler on response`, async () => {
    const ep = getEndpointCfg(streamChat as any)
    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockOn).toHaveBeenCalledWith(`close`, expect.any(Function))
  })
})
