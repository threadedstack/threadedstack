import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { oaiChatCompletions } from './oaiChatCompletions'
import { EPMethod } from '@TBE/types'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock(`nanoid`, () => ({
  nanoid: vi.fn(() => `mock-nano-id-1234567890ab`),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const mockRequireAgentAccess = vi.fn().mockResolvedValue(undefined)
vi.mock(`@TBE/utils/auth/requireAgentAccess`, () => ({
  requireAgentAccess: (...args: any[]) => mockRequireAgentAccess(...args),
}))

const mockRunHeadless = vi.fn().mockResolvedValue({ threadId: `thread-1` })
vi.mock(`@TBE/services/endpoints/agentEndpoint`, () => ({
  AgentEndpoint: vi.fn().mockImplementation(() => ({
    runHeadless: mockRunHeadless,
  })),
}))

const mockExtractPrompt = vi.fn()
const mockBuildOverrides = vi.fn().mockReturnValue({})
const mockConvertOAIMessages = vi.fn().mockReturnValue([])
vi.mock(`@TBE/services/openai/requestAdapter`, () => ({
  extractPrompt: (...args: any[]) => mockExtractPrompt(...args),
  buildOverrides: (...args: any[]) => mockBuildOverrides(...args),
  convertOAIMessages: (...args: any[]) => mockConvertOAIMessages(...args),
}))

const mockResolveAgentConfig = vi.fn().mockResolvedValue({
  agent: { id: `agent-1` },
  effectiveAgent: { id: `agent-1` },
  orgId: `org-1`,
  llmConfig: {},
  sandboxConfig: {},
  environment: undefined,
  customFunctions: [],
  skills: [],
  tools: undefined,
  envVars: {},
  db: {},
  onExecuteFunction: vi.fn(),
})
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: (...args: any[]) => mockResolveAgentConfig(...args),
}))

const mockSendInitial = vi.fn()
const mockOnEventStreaming = vi.fn()
const mockFinish = vi.fn()
const mockCreateStreamingAdapter = vi.fn((_res: any, _id: any, _model: any) => ({
  sendInitial: mockSendInitial,
  onEvent: mockOnEventStreaming,
  finish: mockFinish,
}))

const mockOnEventNonStreaming = vi.fn()
const mockBuild = vi.fn(() => ({
  id: `chatcmpl-mock-nano-id-1234567890ab`,
  object: `chat.completion`,
  created: 1000000,
  model: `default`,
  choices: [
    {
      index: 0,
      message: { role: `assistant`, content: `Hello!` },
      finish_reason: `stop`,
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
}))
const mockCreateNonStreamingAdapter = vi.fn((_id: any, _model: any) => ({
  onEvent: mockOnEventNonStreaming,
  build: mockBuild,
}))

const mockFormatOAIError = vi.fn((err: any) => ({
  status: err?.status || 500,
  body: {
    error: {
      message: err?.message || `Internal server error`,
      type: `server_error`,
      param: null,
      code: null,
    },
  },
}))

vi.mock(`@TBE/services/openai/responseAdapter`, () => ({
  createStreamingAdapter: (...args: any) =>
    mockCreateStreamingAdapter(...(args as [any, any, any])),
  createNonStreamingAdapter: (...args: any) =>
    mockCreateNonStreamingAdapter(...(args as [any, any])),
  formatOAIError: (...args: any) => mockFormatOAIError(...(args as [any])),
}))

// ── Helpers ──────────────────────────────────────────────────────────

const buildApp = () =>
  ({
    locals: {
      db: {
        services: {
          agent: {
            get: vi.fn().mockResolvedValue({
              data: { id: `agent-1`, orgId: `org-1`, projects: [] },
            }),
          },
          thread: {
            create: vi.fn().mockResolvedValue({ data: { id: `thread-1` } }),
            get: vi.fn().mockResolvedValue({
              data: {
                id: `thread-existing`,
                orgId: `org-1`,
                agentId: `agent-1`,
                userId: `test-user-id`,
              },
            }),
          },
          message: { create: vi.fn().mockResolvedValue({ data: {} }) },
        },
      },
    },
  }) as unknown as TApp

// ── Tests ────────────────────────────────────────────────────────────

describe(`POST /agents/:id/v1/chat/completions - OAI Chat Completions`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockWrite: ReturnType<typeof vi.fn>
  let mockEnd: ReturnType<typeof vi.fn>
  let mockSetHeader: ReturnType<typeof vi.fn>
  let mockFlushHeaders: ReturnType<typeof vi.fn>
  let mockOn: ReturnType<typeof vi.fn>

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
      user: { id: `test-user-id`, email: `test@example.com` } as any,
      params: { id: `agent-1` },
      body: {
        messages: [{ role: `user`, content: `Hello` }],
      },
      headers: {},
      query: {},
      on: mockOn as any,
    }

    mockExtractPrompt.mockReturnValue(`Hello`)
    mockBuildOverrides.mockReturnValue({})
    mockConvertOAIMessages.mockReturnValue([])
    mockRunHeadless.mockResolvedValue({ threadId: `thread-1` })
    mockResolveAgentConfig.mockResolvedValue({
      agent: { id: `agent-1` },
      effectiveAgent: { id: `agent-1` },
      orgId: `org-1`,
      llmConfig: {},
      sandboxConfig: {},
      environment: undefined,
      customFunctions: [],
      skills: [],
      tools: undefined,
      envVars: {},
      db: {},
      onExecuteFunction: vi.fn(),
    })
    mockBuild.mockReturnValue({
      id: `chatcmpl-mock-nano-id-1234567890ab`,
      object: `chat.completion`,
      created: 1000000,
      model: `default`,
      choices: [
        {
          index: 0,
          message: { role: `assistant`, content: `Hello!` },
          finish_reason: `stop`,
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    })
    mockFormatOAIError.mockImplementation((err: any) => ({
      status: err?.status || 500,
      body: {
        error: {
          message: err?.message || `Internal server error`,
          type: `server_error`,
          param: null,
          code: null,
        },
      },
    }))
  })

  // ── 1. Endpoint config ──────────────────────────────────────────

  it(`should have correct endpoint config`, () => {
    expect(oaiChatCompletions.path).toBe(`/:id/v1/chat/completions`)
    expect(oaiChatCompletions.method).toBe(EPMethod.Post)
  })

  // ── 2. Auth ─────────────────────────────────────────────────────

  it(`should throw 401 when no userId`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.user = undefined as any

    await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
      `Authentication required`
    )
  })

  // ── 3-5. Validation ─────────────────────────────────────────────

  it(`should return 400 when messages is empty`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = { messages: [] }

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFormatOAIError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `messages is required and must be non-empty`,
      })
    )
    expect(mockStatus).toHaveBeenCalledWith(400)
    expect(mockJson).toHaveBeenCalled()
  })

  it(`should return 400 when messages is missing`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = {}
    mockFormatOAIError.mockReturnValue({
      status: 400,
      body: {
        error: {
          message: `messages is required and must be non-empty`,
          type: `invalid_request_error`,
          param: null,
          code: null,
        },
      },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFormatOAIError).toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(400)
    expect(mockJson).toHaveBeenCalled()
  })

  it(`should return 400 when no user message found`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockExtractPrompt.mockReturnValue(undefined)

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFormatOAIError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `No user message found in messages array`,
      })
    )
    expect(mockStatus).toHaveBeenCalledWith(400)
    expect(mockJson).toHaveBeenCalled()
  })

  // ── 6-8. Non-streaming happy path ──────────────────────────────

  it(`should return JSON response with chat.completion format (non-streaming)`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    const expectedResponse = {
      id: `chatcmpl-mock-nano-id-1234567890ab`,
      object: `chat.completion`,
      created: 1000000,
      model: `default`,
      choices: [
        {
          index: 0,
          message: { role: `assistant`, content: `Hello!` },
          finish_reason: `stop`,
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }
    mockBuild.mockReturnValue(expectedResponse)

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockCreateNonStreamingAdapter).toHaveBeenCalledWith(
      `chatcmpl-mock-nano-id-1234567890ab`,
      `default`
    )
    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith(expectedResponse)
  })

  it(`should call runHeadless with correct args (non-streaming)`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockRunHeadless).toHaveBeenCalledWith(
      mockReq,
      expect.objectContaining({
        agentId: `agent-1`,
        prompt: `Hello`,
        userId: `test-user-id`,
        onEvent: mockOnEventNonStreaming,
        resolvedConfig: expect.objectContaining({ orgId: `org-1` }),
      })
    )
  })

  it(`should pass overrides from buildOverrides to runHeadless`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    const overrides = { model: `gpt-4o`, temperature: 0.5 }
    mockBuildOverrides.mockReturnValue(overrides)

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockRunHeadless).toHaveBeenCalledWith(
      mockReq,
      expect.objectContaining({
        overrides,
        resolvedConfig: expect.objectContaining({ orgId: `org-1` }),
      })
    )
  })

  // ── 9-10. Non-streaming errors ──────────────────────────────────

  it(`should return OAI error when runHeadless throws (non-streaming)`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    const error = new Error(`Agent execution failed`)
    mockRunHeadless.mockRejectedValueOnce(error)
    mockFormatOAIError.mockReturnValue({
      status: 500,
      body: {
        error: {
          message: `Agent execution failed`,
          type: `server_error`,
          param: null,
          code: null,
        },
      },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFormatOAIError).toHaveBeenCalledWith(error)
    expect(mockStatus).toHaveBeenCalledWith(500)
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        message: `Agent execution failed`,
        type: `server_error`,
        param: null,
        code: null,
      },
    })
  })

  it(`should return OAI error when adapter.build() throws (non-streaming)`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    const buildError = new Error(`Error event captured`)
    mockBuild.mockImplementationOnce(() => {
      throw buildError
    })
    mockFormatOAIError.mockReturnValue({
      status: 500,
      body: {
        error: {
          message: `Error event captured`,
          type: `server_error`,
          param: null,
          code: null,
        },
      },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFormatOAIError).toHaveBeenCalledWith(buildError)
    expect(mockStatus).toHaveBeenCalledWith(500)
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        message: `Error event captured`,
        type: `server_error`,
        param: null,
        code: null,
      },
    })
  })

  // ── 11-13. Streaming happy path ─────────────────────────────────

  it(`should set SSE headers (streaming)`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = { messages: [{ role: `user`, content: `Hello` }], stream: true }

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockSetHeader).toHaveBeenCalledWith(`Content-Type`, `text/event-stream`)
    expect(mockSetHeader).toHaveBeenCalledWith(`Cache-Control`, `no-cache`)
    expect(mockSetHeader).toHaveBeenCalledWith(`Connection`, `keep-alive`)
    expect(mockFlushHeaders).toHaveBeenCalled()
  })

  it(`should send initial chunk and call finish (streaming)`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = { messages: [{ role: `user`, content: `Hello` }], stream: true }

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockCreateStreamingAdapter).toHaveBeenCalledWith(
      mockRes,
      `chatcmpl-mock-nano-id-1234567890ab`,
      `default`
    )
    expect(mockSendInitial).toHaveBeenCalled()
    expect(mockFinish).toHaveBeenCalled()
  })

  it(`should register close handler (streaming)`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = { messages: [{ role: `user`, content: `Hello` }], stream: true }

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockOn).toHaveBeenCalledWith(`close`, expect.any(Function))
  })

  // ── 14. Streaming error ─────────────────────────────────────────

  it(`should write error SSE chunk when runHeadless throws (streaming)`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = { messages: [{ role: `user`, content: `Hello` }], stream: true }
    mockRunHeadless.mockRejectedValueOnce(new Error(`LLM crashed`))

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockWrite).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        error: { message: `LLM crashed`, type: `server_error`, param: null, code: null },
      })}\n\n`
    )
    expect(mockFinish).toHaveBeenCalled()
  })

  // ── 15-17. Thread seeding ───────────────────────────────────────

  it(`should seed thread with prior messages when messages.length > 1`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    const priorMessages = [
      { role: `user`, content: `First message` },
      { role: `assistant`, content: `Response` },
    ]
    const currentMessage = { role: `user`, content: `Follow-up` }
    mockReq.body = { messages: [...priorMessages, currentMessage] }
    mockExtractPrompt.mockReturnValue(`Follow-up`)
    mockConvertOAIMessages.mockReturnValue([
      { type: `user`, content: [{ type: `text`, text: `First message` }] },
      { type: `assistant`, content: [{ type: `text`, text: `Response` }] },
    ])

    const db = mockReq.app?.locals.db as any

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockConvertOAIMessages).toHaveBeenCalledWith(priorMessages)
    expect(db.services.thread.create).toHaveBeenCalledWith({
      userId: `test-user-id`,
      agentId: `agent-1`,
      orgId: `org-1`,
      name: `Follow-up`,
    })
    expect(db.services.message.create).toHaveBeenCalledTimes(2)
    expect(db.services.message.create).toHaveBeenCalledWith({
      threadId: `thread-1`,
      type: `user`,
      content: [{ type: `text`, text: `First message` }],
    })
    expect(db.services.message.create).toHaveBeenCalledWith({
      threadId: `thread-1`,
      type: `assistant`,
      content: [{ type: `text`, text: `Response` }],
    })

    expect(mockRunHeadless).toHaveBeenCalledWith(
      mockReq,
      expect.objectContaining({
        threadId: `thread-1`,
        resolvedConfig: expect.objectContaining({ orgId: `org-1` }),
      })
    )
  })

  it(`should skip thread seeding for single message`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = { messages: [{ role: `user`, content: `Hello` }] }
    const db = mockReq.app?.locals.db as any

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockConvertOAIMessages).not.toHaveBeenCalled()
    expect(db.services.thread.create).not.toHaveBeenCalled()
    expect(db.services.message.create).not.toHaveBeenCalled()

    expect(mockRunHeadless).toHaveBeenCalledWith(
      mockReq,
      expect.objectContaining({
        threadId: undefined,
        resolvedConfig: expect.objectContaining({ orgId: `org-1` }),
      })
    )
  })

  it(`should return error if message creation fails during seeding`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = {
      messages: [
        { role: `user`, content: `First` },
        { role: `user`, content: `Second` },
      ],
    }
    mockExtractPrompt.mockReturnValue(`Second`)
    mockConvertOAIMessages.mockReturnValue([
      { type: `user`, content: [{ type: `text`, text: `First` }] },
    ])
    const db = mockReq.app?.locals.db as any
    db.services.message.create.mockResolvedValue({ error: new Error(`DB write error`) })

    mockFormatOAIError.mockReturnValue({
      status: 500,
      body: {
        error: {
          message: `Failed to seed conversation message`,
          type: `server_error`,
          param: null,
          code: null,
        },
      },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFormatOAIError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Failed to seed conversation message`,
      })
    )
    expect(mockStatus).toHaveBeenCalledWith(500)
    expect(mockJson).toHaveBeenCalled()
    expect(mockRunHeadless).not.toHaveBeenCalled()
  })

  it(`should return error if thread creation fails during seeding`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = {
      messages: [
        { role: `user`, content: `First` },
        { role: `user`, content: `Second` },
      ],
    }
    mockExtractPrompt.mockReturnValue(`Second`)
    mockConvertOAIMessages.mockReturnValue([
      { type: `user`, content: [{ type: `text`, text: `First` }] },
    ])
    const db = mockReq.app?.locals.db as any
    db.services.thread.create.mockResolvedValue({
      data: null,
      error: new Error(`DB error`),
    })

    mockFormatOAIError.mockReturnValue({
      status: 500,
      body: {
        error: {
          message: `Failed to create thread for conversation seeding`,
          type: `server_error`,
          param: null,
          code: null,
        },
      },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFormatOAIError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Failed to create thread for conversation seeding`,
      })
    )
    expect(mockStatus).toHaveBeenCalledWith(500)
    expect(mockJson).toHaveBeenCalled()
    expect(mockRunHeadless).not.toHaveBeenCalled()
  })

  // ── 18-20. Thread reuse via threadId ─────────────────────────────

  it(`should reuse an existing thread supplied in the body and skip create/reseed`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    const priorMessages = [
      { role: `user`, content: `First message` },
      { role: `assistant`, content: `Response` },
    ]
    const currentMessage = { role: `user`, content: `Follow-up` }
    mockReq.body = {
      messages: [...priorMessages, currentMessage],
      threadId: `thread-existing`,
    }
    mockExtractPrompt.mockReturnValue(`Follow-up`)
    const db = mockReq.app?.locals.db as any

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(db.services.thread.get).toHaveBeenCalledWith(`thread-existing`)
    expect(db.services.thread.create).not.toHaveBeenCalled()
    expect(mockConvertOAIMessages).not.toHaveBeenCalled()
    expect(db.services.message.create).not.toHaveBeenCalled()

    expect(mockRunHeadless).toHaveBeenCalledWith(
      mockReq,
      expect.objectContaining({
        threadId: `thread-existing`,
        resolvedConfig: expect.objectContaining({ orgId: `org-1` }),
      })
    )
  })

  it(`should reuse an existing thread supplied via the X-Thread-Id header`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = { messages: [{ role: `user`, content: `Follow-up` }] }
    mockReq.headers = { 'x-thread-id': `thread-existing` }
    const db = mockReq.app?.locals.db as any

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(db.services.thread.get).toHaveBeenCalledWith(`thread-existing`)
    expect(db.services.thread.create).not.toHaveBeenCalled()

    expect(mockRunHeadless).toHaveBeenCalledWith(
      mockReq,
      expect.objectContaining({ threadId: `thread-existing` })
    )
  })

  it(`should return 400 when the supplied threadId does not belong to this agent`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = {
      messages: [{ role: `user`, content: `Follow-up` }],
      threadId: `thread-foreign`,
    }
    const db = mockReq.app?.locals.db as any
    db.services.thread.get.mockResolvedValue({
      data: { id: `thread-foreign`, orgId: `org-other`, agentId: `agent-other` },
    })
    mockFormatOAIError.mockReturnValue({
      status: 400,
      body: {
        error: {
          message: `Invalid threadId for this agent`,
          type: `invalid_request_error`,
          param: null,
          code: null,
        },
      },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFormatOAIError).toHaveBeenCalledWith(
      expect.objectContaining({ message: `Invalid threadId for this agent` })
    )
    expect(mockStatus).toHaveBeenCalledWith(400)
    expect(mockJson).toHaveBeenCalled()
    expect(db.services.thread.create).not.toHaveBeenCalled()
    expect(mockRunHeadless).not.toHaveBeenCalled()
  })

  it(`should return 400 when the supplied threadId belongs to a different user in the same org`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = {
      messages: [{ role: `user`, content: `Follow-up` }],
      threadId: `thread-other-user`,
    }
    const db = mockReq.app?.locals.db as any
    db.services.thread.get.mockResolvedValue({
      data: {
        id: `thread-other-user`,
        orgId: `org-1`,
        agentId: `agent-1`,
        userId: `other-user-id`,
      },
    })
    mockFormatOAIError.mockReturnValue({
      status: 400,
      body: {
        error: {
          message: `Invalid threadId for this agent`,
          type: `invalid_request_error`,
          param: null,
          code: null,
        },
      },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFormatOAIError).toHaveBeenCalledWith(
      expect.objectContaining({ message: `Invalid threadId for this agent` })
    )
    expect(mockStatus).toHaveBeenCalledWith(400)
    expect(mockJson).toHaveBeenCalled()
    expect(db.services.thread.create).not.toHaveBeenCalled()
    expect(mockRunHeadless).not.toHaveBeenCalled()
  })

  // ── Streaming abort tests ────────────────────────────────────────

  it(`should not finish when client disconnects during streaming`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = { messages: [{ role: `user`, content: `Hello` }], stream: true }

    let capturedCloseHandler: (() => void) | undefined
    mockOn.mockImplementation((event: string, handler: () => void) => {
      if (event === `close`) capturedCloseHandler = handler
    })

    mockRunHeadless.mockImplementation(async () => {
      capturedCloseHandler?.()
      return { threadId: `thread-1` }
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFinish).not.toHaveBeenCalled()
  })

  it(`should not write error when client disconnects during streaming error`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    mockReq.body = { messages: [{ role: `user`, content: `Hello` }], stream: true }

    let capturedCloseHandler: (() => void) | undefined
    mockOn.mockImplementation((event: string, handler: () => void) => {
      if (event === `close`) capturedCloseHandler = handler
    })

    mockRunHeadless.mockImplementation(async () => {
      capturedCloseHandler?.()
      throw new Error(`LLM crashed`)
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockWrite).not.toHaveBeenCalledWith(expect.stringContaining(`LLM crashed`))
    expect(mockFinish).not.toHaveBeenCalled()
  })

  // ── resolveAgentConfig error → OAI format ────────────────────────

  it(`should return OAI-formatted error when resolveAgentConfig fails`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    const { Exception } = await import(`@tdsk/domain`)
    const configError = new Exception(404, `Agent not found`)
    mockResolveAgentConfig.mockRejectedValueOnce(configError)

    mockFormatOAIError.mockReturnValue({
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

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFormatOAIError).toHaveBeenCalledWith(configError)
    expect(mockStatus).toHaveBeenCalledWith(404)
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        message: `Agent not found`,
        type: `invalid_request_error`,
        param: null,
        code: null,
      },
    })
    expect(mockRunHeadless).not.toHaveBeenCalled()
  })

  it(`should return OAI-formatted 403 when requireAgentAccess denies`, async () => {
    const ep = getEndpointCfg(oaiChatCompletions as any)
    const accessError = { status: 403, message: `Access denied: not a project member` }
    mockRequireAgentAccess.mockRejectedValueOnce(accessError)

    mockFormatOAIError.mockReturnValueOnce({
      status: 403,
      body: {
        error: {
          message: `Access denied: not a project member`,
          type: `server_error`,
          param: null,
          code: null,
        },
      },
    })

    await ep.action(mockReq as TRequest, mockRes as Response)

    expect(mockFormatOAIError).toHaveBeenCalledWith(accessError)
    expect(mockStatus).toHaveBeenCalledWith(403)
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        message: `Access denied: not a project member`,
        type: `server_error`,
        param: null,
        code: null,
      },
    })
    expect(mockRunHeadless).not.toHaveBeenCalled()
  })
})
