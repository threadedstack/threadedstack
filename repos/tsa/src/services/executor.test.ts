import type { ApiClient } from '@TSA/services/api'

import WebSocket from 'ws'
import { EWSEventType } from '@tdsk/domain'
import { Executor } from '@TSA/services/executor'
import { AgentsEnabled } from '@TSA/constants/values'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock WebSocket
const mockInstances: any[] = []
vi.mock(`ws`, () => {
  const MockWS = vi.fn().mockImplementation(() => {
    const handlers: Record<string, Function[]> = {}
    const instance = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1,
      on: vi.fn((event: string, handler: Function) => {
        if (!handlers[event]) handlers[event] = []
        handlers[event].push(handler)
      }),
      _emit: (event: string, ...args: any[]) => {
        for (const h of handlers[event] || []) h(...args)
      },
    }
    mockInstances.push(instance)
    return instance
  })
  return { default: MockWS, __esModule: true }
})

const makeClient = () =>
  ({
    proxyUrl: `https://proxy.test`,
    createSession: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        maxTokens: 4096,
        provider: `anthropic`,
        sessionToken: `sess-abc`,
        systemPrompt: `You are helpful`,
        model: `claude-sonnet-4-20250514`,
        tools: [`shellExec`, `readFile`],
        environment: { timeout: 60000 },
      },
    }),
    createThread: vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, data: { id: `thread-new` } }),
    listMessages: vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] }),
    createMessage: vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, data: { id: `m1` } }),
    listOrgs: vi.fn(),
    getOrg: vi.fn(),
    listAgents: vi.fn(),
    getAgent: vi.fn(),
    listThreads: vi.fn(),
    getThread: vi.fn(),
  }) as unknown as ApiClient

describe.skipIf(!AgentsEnabled)(`Executor (WebSocket)`, () => {
  let executor: Executor
  let client: ReturnType<typeof makeClient>

  beforeEach(() => {
    vi.clearAllMocks()
    mockInstances.length = 0
    client = makeClient()
    executor = new Executor(client)
  })

  describe(`client`, () => {
    it(`should expose the api client`, () => {
      expect(executor.client).toBe(client)
    })
  })

  describe(`createSession`, () => {
    it(`should call client.createSession`, async () => {
      const session = await executor.createSession(`agent-1`)

      expect(client.createSession).toHaveBeenCalledWith(`agent-1`, undefined)
      expect(session.sessionToken).toBe(`sess-abc`)
      expect(session.provider).toBe(`anthropic`)
    })

    it(`should include tools and environment in session`, async () => {
      const session = await executor.createSession(`agent-1`)

      expect(session.tools).toEqual([`shellExec`, `readFile`])
      expect(session.environment).toEqual({ timeout: 60000 })
    })
  })

  describe(`run`, () => {
    it(`should create a session and connect WebSocket`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      // Wait for session creation
      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))

      const ws = mockInstances[0]
      expect(client.createSession).toHaveBeenCalledWith(`agent-1`, undefined)

      // Verify WS URL includes session token
      expect(WebSocket).toHaveBeenCalledWith(`wss://proxy.test/ai/ws?token=sess-abc`, {
        rejectUnauthorized: true,
      })

      // Simulate open → sends prompt
      ws._emit(`open`)
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: EWSEventType.Prompt,
          prompt: `Hello`,
          threadId: undefined,
          maxSteps: undefined,
        })
      )

      // Simulate Done → resolves directly
      ws._emit(`message`, JSON.stringify({ type: EWSEventType.Done, reason: `complete` }))
      const result = await runPromise
      expect(result.threadId).toBe(``)
    })

    it(`defaults to verified TLS (rejectUnauthorized: true) when insecure is not set`, async () => {
      const runPromise = executor.run({
        onEvent: vi.fn(),
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      expect(WebSocket).toHaveBeenCalledWith(`wss://proxy.test/ai/ws?token=sess-abc`, {
        rejectUnauthorized: true,
      })

      const ws = mockInstances[0]
      ws._emit(`open`)
      ws._emit(`close`)
      await runPromise
    })

    it(`skips TLS verification (rejectUnauthorized: false) only when insecure:true is explicitly passed`, async () => {
      const runPromise = executor.run({
        onEvent: vi.fn(),
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        insecure: true,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      expect(WebSocket).toHaveBeenCalledWith(`wss://proxy.test/ai/ws?token=sess-abc`, {
        rejectUnauthorized: false,
      })

      const ws = mockInstances[0]
      ws._emit(`open`)
      ws._emit(`close`)
      await runPromise
    })

    it(`should forward text delta events`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      const ws = mockInstances[0]
      ws._emit(`open`)

      // Simulate text delta message
      ws._emit(
        `message`,
        JSON.stringify({ type: EWSEventType.TextDelta, delta: `Hi there` })
      )

      expect(onEvent).toHaveBeenCalledWith({ type: `text`, text: `Hi there` })

      ws._emit(`close`)
      await runPromise
    })

    it(`should forward tool execution events`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      const ws = mockInstances[0]
      ws._emit(`open`)

      ws._emit(
        `message`,
        JSON.stringify({
          type: EWSEventType.ToolExecutionStart,
          toolCallId: `tc-1`,
          toolName: `readFile`,
          args: {},
        })
      )

      expect(onEvent).toHaveBeenCalledWith({
        type: `tool_call_start`,
        id: `tc-1`,
        name: `readFile`,
      })

      ws._emit(
        `message`,
        JSON.stringify({
          type: EWSEventType.ToolExecutionEnd,
          toolCallId: `tc-1`,
          result: `file contents`,
          isError: false,
        })
      )

      expect(onEvent).toHaveBeenCalledWith({
        type: `tool_result`,
        toolUseId: `tc-1`,
        content: `file contents`,
        isError: false,
      })

      ws._emit(`close`)
      await runPromise
    })

    it(`should capture threadId from ThreadCreated event`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      const ws = mockInstances[0]
      ws._emit(`open`)

      ws._emit(
        `message`,
        JSON.stringify({
          type: EWSEventType.ThreadCreated,
          threadId: `thread-new-123`,
        })
      )

      ws._emit(`close`)
      const result = await runPromise
      expect(result.threadId).toBe(`thread-new-123`)
    })

    it(`should use existing threadId when provided`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        threadId: `existing-thread`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      const ws = mockInstances[0]
      ws._emit(`open`)

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: EWSEventType.Prompt,
          prompt: `Hello`,
          threadId: `existing-thread`,
          maxSteps: undefined,
        })
      )

      ws._emit(`close`)
      const result = await runPromise
      expect(result.threadId).toBe(`existing-thread`)
    })

    it(`should prepend context files to prompt`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        contextFiles: [
          {
            path: `/test/AGENTS.md`,
            name: `AGENTS.md`,
            source: `auto`,
            content: `Be helpful`,
            sizeBytes: 10,
          },
        ],
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      const ws = mockInstances[0]
      ws._emit(`open`)

      const sentData = JSON.parse(ws.send.mock.calls[0][0])
      expect(sentData.prompt).toContain(`<context>`)
      expect(sentData.prompt).toContain(`Be helpful`)
      expect(sentData.prompt).toContain(`Hello`)

      ws._emit(`close`)
      await runPromise
    })

    it(`should reject on WebSocket error`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      const ws = mockInstances[0]

      ws._emit(`error`, new Error(`Connection refused`))

      await expect(runPromise).rejects.toThrow(`Connection refused`)
    })

    it(`should propagate errors from createSession`, async () => {
      ;(client.createSession as any).mockResolvedValue({
        ok: false,
        status: 500,
        error: { message: `Session creation failed` },
      })

      await expect(
        executor.run({
          orgId: `org-1`,
          prompt: `Hello`,
          userId: `user-1`,
          onEvent: vi.fn(),
          agentId: `bad-agent`,
        })
      ).rejects.toThrow(`Failed to create session: Session creation failed`)
    })

    it(`should forward error events`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      const ws = mockInstances[0]
      ws._emit(`open`)

      ws._emit(
        `message`,
        JSON.stringify({
          type: EWSEventType.Error,
          message: `Agent failed`,
        })
      )

      expect(onEvent).toHaveBeenCalledWith({ type: `error`, error: `Agent failed` })

      ws._emit(`close`)
      await runPromise
    })

    it(`passes providerId to session creation when specified`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        threadId: `t1`,
        providerId: `provider-123`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      expect(client.createSession).toHaveBeenCalledWith(`agent-1`, `provider-123`)

      const ws = mockInstances[0]
      ws._emit(`open`)
      ws._emit(`message`, JSON.stringify({ type: EWSEventType.Done, reason: `complete` }))
      await runPromise
    })

    it(`should resolve directly on Done event without waiting for close`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      const ws = mockInstances[0]
      ws._emit(`open`)

      ws._emit(
        `message`,
        JSON.stringify({
          type: EWSEventType.ThreadCreated,
          threadId: `thread-done-test`,
        })
      )

      // Emit Done — promise should resolve immediately
      ws._emit(`message`, JSON.stringify({ type: EWSEventType.Done, reason: `complete` }))
      const result = await runPromise

      expect(result.threadId).toBe(`thread-done-test`)
      expect(onEvent).toHaveBeenCalledWith({
        type: `done`,
        stopReason: `end_turn`,
      })
      // close event has NOT fired yet — resolution came from Done handler
    })

    it(`should not double-resolve when close fires after Done`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      const ws = mockInstances[0]
      ws._emit(`open`)

      // Emit Done first, then close — should not cause issues
      ws._emit(`message`, JSON.stringify({ type: EWSEventType.Done, reason: `complete` }))
      const result = await runPromise
      expect(result.threadId).toBe(``)

      // Close fires after Done — should be a no-op
      ws._emit(`close`, 1000)
    })

    it(`should still resolve via close when connection drops without Done`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        threadId: `existing-t`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      const ws = mockInstances[0]
      ws._emit(`open`)

      // Connection drops without Done — fallback to close handler
      ws._emit(`close`, 1000)
      const result = await runPromise
      expect(result.threadId).toBe(`existing-t`)
    })

    it(`should forward TurnEnd events with usage data`, async () => {
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      await vi.waitFor(() => expect(mockInstances).toHaveLength(1))
      const ws = mockInstances[0]
      ws._emit(`open`)

      ws._emit(
        `message`,
        JSON.stringify({
          type: EWSEventType.TurnEnd,
          usage: { input: 150, output: 42 },
        })
      )

      expect(onEvent).toHaveBeenCalledWith({
        type: `turn_end`,
        usage: { input: 150, output: 42 },
      })

      ws._emit(`message`, JSON.stringify({ type: EWSEventType.Done, reason: `complete` }))
      await runPromise
    })

    it(`should reject once idle for longer than the configured timeout`, async () => {
      vi.useFakeTimers()
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        idleTimeoutMs: 5000,
      })
      runPromise.catch(() => {})

      // Flush the createSession() microtask chain so the WebSocket is constructed
      await vi.advanceTimersByTimeAsync(0)
      expect(mockInstances).toHaveLength(1)
      const ws = mockInstances[0]

      ws._emit(`open`)

      // Never emit a message, Done, or close — advance past the idle window
      await vi.advanceTimersByTimeAsync(5100)

      await expect(runPromise).rejects.toThrow(`timed out`)
      expect(ws.close).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it(`should not time out while messages keep resetting the idle window`, async () => {
      vi.useFakeTimers()
      const onEvent = vi.fn()

      const runPromise = executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        idleTimeoutMs: 1000,
      })

      await vi.advanceTimersByTimeAsync(0)
      const ws = mockInstances[0]
      ws._emit(`open`)

      // Each message arrives just under the idle window and resets the
      // timer, so total elapsed time exceeds idleTimeoutMs without ever
      // tripping it — mirrors the server's periodic Ping heartbeat.
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(700)
        ws._emit(`message`, JSON.stringify({ type: EWSEventType.Ping }))
      }

      ws._emit(`message`, JSON.stringify({ type: EWSEventType.Done, reason: `complete` }))
      const result = await runPromise
      expect(result.threadId).toBe(``)

      vi.useRealTimers()
    })
  })

  describe(`abort`, () => {
    it(`should not throw when no active connection`, () => {
      expect(() => executor.abort()).not.toThrow()
    })
  })

  describe(`clearSession`, () => {
    it(`should clear cached session`, async () => {
      await executor.createSession(`agent-1`)
      executor.clearSession()

      // Creating session again should call the API
      await executor.createSession(`agent-1`)
      expect(client.createSession).toHaveBeenCalledTimes(2)
    })
  })

  describe(`destroy`, () => {
    it(`should clear session and abort`, () => {
      executor.destroy()
      // After destroy, createSession should make a fresh API call
      expect(() => executor.abort()).not.toThrow()
    })
  })
})
