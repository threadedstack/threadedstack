import type { TWasmImports } from '@TAG/types'

import { logger } from '@TAG/utils/logger'
import { WasmBridge } from '@TAG/services/wasm'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dynamic import
vi.mock(`node:path`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:path')>()
  return {
    ...actual,
    default: actual,
    join: vi.fn((...args) => args.join(`/`)),
  }
})

vi.mock(`@TAG/utils/logger`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('@TAG/utils/logger')>()
  return {
    ...actual,
    default: actual,
    log: vi.fn((...args) => undefined),
  }
})

describe(`WasmBridge`, () => {
  let bridge: WasmBridge
  let mockWasmModule: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock WASM module
    mockWasmModule = {
      instantiate: vi.fn(),
      instantiateCore: vi.fn(),
      [`agent.core.wasm`]: {},
    }

    // Mock dynamic import to return our mock module
    vi.doMock(`/mock/path/wasm/agent.js`, () => mockWasmModule)

    bridge = new WasmBridge({
      wasmPath: `/mock/path/wasm/agent.js`,
      logging: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe(`Constructor`, () => {
    it(`should initialize with default logging disabled`, () => {
      const defaultBridge = new WasmBridge()
      expect(defaultBridge).toBeDefined()
    })

    it(`should initialize with custom options`, () => {
      const customBridge = new WasmBridge({
        logging: true,
        wasmPath: `/custom/path`,
      })
      expect(customBridge).toBeDefined()
    })
  })

  describe(`log()`, () => {
    it(`should not log when logging is disabled`, () => {
      const logSpy = vi.spyOn(logger, `log`)
      bridge.log(`test message`)
      expect(logSpy).not.toHaveBeenCalled()
    })

    it(`should log when logging is enabled`, () => {
      const logSpy = vi.spyOn(logger, `log`)
      const loggingBridge = new WasmBridge({ logging: true })
      loggingBridge.log(`test message`)
      expect(logSpy).toHaveBeenCalledWith(`test message`)
    })
  })

  describe(`initialized()`, () => {
    it(`should return false before initialization`, () => {
      expect(bridge.initialized()).toBe(false)
    })

    it(`should return true after initialization`, async () => {
      const mockImports: TWasmImports = {
        onToken: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        webSearch: vi.fn(),
        deleteFile: vi.fn(),
        fileExists: vi.fn(),
        getFileStats: vi.fn(),
        executeShell: vi.fn(),
        listDirectory: vi.fn(),
        createDirectory: vi.fn(),
        executeCustomTool: vi.fn(),
        vfsMounts: {},
        config: {},
      }

      mockWasmModule.instantiate.mockResolvedValue({
        processRequest: vi.fn(),
      })

      await bridge.init(mockImports)
      expect(bridge.initialized()).toBe(true)
    })
  })

  describe(`init()`, () => {
    let mockImports: TWasmImports

    beforeEach(() => {
      mockImports = {
        onToken: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        webSearch: vi.fn(),
        deleteFile: vi.fn(),
        fileExists: vi.fn(),
        getFileStats: vi.fn(),
        executeShell: vi.fn(),
        listDirectory: vi.fn(),
        createDirectory: vi.fn(),
        executeCustomTool: vi.fn(),
        vfsMounts: {
          [`/data`]: `/host/path`,
          [`/workspace`]: `/host/workspace`,
        },
        config: {
          AGENT_URL: `https://api.test.com`,
          AGENT_MODEL: `test-model`,
          AGENT_API_KEY: `test-key`,
        },
      }

      mockWasmModule.instantiate.mockResolvedValue({
        processRequest: vi.fn(),
        otherExport: vi.fn(),
      })
    })

    it(`should create VFS mounts from imports`, async () => {
      await bridge.init(mockImports)

      // Verify instantiate was called with correct structure
      expect(mockWasmModule.instantiate).toHaveBeenCalledWith(
        expect.any(Function), // getCoreModule
        expect.objectContaining({
          [`wasi:filesystem/preopens@0.2.0`]: expect.objectContaining({
            getDirectories: expect.any(Function),
          }),
        }),
        expect.any(Function) // instantiateCore
      )
    })

    it(`should inject Host Bridge callbacks`, async () => {
      await bridge.init(mockImports)

      expect(mockWasmModule.instantiate).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          [`local:tdsk/host-callback`]: expect.objectContaining({
            onToken: mockImports.onToken,
          }),
          [`local:tdsk/tools`]: expect.objectContaining({
            readFile: mockImports.readFile,
            writeFile: mockImports.writeFile,
            webSearch: mockImports.webSearch,
            deleteFile: mockImports.deleteFile,
            fileExists: mockImports.fileExists,
            getFileStats: mockImports.getFileStats,
            executeShell: mockImports.executeShell,
            listDirectory: mockImports.listDirectory,
            createDirectory: mockImports.createDirectory,
            executeCustomTool: mockImports.executeCustomTool,
          }),
        }),
        expect.any(Function)
      )
    })

    it(`should inject environment variables`, async () => {
      await bridge.init(mockImports)

      const callArgs = mockWasmModule.instantiate.mock.calls[0]
      const wasmImports = callArgs[1]
      const getEnvironment = wasmImports[`wasi:cli/environment@0.2.0`].getEnvironment

      const envVars = getEnvironment()
      expect(envVars).toEqual([
        [`AGENT_URL`, `https://api.test.com`],
        [`AGENT_MODEL`, `test-model`],
        [`AGENT_API_KEY`, `test-key`],
      ])
    })

    it(`should return instance with prompt function`, async () => {
      const instance = await bridge.init(mockImports)

      expect(instance).toMatchObject({
        prompt: expect.any(Function),
        exports: expect.any(Object),
        imports: expect.any(Object),
      })
    })

    it(`should expose all WASM exports`, async () => {
      const instance = await bridge.init(mockImports)

      expect(instance.exports).toMatchObject({
        processRequest: expect.any(Function),
        otherExport: expect.any(Function),
      })
    })

    it(`should handle initialization errors`, async () => {
      mockWasmModule.instantiate.mockRejectedValue(new Error(`WASM load failed`))

      await expect(bridge.init(mockImports)).rejects.toThrow(
        `WasmBridge initialization failed: WASM load failed`
      )
    })

    it(`should handle empty VFS mounts`, async () => {
      const importsNoMounts = { ...mockImports, vfsMounts: {} }
      await bridge.init(importsNoMounts)

      const callArgs = mockWasmModule.instantiate.mock.calls[0]
      const wasmImports = callArgs[1]
      const getDirectories = wasmImports[`wasi:filesystem/preopens@0.2.0`].getDirectories

      expect(getDirectories()).toEqual([])
    })

    it(`should handle empty config`, async () => {
      const importsNoConfig = { ...mockImports, config: {} }
      await bridge.init(importsNoConfig)

      const callArgs = mockWasmModule.instantiate.mock.calls[0]
      const wasmImports = callArgs[1]
      const getEnvironment = wasmImports[`wasi:cli/environment@0.2.0`].getEnvironment

      expect(getEnvironment()).toEqual([])
    })
  })

  describe(`prompt()`, () => {
    it(`should throw error if not initialized`, async () => {
      await expect(bridge.prompt(`test`)).rejects.toThrow(`WasmBridge not initialized`)
    })

    it(`should call instance prompt function`, async () => {
      const mockPrompt = vi.fn().mockResolvedValue(undefined)
      mockWasmModule.instantiate.mockResolvedValue({
        processRequest: mockPrompt,
      })

      const mockImports: TWasmImports = {
        onToken: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        webSearch: vi.fn(),
        deleteFile: vi.fn(),
        fileExists: vi.fn(),
        getFileStats: vi.fn(),
        executeShell: vi.fn(),
        listDirectory: vi.fn(),
        createDirectory: vi.fn(),
        executeCustomTool: vi.fn(),
        vfsMounts: {},
        config: {},
      }

      await bridge.init(mockImports)
      await bridge.prompt(`test prompt`)

      expect(mockPrompt).toHaveBeenCalledWith(`test prompt`)
    })
  })

  describe(`cleanup()`, () => {
    it(`should clear VFS mounts`, async () => {
      const mockImports: TWasmImports = {
        onToken: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        webSearch: vi.fn(),
        deleteFile: vi.fn(),
        fileExists: vi.fn(),
        getFileStats: vi.fn(),
        executeShell: vi.fn(),
        listDirectory: vi.fn(),
        createDirectory: vi.fn(),
        executeCustomTool: vi.fn(),
        vfsMounts: { [`/data`]: `/host` },
        config: {},
      }

      mockWasmModule.instantiate.mockResolvedValue({
        processRequest: vi.fn(),
      })

      await bridge.init(mockImports)
      expect(bridge.initialized()).toBe(true)

      await bridge.cleanup()
      expect(bridge.initialized()).toBe(false)
    })

    it(`should handle cleanup when not initialized`, async () => {
      await expect(bridge.cleanup()).resolves.not.toThrow()
    })

    it(`should allow re-initialization after cleanup`, async () => {
      const mockImports: TWasmImports = {
        onToken: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        webSearch: vi.fn(),
        deleteFile: vi.fn(),
        fileExists: vi.fn(),
        getFileStats: vi.fn(),
        executeShell: vi.fn(),
        listDirectory: vi.fn(),
        createDirectory: vi.fn(),
        executeCustomTool: vi.fn(),
        vfsMounts: {},
        config: {},
      }

      mockWasmModule.instantiate.mockResolvedValue({
        processRequest: vi.fn(),
      })

      await bridge.init(mockImports)
      await bridge.cleanup()
      await bridge.init(mockImports)

      expect(bridge.initialized()).toBe(true)
    })
  })

  describe(`VFS Mount Management`, () => {
    it(`should provide mount entries to WASI`, async () => {
      const mockImports: TWasmImports = {
        onToken: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        webSearch: vi.fn(),
        deleteFile: vi.fn(),
        fileExists: vi.fn(),
        getFileStats: vi.fn(),
        executeShell: vi.fn(),
        listDirectory: vi.fn(),
        createDirectory: vi.fn(),
        executeCustomTool: vi.fn(),
        vfsMounts: {
          [`/tmp`]: `/host/tmp`,
          [`/data`]: `/host/data`,
          [`/workspace`]: `/host/workspace`,
        },
        config: {},
      }

      mockWasmModule.instantiate.mockResolvedValue({
        processRequest: vi.fn(),
      })

      await bridge.init(mockImports)

      const callArgs = mockWasmModule.instantiate.mock.calls[0]
      const wasmImports = callArgs[1]
      const getDirectories = wasmImports[`wasi:filesystem/preopens@0.2.0`].getDirectories

      const directories = getDirectories()
      expect(directories).toHaveLength(3)
      expect(directories).toEqual([
        [`/tmp`, { hostPath: `/host/tmp` }],
        [`/data`, { hostPath: `/host/data` }],
        [`/workspace`, { hostPath: `/host/workspace` }],
      ])
    })
  })
})
