import { describe, it, expect, vi, beforeEach } from 'vitest'
import type WebSocket from 'ws'
import type { TStreamEvent } from '@tdsk/domain'

import { Websocket } from './websocket'
import { EWSEventType, EStreamEventType } from '@tdsk/domain'

// ── Mocks ──

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const mockRunnerInit = vi.fn().mockResolvedValue(undefined)
const mockRunnerDestroy = vi.fn().mockResolvedValue(undefined)
const mockRunnerUpdateConfig = vi.fn()
const mockWaitForIdle = vi.fn().mockResolvedValue(undefined)
const mockSteer = vi.fn()
const mockFollowUp = vi.fn()
const mockRunTurn = vi.fn().mockResolvedValue({
  waitForIdle: mockWaitForIdle,
  steer: mockSteer,
  followUp: mockFollowUp,
})

vi.mock(`@tdsk/agent`, () => ({
  AgentRunner: vi.fn().mockImplementation(() => ({
    init: mockRunnerInit,
    destroy: mockRunnerDestroy,
    threadId: `thread-1`,
    initialized: true,
    updateConfig: mockRunnerUpdateConfig,
    runTurn: mockRunTurn,
  })),
}))

vi.mock(`@TBE/services/functions/functionExecutor`, () => ({
  FunctionExecutor: { execute: vi.fn() },
}))

const mockExtractText = vi.fn().mockResolvedValue({ text: `extracted content` })
const mockIsImageMimeType = vi.fn().mockReturnValue(false)

vi.mock(`@TBE/services/files/fileExtractor`, () => ({
  extractText: (...args: any[]) => mockExtractText(...args),
  isImageMimeType: (...args: any[]) => mockIsImageMimeType(...args),
}))

// ── Helpers ──

/**
 * Create a deferred promise whose resolution we control from outside.
 */
const createDeferred = () => {
  let resolve!: () => void
  let reject!: (err: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const createMockWS = (readyState = 1) => {
  const sent: string[] = []
  return {
    send: vi.fn((data: string) => sent.push(data)),
    close: vi.fn(),
    readyState,
    OPEN: 1,
    _sent: sent,
  } as unknown as WebSocket & { _sent: string[] }
}

const createMockApp = () =>
  ({
    locals: {
      config: { server: { port: 5885 } },
      db: {
        services: {
          thread: {
            create: vi.fn().mockResolvedValue({ data: { id: `thread-1` }, error: null }),
          },
          message: {
            list: vi.fn().mockResolvedValue({ data: [] }),
            listByThread: vi.fn().mockResolvedValue({ data: [] }),
            create: vi.fn().mockResolvedValue({ data: { id: `msg-1` } }),
          },
          asset: {
            create: vi.fn().mockResolvedValue({ data: { id: `asset-1` }, error: null }),
          },
          skill: {
            listForAgent: vi.fn().mockResolvedValue({ data: [] }),
          },
        },
      },
    },
  }) as any

const createSession = (overrides: Record<string, any> = {}) => ({
  orgId: `org-1`,
  userId: `user-1`,
  agentId: `agent-1`,
  tools: [`shellExec`],
  llmConfig: {
    provider: `anthropic`,
    model: `claude-sonnet-4-20250514`,
    apiKey: `sk-test`,
  },
  environment: {},
  envVars: {},
  customFunctions: [],
  ...overrides,
})

const parseSent = (ws: WebSocket & { _sent: string[] }, index = 0) =>
  JSON.parse(ws._sent[index])

const parseLastSent = (ws: WebSocket & { _sent: string[] }) =>
  JSON.parse(ws._sent[ws._sent.length - 1])

/**
 * Flush pending microtasks so that async code up to the next real await resolves.
 */
const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 50))

// ── Tests ──

describe(`Websocket`, () => {
  let ws: WebSocket & { _sent: string[] }
  let socket: Websocket

  beforeEach(() => {
    vi.clearAllMocks()
    ws = createMockWS()
    socket = new Websocket({ app: createMockApp(), ws })

    // Reset default mock behavior
    mockWaitForIdle.mockResolvedValue(undefined)
    mockRunTurn.mockResolvedValue({
      waitForIdle: mockWaitForIdle,
      steer: mockSteer,
      followUp: mockFollowUp,
    })
  })

  // ── bridgeEventToWS ──

  describe(`bridgeEventToWS`, () => {
    it(`should bridge text events to TextDelta`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.text,
        text: `Hello world`,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.TextDelta)
      expect(msg.delta).toBe(`Hello world`)
    })

    it(`should bridge toolCallStart events to ToolExecutionStart`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.toolCallStart,
        id: `call-1`,
        name: `shellExec`,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.ToolExecutionStart)
      expect(msg.toolCallId).toBe(`call-1`)
      expect(msg.toolName).toBe(`shellExec`)
      expect(msg.args).toEqual({})
    })

    it(`should bridge toolResult events to ToolExecutionEnd`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.toolResult,
        toolUseId: `call-1`,
        content: `command output`,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.ToolExecutionEnd)
      expect(msg.toolCallId).toBe(`call-1`)
      expect(msg.result).toBe(`command output`)
      expect(msg.isError).toBe(false)
    })

    it(`should bridge error toolResult with isError=true`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.toolResult,
        toolUseId: `call-1`,
        content: `something failed`,
        isError: true,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.ToolExecutionEnd)
      expect(msg.isError).toBe(true)
    })

    it(`should emit Artifact when toolResult contains valid artifact JSON`, () => {
      const artifactPayload = JSON.stringify({
        artifactType: `html`,
        content: `<h1>Hello</h1>`,
        title: `My Page`,
        language: `html`,
      })

      const event: TStreamEvent = {
        type: EStreamEventType.toolResult,
        toolUseId: `call-1`,
        content: artifactPayload,
      }

      socket.bridgeEventToWS(event)

      // Should send ToolExecutionEnd + Artifact
      expect(ws._sent).toHaveLength(2)

      const toolEnd = parseSent(ws, 0)
      expect(toolEnd.type).toBe(EWSEventType.ToolExecutionEnd)
      expect(toolEnd.result).toBe(artifactPayload)

      const artifact = parseSent(ws, 1)
      expect(artifact.type).toBe(EWSEventType.Artifact)
      expect(artifact.artifactType).toBe(`html`)
      expect(artifact.content).toBe(`<h1>Hello</h1>`)
      expect(artifact.title).toBe(`My Page`)
      expect(artifact.language).toBe(`html`)
    })

    it(`should emit Artifact without optional title/language`, () => {
      const artifactPayload = JSON.stringify({
        artifactType: `markdown`,
        content: `# Heading`,
      })

      const event: TStreamEvent = {
        type: EStreamEventType.toolResult,
        toolUseId: `call-2`,
        content: artifactPayload,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(2)
      const artifact = parseSent(ws, 1)
      expect(artifact.type).toBe(EWSEventType.Artifact)
      expect(artifact.artifactType).toBe(`markdown`)
      expect(artifact.content).toBe(`# Heading`)
      expect(artifact.title).toBeUndefined()
      expect(artifact.language).toBeUndefined()
    })

    it(`should NOT emit Artifact when toolResult content is not JSON`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.toolResult,
        toolUseId: `call-1`,
        content: `just plain text`,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.ToolExecutionEnd)
    })

    it(`should NOT emit Artifact when toolResult JSON lacks artifactType`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.toolResult,
        toolUseId: `call-1`,
        content: JSON.stringify({ content: `<h1>No type</h1>` }),
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      expect(parseSent(ws).type).toBe(EWSEventType.ToolExecutionEnd)
    })

    it(`should NOT emit Artifact when toolResult JSON lacks content`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.toolResult,
        toolUseId: `call-1`,
        content: JSON.stringify({ artifactType: `html` }),
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      expect(parseSent(ws).type).toBe(EWSEventType.ToolExecutionEnd)
    })

    it(`should NOT emit Artifact when toolResult isError is true`, () => {
      const artifactPayload = JSON.stringify({
        artifactType: `html`,
        content: `<h1>Hello</h1>`,
      })

      const event: TStreamEvent = {
        type: EStreamEventType.toolResult,
        toolUseId: `call-1`,
        content: artifactPayload,
        isError: true,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.ToolExecutionEnd)
      expect(msg.isError).toBe(true)
    })

    it(`should bridge toolExecutionUpdate events`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.toolExecutionUpdate,
        toolUseId: `call-1`,
        content: `progress update`,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.ToolExecutionUpdate)
      expect(msg.toolCallId).toBe(`call-1`)
      expect(msg.result).toBe(`progress update`)
      expect(msg.isError).toBe(false)
    })

    it(`should bridge thinking events to ThinkingDelta`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.thinking,
        thinking: `Let me consider...`,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.ThinkingDelta)
      expect(msg.delta).toBe(`Let me consider...`)
    })

    it(`should bridge error events to Error`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.error,
        error: `Something went wrong`,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toBe(`Something went wrong`)
    })

    it(`should bridge turnEnd events with usage`, () => {
      const usage = {
        input: 100,
        output: 50,
        cacheRead: 10,
        cacheWrite: 5,
        cost: {
          input: 0.001,
          output: 0.002,
          cacheRead: 0.0001,
          cacheWrite: 0.0002,
          total: 0.0033,
        },
      }

      const event: TStreamEvent = {
        type: EStreamEventType.turnEnd,
        usage,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.TurnEnd)
      expect(msg.usage).toEqual(usage)
    })

    it(`should not send anything for toolCallArgs events`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.toolCallArgs,
        id: `call-1`,
        args: `{"path": "/tmp"}`,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(0)
    })

    it(`should not send anything for done events`, () => {
      const event: TStreamEvent = {
        type: EStreamEventType.done,
        stopReason: `end_turn`,
      }

      socket.bridgeEventToWS(event)

      expect(ws._sent).toHaveLength(0)
    })
  })

  // ── send ──

  describe(`send`, () => {
    it(`should serialize and send message when socket is open`, () => {
      socket.send({ type: EWSEventType.TextDelta, delta: `test` })

      expect(ws.send).toHaveBeenCalledTimes(1)
      const sent = parseSent(ws)
      expect(sent.type).toBe(EWSEventType.TextDelta)
      expect(sent.delta).toBe(`test`)
    })

    it(`should drop message and abort when socket is not open`, () => {
      const closedWS = createMockWS(3) // CLOSED
      const closedSocket = new Websocket({ app: createMockApp(), ws: closedWS })

      const ac = new AbortController()
      closedSocket.abortController = ac

      closedSocket.send({ type: EWSEventType.TextDelta, delta: `test` })

      // Should not have called ws.send
      expect(closedWS.send).not.toHaveBeenCalled()
      // Should have aborted the controller
      expect(ac.signal.aborted).toBe(true)
    })

    it(`should not throw when socket is undefined after close`, async () => {
      await socket.close()

      // After close, #ws is undefined so send should be a no-op
      expect(() =>
        socket.send({ type: EWSEventType.TextDelta, delta: `test` })
      ).not.toThrow()
    })
  })

  // ── handlePrompt ──

  describe(`handlePrompt`, () => {
    const session = createSession()
    const db = createMockApp().locals.db

    it(`should send error when prompt is missing`, async () => {
      await socket.handlePrompt({ prompt: `` } as any, session as any, db)

      expect(ws._sent).toHaveLength(2)
      expect(parseSent(ws, 0).type).toBe(EWSEventType.Error)
      expect(parseSent(ws, 0).message).toBe(`prompt is required`)
      expect(parseSent(ws, 1).type).toBe(EWSEventType.Done)
      expect(parseSent(ws, 1).reason).toBe(`error`)
    })

    it(`should create thread when threadId is not provided`, async () => {
      await socket.handlePrompt({ prompt: `Hello agent` }, session as any, db)

      expect(db.services.thread.create).toHaveBeenCalledWith({
        orgId: `org-1`,
        userId: `user-1`,
        agentId: `agent-1`,
        name: `Hello agent`,
      })

      // Should have sent ThreadCreated
      const threadCreatedMsg = ws._sent
        .map((s) => JSON.parse(s))
        .find((m) => m.type === EWSEventType.ThreadCreated)
      expect(threadCreatedMsg).toBeDefined()
      expect(threadCreatedMsg.threadId).toBe(`thread-1`)
    })

    it(`should send Done with reason complete on success`, async () => {
      await socket.handlePrompt(
        { prompt: `Hello`, threadId: `thread-1` },
        session as any,
        db
      )

      const doneMsg = parseLastSent(ws)
      expect(doneMsg.type).toBe(EWSEventType.Done)
      expect(doneMsg.reason).toBe(`complete`)
    })

    it(`should send error when thread creation fails`, async () => {
      const failDb = {
        services: {
          ...db.services,
          thread: {
            create: vi.fn().mockResolvedValue({ data: null, error: `db error` }),
          },
        },
      }

      await socket.handlePrompt({ prompt: `Hello` }, session as any, failDb)

      const errorMsg = parseSent(ws, 0)
      expect(errorMsg.type).toBe(EWSEventType.Error)
      expect(errorMsg.message).toBe(`Failed to create thread`)

      const doneMsg = parseSent(ws, 1)
      expect(doneMsg.type).toBe(EWSEventType.Done)
      expect(doneMsg.reason).toBe(`error`)
    })

    it(`should send error when a run is already in progress`, async () => {
      // Use a deferred promise to block waitForIdle until we say so
      const deferred = createDeferred()
      mockWaitForIdle.mockReturnValueOnce(deferred.promise)

      // Start first prompt — will block at waitForIdle
      const firstPrompt = socket.handlePrompt(
        { prompt: `First`, threadId: `thread-1` },
        session as any,
        db
      )

      // Flush microtasks so first prompt reaches waitForIdle (abortController is now set)
      await flushMicrotasks()

      // Send second prompt while first is blocked
      await socket.handlePrompt(
        { prompt: `Second`, threadId: `thread-1` },
        session as any,
        db
      )

      const msgs = ws._sent.map((s) => JSON.parse(s))
      const errorMsg = msgs.find(
        (m) => m.type === EWSEventType.Error && m.message.includes(`already running`)
      )
      expect(errorMsg).toBeDefined()

      // Unblock the first prompt so it completes
      deferred.resolve()
      await firstPrompt
    })

    it(`should pass files parameter to runTurn`, async () => {
      const files = [
        {
          assetId: `asset-1`,
          fileName: `doc.pdf`,
          extractedText: `Hello PDF`,
          mimeType: `application/pdf`,
        },
      ]

      await socket.handlePrompt(
        { prompt: `Analyze this`, threadId: `thread-1`, files },
        session as any,
        db
      )

      expect(mockRunTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: `Analyze this`,
          files,
          signal: expect.any(AbortSignal),
        })
      )
    })

    it(`should pass images parameter to runTurn`, async () => {
      const images = [{ data: `base64data`, mimeType: `image/png` }]

      await socket.handlePrompt(
        { prompt: `What is this`, threadId: `thread-1`, images },
        session as any,
        db
      )

      expect(mockRunTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: `What is this`,
          images,
          signal: expect.any(AbortSignal),
        })
      )
    })

    it(`should clear abortController after completion`, async () => {
      await socket.handlePrompt(
        { prompt: `Hello`, threadId: `thread-1` },
        session as any,
        db
      )

      expect(socket.abortController).toBeNull()
    })

    it(`should send error when runTurn throws`, async () => {
      mockRunTurn.mockRejectedValueOnce(new Error(`LLM request failed`))

      await socket.handlePrompt(
        { prompt: `Hello`, threadId: `thread-1` },
        session as any,
        db
      )

      const msgs = ws._sent.map((s) => JSON.parse(s))
      const errorMsg = msgs.find((m) => m.type === EWSEventType.Error)
      expect(errorMsg).toBeDefined()
      expect(errorMsg.message).toBe(`LLM request failed`)

      const doneMsg = msgs.find((m) => m.type === EWSEventType.Done)
      expect(doneMsg).toBeDefined()
      expect(doneMsg.reason).toBe(`error`)
    })

    it(`should send Done:cancelled when aborted mid-run`, async () => {
      const deferred = createDeferred()
      mockWaitForIdle.mockReturnValueOnce(deferred.promise)

      const promptPromise = socket.handlePrompt(
        { prompt: `Hello`, threadId: `thread-1` },
        session as any,
        db
      )

      await flushMicrotasks()
      await socket.close()
      deferred.reject(new Error(`aborted`))
      await promptPromise

      const msgs = ws._sent.map((s) => JSON.parse(s))
      const doneMsg = msgs.find((m) => m.type === EWSEventType.Done)
      expect(doneMsg).toBeDefined()
      expect(doneMsg.reason).toBe(`cancelled`)
      const errorMsg = msgs.find((m) => m.type === EWSEventType.Error)
      expect(errorMsg).toBeUndefined()
    })

    it(`should send Done:cancelled when closed during runner init`, async () => {
      const deferred = createDeferred()
      mockRunnerInit.mockReturnValueOnce(deferred.promise)

      const promptPromise = socket.handlePrompt(
        { prompt: `Hello`, threadId: `thread-1` },
        session as any,
        db
      )

      await flushMicrotasks()
      await socket.close()
      deferred.resolve()
      await promptPromise

      const msgs = ws._sent.map((s) => JSON.parse(s))
      const doneMsg = msgs.find((m) => m.type === EWSEventType.Done)
      expect(doneMsg).toBeDefined()
      expect(doneMsg.reason).toBe(`cancelled`)
    })
  })

  // ── handleSteer ──

  describe(`handleSteer`, () => {
    it(`should send error when no agent is running`, () => {
      socket.handleSteer(`new direction`)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toBe(`No agent running to steer`)
    })

    it(`should call steer on the active handle`, async () => {
      const session = createSession()
      const db = createMockApp().locals.db

      // Use a deferred promise to keep handlePrompt blocked at waitForIdle
      const deferred = createDeferred()
      mockWaitForIdle.mockReturnValueOnce(deferred.promise)

      const promptPromise = socket.handlePrompt(
        { prompt: `Start`, threadId: `thread-1` },
        session as any,
        db
      )

      // Flush microtasks so the handle is set
      await flushMicrotasks()

      socket.handleSteer(`change course`)
      expect(mockSteer).toHaveBeenCalledWith(`change course`)

      // Unblock and cleanup
      deferred.resolve()
      await promptPromise
    })
  })

  // ── handleFollowUp ──

  describe(`handleFollowUp`, () => {
    it(`should send error when no agent is running`, () => {
      socket.handleFollowUp(`follow up message`)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toBe(`No agent running for follow-up`)
    })

    it(`should call followUp on the active handle`, async () => {
      const session = createSession()
      const db = createMockApp().locals.db

      const deferred = createDeferred()
      mockWaitForIdle.mockReturnValueOnce(deferred.promise)

      const promptPromise = socket.handlePrompt(
        { prompt: `Start`, threadId: `thread-1` },
        session as any,
        db
      )

      await flushMicrotasks()

      socket.handleFollowUp(`also do this`)
      expect(mockFollowUp).toHaveBeenCalledWith(`also do this`)

      deferred.resolve()
      await promptPromise
    })
  })

  // ── handleUpdateConfig ──

  describe(`handleUpdateConfig`, () => {
    it(`should send error when no runner is initialized`, () => {
      socket.handleUpdateConfig({ model: `gpt-4` } as any)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toBe(`No agent session to update`)
    })

    it(`should call updateConfig on the runner`, async () => {
      const session = createSession()
      const db = createMockApp().locals.db

      // Run a prompt to initialize the runner
      await socket.handlePrompt(
        { prompt: `Init`, threadId: `thread-1` },
        session as any,
        db
      )

      ws._sent.length = 0

      socket.handleUpdateConfig({ model: `gpt-4o` } as any)

      expect(mockRunnerUpdateConfig).toHaveBeenCalledWith({ model: `gpt-4o` })
      expect(ws._sent).toHaveLength(0) // No error sent
    })

    it(`should send error when updateConfig throws`, async () => {
      const session = createSession()
      const db = createMockApp().locals.db

      await socket.handlePrompt(
        { prompt: `Init`, threadId: `thread-1` },
        session as any,
        db
      )

      ws._sent.length = 0

      mockRunnerUpdateConfig.mockImplementationOnce(() => {
        throw new Error(`Invalid config`)
      })

      socket.handleUpdateConfig({ model: `bad-model` } as any)

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toBe(`Invalid config`)
    })
  })

  // ── handleFileUpload ──

  describe(`handleFileUpload`, () => {
    const session = createSession()
    const db = createMockApp().locals.db

    it(`should send error when requestId is missing`, async () => {
      await socket.handleFileUpload(
        { requestId: ``, path: `src/index.ts`, content: `hello` } as any,
        session as any,
        db
      )

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toContain(`requires requestId, path, and content`)
    })

    it(`should send error when path is missing`, async () => {
      await socket.handleFileUpload(
        { requestId: `r1`, path: ``, content: `hello` } as any,
        session as any,
        db
      )

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toContain(`requires requestId, path, and content`)
    })

    it(`should send error when content is not a string`, async () => {
      await socket.handleFileUpload(
        { requestId: `r1`, path: `src/index.ts`, content: 123 } as any,
        session as any,
        db
      )

      expect(ws._sent).toHaveLength(1)
      expect(parseSent(ws).type).toBe(EWSEventType.Error)
    })

    it(`should send error when content is undefined`, async () => {
      await socket.handleFileUpload(
        { requestId: `r1`, path: `src/index.ts`, content: undefined } as any,
        session as any,
        db
      )

      expect(ws._sent).toHaveLength(1)
      expect(parseSent(ws).type).toBe(EWSEventType.Error)
    })

    it(`should reject path traversal with ".." segments`, async () => {
      await socket.handleFileUpload(
        { requestId: `r1`, path: `../../etc/passwd`, content: `data` },
        session as any,
        db
      )

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toContain(`Invalid file path`)
    })

    it(`should reject absolute paths`, async () => {
      await socket.handleFileUpload(
        { requestId: `r1`, path: `/etc/passwd`, content: `data` },
        session as any,
        db
      )

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toContain(`Invalid file path`)
    })

    it(`should send error for disallowed MIME type`, async () => {
      await socket.handleFileUpload(
        { requestId: `r1`, path: `binary.exe`, content: `data` },
        session as any,
        db
      )

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toContain(`Unsupported file type`)
    })

    it(`should send error when file exceeds max size`, async () => {
      const { FileMaxSize } = await import(`@TBE/constants/values`)
      const oversized = `x`.repeat(FileMaxSize + 1)

      await socket.handleFileUpload(
        { requestId: `r1`, path: `big.ts`, content: oversized },
        session as any,
        db
      )

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toContain(`exceeds maximum size`)
    })

    it(`should send FileUploadComplete without assetId when no runner exists`, async () => {
      await socket.handleFileUpload(
        { requestId: `r1`, path: `src/app.ts`, content: `const x = 1` },
        session as any,
        db
      )

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.FileUploadComplete)
      expect(msg.requestId).toBe(`r1`)
      expect(msg.assetId).toBe(``)
      expect(msg.fileName).toBe(`src/app.ts`)
      expect(msg.fileType).toBe(`application/typescript`)
      expect(msg.fileSize).toBeGreaterThan(0)
    })

    it(`should store file in workspace map`, async () => {
      await socket.handleFileUpload(
        { requestId: `r1`, path: `src/app.ts`, content: `const x = 1` },
        session as any,
        db
      )

      expect(socket.getWorkspaceFile(`src/app.ts`)).toBe(`const x = 1`)
    })

    it(`should create asset and send FileUploadComplete when runner exists`, async () => {
      // Initialize runner by running a prompt
      await socket.handlePrompt(
        { prompt: `Init`, threadId: `thread-1` },
        session as any,
        db
      )

      ws._sent.length = 0

      await socket.handleFileUpload(
        { requestId: `r1`, path: `src/utils.ts`, content: `export const foo = 42` },
        session as any,
        db
      )

      expect(db.services.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `utils.ts`,
          type: `application/typescript`,
          threadId: `thread-1`,
          meta: expect.objectContaining({
            fileSize: expect.any(Number),
            extractedText: `extracted content`,
          }),
        })
      )

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.FileUploadComplete)
      expect(msg.requestId).toBe(`r1`)
      expect(msg.assetId).toBe(`asset-1`)
      expect(msg.fileName).toBe(`src/utils.ts`)
    })

    it(`should pass extraction error into asset metadata`, async () => {
      await socket.handlePrompt(
        { prompt: `Init`, threadId: `thread-1` },
        session as any,
        db
      )

      ws._sent.length = 0
      mockExtractText.mockResolvedValueOnce({ text: ``, error: `parse failed` })

      await socket.handleFileUpload(
        { requestId: `r1`, path: `src/broken.ts`, content: `bad content` },
        session as any,
        db
      )

      expect(db.services.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            extractedText: ``,
            extractionError: `parse failed`,
          }),
        })
      )
    })

    it(`should pass isImage=true for image MIME types`, async () => {
      await socket.handlePrompt(
        { prompt: `Init`, threadId: `thread-1` },
        session as any,
        db
      )

      ws._sent.length = 0
      mockIsImageMimeType.mockReturnValueOnce(true)

      await socket.handleFileUpload(
        { requestId: `r1`, path: `photo.png`, content: `base64data` },
        session as any,
        db
      )

      expect(db.services.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            isImage: true,
          }),
        })
      )
    })

    it(`should send error and not kill WS when extractText throws`, async () => {
      await socket.handlePrompt(
        { prompt: `Init`, threadId: `thread-1` },
        session as any,
        db
      )

      ws._sent.length = 0
      mockExtractText.mockRejectedValueOnce(new Error(`extraction crashed`))

      await socket.handleFileUpload(
        { requestId: `r1`, path: `src/crash.ts`, content: `data` },
        session as any,
        db
      )

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toContain(`File processing failed`)
      expect(msg.message).toContain(`extraction crashed`)
    })

    it(`should send error when asset creation fails`, async () => {
      await socket.handlePrompt(
        { prompt: `Init`, threadId: `thread-1` },
        session as any,
        db
      )

      ws._sent.length = 0

      const failDb = {
        services: {
          ...db.services,
          asset: {
            create: vi.fn().mockResolvedValue({ data: null, error: `db error` }),
          },
        },
      }

      await socket.handleFileUpload(
        { requestId: `r1`, path: `src/bad.ts`, content: `fail` },
        session as any,
        failDb
      )

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toContain(`Failed to store file`)
    })
  })

  // ── handleWorkspaceManifest ──

  describe(`handleWorkspaceManifest`, () => {
    it(`should store manifest on instance`, () => {
      socket.handleWorkspaceManifest({
        rootDir: `/project`,
        files: [
          { path: `src/index.ts`, hash: `abc123`, size: 100 },
          { path: `package.json`, hash: `def456`, size: 200 },
        ],
      })

      expect(ws._sent).toHaveLength(0)
      expect(socket.workspaceManifest).toBeDefined()
      expect(socket.workspaceManifest!.rootDir).toBe(`/project`)
      expect(socket.workspaceManifest!.files).toHaveLength(2)
    })

    it(`should handle empty files array`, () => {
      socket.handleWorkspaceManifest({
        rootDir: `/empty`,
        files: [],
      })

      expect(ws._sent).toHaveLength(0)
      expect(socket.workspaceManifest!.files).toHaveLength(0)
    })

    it(`should send error when rootDir is missing`, () => {
      socket.handleWorkspaceManifest({
        rootDir: ``,
        files: [],
      })

      expect(ws._sent).toHaveLength(1)
      const msg = parseSent(ws)
      expect(msg.type).toBe(EWSEventType.Error)
      expect(msg.message).toContain(`requires rootDir`)
    })

    it(`should send error when files is not an array`, () => {
      socket.handleWorkspaceManifest({
        rootDir: `/project`,
        files: null as any,
      })

      expect(ws._sent).toHaveLength(1)
      expect(parseSent(ws).type).toBe(EWSEventType.Error)
    })

    it(`should filter out invalid file entries`, () => {
      socket.handleWorkspaceManifest({
        rootDir: `/project`,
        files: [
          { path: `valid.ts`, hash: `abc`, size: 100 },
          null as any,
          { path: ``, hash: `bad`, size: 0 },
          { path: `also-valid.ts`, hash: `def`, size: 200 },
        ],
      })

      expect(ws._sent).toHaveLength(0)
      expect(socket.workspaceManifest!.files).toHaveLength(2)
      expect(socket.workspaceManifest!.files[0].path).toBe(`valid.ts`)
      expect(socket.workspaceManifest!.files[1].path).toBe(`also-valid.ts`)
    })

    it(`should overwrite previous manifest`, () => {
      socket.handleWorkspaceManifest({
        rootDir: `/first`,
        files: [{ path: `a.ts`, hash: `1`, size: 10 }],
      })

      socket.handleWorkspaceManifest({
        rootDir: `/second`,
        files: [{ path: `b.ts`, hash: `2`, size: 20 }],
      })

      expect(socket.workspaceManifest!.rootDir).toBe(`/second`)
      expect(socket.workspaceManifest!.files).toHaveLength(1)
      expect(socket.workspaceManifest!.files[0].path).toBe(`b.ts`)
    })
  })

  // ── close ──

  describe(`close`, () => {
    it(`should close the websocket`, async () => {
      await socket.close()

      expect(ws.close).toHaveBeenCalled()
    })

    it(`should destroy the runner if one exists`, async () => {
      const session = createSession()
      const db = createMockApp().locals.db

      // Initialize a runner
      await socket.handlePrompt(
        { prompt: `Init`, threadId: `thread-1` },
        session as any,
        db
      )

      await socket.close()

      expect(mockRunnerDestroy).toHaveBeenCalled()
    })

    it(`should clear workspace and manifest on close`, async () => {
      socket.handleWorkspaceManifest({
        rootDir: `/project`,
        files: [{ path: `a.ts`, hash: `1`, size: 10 }],
      })

      await socket.handleFileUpload(
        { requestId: `r1`, path: `src/app.ts`, content: `const x = 1` },
        createSession() as any,
        createMockApp().locals.db
      )

      expect(socket.getWorkspaceFile(`src/app.ts`)).toBe(`const x = 1`)
      expect(socket.workspaceManifest).toBeDefined()

      await socket.close()

      expect(socket.getWorkspaceFile(`src/app.ts`)).toBeUndefined()
      expect(socket.workspaceManifest).toBeNull()
    })

    it(`should handle runner destroy errors gracefully`, async () => {
      const session = createSession()
      const db = createMockApp().locals.db

      await socket.handlePrompt(
        { prompt: `Init`, threadId: `thread-1` },
        session as any,
        db
      )

      mockRunnerDestroy.mockRejectedValueOnce(new Error(`destroy failed`))

      // Should not throw
      await expect(socket.close()).resolves.not.toThrow()
    })
  })
})
