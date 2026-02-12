import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMAdapter, createSandboxProvider, getToolDefs } from '@tdsk/agent'

/**
 * Inline enum values matching @tdsk/domain to avoid resolution issues
 * with domain-internal path aliases in the backend vitest config.
 */
const EContentType = {
  text: `text`,
  toolUse: `tool_use`,
  toolResult: `tool_result`,
} as const

const EStreamEventType = {
  text: `text`,
  toolCallStart: `tool_call_start`,
  toolCallArgs: `tool_call_args`,
  toolResult: `tool_result`,
  error: `error`,
  done: `done`,
} as const

type TStreamEvent =
  | { type: typeof EStreamEventType.text; text: string }
  | { type: typeof EStreamEventType.toolCallStart; id: string; name: string }
  | { type: typeof EStreamEventType.toolCallArgs; id: string; args: string }
  | {
      type: typeof EStreamEventType.toolResult
      toolUseId: string
      content: string
      isError?: boolean
    }
  | { type: typeof EStreamEventType.error; error: string }
  | { type: typeof EStreamEventType.done; stopReason: string }

type ISandbox = {
  exec(
    command: string,
    args?: string[]
  ): Promise<{ success: boolean; output: string; error?: string }>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listDir(path: string): Promise<string[]>
  deleteFile(path: string): Promise<void>
  mkdir(path: string): Promise<void>
  fileExists(path: string): Promise<boolean>
  close(): Promise<void>
}

type TAgentRunOpts = {
  agentId: string
  threadId: string
  prompt: string
  userId: string
  orgId: string
  db: any
  llmConfig: { apiKey: string; model: string; provider: string }
  sandboxConfig?: {
    provider: string
    apiKey?: string
    template?: string
    timeout?: number
    envVars?: Record<string, string>
  }
  tools?: string[]
  maxSteps?: number
  onEvent: (event: any) => void
}

vi.mock(`@tdsk/domain`, () => ({
  EContentType: {
    text: `text`,
    toolUse: `tool_use`,
    toolResult: `tool_result`,
  },
  EStreamEventType: {
    text: `text`,
    toolCallStart: `tool_call_start`,
    toolCallArgs: `tool_call_args`,
    toolResult: `tool_result`,
    error: `error`,
    done: `done`,
  },
  EAgentTool: {
    mkdir: `mkdir`,
    listDir: `listDir`,
    readFile: `readFile`,
    shellExec: `shellExec`,
    webSearch: `webSearch`,
    writeFile: `writeFile`,
    deleteFile: `deleteFile`,
    fileExists: `fileExists`,
  },
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock(`@tdsk/agent`, () => ({
  Mutex: vi.fn().mockImplementation(() => ({
    acquire: vi.fn().mockResolvedValue(vi.fn()),
    clearAll: vi.fn(),
    getActiveLocks: vi.fn().mockReturnValue(0),
  })),
  createLLMAdapter: vi.fn(),
  createSandboxProvider: vi.fn(),
  getToolDefs: vi.fn().mockReturnValue([]),
}))

/**
 * Helper: creates an async generator from an array of TStreamEvent
 */
async function* streamFromEvents(events: TStreamEvent[]): AsyncIterable<TStreamEvent> {
  for (const event of events) {
    yield event
  }
}

/**
 * Build a minimal mock db object with message.list and message.create stubs
 */
function createMockDb(existingMessages: any[] = []) {
  return {
    services: {
      message: {
        list: vi.fn().mockResolvedValue({ data: existingMessages }),
        create: vi.fn().mockResolvedValue({}),
      },
    },
  }
}

/**
 * Build a minimal mock sandbox implementing ISandbox
 */
function createMockSandbox(
  overrides: Partial<Record<keyof ISandbox, any>> = {}
): ISandbox {
  return {
    exec: vi.fn().mockResolvedValue({ success: true, output: `ok`, error: `` }),
    readFile: vi.fn().mockResolvedValue(`file content`),
    writeFile: vi.fn().mockResolvedValue(undefined),
    listDir: vi.fn().mockResolvedValue([`a.txt`, `b.txt`]),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    fileExists: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

/**
 * Base options shared across tests
 */
function baseOpts(overrides: Partial<TAgentRunOpts> = {}): TAgentRunOpts {
  return {
    agentId: `agent-1`,
    threadId: `thread-1`,
    prompt: `Hello`,
    userId: `user-1`,
    orgId: `org-1`,
    db: createMockDb(),
    llmConfig: {
      apiKey: `sk-test`,
      model: `claude-3-opus`,
      provider: `anthropic`,
    },
    onEvent: vi.fn(),
    ...overrides,
  }
}

describe(`AgentRunner`, () => {
  let AgentRunner: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Re-import to get a fresh module with reset mocks each time
    const mod = await import(`./agent`)
    AgentRunner = mod.AgentRunner
  })

  describe(`run - simple text response`, () => {
    it(`should stream a text response and save messages to db`, async () => {
      const textEvent: TStreamEvent = { type: EStreamEventType.text, text: `Hello world` }
      const doneEvent: TStreamEvent = {
        type: EStreamEventType.done,
        stopReason: `end_turn`,
      }

      const mockAdapter = {
        stream: vi.fn().mockReturnValue(streamFromEvents([textEvent, doneEvent])),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const opts = baseOpts()
      await AgentRunner.run(opts)

      // onEvent should have received text and done
      expect(opts.onEvent).toHaveBeenCalledWith(textEvent)
      expect(opts.onEvent).toHaveBeenCalledWith(doneEvent)

      // message.list called to load history
      expect(opts.db.services.message.list).toHaveBeenCalledWith(
        expect.objectContaining({ where: { threadId: `thread-1` } })
      )

      // Two creates: user message, then assistant message
      expect(opts.db.services.message.create).toHaveBeenCalledTimes(2)

      // First call: user message
      expect(opts.db.services.message.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          threadId: `thread-1`,
          type: `user`,
          content: [{ type: EContentType.text, text: `Hello` }],
          orgId: `org-1`,
        })
      )

      // Second call: assistant message with text content
      expect(opts.db.services.message.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          threadId: `thread-1`,
          type: `assistant`,
          orgId: `org-1`,
        })
      )
    })

    it(`should stop the loop when done event has stopReason other than tool_use`, async () => {
      const mockAdapter = {
        stream: vi.fn().mockReturnValue(
          streamFromEvents([
            { type: EStreamEventType.text, text: `Done` },
            { type: EStreamEventType.done, stopReason: `end_turn` },
          ])
        ),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const opts = baseOpts()
      await AgentRunner.run(opts)

      // adapter.stream called exactly once (single loop iteration)
      expect(mockAdapter.stream).toHaveBeenCalledTimes(1)
    })
  })

  describe(`run - tool call without sandbox`, () => {
    it(`should produce error tool results when no sandbox is configured`, async () => {
      const toolDefs = [
        {
          name: `shellExec`,
          description: `Run shell`,
          inputSchema: { type: `object` as const, properties: {} },
        },
      ]
      vi.mocked(getToolDefs).mockReturnValue(toolDefs as any)

      const mockAdapter = {
        stream: vi.fn().mockReturnValue(
          streamFromEvents([
            { type: EStreamEventType.toolCallStart, id: `tc-1`, name: `shellExec` },
            { type: EStreamEventType.toolCallArgs, id: `tc-1`, args: `{"command":"ls"}` },
            { type: EStreamEventType.done, stopReason: `tool_use` },
          ])
        ),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const opts = baseOpts()
      await AgentRunner.run(opts)

      // Three creates: user msg, assistant msg (with toolUse), error tool result msg
      expect(opts.db.services.message.create).toHaveBeenCalledTimes(3)

      // Third create should be the error tool result
      const thirdCall = opts.db.services.message.create.mock.calls[2][0]
      expect(thirdCall.type).toBe(`user`)
      expect(thirdCall.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: EContentType.toolResult,
            toolUseId: `tc-1`,
            isError: true,
            content: expect.stringContaining(`No sandbox configured`),
          }),
        ])
      )

      // Loop should stop after the error (only one stream call)
      expect(mockAdapter.stream).toHaveBeenCalledTimes(1)
    })
  })

  describe(`run - tool call with sandbox`, () => {
    it(`should execute tool in sandbox and loop for second LLM call`, async () => {
      const toolDefs = [
        {
          name: `shellExec`,
          description: `Run shell`,
          inputSchema: { type: `object` as const, properties: {} },
        },
      ]
      vi.mocked(getToolDefs).mockReturnValue(toolDefs as any)

      const mockSandbox = createMockSandbox()
      const mockProvider = { create: vi.fn().mockResolvedValue(mockSandbox) }
      vi.mocked(createSandboxProvider).mockReturnValue(mockProvider as any)

      // First stream call: tool call
      // Second stream call: text response
      let callCount = 0
      const mockAdapter = {
        stream: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            return streamFromEvents([
              { type: EStreamEventType.toolCallStart, id: `tc-1`, name: `shellExec` },
              {
                type: EStreamEventType.toolCallArgs,
                id: `tc-1`,
                args: `{"command":"ls","args":["-la"]}`,
              },
              { type: EStreamEventType.done, stopReason: `tool_use` },
            ])
          }
          return streamFromEvents([
            { type: EStreamEventType.text, text: `Here are the files` },
            { type: EStreamEventType.done, stopReason: `end_turn` },
          ])
        }),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const opts = baseOpts({
        sandboxConfig: { provider: `e2b`, apiKey: `key-123` },
      })
      await AgentRunner.run(opts)

      // adapter.stream called twice (two loop iterations)
      expect(mockAdapter.stream).toHaveBeenCalledTimes(2)

      // sandbox.exec called once with parsed args
      expect(mockSandbox.exec).toHaveBeenCalledWith(`ls`, [`-la`])

      // onEvent should have received a toolResult event
      expect(opts.onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          toolUseId: `tc-1`,
          isError: false,
        })
      )

      // message.create calls: user, assistant (tool_use), tool result user, assistant (text)
      expect(opts.db.services.message.create).toHaveBeenCalledTimes(4)

      // Sandbox should be closed in finally
      expect(mockSandbox.close).toHaveBeenCalledTimes(1)
    })
  })

  describe(`run - error handling`, () => {
    it(`should emit error event and call cleanup when adapter.stream throws`, async () => {
      const mockAdapter = {
        stream: vi.fn().mockImplementation(() => {
          throw new Error(`LLM connection failed`)
        }),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const opts = baseOpts()
      await AgentRunner.run(opts)

      // onEvent should have been called with an error event
      expect(opts.onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.error,
          error: `LLM connection failed`,
        })
      )
    })

    it(`should close sandbox and release lock even when an error occurs`, async () => {
      const toolDefs = [
        {
          name: `shellExec`,
          description: `Run shell`,
          inputSchema: { type: `object` as const, properties: {} },
        },
      ]
      vi.mocked(getToolDefs).mockReturnValue(toolDefs as any)

      const mockSandbox = createMockSandbox()
      const mockProvider = { create: vi.fn().mockResolvedValue(mockSandbox) }
      vi.mocked(createSandboxProvider).mockReturnValue(mockProvider as any)

      // Stream yields tool call, then sandbox.exec throws on execution
      const mockAdapter = {
        stream: vi.fn().mockReturnValue(
          streamFromEvents([
            { type: EStreamEventType.toolCallStart, id: `tc-1`, name: `shellExec` },
            {
              type: EStreamEventType.toolCallArgs,
              id: `tc-1`,
              args: `{"command":"fail"}`,
            },
            { type: EStreamEventType.done, stopReason: `tool_use` },
          ])
        ),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      // Make exec throw to trigger the executeTool catch branch
      mockSandbox.exec = vi.fn().mockRejectedValue(new Error(`sandbox crashed`))

      const opts = baseOpts({
        sandboxConfig: { provider: `e2b`, apiKey: `key-123` },
      })
      await AgentRunner.run(opts)

      // Tool result should have the error message
      expect(opts.onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          toolUseId: `tc-1`,
          isError: true,
          content: expect.stringContaining(`Tool execution error`),
        })
      )

      // Sandbox should still be closed
      expect(mockSandbox.close).toHaveBeenCalledTimes(1)
    })

    it(`should handle stream error event and stop the loop`, async () => {
      const mockAdapter = {
        stream: vi.fn().mockReturnValue(
          streamFromEvents([
            { type: EStreamEventType.text, text: `partial` },
            { type: EStreamEventType.error, error: `Rate limited` },
          ])
        ),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const opts = baseOpts()
      await AgentRunner.run(opts)

      expect(opts.onEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: EStreamEventType.error, error: `Rate limited` })
      )

      // Only one iteration; loop stops after error event
      expect(mockAdapter.stream).toHaveBeenCalledTimes(1)
    })
  })

  describe(`run - max steps limit`, () => {
    it(`should stop after maxSteps iterations even if tool calls keep coming`, async () => {
      const toolDefs = [
        {
          name: `shellExec`,
          description: `Run shell`,
          inputSchema: { type: `object` as const, properties: {} },
        },
      ]
      vi.mocked(getToolDefs).mockReturnValue(toolDefs as any)

      const mockSandbox = createMockSandbox()
      const mockProvider = { create: vi.fn().mockResolvedValue(mockSandbox) }
      vi.mocked(createSandboxProvider).mockReturnValue(mockProvider as any)

      // Always return tool_use to keep the loop going
      let streamCallCount = 0
      const mockAdapter = {
        stream: vi.fn().mockImplementation(() => {
          streamCallCount++
          return streamFromEvents([
            {
              type: EStreamEventType.toolCallStart,
              id: `tc-${streamCallCount}`,
              name: `shellExec`,
            },
            {
              type: EStreamEventType.toolCallArgs,
              id: `tc-${streamCallCount}`,
              args: `{"command":"loop"}`,
            },
            { type: EStreamEventType.done, stopReason: `tool_use` },
          ])
        }),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const opts = baseOpts({
        maxSteps: 3,
        sandboxConfig: { provider: `e2b`, apiKey: `key-123` },
      })
      await AgentRunner.run(opts)

      // Stream called exactly 3 times (maxSteps)
      expect(mockAdapter.stream).toHaveBeenCalledTimes(3)
    })

    it(`should default maxSteps to 10`, async () => {
      const toolDefs = [
        {
          name: `shellExec`,
          description: `Run shell`,
          inputSchema: { type: `object` as const, properties: {} },
        },
      ]
      vi.mocked(getToolDefs).mockReturnValue(toolDefs as any)

      const mockSandbox = createMockSandbox()
      const mockProvider = { create: vi.fn().mockResolvedValue(mockSandbox) }
      vi.mocked(createSandboxProvider).mockReturnValue(mockProvider as any)

      let streamCallCount = 0
      const mockAdapter = {
        stream: vi.fn().mockImplementation(() => {
          streamCallCount++
          return streamFromEvents([
            {
              type: EStreamEventType.toolCallStart,
              id: `tc-${streamCallCount}`,
              name: `shellExec`,
            },
            {
              type: EStreamEventType.toolCallArgs,
              id: `tc-${streamCallCount}`,
              args: `{"command":"loop"}`,
            },
            { type: EStreamEventType.done, stopReason: `tool_use` },
          ])
        }),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const opts = baseOpts({
        sandboxConfig: { provider: `e2b`, apiKey: `key-123` },
      })
      // maxSteps not provided - defaults to 10
      await AgentRunner.run(opts)

      expect(mockAdapter.stream).toHaveBeenCalledTimes(10)
    })
  })

  describe(`run - history loading`, () => {
    it(`should load existing messages from db and include them in history`, async () => {
      const existingMessages = [
        {
          type: `user`,
          content: [{ type: EContentType.text, text: `Previous question` }],
        },
        {
          type: `assistant`,
          content: [{ type: EContentType.text, text: `Previous answer` }],
        },
      ]
      const db = createMockDb(existingMessages)

      // Capture a snapshot of history at call time since the source mutates the array
      let historySnapshot: any[] = []
      const mockAdapter = {
        stream: vi.fn().mockImplementation((history: any[]) => {
          historySnapshot = history.map((m: any) => ({ ...m }))
          return streamFromEvents([
            { type: EStreamEventType.text, text: `Response` },
            { type: EStreamEventType.done, stopReason: `end_turn` },
          ])
        }),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const opts = baseOpts({ db })
      await AgentRunner.run(opts)

      // Verify message.list was called correctly
      expect(db.services.message.list).toHaveBeenCalledWith({
        where: { threadId: `thread-1` },
        limit: 100,
        offset: 0,
      })

      // History at call time should have 2 existing + 1 new user message
      expect(historySnapshot).toHaveLength(3)
      expect(historySnapshot[0].role).toBe(`user`)
      expect(historySnapshot[0].content[0].text).toBe(`Previous question`)
      expect(historySnapshot[1].role).toBe(`assistant`)
      expect(historySnapshot[2].role).toBe(`user`)
      expect(historySnapshot[2].content[0].text).toBe(`Hello`)
    })

    it(`should handle empty message history`, async () => {
      const db = createMockDb([])
      let historySnapshot: any[] = []
      const mockAdapter = {
        stream: vi.fn().mockImplementation((history: any[]) => {
          historySnapshot = history.map((m: any) => ({ ...m }))
          return streamFromEvents([
            { type: EStreamEventType.text, text: `First response` },
            { type: EStreamEventType.done, stopReason: `end_turn` },
          ])
        }),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const opts = baseOpts({ db })
      await AgentRunner.run(opts)

      // Only the new user message should be in history at call time
      expect(historySnapshot).toHaveLength(1)
      expect(historySnapshot[0].role).toBe(`user`)
    })
  })

  describe(`run - tool dispatch (executeTool)`, () => {
    /**
     * Helper to run AgentRunner with a single tool call and return events
     */
    async function runWithToolCall(
      toolName: string,
      argsJson: string,
      sandbox: ISandbox
    ) {
      const toolDefs = [
        {
          name: toolName,
          description: `test`,
          inputSchema: { type: `object` as const, properties: {} },
        },
      ]
      vi.mocked(getToolDefs).mockReturnValue(toolDefs as any)

      const mockProvider = { create: vi.fn().mockResolvedValue(sandbox) }
      vi.mocked(createSandboxProvider).mockReturnValue(mockProvider as any)

      let callCount = 0
      const mockAdapter = {
        stream: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            return streamFromEvents([
              { type: EStreamEventType.toolCallStart, id: `tc-1`, name: toolName },
              { type: EStreamEventType.toolCallArgs, id: `tc-1`, args: argsJson },
              { type: EStreamEventType.done, stopReason: `tool_use` },
            ])
          }
          return streamFromEvents([
            { type: EStreamEventType.done, stopReason: `end_turn` },
          ])
        }),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const onEvent = vi.fn()
      const opts = baseOpts({
        onEvent,
        sandboxConfig: { provider: `e2b`, apiKey: `key` },
      })
      await AgentRunner.run(opts)
      return onEvent
    }

    it(`should dispatch shellExec to sandbox.exec`, async () => {
      const sandbox = createMockSandbox()
      await runWithToolCall(
        `shellExec`,
        `{"command":"echo hi","args":["--flag"]}`,
        sandbox
      )
      expect(sandbox.exec).toHaveBeenCalledWith(`echo hi`, [`--flag`])
    })

    it(`should dispatch readFile to sandbox.readFile`, async () => {
      const sandbox = createMockSandbox()
      const onEvent = await runWithToolCall(
        `readFile`,
        `{"path":"/tmp/test.txt"}`,
        sandbox
      )
      expect(sandbox.readFile).toHaveBeenCalledWith(`/tmp/test.txt`)

      // Verify the tool result content matches readFile return
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          content: `file content`,
          isError: false,
        })
      )
    })

    it(`should dispatch writeFile to sandbox.writeFile`, async () => {
      const sandbox = createMockSandbox()
      const onEvent = await runWithToolCall(
        `writeFile`,
        `{"path":"/tmp/out.txt","content":"hello"}`,
        sandbox
      )
      expect(sandbox.writeFile).toHaveBeenCalledWith(`/tmp/out.txt`, `hello`)

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          content: `File written to /tmp/out.txt`,
          isError: false,
        })
      )
    })

    it(`should dispatch listDir to sandbox.listDir`, async () => {
      const sandbox = createMockSandbox()
      const onEvent = await runWithToolCall(`listDir`, `{"path":"/tmp"}`, sandbox)
      expect(sandbox.listDir).toHaveBeenCalledWith(`/tmp`)

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          content: `a.txt\nb.txt`,
          isError: false,
        })
      )
    })

    it(`should dispatch deleteFile to sandbox.deleteFile`, async () => {
      const sandbox = createMockSandbox()
      const onEvent = await runWithToolCall(
        `deleteFile`,
        `{"path":"/tmp/old.txt"}`,
        sandbox
      )
      expect(sandbox.deleteFile).toHaveBeenCalledWith(`/tmp/old.txt`)

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          content: `File deleted: /tmp/old.txt`,
        })
      )
    })

    it(`should dispatch mkdir to sandbox.mkdir`, async () => {
      const sandbox = createMockSandbox()
      const onEvent = await runWithToolCall(`mkdir`, `{"path":"/tmp/newdir"}`, sandbox)
      expect(sandbox.mkdir).toHaveBeenCalledWith(`/tmp/newdir`)

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          content: `Directory created: /tmp/newdir`,
        })
      )
    })

    it(`should dispatch fileExists to sandbox.fileExists`, async () => {
      const sandbox = createMockSandbox()
      const onEvent = await runWithToolCall(
        `fileExists`,
        `{"path":"/tmp/check.txt"}`,
        sandbox
      )
      expect(sandbox.fileExists).toHaveBeenCalledWith(`/tmp/check.txt`)

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          content: `true`,
          isError: false,
        })
      )
    })

    it(`should return error for unknown tool name`, async () => {
      const sandbox = createMockSandbox()
      const onEvent = await runWithToolCall(`unknownTool`, `{}`, sandbox)

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          content: `Unknown tool: unknownTool`,
          isError: true,
        })
      )
    })

    it(`should return error for webSearch (not implemented)`, async () => {
      const sandbox = createMockSandbox()
      const onEvent = await runWithToolCall(`webSearch`, `{"query":"test"}`, sandbox)

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          content: `Web search not yet implemented`,
          isError: true,
        })
      )
    })

    it(`should return error for invalid JSON arguments`, async () => {
      const sandbox = createMockSandbox()
      const onEvent = await runWithToolCall(`shellExec`, `not-json`, sandbox)

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          content: expect.stringContaining(`Invalid JSON arguments`),
          isError: true,
        })
      )
    })
  })
})
