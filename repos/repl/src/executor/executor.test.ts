import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@tdsk/agent`, () => ({
  AgentRunner: {
    run: vi.fn().mockResolvedValue(undefined),
  },
}))

import { LocalAgentExecutor } from './executor'
import { AgentRunner } from '@tdsk/agent'
import type { ApiClient } from '@TRL/api'

const makeClient = () =>
  ({
    resolveAgent: vi.fn().mockResolvedValue({
      agentId: `agent-1`,
      orgId: `org-1`,
      llmConfig: {
        apiKey: `sk-test`,
        provider: `anthropic`,
        model: `claude-sonnet-4-20250514`,
        maxTokens: 4096,
      },
      sandboxConfig: { provider: `local`, timeout: 300000 },
      tools: [`shellExec`, `readFile`],
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

  describe(`resolve`, () => {
    it(`should call client.resolveAgent`, async () => {
      const config = await executor.resolve(`org-1`, `agent-1`)

      expect(client.resolveAgent).toHaveBeenCalledWith(`org-1`, `agent-1`)
      expect(config.llmConfig.apiKey).toBe(`sk-test`)
      expect(config.llmConfig.provider).toBe(`anthropic`)
    })
  })

  describe(`run`, () => {
    it(`should create a new thread when none provided`, async () => {
      const onEvent = vi.fn()

      const result = await executor.run({
        orgId: `org-1`,
        agentId: `agent-1`,
        prompt: `Hello`,
        userId: `user-1`,
        onEvent,
      })

      expect(client.resolveAgent).toHaveBeenCalledWith(`org-1`, `agent-1`)
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

    it(`should call AgentRunner.run with correct options`, async () => {
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
          llmConfig: expect.objectContaining({
            apiKey: `sk-test`,
            provider: `anthropic`,
          }),
          sandboxConfig: expect.objectContaining({
            provider: `local`,
          }),
          tools: [`shellExec`, `readFile`],
          maxSteps: 10,
          onEvent,
        })
      )
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

    it(`should propagate errors from resolve`, async () => {
      ;(client.resolveAgent as any).mockRejectedValue(new Error(`Agent not found`))

      await expect(
        executor.run({
          orgId: `org-1`,
          agentId: `bad-agent`,
          prompt: `Hello`,
          userId: `user-1`,
          onEvent: vi.fn(),
        })
      ).rejects.toThrow(`Agent not found`)
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
