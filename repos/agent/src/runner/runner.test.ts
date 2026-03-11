import type {
  TAgentRunOpts,
  TAgentInitOpts,
  TAgentTurnOpts,
  TAgentConfig,
} from '@TAG/types'
import type { AgentEvent } from '@mariozechner/pi-agent-core'

import { ESandboxType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSubscribe,
  mockPrompt,
  mockWaitForIdle,
  mockSandboxClose,
  mockSandboxCreate,
  mockContinue,
  mockAbort,
  mockSteer,
  mockFollowUp,
  mockSetModel,
  mockSetTools,
  mockSetSystemPrompt,
  mockSetThinkingLevel,
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn().mockReturnValue(vi.fn()),
  mockPrompt: vi.fn().mockResolvedValue(undefined),
  mockWaitForIdle: vi.fn().mockResolvedValue(undefined),
  mockSandboxClose: vi.fn().mockResolvedValue(undefined),
  mockContinue: vi.fn().mockResolvedValue(undefined),
  mockAbort: vi.fn(),
  mockSteer: vi.fn(),
  mockFollowUp: vi.fn(),
  mockSetModel: vi.fn(),
  mockSetTools: vi.fn(),
  mockSetSystemPrompt: vi.fn(),
  mockSetThinkingLevel: vi.fn(),
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
      continue: mockContinue,
      abort: mockAbort,
      steer: mockSteer,
      followUp: mockFollowUp,
      setModel: mockSetModel,
      setTools: mockSetTools,
      setSystemPrompt: mockSetSystemPrompt,
      setThinkingLevel: mockSetThinkingLevel,
      state: { error: undefined as string | undefined },
    })),
  }
})

vi.mock(`@mariozechner/pi-ai`, () => ({
  getModel: vi.fn().mockReturnValue({
    api: `test`,
    provider: `test`,
    id: `test-model`,
    contextWindow: 100000,
  }),
  streamSimple: vi.fn(),
  isContextOverflow: vi.fn().mockReturnValue(false),
}))

vi.mock(`@tdsk/sandbox`, () => ({
  createSandboxProvider: vi.fn().mockReturnValue({
    create: mockSandboxCreate,
  }),
}))

vi.mock(`@tdsk/logger`, () => ({
  Log: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}))

vi.mock(`@TAG/tools/tools`, () => ({
  createSandboxTools: vi.fn().mockReturnValue([]),
  createWebTools: vi.fn().mockReturnValue([]),
  buildCustomFunctionTools: vi.fn().mockReturnValue([]),
}))

vi.mock(`@TAG/adapters/eventBridge`, () => ({
  mapAgentEvent: vi.fn().mockReturnValue(undefined),
}))

vi.mock(`@TAG/adapters/messageConverter`, () => ({
  convertToLlmMessages: vi.fn().mockReturnValue([]),
  convertAssistantToContent: vi.fn().mockReturnValue([]),
  convertToolResultToContent: vi.fn().mockReturnValue({}),
}))

vi.mock(`@TAG/utils/errorClassifier`, () => ({
  isTransientError: vi.fn().mockReturnValue(false),
}))

vi.mock(`@TAG/utils/contextManager`, () => ({
  createContextManager: vi
    .fn()
    .mockReturnValue(vi.fn().mockImplementation((msgs: any) => Promise.resolve(msgs))),
}))

import { AgentRunner } from './runner'
import { getModel, isContextOverflow } from '@mariozechner/pi-ai'
import { Agent } from '@mariozechner/pi-agent-core'
import { createSandboxProvider } from '@tdsk/sandbox'
import { createSandboxTools } from '@TAG/tools/tools'
import { mapAgentEvent } from '@TAG/adapters/eventBridge'
import { convertToLlmMessages } from '@TAG/adapters/messageConverter'
import { isTransientError } from '@TAG/utils/errorClassifier'
import { createContextManager } from '@TAG/utils/contextManager'

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
    mockContinue.mockResolvedValue(undefined)
    mockSandboxClose.mockResolvedValue(undefined)
    mockSteer.mockReturnValue(undefined)
    mockFollowUp.mockReturnValue(undefined)
    mockSetModel.mockReturnValue(undefined)
    mockSetTools.mockReturnValue(undefined)
    mockSetSystemPrompt.mockReturnValue(undefined)
    mockSetThinkingLevel.mockReturnValue(undefined)
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
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(Agent).toHaveBeenCalledTimes(1)
    expect(mockPrompt).toHaveBeenCalledWith(`Hello agent`, undefined)
    expect(mockWaitForIdle).toHaveBeenCalledTimes(1)
  })

  it(`should return a TAgentHandle with steer, followUp, abort, waitForIdle`, async () => {
    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)

    expect(handle).toBeDefined()
    expect(typeof handle.steer).toBe(`function`)
    expect(typeof handle.followUp).toBe(`function`)
    expect(typeof handle.abort).toBe(`function`)
    expect(typeof handle.waitForIdle).toBe(`function`)

    await handle.waitForIdle()
  })

  it(`should load conversation history via db.listMessages`, async () => {
    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(mockDb.listMessages).toHaveBeenCalledWith({
      where: { threadId: `thread-1` },
      limit: 100,
      offset: 0,
    })
  })

  it(`should save user message via db.createMessage`, async () => {
    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

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
        provider: ESandboxType.local,
        timeout: 60000,
        envVars: { FOO: `bar` },
      },
    }
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(createSandboxProvider).toHaveBeenCalledWith(ESandboxType.local)
    expect(mockSandboxCreate).toHaveBeenCalledWith({
      envVars: { FOO: `bar` },
      options: {},
      provider: ESandboxType.local,
      timeout: 60000,
    })
    expect(createSandboxTools).toHaveBeenCalled()
  })

  it(`should use default timeout of 300000 when sandboxConfig.timeout is not set`, async () => {
    const opts = {
      ...baseOpts(),
      sandboxConfig: {
        provider: ESandboxType.local,
      },
    }
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(mockSandboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 300000 })
    )
  })

  it(`should not create sandbox when sandboxConfig is absent`, async () => {
    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(createSandboxProvider).not.toHaveBeenCalled()
    expect(createSandboxTools).not.toHaveBeenCalled()
  })

  it(`should call getModel with llmConfig provider and model`, async () => {
    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(getModel).toHaveBeenCalledWith(`anthropic`, `claude-sonnet-4-20250514`)
  })

  it(`should set up getApiKey from llmConfig.apiKey`, async () => {
    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
    expect(agentCtorArgs.getApiKey).toBeDefined()
    expect((agentCtorArgs as any).getApiKey!()).toBe(`sk-test-key`)
  })

  it(`should not set getApiKey when llmConfig.apiKey is absent`, async () => {
    const opts = baseOpts()
    opts.llmConfig.apiKey = undefined as any
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
    expect(agentCtorArgs.getApiKey).toBeUndefined()
  })

  it(`should call Agent constructor with correct initialState`, async () => {
    const mockModel = { api: `test`, provider: `test`, id: `test-model` }
    const mockHistory = [{ role: `user`, content: `old msg`, timestamp: 1 }]
    vi.mocked(getModel).mockReturnValue(mockModel as any)
    vi.mocked(convertToLlmMessages).mockReturnValue(mockHistory as any)

    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

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
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
    expect(agentCtorArgs.initialState.systemPrompt).toBe(``)
  })

  it(`should subscribe to agent events and call mapAgentEvent + onEvent`, async () => {
    const mockStreamEvent = { type: `text`, text: `hello` }
    vi.mocked(mapAgentEvent).mockReturnValue(mockStreamEvent as any)

    // Capture the FIRST subscriber callback (from init — the main event bridge)
    const subscribers: Array<(event: AgentEvent) => void> = []
    mockSubscribe.mockImplementation((fn: (event: AgentEvent) => void) => {
      subscribers.push(fn)
      return vi.fn()
    })

    // Use instance API to avoid auto-destroy (which nulls #model)
    const runner = new AgentRunner()
    const opts = baseOpts()
    const { prompt, images, signal, ...initOpts } = opts
    await runner.init(initOpts)
    const handle = await runner.runTurn({ prompt, images, signal })
    await handle.waitForIdle()

    // init() subscribes once, runTurn() subscribes once (for overflow tracking)
    expect(mockSubscribe).toHaveBeenCalledTimes(2)
    expect(subscribers[0]).toBeDefined()

    // Simulate an event on the init subscriber (which bridges to onEvent)
    const fakeEvent = { type: `message_update` } as AgentEvent
    subscribers[0](fakeEvent)

    expect(mapAgentEvent).toHaveBeenCalledWith(
      fakeEvent,
      expect.objectContaining({ id: `test-model` })
    )
    expect(opts.onEvent).toHaveBeenCalledWith(mockStreamEvent)

    await runner.destroy()
  })

  it(`should not call onEvent when mapAgentEvent returns undefined`, async () => {
    vi.mocked(mapAgentEvent).mockReturnValue(undefined)

    const subscribers: Array<(event: AgentEvent) => void> = []
    mockSubscribe.mockImplementation((fn: (event: AgentEvent) => void) => {
      subscribers.push(fn)
      return vi.fn()
    })

    // Use instance API to avoid auto-destroy (which nulls #model)
    const runner = new AgentRunner()
    const opts = baseOpts()
    const { prompt, images, signal, ...initOpts } = opts
    await runner.init(initOpts)
    const handle = await runner.runTurn({ prompt, images, signal })
    await handle.waitForIdle()

    // Use the init subscriber (index 0) which bridges events
    const fakeEvent = { type: `agent_start` } as AgentEvent
    subscribers[0](fakeEvent)

    expect(mapAgentEvent).toHaveBeenCalledWith(
      fakeEvent,
      expect.objectContaining({ id: `test-model` })
    )
    expect(opts.onEvent).not.toHaveBeenCalled()

    await runner.destroy()
  })

  it(`should close sandbox in finally block`, async () => {
    const opts = {
      ...baseOpts(),
      sandboxConfig: { provider: ESandboxType.local },
    }
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(mockSandboxClose).toHaveBeenCalledTimes(1)
  })

  it(`should send error event when agent throws`, async () => {
    mockPrompt.mockRejectedValue(new Error(`LLM connection failed`))

    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(opts.onEvent).toHaveBeenCalledWith({
      type: `error`,
      error: `LLM connection failed`,
    })
  })

  it(`should send 'Unknown agent error' for non-Error throws`, async () => {
    mockPrompt.mockRejectedValue(`string error`)

    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(opts.onEvent).toHaveBeenCalledWith({
      type: `error`,
      error: `Unknown agent error`,
    })
  })

  it(`should close sandbox even when error occurs`, async () => {
    mockPrompt.mockRejectedValue(new Error(`Agent crashed`))

    const opts = {
      ...baseOpts(),
      sandboxConfig: { provider: ESandboxType.local },
    }
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(mockSandboxClose).toHaveBeenCalledTimes(1)
  })

  it(`should pass existing messages to convertToLlmMessages`, async () => {
    const existingMsgs = [
      { type: `user`, content: [{ type: `text`, text: `hi` }] },
      { type: `assistant`, content: [{ type: `text`, text: `hello` }] },
    ]
    mockDb.listMessages.mockResolvedValue({ data: existingMsgs })

    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(convertToLlmMessages).toHaveBeenCalledWith(
      existingMsgs,
      expect.objectContaining({
        api: expect.any(String),
        provider: expect.any(String),
      })
    )
  })

  it(`should pass empty array to convertToLlmMessages when data is undefined`, async () => {
    mockDb.listMessages.mockResolvedValue({ data: undefined })

    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(convertToLlmMessages).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        api: expect.any(String),
        provider: expect.any(String),
      })
    )
  })

  it(`should call unsubscribe after agent completes`, async () => {
    const mockUnsubscribe = vi.fn()
    mockSubscribe.mockReturnValue(mockUnsubscribe)

    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    // init() subscribes + runTurn() subscribes (turnListener)
    // Both get unsubscribed: init's via destroy(), turnListener via finally block
    expect(mockUnsubscribe).toHaveBeenCalledTimes(2)
  })

  it(`should pass sandbox and tools list to createSandboxTools`, async () => {
    const opts = {
      ...baseOpts(),
      sandboxConfig: { provider: ESandboxType.local },
      tools: [`shellExec`, `readFile`],
    }
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    const sandbox = await mockSandboxCreate.mock.results[0].value
    expect(createSandboxTools).toHaveBeenCalledWith(sandbox, [`shellExec`, `readFile`])
  })

  it(`should not call createSandboxTools when no sandbox is created`, async () => {
    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    expect(createSandboxTools).not.toHaveBeenCalled()
  })

  it(`should pass sessionId and streamFn to Agent constructor`, async () => {
    const opts = baseOpts()
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()

    const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
    expect(agentCtorArgs.sessionId).toBe(`thread-1`)
    expect(agentCtorArgs.streamFn).toBeDefined()
  })

  describe(`context management`, () => {
    it(`should pass transformContext from createContextManager to Agent`, async () => {
      const mockPruner = vi.fn().mockImplementation((msgs: any) => Promise.resolve(msgs))
      vi.mocked(createContextManager).mockReturnValue(mockPruner)

      const opts = { ...baseOpts(), environment: { contextBudgetPercent: 70 } }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(createContextManager).toHaveBeenCalledWith(
        expect.objectContaining({ id: `test-model` }),
        70,
        undefined // no compaction configured
      )
      const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
      expect(agentCtorArgs.transformContext).toBe(mockPruner)
    })

    it(`should use default 80% context budget when not specified`, async () => {
      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(createContextManager).toHaveBeenCalledWith(
        expect.objectContaining({ id: `test-model` }),
        80,
        undefined // no compaction configured
      )
    })
  })

  describe(`retry on transient errors`, () => {
    it(`should retry with agent.continue() on transient errors`, async () => {
      vi.useFakeTimers()

      let waitCalls = 0
      const agentState = { error: `Rate limit exceeded` as string | undefined }

      vi.mocked(Agent).mockImplementationOnce(
        () =>
          ({
            subscribe: mockSubscribe,
            prompt: mockPrompt,
            waitForIdle: vi.fn().mockImplementation(async () => {
              waitCalls++
              if (waitCalls >= 2) agentState.error = undefined
            }),
            continue: mockContinue,
            abort: mockAbort,
            steer: mockSteer,
            followUp: mockFollowUp,
            state: agentState,
          }) as any
      )

      vi.mocked(isTransientError).mockReturnValue(true)

      const opts = { ...baseOpts(), environment: { maxRetries: 1 } }
      const handlePromise = AgentRunner.run(opts)
      await vi.advanceTimersByTimeAsync(5000)
      const handle = await handlePromise
      await handle.waitForIdle()

      expect(mockContinue).toHaveBeenCalledTimes(1)
      expect(isTransientError).toHaveBeenCalledWith(`Rate limit exceeded`)

      vi.useRealTimers()
    })

    it(`should not retry on permanent errors`, async () => {
      const agentState = { error: `Invalid API key` as string | undefined }

      vi.mocked(Agent).mockImplementationOnce(
        () =>
          ({
            subscribe: mockSubscribe,
            prompt: mockPrompt,
            waitForIdle: mockWaitForIdle,
            continue: mockContinue,
            abort: mockAbort,
            steer: mockSteer,
            followUp: mockFollowUp,
            state: agentState,
          }) as any
      )

      vi.mocked(isTransientError).mockReturnValue(false)

      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(mockContinue).not.toHaveBeenCalled()
    })
  })

  describe(`context overflow detection`, () => {
    it(`should emit error event when context overflow is detected`, async () => {
      vi.mocked(isContextOverflow).mockReturnValue(true)

      let subscriberFn: ((event: AgentEvent) => void) | undefined
      mockSubscribe.mockImplementation((fn: (event: AgentEvent) => void) => {
        subscriberFn = fn
        return vi.fn()
      })

      mockPrompt.mockImplementation(async () => {
        subscriberFn?.({
          type: `turn_end`,
          message: {
            role: `assistant`,
            usage: {
              input: 100,
              output: 50,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 150,
              cost: {},
            },
          },
          toolResults: [],
        } as any)
      })

      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(isContextOverflow).toHaveBeenCalled()
      expect(opts.onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: `error`,
          error: `Context window exceeded. The conversation is too long for this model.`,
        })
      )
    })

    it(`should not emit overflow error when context fits`, async () => {
      vi.mocked(isContextOverflow).mockReturnValue(false)

      let subscriberFn: ((event: AgentEvent) => void) | undefined
      mockSubscribe.mockImplementation((fn: (event: AgentEvent) => void) => {
        subscriberFn = fn
        return vi.fn()
      })

      mockPrompt.mockImplementation(async () => {
        subscriberFn?.({
          type: `turn_end`,
          message: {
            role: `assistant`,
            usage: {
              input: 100,
              output: 50,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 150,
              cost: {},
            },
          },
          toolResults: [],
        } as any)
      })

      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(opts.onEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: `error`,
          error: expect.stringContaining(`Context window exceeded`),
        })
      )
    })
  })

  describe(`thinking/reasoning mode`, () => {
    it(`should pass thinkingLevel to Agent initialState when not off`, async () => {
      const opts = { ...baseOpts(), environment: { thinkingLevel: `high` as const } }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
      expect(agentCtorArgs.initialState.thinkingLevel).toBe(`high`)
    })

    it(`should not pass thinkingLevel when set to off`, async () => {
      const opts = { ...baseOpts(), environment: { thinkingLevel: `off` as const } }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
      expect(agentCtorArgs.initialState.thinkingLevel).toBeUndefined()
    })

    it(`should not pass thinkingLevel when not specified`, async () => {
      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
      expect(agentCtorArgs.initialState.thinkingLevel).toBeUndefined()
    })

    it(`should pass thinkingBudgets to Agent constructor`, async () => {
      const budgets = { minimal: 1000, low: 5000, medium: 10000, high: 20000 }
      const opts = { ...baseOpts(), environment: { thinkingBudgets: budgets } }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
      expect(agentCtorArgs.thinkingBudgets).toEqual(budgets)
    })
  })

  describe(`image/vision support`, () => {
    it(`should pass images to agent.prompt`, async () => {
      const images = [{ data: `base64data`, mimeType: `image/png` }]
      const opts = { ...baseOpts(), images }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(mockPrompt).toHaveBeenCalledWith(`Hello agent`, [
        { type: `image`, data: `base64data`, mimeType: `image/png` },
      ])
    })

    it(`should save image content in user message`, async () => {
      const images = [
        { data: `img1data`, mimeType: `image/png` },
        { data: `img2data`, mimeType: `image/jpeg` },
      ]
      const opts = { ...baseOpts(), images }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(mockDb.createMessage).toHaveBeenCalledWith({
        threadId: `thread-1`,
        type: `user`,
        orgId: `org-1`,
        content: [
          { type: `text`, text: `Hello agent` },
          { type: `image`, data: `img1data`, mimeType: `image/png` },
          { type: `image`, data: `img2data`, mimeType: `image/jpeg` },
        ],
      })
    })

    it(`should pass undefined images when none provided`, async () => {
      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(mockPrompt).toHaveBeenCalledWith(`Hello agent`, undefined)
    })
  })

  describe(`file attachment support`, () => {
    it(`should include file content blocks in user message saved to DB`, async () => {
      const files = [
        {
          assetId: `asset-1`,
          fileName: `doc.pdf`,
          mimeType: `application/pdf`,
          extractedText: `PDF content here`,
        },
        {
          assetId: `asset-2`,
          fileName: `notes.txt`,
          mimeType: `text/plain`,
          extractedText: `Some notes`,
        },
      ]
      const opts = { ...baseOpts(), files }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(mockDb.createMessage).toHaveBeenCalledWith({
        threadId: `thread-1`,
        type: `user`,
        orgId: `org-1`,
        content: [
          { type: `text`, text: `Hello agent` },
          {
            type: `file`,
            assetId: `asset-1`,
            fileName: `doc.pdf`,
            fileType: `application/pdf`,
            fileSize: 0,
            extractedText: `PDF content here`,
          },
          {
            type: `file`,
            assetId: `asset-2`,
            fileName: `notes.txt`,
            fileType: `text/plain`,
            fileSize: 0,
            extractedText: `Some notes`,
          },
        ],
      })
    })

    it(`should prepend file context to prompt with extracted_content tags`, async () => {
      const files = [
        {
          assetId: `asset-1`,
          fileName: `doc.pdf`,
          mimeType: `application/pdf`,
          extractedText: `PDF content here`,
        },
        {
          assetId: `asset-2`,
          fileName: `readme.md`,
          mimeType: `text/markdown`,
          extractedText: `# Readme`,
        },
      ]
      const opts = { ...baseOpts(), files }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      const expectedPrompt =
        `[Attached file: doc.pdf]\n<extracted_content>\nPDF content here\n</extracted_content>` +
        `\n\n` +
        `[Attached file: readme.md]\n<extracted_content>\n# Readme\n</extracted_content>` +
        `\n\n` +
        `Hello agent`
      expect(mockPrompt).toHaveBeenCalledWith(expectedPrompt, undefined)
    })

    it(`should pass file image data as ImageContent to agent.prompt`, async () => {
      const files = [
        {
          assetId: `asset-1`,
          fileName: `photo.png`,
          mimeType: `image/png`,
          imageData: `base64imagedata`,
        },
      ]
      const opts = { ...baseOpts(), files }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(mockPrompt).toHaveBeenCalledWith(`Hello agent`, [
        { type: `image`, data: `base64imagedata`, mimeType: `image/png` },
      ])
    })

    it(`should combine direct images and file images in imageContents`, async () => {
      const images = [{ data: `directImgData`, mimeType: `image/jpeg` }]
      const files = [
        {
          assetId: `asset-1`,
          fileName: `screenshot.png`,
          mimeType: `image/png`,
          imageData: `fileImgData`,
        },
      ]
      const opts = { ...baseOpts(), images, files }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(mockPrompt).toHaveBeenCalledWith(`Hello agent`, [
        { type: `image`, data: `directImgData`, mimeType: `image/jpeg` },
        { type: `image`, data: `fileImgData`, mimeType: `image/png` },
      ])
    })

    it(`should not modify prompt when files have no extractedText`, async () => {
      const files = [
        {
          assetId: `asset-1`,
          fileName: `photo.png`,
          mimeType: `image/png`,
          imageData: `base64data`,
        },
        { assetId: `asset-2`, fileName: `icon.svg`, mimeType: `image/svg+xml` },
      ]
      const opts = { ...baseOpts(), files }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(mockPrompt).toHaveBeenCalledWith(`Hello agent`, [
        { type: `image`, data: `base64data`, mimeType: `image/png` },
      ])
    })

    it(`should handle files without imageData (non-image files)`, async () => {
      const files = [
        {
          assetId: `asset-1`,
          fileName: `data.csv`,
          mimeType: `text/csv`,
          extractedText: `a,b,c\n1,2,3`,
        },
      ]
      const opts = { ...baseOpts(), files }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      // No imageContents since no imageData on any file
      const expectedPrompt =
        `[Attached file: data.csv]\n<extracted_content>\na,b,c\n1,2,3\n</extracted_content>` +
        `\n\n` +
        `Hello agent`
      expect(mockPrompt).toHaveBeenCalledWith(expectedPrompt, undefined)

      // File content block saved to DB
      expect(mockDb.createMessage).toHaveBeenCalledWith({
        threadId: `thread-1`,
        type: `user`,
        orgId: `org-1`,
        content: [
          { type: `text`, text: `Hello agent` },
          {
            type: `file`,
            assetId: `asset-1`,
            fileName: `data.csv`,
            fileType: `text/csv`,
            fileSize: 0,
            extractedText: `a,b,c\n1,2,3`,
          },
        ],
      })
    })

    it(`static run() should pass files through to runTurn`, async () => {
      const files = [
        {
          assetId: `asset-1`,
          fileName: `doc.pdf`,
          mimeType: `application/pdf`,
          extractedText: `content`,
        },
      ]
      const opts = { ...baseOpts(), files }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      // Verify file content block is in the saved user message
      expect(mockDb.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: `file`,
              assetId: `asset-1`,
              fileName: `doc.pdf`,
            }),
          ]),
        })
      )

      // Verify prompt was modified with file context
      const expectedPrompt =
        `[Attached file: doc.pdf]\n<extracted_content>\ncontent\n</extracted_content>` +
        `\n\n` +
        `Hello agent`
      expect(mockPrompt).toHaveBeenCalledWith(expectedPrompt, undefined)
    })
  })

  describe(`agent handle - steer and follow-up`, () => {
    it(`should call agent.steer with correct message format`, async () => {
      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)

      handle.steer(`Change direction`)

      expect(mockSteer).toHaveBeenCalledWith({
        role: `user`,
        content: `Change direction`,
        timestamp: expect.any(Number),
      })

      await handle.waitForIdle()
    })

    it(`should call agent.followUp with correct message format`, async () => {
      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)

      handle.followUp(`Also do this`)

      expect(mockFollowUp).toHaveBeenCalledWith({
        role: `user`,
        content: `Also do this`,
        timestamp: expect.any(Number),
      })

      await handle.waitForIdle()
    })

    it(`should call agent.abort`, async () => {
      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)

      handle.abort()

      expect(mockAbort).toHaveBeenCalledTimes(1)

      await handle.waitForIdle()
    })
  })

  describe(`instance lifecycle (init/runTurn/destroy)`, () => {
    const baseInitOpts = (): TAgentInitOpts => ({
      agentId: `agent-1`,
      threadId: `thread-1`,
      userId: `user-1`,
      orgId: `org-1`,
      db: mockDb,
      llmConfig: {
        provider: `anthropic`,
        model: `claude-sonnet-4-20250514`,
        systemPrompt: `You are a helper`,
        apiKey: `sk-test-key`,
      },
      onEvent: vi.fn(),
    })

    it(`should init and expose threadId + initialized`, async () => {
      const runner = new AgentRunner()
      expect(runner.threadId).toBeNull()
      expect(runner.initialized).toBe(false)

      await runner.init(baseInitOpts())
      expect(runner.threadId).toBe(`thread-1`)
      expect(runner.initialized).toBe(true)

      await runner.destroy()
      expect(runner.initialized).toBe(false)
      expect(runner.threadId).toBeNull()
    })

    it(`should throw on double init without destroy`, async () => {
      const runner = new AgentRunner()
      await runner.init(baseInitOpts())

      await expect(runner.init(baseInitOpts())).rejects.toThrow(
        `AgentRunner already initialized`
      )

      await runner.destroy()
    })

    it(`should throw runTurn before init`, async () => {
      const runner = new AgentRunner()
      await expect(runner.runTurn({ prompt: `hi` })).rejects.toThrow(
        `AgentRunner not initialized`
      )
    })

    it(`should run multiple turns on same runner`, async () => {
      const runner = new AgentRunner()
      await runner.init(baseInitOpts())

      const handle1 = await runner.runTurn({ prompt: `first` })
      await handle1.waitForIdle()

      const handle2 = await runner.runTurn({ prompt: `second` })
      await handle2.waitForIdle()

      // Agent created once, prompted twice
      expect(Agent).toHaveBeenCalledTimes(1)
      expect(mockPrompt).toHaveBeenCalledTimes(2)
      expect(mockPrompt).toHaveBeenCalledWith(`first`, undefined)
      expect(mockPrompt).toHaveBeenCalledWith(`second`, undefined)

      // User messages saved for each turn
      expect(mockDb.createMessage).toHaveBeenCalledTimes(2)

      await runner.destroy()
    })

    it(`should allow re-init after destroy`, async () => {
      const runner = new AgentRunner()

      await runner.init(baseInitOpts())
      await runner.destroy()

      // Re-init with different thread
      await runner.init({ ...baseInitOpts(), threadId: `thread-2` })
      expect(runner.threadId).toBe(`thread-2`)
      expect(runner.initialized).toBe(true)

      await runner.destroy()
    })

    it(`should destroy sandbox on destroy`, async () => {
      const runner = new AgentRunner()
      await runner.init({
        ...baseInitOpts(),
        sandboxConfig: { provider: ESandboxType.local },
      })

      await runner.destroy()
      expect(mockSandboxClose).toHaveBeenCalledTimes(1)
    })
  })

  describe(`updateConfig`, () => {
    const baseInitOpts = (): TAgentInitOpts => ({
      agentId: `agent-1`,
      threadId: `thread-1`,
      userId: `user-1`,
      orgId: `org-1`,
      db: mockDb,
      llmConfig: {
        provider: `anthropic`,
        model: `claude-sonnet-4-20250514`,
        systemPrompt: `You are a helper`,
        apiKey: `sk-test-key`,
      },
      sandboxConfig: { provider: ESandboxType.local },
      onEvent: vi.fn(),
    })

    it(`should throw before init`, () => {
      const runner = new AgentRunner()
      expect(() => runner.updateConfig({ model: `test` })).toThrow(
        `AgentRunner not initialized`
      )
    })

    it(`should call agent.setSystemPrompt`, async () => {
      const runner = new AgentRunner()
      await runner.init(baseInitOpts())

      runner.updateConfig({ systemPrompt: `New prompt` })
      expect(mockSetSystemPrompt).toHaveBeenCalledWith(`New prompt`)

      await runner.destroy()
    })

    it(`should call agent.setThinkingLevel`, async () => {
      const runner = new AgentRunner()
      await runner.init(baseInitOpts())

      runner.updateConfig({ thinkingLevel: `high` })
      expect(mockSetThinkingLevel).toHaveBeenCalledWith(`high`)

      await runner.destroy()
    })

    it(`should call agent.setModel when model + provider provided`, async () => {
      const runner = new AgentRunner()
      await runner.init(baseInitOpts())

      // Set mock AFTER init() so it's not consumed by the init getModel call
      const newModel = {
        api: `test`,
        provider: `test`,
        id: `new-model`,
        contextWindow: 200000,
      }
      vi.mocked(getModel).mockReturnValueOnce(newModel as any)

      runner.updateConfig({ model: `new-model`, provider: `anthropic` })
      expect(getModel).toHaveBeenCalledWith(`anthropic`, `new-model`)
      expect(mockSetModel).toHaveBeenCalledWith(newModel)

      await runner.destroy()
    })

    it(`should call agent.setTools when tools + sandbox available`, async () => {
      const runner = new AgentRunner()
      await runner.init(baseInitOpts())

      runner.updateConfig({ tools: [`shellExec`, `readFile`] })
      expect(createSandboxTools).toHaveBeenCalledWith(expect.anything(), [
        `shellExec`,
        `readFile`,
      ])
      expect(mockSetTools).toHaveBeenCalled()

      await runner.destroy()
    })
  })

  describe(`convertToLlm filter`, () => {
    it(`should pass convertToLlm to Agent constructor`, async () => {
      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
      expect(agentCtorArgs.convertToLlm).toBeDefined()
      expect(typeof agentCtorArgs.convertToLlm).toBe(`function`)
    })

    it(`should filter out custom message roles from LLM messages`, async () => {
      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      const agentCtorArgs = vi.mocked(Agent).mock.calls[0][0]
      const filterFn = agentCtorArgs.convertToLlm!

      const messages = [
        { role: `user`, content: `hello`, timestamp: 1 },
        {
          role: `assistant`,
          content: [{ type: `text`, text: `hi` }],
          timestamp: 2,
          api: `test`,
          provider: `test`,
          model: `test`,
          usage: {},
          stopReason: `stop`,
        },
        {
          role: `toolResult`,
          toolCallId: `tc-1`,
          toolName: `readFile`,
          content: [{ type: `text`, text: `data` }],
          isError: false,
          timestamp: 3,
        },
        {
          role: `artifact`,
          content: `html`,
          mimeType: `text/html`,
          title: `test`,
          timestamp: 4,
        },
        { role: `notification`, text: `info`, level: `info`, timestamp: 5 },
        { role: `systemEvent`, event: `start`, data: {}, timestamp: 6 },
      ] as any[]

      const filtered = await filterFn(messages)

      expect(filtered).toHaveLength(3)
      expect(filtered.map((m: any) => m.role)).toEqual([
        `user`,
        `assistant`,
        `toolResult`,
      ])
    })
  })

  describe(`message persistence drain`, () => {
    it(`should await message persistence before completing run`, async () => {
      const persistenceOrder: string[] = []
      mockDb.createMessage.mockImplementation(async () => {
        persistenceOrder.push(`persisted`)
        return {}
      })

      // Capture the init subscriber (index 0) to simulate turn_end events
      const subscribers: Array<(event: AgentEvent) => void> = []
      mockSubscribe.mockImplementation((fn: (event: AgentEvent) => void) => {
        subscribers.push(fn)
        return vi.fn()
      })

      // Make prompt fire a turn_end event to trigger persistence queueing
      mockPrompt.mockImplementation(async () => {
        const initSubscriber = subscribers[0]
        initSubscriber?.({
          type: `turn_end`,
          message: { role: `assistant`, content: [{ type: `text`, text: `hi` }] },
          toolResults: [],
        } as any)
      })

      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      // Persistence should have completed (user message + assistant from turn_end)
      expect(persistenceOrder.length).toBeGreaterThan(0)
    })

    it(`should log errors for failed persistence but not throw`, async () => {
      // Capture subscribers to simulate turn_end
      const subscribers: Array<(event: AgentEvent) => void> = []
      mockSubscribe.mockImplementation((fn: (event: AgentEvent) => void) => {
        subscribers.push(fn)
        return vi.fn()
      })

      // First call succeeds (user message), subsequent calls fail (persistence)
      let callCount = 0
      mockDb.createMessage.mockImplementation(async () => {
        callCount++
        if (callCount > 1) throw new Error(`DB write failed`)
        return {}
      })

      mockPrompt.mockImplementation(async () => {
        const initSubscriber = subscribers[0]
        initSubscriber?.({
          type: `turn_end`,
          message: { role: `assistant`, content: [{ type: `text`, text: `hi` }] },
          toolResults: [],
        } as any)
      })

      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)
      // Should not throw — errors are logged, not re-thrown
      await expect(handle.waitForIdle()).resolves.not.toThrow()
    })

    it(`should handle empty persistence queue gracefully`, async () => {
      // No turn_end events emitted, so no persistence is queued
      const opts = baseOpts()
      const handle = await AgentRunner.run(opts)
      await expect(handle.waitForIdle()).resolves.not.toThrow()
    })

    it(`should also drain persistence on destroy`, async () => {
      const subscribers: Array<(event: AgentEvent) => void> = []
      mockSubscribe.mockImplementation((fn: (event: AgentEvent) => void) => {
        subscribers.push(fn)
        return vi.fn()
      })

      const runner = new AgentRunner()
      const opts = baseOpts()
      const { prompt, images, signal, ...initOpts } = opts
      await runner.init(initOpts)

      // Simulate queuing a persistence promise by triggering turn_end
      const initSubscriber = subscribers[0]
      initSubscriber?.({
        type: `turn_end`,
        message: { role: `assistant`, content: [{ type: `text`, text: `bye` }] },
        toolResults: [],
      } as any)

      // destroy() should drain persistence without throwing
      await expect(runner.destroy()).resolves.not.toThrow()
    })
  })

  describe(`context compaction passthrough`, () => {
    it(`should pass compaction opts to createContextManager when enabled`, async () => {
      const opts = {
        ...baseOpts(),
        environment: {
          contextBudgetPercent: 75,
          contextCompaction: {
            enabled: true,
            strategy: `compact` as const,
            compactionModel: `claude-haiku`,
          },
        },
      }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(createContextManager).toHaveBeenCalledWith(
        expect.objectContaining({ id: `test-model` }),
        75,
        expect.objectContaining({
          strategy: `compact`,
          compactionModel: `claude-haiku`,
          streamFn: expect.any(Function),
        })
      )
    })

    it(`should not pass compaction opts when disabled`, async () => {
      const opts = {
        ...baseOpts(),
        environment: {
          contextCompaction: {
            enabled: false,
            strategy: `compact` as const,
          },
        },
      }
      const handle = await AgentRunner.run(opts)
      await handle.waitForIdle()

      expect(createContextManager).toHaveBeenCalledWith(
        expect.objectContaining({ id: `test-model` }),
        80,
        undefined
      )
    })
  })
})
