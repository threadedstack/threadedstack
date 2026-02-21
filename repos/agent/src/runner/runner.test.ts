import type { TAgentRunOpts } from '@TAG/types'
import type { AgentEvent } from '@mariozechner/pi-agent-core'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSubscribe,
  mockPrompt,
  mockWaitForIdle,
  mockSandboxClose,
  mockSandboxCreate,
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn().mockReturnValue(vi.fn()),
  mockPrompt: vi.fn().mockResolvedValue(undefined),
  mockWaitForIdle: vi.fn().mockResolvedValue(undefined),
  mockSandboxClose: vi.fn().mockResolvedValue(undefined),
  mockSandboxCreate: vi.fn().mockResolvedValue({
    exec: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    listDir: vi.fn(),
    deleteFile: vi.fn(),
    mkdir: vi.fn(),
    fileExists: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock(`@mariozechner/pi-agent-core`, () => {
  return {
    Agent: vi.fn().mockImplementation(() => ({
      subscribe: mockSubscribe,
      prompt: mockPrompt,
      waitForIdle: mockWaitForIdle,
    })),
  }
})

vi.mock(`@mariozechner/pi-ai`, () => ({
  getModel: vi.fn().mockReturnValue({ api: `test`, provider: `test`, id: `test-model` }),
}))

vi.mock(`@tdsk/sandbox`, () => ({
  createSandboxProvider: vi.fn().mockReturnValue({
    create: mockSandboxCreate,
  }),
}))

vi.mock(`@tdsk/logger`, () => ({
  buildApiLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

vi.mock(`@TAG/tools/tools`, () => ({
  createSandboxTools: vi.fn().mockReturnValue([]),
  buildCustomFunctionTools: vi.fn().mockReturnValue([]),
}))

vi.mock(`@TAG/adapters/eventBridge`, () => ({
  mapAgentEvent: vi.fn().mockReturnValue(undefined),
}))

vi.mock(`@TAG/stream/stream`, () => ({
  createStreamProxy: vi.fn().mockReturnValue(vi.fn()),
}))

vi.mock(`@TAG/adapters/messageConverter`, () => ({
  convertToLlmMessages: vi.fn().mockReturnValue([]),
  convertAssistantToContent: vi.fn().mockReturnValue([]),
  convertToolResultToContent: vi.fn().mockReturnValue({}),
}))

import { AgentRunner } from './runner'
import { getModel } from '@mariozechner/pi-ai'
import { Agent } from '@mariozechner/pi-agent-core'
import { createSandboxProvider } from '@tdsk/sandbox'
import { createSandboxTools } from '@TAG/tools/tools'
import { createStreamProxy } from '@TAG/stream/stream'
import { mapAgentEvent } from '@TAG/adapters/eventBridge'
import { convertToLlmMessages } from '@TAG/adapters/messageConverter'

const mockDb = {
  listMessages: vi.fn().mockResolvedValue({ data: [] }),
  createMessage: vi.fn().mockResolvedValue({}),
}

const baseOpts = () =>
  ({
    agentId: `agent-1`,
    threadId: `thread-1`,
    prompt: `Hello agent`,
    userId: `user-1`,
    orgId: `org-1`,
    db: mockDb,
    llmConfig: {
      provider: `anthropic`,
      model: `claude-sonnet-4-20250514`,
      systemPrompt: `You are a helpful assistant`,
      apiKey: `sk-test-key`,
    },
    onEvent: vi.fn(),
  }) as TAgentRunOpts

describe(`AgentRunner`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscribe.mockReturnValue(vi.fn())
    mockPrompt.mockResolvedValue(undefined)
    mockWaitForIdle.mockResolvedValue(undefined)
    mockSandboxClose.mockResolvedValue(undefined)
    mockSandboxCreate.mockResolvedValue({
      exec: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      listDir: vi.fn(),
      deleteFile: vi.fn(),
      mkdir: vi.fn(),
      fileExists: vi.fn(),
      close: mockSandboxClose,
    })
    mockDb.listMessages.mockResolvedValue({ data: [] })
    mockDb.createMessage.mockResolvedValue({})
  })

  it(`should create an Agent and call prompt + waitForIdle`, async () => {
    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(Agent).toHaveBeenCalledTimes(1)
    expect(mockPrompt).toHaveBeenCalledWith(`Hello agent`)
    expect(mockWaitForIdle).toHaveBeenCalledTimes(1)
  })

  it(`should load conversation history via db.listMessages`, async () => {
    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(mockDb.listMessages).toHaveBeenCalledWith({
      where: { threadId: `thread-1` },
      limit: 100,
      offset: 0,
    })
  })

  it(`should save user message via db.createMessage`, async () => {
    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(mockDb.createMessage).toHaveBeenCalledWith({
      threadId: `thread-1`,
      type: `user`,
      orgId: `org-1`,
      content: [{ type: `text`, text: `Hello agent` }],
    })
  })

  it(`should create sandbox when sandboxConfig.provider is set`, async () => {
    const opts = {
      ...baseOpts(),
      sandboxConfig: {
        provider: `local`,
        timeout: 60000,
        envVars: { FOO: `bar` },
      },
    }
    await AgentRunner.run(opts)

    expect(createSandboxProvider).toHaveBeenCalledWith(`local`)
    expect(mockSandboxCreate).toHaveBeenCalledWith({
      envVars: { FOO: `bar` },
      provider: `local`,
      timeout: 60000,
    })
    expect(createSandboxTools).toHaveBeenCalled()
  })

  it(`should use default timeout of 300000 when sandboxConfig.timeout is not set`, async () => {
    const opts = {
      ...baseOpts(),
      sandboxConfig: {
        provider: `local`,
      },
    }
    await AgentRunner.run(opts)

    expect(mockSandboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 300000 })
    )
  })

  it(`should not create sandbox when sandboxConfig is absent`, async () => {
    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(createSandboxProvider).not.toHaveBeenCalled()
    expect(createSandboxTools).not.toHaveBeenCalled()
  })

  it(`should call getModel with llmConfig provider and model`, async () => {
    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(getModel).toHaveBeenCalledWith(`anthropic`, `claude-sonnet-4-20250514`)
  })

  it(`should create proxy stream function when proxyConfig is provided`, async () => {
    const opts = {
      ...baseOpts(),
      proxyConfig: {
        backendUrl: `https://api.example.com`,
        sessionToken: `session-123`,
      },
    }
    await AgentRunner.run(opts)

    expect(createStreamProxy).toHaveBeenCalledWith({
      backendUrl: `https://api.example.com`,
      sessionToken: `session-123`,
    })

    // Verify streamFn was passed to Agent constructor
    const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
    expect(agentCtorArgs.streamFn).toBeDefined()
  })

  it(`should NOT create proxy stream function when proxyConfig is absent`, async () => {
    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(createStreamProxy).not.toHaveBeenCalled()

    const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
    expect(agentCtorArgs.streamFn).toBeUndefined()
  })

  it(`should set up getApiKey from llmConfig.apiKey`, async () => {
    const opts = baseOpts()
    await AgentRunner.run(opts)

    const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
    expect(agentCtorArgs.getApiKey).toBeDefined()
    expect((agentCtorArgs as any).getApiKey!()).toBe(`sk-test-key`)
  })

  it(`should not set getApiKey when llmConfig.apiKey is absent`, async () => {
    const opts = baseOpts()
    opts.llmConfig.apiKey = undefined as any
    await AgentRunner.run(opts)

    const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
    expect(agentCtorArgs.getApiKey).toBeUndefined()
  })

  it(`should call Agent constructor with correct initialState`, async () => {
    const mockModel = { api: `test`, provider: `test`, id: `test-model` }
    const mockHistory = [{ role: `user`, content: `old msg`, timestamp: 1 }]
    vi.mocked(getModel).mockReturnValue(mockModel as any)
    vi.mocked(convertToLlmMessages).mockReturnValue(mockHistory as any)

    const opts = baseOpts()
    await AgentRunner.run(opts)

    const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
    expect(agentCtorArgs.initialState).toEqual({
      systemPrompt: `You are a helpful assistant`,
      model: mockModel,
      tools: [],
      messages: mockHistory,
    })
  })

  it(`should use empty string for systemPrompt when not provided`, async () => {
    const opts = baseOpts()
    opts.llmConfig.systemPrompt = undefined as any
    await AgentRunner.run(opts)

    const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
    expect(agentCtorArgs.initialState.systemPrompt).toBe(``)
  })

  it(`should subscribe to agent events and call mapAgentEvent + onEvent`, async () => {
    const mockStreamEvent = { type: `text`, text: `hello` }
    vi.mocked(mapAgentEvent).mockReturnValue(mockStreamEvent as any)

    // Capture the subscriber callback
    let subscriberFn: ((event: AgentEvent) => void) | undefined
    mockSubscribe.mockImplementation((fn: (event: AgentEvent) => void) => {
      subscriberFn = fn
      return vi.fn()
    })

    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(subscriberFn).toBeDefined()

    // Simulate an event
    const fakeEvent = { type: `message_update` } as AgentEvent
    subscriberFn!(fakeEvent)

    expect(mapAgentEvent).toHaveBeenCalledWith(fakeEvent)
    expect(opts.onEvent).toHaveBeenCalledWith(mockStreamEvent)
  })

  it(`should not call onEvent when mapAgentEvent returns undefined`, async () => {
    vi.mocked(mapAgentEvent).mockReturnValue(undefined)

    let subscriberFn: ((event: AgentEvent) => void) | undefined
    mockSubscribe.mockImplementation((fn: (event: AgentEvent) => void) => {
      subscriberFn = fn
      return vi.fn()
    })

    const opts = baseOpts()
    await AgentRunner.run(opts)

    const fakeEvent = { type: `agent_start` } as AgentEvent
    subscriberFn!(fakeEvent)

    expect(mapAgentEvent).toHaveBeenCalledWith(fakeEvent)
    expect(opts.onEvent).not.toHaveBeenCalled()
  })

  it(`should close sandbox in finally block`, async () => {
    const opts = {
      ...baseOpts(),
      sandboxConfig: { provider: `local` },
    }
    await AgentRunner.run(opts)

    expect(mockSandboxClose).toHaveBeenCalledTimes(1)
  })

  it(`should send error event when agent throws`, async () => {
    mockPrompt.mockRejectedValue(new Error(`LLM connection failed`))

    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(opts.onEvent).toHaveBeenCalledWith({
      type: `error`,
      error: `LLM connection failed`,
    })
  })

  it(`should send 'Unknown agent error' for non-Error throws`, async () => {
    mockPrompt.mockRejectedValue(`string error`)

    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(opts.onEvent).toHaveBeenCalledWith({
      type: `error`,
      error: `Unknown agent error`,
    })
  })

  it(`should close sandbox even when error occurs`, async () => {
    mockPrompt.mockRejectedValue(new Error(`Agent crashed`))

    const opts = {
      ...baseOpts(),
      sandboxConfig: { provider: `local` },
    }
    await AgentRunner.run(opts)

    expect(mockSandboxClose).toHaveBeenCalledTimes(1)
  })

  it(`should pass existing messages to convertToLlmMessages`, async () => {
    const existingMsgs = [
      { type: `user`, content: [{ type: `text`, text: `hi` }] },
      { type: `assistant`, content: [{ type: `text`, text: `hello` }] },
    ]
    mockDb.listMessages.mockResolvedValue({ data: existingMsgs })

    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(convertToLlmMessages).toHaveBeenCalledWith(existingMsgs)
  })

  it(`should pass empty array to convertToLlmMessages when data is undefined`, async () => {
    mockDb.listMessages.mockResolvedValue({ data: undefined })

    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(convertToLlmMessages).toHaveBeenCalledWith([])
  })

  it(`should call unsubscribe after agent completes`, async () => {
    const mockUnsubscribe = vi.fn()
    mockSubscribe.mockReturnValue(mockUnsubscribe)

    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it(`should pass sandbox and tools list to createSandboxTools`, async () => {
    const opts = {
      ...baseOpts(),
      sandboxConfig: { provider: `local` },
      tools: [`shellExec`, `readFile`],
    }
    await AgentRunner.run(opts)

    const sandbox = await mockSandboxCreate.mock.results[0].value
    expect(createSandboxTools).toHaveBeenCalledWith(sandbox, [`shellExec`, `readFile`])
  })

  it(`should not call createSandboxTools when no sandbox is created`, async () => {
    const opts = baseOpts()
    await AgentRunner.run(opts)

    expect(createSandboxTools).not.toHaveBeenCalled()
  })
})
