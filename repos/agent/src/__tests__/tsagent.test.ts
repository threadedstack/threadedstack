import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TSAgent } from '@TAG/tsagent'
import type { TInitOpts } from '@TAG/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Mock dependencies
vi.mock(`node:fs/promises`)

// Create persistent mock objects that survive clearAllMocks()
const mockSandboxTools = {
  add: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  clear: vi.fn(),
}
const mockSandboxExecute = vi.fn().mockResolvedValue({
  success: true,
  output: `mock output`,
  executionTime: 100,
})

const mockMutexAcquire = vi.fn()
const mockMutexGetActiveLocks = vi.fn()
const mockMutexClearAll = vi.fn()

const mockBridgeInit = vi.fn()
const mockBridgeCleanup = vi.fn()

const mockExecExec = vi.fn()

const mockSubAgentSpawn = vi.fn()
const mockSubAgentSendMessage = vi.fn()
const mockSubAgentReceiveMessage = vi.fn()
const mockSubAgentTerminate = vi.fn()
const mockSubAgentCleanup = vi.fn()

vi.mock(`@TAG/services/sandbox`, () => ({
  Sandbox: class MockSandbox {
    tools = mockSandboxTools
    execute = mockSandboxExecute
  },
}))

vi.mock(`@TAG/services/mutex`, () => ({
  Mutex: class MockMutex {
    acquire = mockMutexAcquire
    getActiveLocks = mockMutexGetActiveLocks
    clearAll = mockMutexClearAll
  },
}))

vi.mock(`@TAG/services/wasm`, () => ({
  WasmBridge: class MockWasmBridge {
    init = mockBridgeInit
    cleanup = mockBridgeCleanup
  },
}))

vi.mock(`@TAG/services/executor`, () => ({
  Executor: class MockExecutor {
    exec = mockExecExec
  },
}))

vi.mock(`@TAG/services/subagent`, () => ({
  SubAgentManager: class MockSubAgentManager {
    spawn = mockSubAgentSpawn
    sendMessage = mockSubAgentSendMessage
    receiveMessage = mockSubAgentReceiveMessage
    terminate = mockSubAgentTerminate
    cleanup = mockSubAgentCleanup
  },
}))

describe(`TSAgent`, () => {
  let agent: TSAgent
  let mockOnToken: ReturnType<typeof vi.fn>
  let mockReleaseLock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnToken = vi.fn()
    mockReleaseLock = vi.fn()

    // Mock filesystem operations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)
    vi.mocked(fs.readFile).mockResolvedValue(`test file content`)
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)
    vi.mocked(fs.readdir).mockResolvedValue([])
    vi.mocked(fs.unlink).mockResolvedValue(undefined)
    vi.mocked(fs.access).mockResolvedValue(undefined)
    vi.mocked(fs.stat).mockResolvedValue({
      size: 1024,
      isFile: () => true,
      isDirectory: () => false,
      mtime: new Date(`2024-01-01`),
      birthtime: new Date(`2024-01-01`),
    } as any)

    // Configure persistent mocks
    mockMutexAcquire.mockResolvedValue(mockReleaseLock)
    mockMutexGetActiveLocks.mockReturnValue(0)
    mockMutexClearAll.mockReturnValue(undefined)

    mockBridgeInit.mockResolvedValue({
      prompt: vi.fn().mockResolvedValue(undefined),
      exports: {},
      imports: {},
    })
    mockBridgeCleanup.mockResolvedValue(undefined)

    mockExecExec.mockResolvedValue(`command output`)

    mockSubAgentSpawn.mockResolvedValue(undefined)
    mockSubAgentSendMessage.mockResolvedValue(undefined)
    mockSubAgentReceiveMessage.mockResolvedValue([])
    mockSubAgentTerminate.mockResolvedValue(undefined)
    mockSubAgentCleanup.mockResolvedValue(undefined)

    mockSandboxExecute.mockResolvedValue({
      success: true,
      output: `tool output`,
      executionTime: 100,
    })

    // Create agent instance (mocks already applied via class constructors)
    agent = new TSAgent({
      tempDir: `/tmp/test`,
      mutex: { maxLocks: 10, timeout: 5000 },
      exec: { timeout: 5000 },
      bridge: { logging: false },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe(`Constructor`, () => {
    it(`should initialize with default temp directory`, () => {
      const defaultAgent = new TSAgent()
      expect(defaultAgent.temp).toBe(os.tmpdir())
    })

    it(`should initialize with custom temp directory`, () => {
      expect(agent.temp).toBe(`/tmp/test`)
    })

    it(`should initialize all services`, () => {
      expect(agent.mutex).toBeDefined()
      expect(agent.exec).toBeDefined()
      expect(agent.bridge).toBeDefined()
      expect(agent.sandbox).toBeDefined()
      expect(agent.subAgentManager).toBeDefined()
    })
  })

  describe(`run()`, () => {
    // Helper function to create fresh config with current mockOnToken
    const getMockConfig = (): TInitOpts => ({
      prompt: `test prompt`,
      projectId: `test-project`,
      onToken: mockOnToken,
      config: {
        url: `https://api.test.com`,
        model: `test-model`,
        apiKey: `test-key`,
        provider: `openai`,
      },
    })

    it(`should acquire mutex lock for projectId`, async () => {
      await agent.run(getMockConfig())
      expect(agent.mutex.acquire).toHaveBeenCalledWith(`test-project`)
    })

    it(`should create project directory`, async () => {
      await agent.run(getMockConfig())
      expect(fs.mkdir).toHaveBeenCalledWith(path.resolve(`/tmp/test`, `test-project`), {
        recursive: true,
      })
    })

    it(`should register custom tools if provided`, async () => {
      const customTool = {
        name: `customTool`,
        code: `return true`,
        description: `test tool`,
        language: `javascript` as const,
        parameters: { type: `object` as const, properties: {}, required: [] },
      }

      const config = getMockConfig()
      await agent.run({
        ...config,
        config: {
          ...config.config,
          tools: { custom: [customTool] },
        },
      })

      expect(agent.sandbox.tools.add).toHaveBeenCalledWith(customTool)
    })

    it(`should initialize WasmBridge with correct imports`, async () => {
      await agent.run(getMockConfig())
      expect(agent.bridge.init).toHaveBeenCalledWith(
        expect.objectContaining({
          onToken: expect.any(Function),
          config: expect.objectContaining({
            AGENT_URL: `https://api.test.com`,
            AGENT_MODEL: `test-model`,
            AGENT_API_KEY: `test-key`,
            AGENT_PROVIDER: `openai`,
          }),
          vfsMounts: expect.objectContaining({
            [`/data`]: path.resolve(`/tmp/test`, `test-project`),
          }),
        })
      )
    })

    it(`should execute agent prompt`, async () => {
      const mockPrompt = vi.fn().mockResolvedValue(undefined)
      mockBridgeInit.mockResolvedValue({
        prompt: mockPrompt,
        exports: {},
        imports: {},
      })

      await agent.run(getMockConfig())
      expect(mockPrompt).toHaveBeenCalledWith(`test prompt`)
    })

    it(`should cleanup WasmBridge after execution`, async () => {
      await agent.run(getMockConfig())
      expect(mockBridgeCleanup).toHaveBeenCalled()
    })

    it(`should always release lock, even on error`, async () => {
      const mockPrompt = vi.fn().mockRejectedValue(new Error(`test error`))
      mockBridgeInit.mockResolvedValue({
        prompt: mockPrompt,
        exports: {},
        imports: {},
      })

      await expect(agent.run(getMockConfig())).rejects.toThrow(`test error`)
      expect(mockReleaseLock).toHaveBeenCalled()
    })

    it(`should call onToken with error message on failure`, async () => {
      mockBridgeInit.mockRejectedValue(new Error(`init failed`))

      await expect(agent.run(getMockConfig())).rejects.toThrow(`init failed`)
      expect(mockOnToken).toHaveBeenCalledWith(`[Error] init failed\n`)
    })

    it(`should pass conversation history if provided`, async () => {
      const history = [
        { role: `user` as const, content: `previous message` },
        { role: `assistant` as const, content: `previous response` },
      ]

      await agent.run({ ...getMockConfig(), history })

      expect(agent.bridge.init).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            AGENT_INITIAL_HISTORY: JSON.stringify(history),
          }),
        })
      )
    })
  })

  describe(`wasmImports - executeShell`, () => {
    it(`should execute shell commands`, async () => {
      let capturedImports: any
      mockBridgeInit.mockImplementation(async (imports) => {
        capturedImports = imports
        return {
          prompt: vi.fn().mockResolvedValue(undefined),
          exports: {},
          imports,
        }
      })

      await agent.run({
        prompt: `test`,
        projectId: `test`,
        onToken: mockOnToken,
        config: {
          url: `test`,
          model: `test`,
          apiKey: `test`,
          provider: `openai`,
        },
      })

      const result = await capturedImports.executeShell(`ls`, [`-la`])
      expect(mockExecExec).toHaveBeenCalledWith(
        `ls`,
        [`-la`],
        path.resolve(`/tmp/test`, `test`)
      )
      expect(result).toBe(`command output`)
    })

    it(`should return error message on shell command failure`, async () => {
      mockExecExec.mockRejectedValue(new Error(`command failed`))

      let capturedImports: any
      mockBridgeInit.mockImplementation(async (imports) => {
        capturedImports = imports
        return {
          prompt: vi.fn().mockResolvedValue(undefined),
          exports: {},
          imports,
        }
      })

      await agent.run({
        prompt: `test`,
        projectId: `test`,
        onToken: mockOnToken,
        config: {
          url: `test`,
          model: `test`,
          apiKey: `test`,
          provider: `openai`,
        },
      })

      const result = await capturedImports.executeShell(`bad-cmd`, [])
      expect(result).toBe(`[Error] command failed`)
    })
  })

  describe(`wasmImports - filesystem operations`, () => {
    let capturedImports: any

    beforeEach(async () => {
      mockBridgeInit.mockImplementation(async (imports) => {
        capturedImports = imports
        return {
          prompt: vi.fn().mockResolvedValue(undefined),
          exports: {},
          imports,
        }
      })

      await agent.run({
        prompt: `test`,
        projectId: `test-fs`,
        onToken: mockOnToken,
        config: {
          url: `test`,
          model: `test`,
          apiKey: `test`,
          provider: `openai`,
        },
      })
    })

    it(`should read files within project directory`, async () => {
      const content = await capturedImports.readFile(`test.txt`)
      expect(fs.readFile).toHaveBeenCalledWith(
        path.resolve(`/tmp/test`, `test-fs`, `test.txt`),
        `utf-8`
      )
      expect(content).toBe(`test file content`)
    })

    it(`should reject reading files outside project directory`, async () => {
      await expect(capturedImports.readFile(`../outside.txt`)).rejects.toThrow(
        `Access denied: Path outside project directory`
      )
    })

    it(`should write files within project directory`, async () => {
      const result = await capturedImports.writeFile(`new.txt`, `content`)
      expect(fs.mkdir).toHaveBeenCalled()
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.resolve(`/tmp/test`, `test-fs`, `new.txt`),
        `content`,
        `utf-8`
      )
      expect(result).toContain(`Successfully wrote`)
    })

    it(`should reject writing files outside project directory`, async () => {
      await expect(
        capturedImports.writeFile(`../outside.txt`, `content`)
      ).rejects.toThrow(`Access denied: Path outside project directory`)
    })

    it(`should list directory contents`, async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: `file.txt`, isDirectory: () => false } as any,
        { name: `subdir`, isDirectory: () => true } as any,
      ])

      const entries = await capturedImports.listDirectory(`.`)
      expect(entries).toEqual([`file.txt`, `[DIR] subdir`])
    })

    it(`should reject listing directories outside project`, async () => {
      await expect(capturedImports.listDirectory(`../outside`)).rejects.toThrow(
        `Access denied: Path outside project directory`
      )
    })

    it(`should delete files within project directory`, async () => {
      const result = await capturedImports.deleteFile(`old.txt`)
      expect(fs.unlink).toHaveBeenCalledWith(
        path.resolve(`/tmp/test`, `test-fs`, `old.txt`)
      )
      expect(result).toContain(`Successfully deleted`)
    })

    it(`should create directories within project`, async () => {
      const result = await capturedImports.createDirectory(`newdir`)
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.resolve(`/tmp/test`, `test-fs`, `newdir`),
        { recursive: true }
      )
      expect(result).toContain(`Successfully created`)
    })

    it(`should check if file exists`, async () => {
      const exists = await capturedImports.fileExists(`test.txt`)
      expect(fs.access).toHaveBeenCalled()
      expect(exists).toBe(true)
    })

    it(`should return false for files outside project`, async () => {
      const exists = await capturedImports.fileExists(`../outside.txt`)
      expect(exists).toBe(false)
    })

    it(`should get file stats`, async () => {
      const stats = await capturedImports.getFileStats(`test.txt`)
      expect(fs.stat).toHaveBeenCalled()
      const parsed = JSON.parse(stats)
      expect(parsed).toMatchObject({
        size: 1024,
        isFile: true,
        isDirectory: false,
      })
    })
  })

  describe(`wasmImports - sub-agent operations`, () => {
    let capturedImports: any

    beforeEach(async () => {
      mockBridgeInit.mockImplementation(async (imports) => {
        capturedImports = imports
        return {
          prompt: vi.fn().mockResolvedValue(undefined),
          exports: {},
          imports,
        }
      })

      await agent.run({
        prompt: `test`,
        projectId: `test-subagent`,
        onToken: mockOnToken,
        config: {
          url: `test`,
          model: `test`,
          apiKey: `test`,
          provider: `openai`,
        },
      })
    })

    it(`should spawn sub-agent`, async () => {
      const result = await capturedImports.spawnSubAgent(`sub-1`, `sub prompt`)
      expect(mockSubAgentSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          subAgentId: `sub-1`,
          prompt: `sub prompt`,
          config: expect.any(Object),
          onToken: expect.any(Function),
        })
      )
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      expect(parsed.subAgentId).toBe(`sub-1`)
    })

    it(`should handle spawn errors`, async () => {
      mockSubAgentSpawn.mockRejectedValue(new Error(`spawn failed`))
      const result = await capturedImports.spawnSubAgent(`sub-1`, `prompt`)
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain(`spawn failed`)
    })

    it(`should send message to sub-agent`, async () => {
      const result = await capturedImports.sendMessageToSubAgent(`sub-1`, `hello`)
      expect(mockSubAgentSendMessage).toHaveBeenCalledWith(
        `sub-1`,
        expect.objectContaining({
          type: `prompt`,
          content: `hello`,
        })
      )
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
    })

    it(`should receive message from sub-agent`, async () => {
      mockSubAgentReceiveMessage.mockResolvedValue([
        { type: `response`, content: `reply`, timestamp: Date.now() },
      ])

      const result = await capturedImports.receiveMessageFromSubAgent(`sub-1`)
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      expect(parsed.message).toMatchObject({
        type: `response`,
        content: `reply`,
      })
    })

    it(`should return null when no messages available`, async () => {
      mockSubAgentReceiveMessage.mockResolvedValue([])

      const result = await capturedImports.receiveMessageFromSubAgent(`sub-1`)
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      expect(parsed.message).toBeNull()
    })

    it(`should terminate sub-agent`, async () => {
      const result = await capturedImports.terminateSubAgent(`sub-1`)
      expect(mockSubAgentTerminate).toHaveBeenCalledWith(`sub-1`)
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
    })
  })

  describe(`wasmImports - custom tool execution`, () => {
    let capturedImports: any

    beforeEach(async () => {
      mockBridgeInit.mockImplementation(async (imports) => {
        capturedImports = imports
        return {
          prompt: vi.fn().mockResolvedValue(undefined),
          exports: {},
          imports,
        }
      })

      await agent.run({
        prompt: `test`,
        projectId: `test-custom`,
        onToken: mockOnToken,
        config: {
          url: `test`,
          model: `test`,
          apiKey: `test`,
          provider: `openai`,
        },
      })
    })

    it(`should execute custom tool successfully`, async () => {
      const mockTool = {
        name: `customTool`,
        code: `return true`,
        description: `test`,
        parameters: { type: `object` as const, properties: {}, required: [] },
      }

      mockSandboxTools.get.mockReturnValue(mockTool)
      mockSandboxExecute.mockResolvedValue({
        success: true,
        output: `custom tool result`,
        executionTime: 50,
      })

      const result = await capturedImports.executeCustomTool(
        `customTool`,
        `{"arg": "value"}`
      )

      expect(mockSandboxTools.get).toHaveBeenCalledWith(`customTool`)
      expect(mockSandboxExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: mockTool,
          arguments: { arg: `value` },
          projectDir: path.resolve(`/tmp/test`, `test-custom`),
        })
      )
      expect(result).toBe(`custom tool result`)
    })

    it(`should throw error when custom tool not found`, async () => {
      mockSandboxTools.get.mockReturnValue(null)

      await expect(
        capturedImports.executeCustomTool(`unknownTool`, `{}`)
      ).rejects.toThrow(`Custom tool "unknownTool" not found`)
    })

    it(`should throw error when custom tool execution fails`, async () => {
      const mockTool = {
        name: `failingTool`,
        code: `throw new Error("fail")`,
        description: `test`,
        parameters: { type: `object` as const, properties: {}, required: [] },
      }

      mockSandboxTools.get.mockReturnValue(mockTool)
      mockSandboxExecute.mockResolvedValue({
        success: false,
        output: ``,
        error: `execution error`,
        executionTime: 10,
      })

      await expect(
        capturedImports.executeCustomTool(`failingTool`, `{}`)
      ).rejects.toThrow(`execution error`)
    })
  })

  describe(`getStats()`, () => {
    it(`should return mutex and temp directory stats`, () => {
      mockMutexGetActiveLocks.mockReturnValue(3)

      const stats = agent.getStats()
      expect(stats).toEqual({
        activeLocks: 3,
        tempDir: `/tmp/test`,
      })
    })
  })

  describe(`cleanup()`, () => {
    it(`should cleanup all resources`, async () => {
      await agent.cleanup()

      expect(mockSubAgentCleanup).toHaveBeenCalled()
      expect(mockMutexClearAll).toHaveBeenCalled()
      expect(mockBridgeCleanup).toHaveBeenCalled()
    })
  })

  describe(`webSearch`, () => {
    it(`should return not implemented message`, async () => {
      let capturedImports: any
      mockBridgeInit.mockImplementation(async (imports) => {
        capturedImports = imports
        return {
          prompt: vi.fn().mockResolvedValue(undefined),
          exports: {},
          imports,
        }
      })

      await agent.run({
        prompt: `test`,
        projectId: `test`,
        onToken: mockOnToken,
        config: {
          url: `test`,
          model: `test`,
          apiKey: `test`,
          provider: `openai`,
        },
      })

      const result = capturedImports.webSearch(`test query`)
      expect(result).toBe(`[Search] Web search not yet implemented`)
    })
  })
})
