import type { ApiClient } from '@TRL/services/api'

import { AgentRunner } from '@tdsk/agent'
import { Executor } from '@TRL/services/executor'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@tdsk/agent`, () => ({
  AgentRunner: {
    run: vi.fn().mockResolvedValue(undefined),
  },
}))

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

describe(`Executor`, () => {
  let executor: Executor
  let client: ReturnType<typeof makeClient>

  beforeEach(() => {
    vi.clearAllMocks()
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

      expect(client.createSession).toHaveBeenCalledWith(`agent-1`, undefined)
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

      expect(AgentRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          proxyConfig: {
            sessionToken: `sess-abc`,
            backendUrl: `https://proxy.test`,
          },
        })
      )
    })

    it(`should call AgentRunner.run with proxyConfig and llmConfig (no apiKey)`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        onEvent,
        threadId: `t1`,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
      })

      expect(AgentRunner.run).toHaveBeenCalledWith(
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
      const call = (AgentRunner.run as any).mock.calls[0][0]
      expect(call.llmConfig.apiKey).toBeUndefined()
    })

    it(`should pass an DBProxy as db`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        onEvent,
        threadId: `t1`,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
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

  describe(`provider switching`, () => {
    it(`passes providerId to session creation when specified`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        threadId: `t1`,
        providerId: `provider-123`,
      })

      expect(client.createSession).toHaveBeenCalledWith(`agent-1`, `provider-123`)
    })

    it(`uses configurable maxSteps`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        threadId: `t1`,
        maxSteps: 25,
      })

      expect(AgentRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          maxSteps: 25,
        })
      )
    })

    it(`uses default maxSteps when not specified`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        threadId: `t1`,
      })

      expect(AgentRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          maxSteps: 10,
        })
      )
    })
  })

  describe(`context files`, () => {
    it(`prepends context files to prompt`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        threadId: `t1`,
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

      const call = (AgentRunner.run as any).mock.calls[0][0]
      expect(call.prompt).toContain(`<context>`)
      expect(call.prompt).toContain(`Be helpful`)
      expect(call.prompt).toContain(`Hello`)
    })

    it(`does not modify prompt when no context files`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        threadId: `t1`,
      })

      const call = (AgentRunner.run as any).mock.calls[0][0]
      expect(call.prompt).toBe(`Hello`)
    })

    it(`handles multiple context files`, async () => {
      const onEvent = vi.fn()

      await executor.run({
        onEvent,
        orgId: `org-1`,
        prompt: `Hello`,
        userId: `user-1`,
        agentId: `agent-1`,
        threadId: `t1`,
        contextFiles: [
          {
            path: `/test/file1.md`,
            name: `file1.md`,
            source: `auto`,
            content: `Content one`,
            sizeBytes: 11,
          },
          {
            path: `/test/file2.md`,
            name: `file2.md`,
            source: `manual`,
            content: `Content two`,
            sizeBytes: 11,
          },
        ],
      })

      const call = (AgentRunner.run as any).mock.calls[0][0]
      expect(call.prompt).toContain(`--- file1.md ---`)
      expect(call.prompt).toContain(`Content one`)
      expect(call.prompt).toContain(`--- file2.md ---`)
      expect(call.prompt).toContain(`Content two`)
      expect(call.prompt).toContain(`</context>`)
      expect(call.prompt).toContain(`Hello`)
    })
  })
})
