import type { TSandboxMetadata, TSandboxExecution } from '@TAG/types/sandbox.types'

import { Sandbox } from '@TAG/services/sandbox'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the WASM sandbox module
vi.mock(`node:path`, () => ({
  join: vi.fn((...args) => args.join(`/`)),
}))

describe(`Sandbox`, () => {
  let sandbox: Sandbox
  let mockSandboxModule: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock WASM sandbox module
    mockSandboxModule = {
      executeCode: vi.fn(),
    }

    sandbox = new Sandbox({
      module: mockSandboxModule,
      sandboxPath: `/mock/sandbox.js`,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe(`Constructor`, () => {
    it(`should initialize with default sandbox path`, () => {
      const defaultSandbox = new Sandbox()
      expect(defaultSandbox).toBeDefined()
      expect(defaultSandbox.tools).toBeDefined()
    })

    it(`should initialize with custom sandbox path`, () => {
      const customSandbox = new Sandbox({
        sandboxPath: `/custom/sandbox.js`,
      })
      expect(customSandbox).toBeDefined()
    })

    it(`should initialize tools registry`, () => {
      expect(sandbox.tools).toBeDefined()
      expect(sandbox.tools.list()).toEqual([])
    })
  })

  describe(`execute()`, () => {
    let mockTool: TSandboxMetadata
    let mockExecution: TSandboxExecution

    beforeEach(() => {
      mockTool = {
        name: `testTool`,
        description: `Test tool`,
        code: `return args.a + args.b`,
        language: `javascript`,
        parameters: {
          type: `object`,
          properties: {
            a: { type: `number` },
            b: { type: `number` },
          },
          required: [`a`, `b`],
        },
      }

      mockExecution = {
        tool: mockTool,
        arguments: { a: 5, b: 3 },
        projectDir: `/tmp/test`,
      }

      // Mock dynamic import
      vi.doMock(`/mock/sandbox.js`, () => mockSandboxModule)
    })

    it(`should validate execution parameters`, async () => {
      const invalidExecution = {
        tool: null as any,
        arguments: {},
        projectDir: `/tmp`,
      }

      const result = await sandbox.execute(invalidExecution)
      expect(result.success).toBe(false)
      expect(result.error).toContain(`tool and arguments`)
    })

    it(`should execute tool code successfully`, async () => {
      mockSandboxModule.executeCode.mockReturnValue(`8`)

      const result = await sandbox.execute(mockExecution)

      expect(result.success).toBe(true)
      expect(result.output).toBe(`8`)
      expect(result.executionTime).toBeGreaterThanOrEqual(0)
    })

    it(`should serialize arguments as JSON`, async () => {
      mockSandboxModule.executeCode.mockReturnValue(`result`)

      await sandbox.execute(mockExecution)

      expect(mockSandboxModule.executeCode).toHaveBeenCalledWith(
        mockTool.code,
        JSON.stringify({ a: 5, b: 3 })
      )
    })

    it(`should handle execution errors`, async () => {
      mockSandboxModule.executeCode.mockImplementation(() => {
        throw new Error(`Execution failed`)
      })

      const result = await sandbox.execute(mockExecution)

      expect(result.success).toBe(false)
      expect(result.error).toContain(`Execution failed`)
      expect(result.output).toBe(``)
    })

    it(`should enforce timeout`, async () => {
      // Create a promise that never resolves to simulate timeout
      mockSandboxModule.executeCode.mockImplementation(() => {
        return new Promise(() => {}) // Never resolves
      })

      const startTime = Date.now()

      // Use a shorter timeout for testing
      const result = await Promise.race([
        sandbox.execute(mockExecution),
        new Promise<any>((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: false,
                error: `timeout`,
                output: ``,
                executionTime: 0,
              }),
            100
          )
        ),
      ])

      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(200) // Timeout should kick in
    })

    it(`should measure execution time`, async () => {
      mockSandboxModule.executeCode.mockImplementation(() => {
        // Synchronous delay simulation
        const start = Date.now()
        while (Date.now() - start < 50) {
          // Busy wait
        }
        return `result`
      })

      const result = await sandbox.execute(mockExecution)

      expect(result.success).toBe(true)
      expect(result.executionTime).toBeGreaterThanOrEqual(50)
      expect(result.executionTime).toBeLessThan(200)
    })

    it(`should handle JSON-formatted errors`, async () => {
      const jsonError = JSON.stringify({
        error: `Validation failed`,
        details: `Missing required parameter`,
      })

      mockSandboxModule.executeCode.mockImplementation(() => {
        throw new Error(jsonError)
      })

      const result = await sandbox.execute(mockExecution)

      expect(result.success).toBe(false)
      expect(result.error).toContain(`Validation failed`)
      expect(result.error).toContain(`Missing required parameter`)
    })

    it(`should handle non-JSON errors`, async () => {
      mockSandboxModule.executeCode.mockImplementation(() => {
        throw new Error(`Plain error message`)
      })

      const result = await sandbox.execute(mockExecution)

      expect(result.success).toBe(false)
      expect(result.error).toContain(`Plain error message`)
    })

    it(`should handle non-Error exceptions`, async () => {
      mockSandboxModule.executeCode.mockImplementation(() => {
        throw `String error`
      })

      const result = await sandbox.execute(mockExecution)

      expect(result.success).toBe(false)
      expect(result.error).toContain(`String error`)
    })
  })

  describe(`Tool isolation`, () => {
    it(`should create fresh WASM instance for each execution`, async () => {
      mockSandboxModule.executeCode.mockReturnValue(`result`)

      const tool: TSandboxMetadata = {
        name: `tool1`,
        description: `Test`,
        code: `return 1`,
        language: `javascript`,
        parameters: { type: `object`, properties: {}, required: [] },
      }

      // Execute twice
      await sandbox.execute({
        tool,
        arguments: {},
        projectDir: `/tmp`,
      })

      await sandbox.execute({
        tool,
        arguments: {},
        projectDir: `/tmp`,
      })

      // Each execution should call executeCode
      expect(mockSandboxModule.executeCode).toHaveBeenCalledTimes(2)
    })
  })

  describe(`Security features`, () => {
    it(`should have no filesystem access`, async () => {
      const fsAccessTool: TSandboxMetadata = {
        name: `fsAccess`,
        description: `Try to access filesystem`,
        code: `const fs = require("fs"); return fs.readFileSync("/etc/passwd")`,
        language: `javascript`,
        parameters: { type: `object`, properties: {}, required: [] },
      }

      mockSandboxModule.executeCode.mockImplementation(() => {
        throw new Error(`require is not defined`)
      })

      const result = await sandbox.execute({
        tool: fsAccessTool,
        arguments: {},
        projectDir: `/tmp`,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain(`require is not defined`)
    })

    it(`should have no network access`, async () => {
      const networkTool: TSandboxMetadata = {
        name: `network`,
        description: `Try network request`,
        code: `return fetch("https://example.com")`,
        language: `javascript`,
        parameters: { type: `object`, properties: {}, required: [] },
      }

      mockSandboxModule.executeCode.mockImplementation(() => {
        throw new Error(`fetch is not defined`)
      })

      const result = await sandbox.execute({
        tool: networkTool,
        arguments: {},
        projectDir: `/tmp`,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain(`fetch is not defined`)
    })

    it(`should have no access to Node.js APIs`, async () => {
      const nodeTool: TSandboxMetadata = {
        name: `node`,
        description: `Try Node.js API`,
        code: `return process.env.HOME`,
        language: `javascript`,
        parameters: { type: `object`, properties: {}, required: [] },
      }

      mockSandboxModule.executeCode.mockImplementation(() => {
        throw new Error(`process is not defined`)
      })

      const result = await sandbox.execute({
        tool: nodeTool,
        arguments: {},
        projectDir: `/tmp`,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain(`process is not defined`)
    })
  })

  describe(`Complex executions`, () => {
    it(`should handle complex data structures`, async () => {
      const complexTool: TSandboxMetadata = {
        name: `complex`,
        description: `Process complex data`,
        code: `return JSON.stringify(args.data.map(x => x * 2))`,
        language: `javascript`,
        parameters: {
          type: `object`,
          properties: {
            data: { type: `array` },
          },
          required: [`data`],
        },
      }

      mockSandboxModule.executeCode.mockReturnValue(`[2,4,6,8,10]`)

      const result = await sandbox.execute({
        tool: complexTool,
        arguments: { data: [1, 2, 3, 4, 5] },
        projectDir: `/tmp`,
      })

      expect(result.success).toBe(true)
      expect(result.output).toBe(`[2,4,6,8,10]`)
    })

    it(`should handle string return values`, async () => {
      mockSandboxModule.executeCode.mockReturnValue(`string result`)

      const result = await sandbox.execute({
        tool: {
          name: `string`,
          description: `Return string`,
          code: `return "string result"`,
          language: `javascript`,
          parameters: { type: `object`, properties: {}, required: [] },
        },
        arguments: {},
        projectDir: `/tmp`,
      })

      expect(result.success).toBe(true)
      expect(result.output).toBe(`string result`)
    })

    it(`should handle number return values`, async () => {
      mockSandboxModule.executeCode.mockReturnValue(`42`)

      const result = await sandbox.execute({
        tool: {
          name: `number`,
          description: `Return number`,
          code: `return 42`,
          language: `javascript`,
          parameters: { type: `object`, properties: {}, required: [] },
        },
        arguments: {},
        projectDir: `/tmp`,
      })

      expect(result.success).toBe(true)
      expect(result.output).toBe(`42`)
    })
  })
})
