import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { IncomingMessage } from 'http'
import type WebSocket from 'ws'

import { onWSConnect } from './onWSConnect'
import { EWSEventType } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@tdsk/agent`, () => ({
  AgentRunner: { run: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock(`@tdsk/sandbox`, () => ({
  createSandboxProvider: vi.fn(),
}))

const mockResolveApiKey = vi.fn().mockResolvedValue(`sk-test`)
const mockResolveHeaders = vi.fn().mockResolvedValue({})
const mockResolveBodyParams = vi.fn().mockResolvedValue({})

vi.mock(`@TBE/services/secrets/secretResolver`, () => ({
  SecretResolver: vi.fn().mockImplementation(() => ({
    resolveApiKey: mockResolveApiKey,
    resolveHeaders: mockResolveHeaders,
    resolveBodyParams: mockResolveBodyParams,
  })),
}))

const mockVerify = vi.fn()

vi.mock(`@TBE/services/sessionToken`, () => ({
  verifySessionToken: (...args: any[]) => mockVerify(...args),
}))

const createMockWS = () => {
  const sent: string[] = []
  return {
    send: vi.fn((data: string) => sent.push(data)),
    close: vi.fn(),
    on: vi.fn(),
    readyState: 1, // WebSocket.OPEN
    _sent: sent,
  } as unknown as WebSocket & { _sent: string[] }
}

const createMockReq = (token: string) =>
  ({
    url: `/ai/ws?token=${token}`,
  }) as IncomingMessage

const buildMockApp = (agentOverrides: Record<string, any> = {}) =>
  ({
    locals: {
      config: { server: { port: 5885 } },
      db: {
        services: {
          agent: {
            get: vi.fn().mockResolvedValue({
              data: {
                id: `agent-1`,
                orgId: `org-1`,
                name: `Test Agent`,
                model: `test-model`,
                systemPrompt: `You are helpful.`,
                maxTokens: 4096,
                tools: [`shellExec`],
                envVars: {},
                environment: {},
                primaryProvider: {
                  id: `prov-1`,
                  secretId: `secret-1`,
                  type: `ai`,
                  orgId: `org-1`,
                  name: `anthropic`,
                  brand: `anthropic`,
                  options: {},
                },
                resolveModel: vi.fn().mockReturnValue(`test-model`),
                ...agentOverrides,
              },
            }),
          },
          thread: { create: vi.fn() },
          message: {
            list: vi.fn().mockResolvedValue({ data: [] }),
            create: vi.fn().mockResolvedValue({ data: { id: `m1` } }),
          },
          function: { get: vi.fn() },
          skill: { listForAgent: vi.fn().mockResolvedValue({ data: [] }) },
          secret: { get: vi.fn(), list: vi.fn().mockResolvedValue({ data: [] }) },
          role: {
            getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
          },
          provider: {
            resolveLLMBrand: vi.fn().mockReturnValue(`anthropic`),
          },
        },
      },
    },
  }) as any

const validPayload = { userId: `user-1`, agentId: `agent-1`, orgId: `org-1` }

describe(`onWSConnect`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerify.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it(`should close connection with 4001 for missing token`, async () => {
    const ws = createMockWS()
    const req = { url: `/ai/ws` } as IncomingMessage

    await onWSConnect(ws, req, buildMockApp())

    expect(ws.close).toHaveBeenCalledWith(4001, expect.stringContaining(`token`))
  })

  it(`should close connection with 4001 for invalid token`, async () => {
    const ws = createMockWS()
    const req = createMockReq(`invalid-token`)
    mockVerify.mockReturnValue(null)

    await onWSConnect(ws, req, buildMockApp())

    expect(ws.close).toHaveBeenCalledWith(4001, expect.stringContaining(`Invalid`))
  })

  it(`should accept connection with valid session token`, async () => {
    mockVerify.mockReturnValue(validPayload)

    const ws = createMockWS()
    const req = createMockReq(`valid.jwt.token`)

    await onWSConnect(ws, req, buildMockApp())

    expect(ws.close).not.toHaveBeenCalled()
    expect(ws.on).toHaveBeenCalledWith(`message`, expect.any(Function))
    expect(ws.on).toHaveBeenCalledWith(`close`, expect.any(Function))
  })

  it(`should close connection when agent resolution fails`, async () => {
    mockVerify.mockReturnValue(validPayload)

    const app = buildMockApp()
    app.locals.db.services.agent.get.mockResolvedValue({ data: null })

    const ws = createMockWS()
    const req = createMockReq(`valid.jwt.token`)

    await onWSConnect(ws, req, app)

    expect(ws.close).toHaveBeenCalledWith(
      4001,
      expect.stringContaining(`Agent not found`)
    )
  })

  it(`should close connection when agent has no provider`, async () => {
    mockVerify.mockReturnValue(validPayload)

    const app = buildMockApp({ primaryProvider: null })

    const ws = createMockWS()
    const req = createMockReq(`valid.jwt.token`)

    await onWSConnect(ws, req, app)

    expect(ws.close).toHaveBeenCalledWith(4001, expect.stringContaining(`no provider`))
  })

  it(`should close connection when API key resolution fails`, async () => {
    mockVerify.mockReturnValue(validPayload)
    mockResolveApiKey.mockResolvedValueOnce(``)

    const ws = createMockWS()
    const req = createMockReq(`valid.jwt.token`)

    await onWSConnect(ws, req, buildMockApp())

    expect(ws.close).toHaveBeenCalledWith(4001, expect.stringContaining(`No API key`))
  })

  it(`should send error for unknown message type`, async () => {
    mockVerify.mockReturnValue(validPayload)

    const ws = createMockWS()
    const req = createMockReq(`valid.jwt.token`)

    await onWSConnect(ws, req, buildMockApp())

    // Get the message handler
    const messageHandler = (ws.on as any).mock.calls.find(
      (c: any[]) => c[0] === `message`
    )[1]

    // Send unknown message (handler is async — await to let it process)
    await messageHandler(JSON.stringify({ type: `unknown_type` }))

    const lastSent = JSON.parse(ws._sent[ws._sent.length - 1])
    expect(lastSent.type).toBe(EWSEventType.Error)
  })

  it(`should send error for invalid JSON`, async () => {
    mockVerify.mockReturnValue(validPayload)

    const ws = createMockWS()
    const req = createMockReq(`valid.jwt.token`)

    await onWSConnect(ws, req, buildMockApp())

    const messageHandler = (ws.on as any).mock.calls.find(
      (c: any[]) => c[0] === `message`
    )[1]

    await messageHandler(`not-json`)

    const lastSent = JSON.parse(ws._sent[ws._sent.length - 1])
    expect(lastSent.type).toBe(EWSEventType.Error)
    expect(lastSent.message).toContain(`Invalid`)
  })
})
