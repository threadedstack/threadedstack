import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@tdsk/agent`, () => ({
  AgentRunner: {
    run: vi.fn().mockResolvedValue(undefined),
  },
  ProxyAdapter: vi.fn().mockImplementation((opts: any) => ({
    provider: opts.provider,
    stream: vi.fn(),
  })),
}))

import { LocalAgentExecutor } from './executor'
import { AgentRunner, ProxyAdapter } from '@tdsk/agent'
import type { ApiClient } from '@TRL/api'

const makeClient = () =>
  ({
    proxyUrl: `https://proxy.test`,
    createSession: vi.fn().mockResolvedValue({
      sessionToken: `sess-abc`,
      provider: `anthropic`,
      model: `claude-sonnet-4-20250514`,
      maxTokens: 4096,
      systemPrompt: `You are helpful`,
    }),
    createThread: vi.fn().mockResolvedValue({ id: `thread-new` }),
    listMessages: vi.fn().mockResolvedValue([]),
    createMessage: vi.fn().mockResolvedValue({ id: `m1` }),
    listOrgs: vi.fn(),
    getOrg: vi.fn(),
    listAgents: vi.fn(),
    getAgent: vi.fn(),
    listThreads: vi.fn(),
    getThread: vi.fn(),
  }) as unknown as ApiClient

describe(`LocalAgentExecutor`, () => {
  let executor: LocalAgentExecutor
  let client: ReturnType<typeof makeClient>

  beforeEach(() => {
    vi.clearAllMocks()
    client = makeClient()
    executor = new LocalAgentExecutor(client)
  })

  describe(`client`, () => {
    it(`should expose the api client`, () => {
      expect(executor.client).toBe(client)
    })
  })

  describe(`createSession`, () => {
    it(`should call client.createSession`, async () => {
      const session = await executor.createSession(`agent-1`)

      expect(client.createSession).toHaveBeenCalledWith(`agent-1`)
      expect(session.sessionToken).toBe(`sess-abc`)
      expect(session.provider).toBe(`anthropic`)
    })
  })

  describe(`run`, () => {
    it(`should create a session and new thread when none provided`, async () => {
      const onEvent = vi.fn()

      const result = await executor.run({
        orgId: `org-1`,
        agentId: `agent-1`,
        prompt: `Hello`,
        userId: `user-1`,
        onEvent,
      })

      expect(client.createSession).toHaveBeenCalledWith(`agent-1`)
      expect(client.createThread).toHaveBeenCalledWith(`org-1`, `agent-1`)
      expect(result.threadId).toBe(`thread-new`)
    })

    it(`should reuse existing thread when provided`, async () => {
      const onEvent = vi.fn()

      const result = await executor.run({
        orgId: `org-1`,
        agentId: `agent-1`,
        prompt: `Hello`,
        userId: `user-1`,
        threadId: `existing-thread`,
        onEvent,
      })

      expect(client.createThread).not.toHaveBeenCalled()
      expect(result.threadId).toBe(`existing-thread`)
    })

    it(`should create a ProxyAdapter with session token`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        orgId: `org-1`,
        agentId: `agent-1`,
        prompt: `Hello`,
        userId: `user-1`,
        threadId: `t1`,
        onEvent,
      })

      expect(ProxyAdapter).toHaveBeenCalledWith({
        backendUrl: `https://proxy.test`,
        sessionToken: `sess-abc`,
        provider: `anthropic`,
      })
    })

    it(`should call AgentRunner.run with adapter and llmConfig (no apiKey)`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        orgId: `org-1`,
        agentId: `agent-1`,
        prompt: `Hello`,
        userId: `user-1`,
        threadId: `t1`,
        onEvent,
      })

      expect(AgentRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: `agent-1`,
          threadId: `t1`,
          prompt: `Hello`,
          userId: `user-1`,
          orgId: `org-1`,
          adapter: expect.objectContaining({
            provider: `anthropic`,
          }),
          llmConfig: expect.objectContaining({
            provider: `anthropic`,
            model: `claude-sonnet-4-20250514`,
            maxTokens: 4096,
            systemPrompt: `You are helpful`,
          }),
          maxSteps: 10,
          onEvent,
        })
      )

      // Verify no apiKey in llmConfig
      const call = (AgentRunner.run as any).mock.calls[0][0]
      expect(call.llmConfig.apiKey).toBeUndefined()
    })

    it(`should pass an HttpMessageAdapter as db`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        orgId: `org-1`,
        agentId: `agent-1`,
        prompt: `Hello`,
        userId: `user-1`,
        threadId: `t1`,
        onEvent,
      })

      const call = (AgentRunner.run as any).mock.calls[0][0]
      expect(call.db).toBeDefined()
      expect(typeof call.db.listMessages).toBe(`function`)
      expect(typeof call.db.createMessage).toBe(`function`)
    })

    it(`should propagate errors from createSession`, async () => {
      ;(client.createSession as any).mockRejectedValue(
        new Error(`Session creation failed`)
      )

      await expect(
        executor.run({
          orgId: `org-1`,
          agentId: `bad-agent`,
          prompt: `Hello`,
          userId: `user-1`,
          onEvent: vi.fn(),
        })
      ).rejects.toThrow(`Session creation failed`)
    })

    it(`should propagate errors from createThread`, async () => {
      ;(client.createThread as any).mockRejectedValue(new Error(`Thread creation failed`))

      await expect(
        executor.run({
          orgId: `org-1`,
          agentId: `agent-1`,
          prompt: `Hello`,
          userId: `user-1`,
          onEvent: vi.fn(),
        })
      ).rejects.toThrow(`Thread creation failed`)
    })
  })
})
