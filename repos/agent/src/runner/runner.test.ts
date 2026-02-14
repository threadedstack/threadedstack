import type { IAgentRunnerDB, TAgentRunOpts } from '../types/runner.types'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMAdapter } from '../llm/factory'
import { createSandboxProvider } from '@tdsk/sandbox'
import { getToolDefs } from '../tools'

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

vi.mock(`@tdsk/logger`, () => ({
  buildApiLogger: vi
    .fn()
    .mockReturnValue({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}))

vi.mock(`../services/mutex`, () => ({
  Mutex: vi.fn().mockImplementation(() => ({
    acquire: vi.fn().mockResolvedValue(vi.fn()),
    clearAll: vi.fn(),
    getActiveLocks: vi.fn().mockReturnValue(0),
  })),
}))

vi.mock(`../llm/factory`, () => ({
  createLLMAdapter: vi.fn(),
}))

vi.mock(`@tdsk/sandbox`, () => ({
  createSandboxProvider: vi.fn(),
}))

vi.mock(`../tools`, () => ({
  getToolDefs: vi.fn().mockReturnValue([]),
}))

async function* streamFromEvents(events: TStreamEvent[]): AsyncIterable<TStreamEvent> {
  for (const event of events) {
    yield event
  }
}

function createMockDb(existingMessages: any[] = []): IAgentRunnerDB {
  return {
    listMessages: vi.fn().mockResolvedValue({ data: existingMessages }),
    createMessage: vi.fn().mockResolvedValue({}),
  }
}

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
    const mod = await import(`./runner`)
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

      expect(opts.onEvent).toHaveBeenCalledWith(textEvent)
      expect(opts.onEvent).toHaveBeenCalledWith(doneEvent)

      expect(opts.db.listMessages).toHaveBeenCalledWith(
        expect.objectContaining({ where: { threadId: `thread-1` } })
      )

      expect(opts.db.createMessage).toHaveBeenCalledTimes(2)

      expect(opts.db.createMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          threadId: `thread-1`,
          type: `user`,
          content: [{ type: EContentType.text, text: `Hello` }],
          orgId: `org-1`,
        })
      )

      expect(opts.db.createMessage).toHaveBeenNthCalledWith(
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

      expect(opts.db.createMessage).toHaveBeenCalledTimes(3)

      const thirdCall = (opts.db.createMessage as ReturnType<typeof vi.fn>).mock
        .calls[2][0]
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

      expect(mockAdapter.stream).toHaveBeenCalledTimes(1)
    })
  })

  describe(`run - tool call with sandbox`, () => {
    it(`should run tool in sandbox and loop for second LLM call`, async () => {
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

      expect(mockAdapter.stream).toHaveBeenCalledTimes(2)
      expect(mockSandbox.exec).toHaveBeenCalledWith(`ls`, [`-la`])

      expect(opts.onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          toolUseId: `tc-1`,
          isError: false,
        })
      )

      expect(opts.db.createMessage).toHaveBeenCalledTimes(4)
      expect(mockSandbox.close).toHaveBeenCalledTimes(1)
    })
  })

  describe(`run - error handling`, () => {
    it(`should emit error event when adapter.stream throws`, async () => {
      const mockAdapter = {
        stream: vi.fn().mockImplementation(() => {
          throw new Error(`LLM connection failed`)
        }),
      }
      vi.mocked(createLLMAdapter).mockReturnValue(mockAdapter as any)

      const opts = baseOpts()
      await AgentRunner.run(opts)

      expect(opts.onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.error,
          error: `LLM connection failed`,
        })
      )
    })

    it(`should close sandbox even when an error occurs`, async () => {
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

      mockSandbox.exec = vi.fn().mockRejectedValue(new Error(`sandbox crashed`))

      const opts = baseOpts({
        sandboxConfig: { provider: `e2b`, apiKey: `key-123` },
      })
      await AgentRunner.run(opts)

      expect(opts.onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EStreamEventType.toolResult,
          toolUseId: `tc-1`,
          isError: true,
          content: expect.stringContaining(`Tool execution error`),
        })
      )

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

      expect(mockAdapter.stream).toHaveBeenCalledTimes(1)
    })
  })

  describe(`run - max steps limit`, () => {
    it(`should stop after maxSteps iterations`, async () => {
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
        maxSteps: 3,
        sandboxConfig: { provider: `e2b`, apiKey: `key-123` },
      })
      await AgentRunner.run(opts)

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
      await AgentRunner.run(opts)

      expect(mockAdapter.stream).toHaveBeenCalledTimes(10)
    })
  })

  describe(`run - history loading`, () => {
    it(`should load existing messages and include them in history`, async () => {
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

      expect(db.listMessages).toHaveBeenCalledWith({
        where: { threadId: `thread-1` },
        limit: 100,
        offset: 0,
      })

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

      expect(historySnapshot).toHaveLength(1)
      expect(historySnapshot[0].role).toBe(`user`)
    })
  })

  describe(`run - tool dispatch`, () => {
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
