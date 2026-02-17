import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@tdsk/agent`, () => ({
  PiAgentRunner: {
    run: vi.fn().mockResolvedValue(undefined),
  },
}))

import { LocalAgentExecutor } from './executor'
import { PiAgentRunner } from '@tdsk/agent'
import type { ApiClient } from '@TRL/api'

const makeClient = () =>
  ({
    proxyUrl: `https://proxy.test`,
    createSession: vi.fn().mockResolvedValue({
      maxTokens: 4096,
      provider: `anthropic`,
      sessionToken: `sess-abc`,
      systemPrompt: `You are helpful`,
      model: `claude-sonnet-4-20250514`,
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
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      expect(client.createSession).toHaveBeenCalledWith(`agent-1`)
      expect(client.createThread).toHaveBeenCalledWith(`org-1`, `agent-1`)
      expect(result.threadId).toBe(`thread-new`)
    })

    it(`should reuse existing thread when provided`, async () => {
      const onEvent = vi.fn()

      const result = await executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        threadId: `existing-thread`,
      })

      expect(client.createThread).not.toHaveBeenCalled()
      expect(result.threadId).toBe(`existing-thread`)
    })

    it(`should pass proxyConfig with backendUrl and sessionToken`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        onEvent,
        threadId: `t1`,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      expect(PiAgentRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          proxyConfig: {
            sessionToken: `sess-abc`,
            backendUrl: `https://proxy.test`,
          },
        })
      )
    })

    it(`should call PiAgentRunner.run with proxyConfig and llmConfig (no apiKey)`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        onEvent,
        threadId: `t1`,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      expect(PiAgentRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          onEvent,
          maxSteps: 10,
          orgId: `org-1`,
          threadId: `t1`,
          prompt: `Hello`,
          userId: `user-1`,
          agentId: `agent-1`,
          proxyConfig: {
            backendUrl: `https://proxy.test`,
            sessionToken: `sess-abc`,
          },
          llmConfig: expect.objectContaining({
            maxTokens: 4096,
            provider: `anthropic`,
            systemPrompt: `You are helpful`,
            model: `claude-sonnet-4-20250514`,
          }),
        })
      )

      // Verify no apiKey in llmConfig
      const call = (PiAgentRunner.run as any).mock.calls[0][0]
      expect(call.llmConfig.apiKey).toBeUndefined()
    })

    it(`should pass an HttpMessageAdapter as db`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        onEvent,
        threadId: `t1`,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      const call = (PiAgentRunner.run as any).mock.calls[0][0]
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
          prompt: `Hello`,
          userId: `user-1`,
          onEvent: vi.fn(),
          agentId: `bad-agent`,
        })
      ).rejects.toThrow(`Session creation failed`)
    })

    it(`should propagate errors from createThread`, async () => {
      ;(client.createThread as any).mockRejectedValue(new Error(`Thread creation failed`))

      await expect(
        executor.run({
          orgId: `org-1`,
          prompt: `Hello`,
          userId: `user-1`,
          onEvent: vi.fn(),
          agentId: `agent-1`,
        })
      ).rejects.toThrow(`Thread creation failed`)
    })
  })
})
