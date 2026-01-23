import type { TWasmBridgeOpts, TWasmImports, TWasmInstance } from '@TAG/types'

import { join } from 'node:path'
import { paths } from '@TAG/utils/paths'
import { logger } from '@TAG/utils/logger'

/**
 * WasmBridge class for initializing and communicating with WASM Agent
 * Handles WASM instantiation, VFS mounting, and capability injection
 */
export class WasmBridge {
  #wasmPath: string
  private logging: boolean
  private instance?: TWasmInstance
  private preopens?: Map<string, any>

  constructor(opts?: TWasmBridgeOpts) {
    this.logging = opts?.logging ?? false
    this.#wasmPath = opts?.wasmPath ?? join(paths.dist, `wasm/agent.js`)
  }

  /**
   * Only log output if logging is enabled
   */
  log = (...args: unknown[]) => this.logging && logger.log(...args)

  /**
   * Check if WASM instance is initialized
   */
  initialized = (): boolean => this.instance !== undefined

  /**
   * Mount VFS directories for WASI preopens
   */
  #mounts = (imports: TWasmImports) => {
    this.preopens = new Map()
    if (imports.vfsMounts) {
      for (const [guestPath, hostPath] of Object.entries(imports.vfsMounts)) {
        this.preopens.set(guestPath, { hostPath })
        this.log(`[WasmBridge] Will mount ${hostPath} -> ${guestPath}`)
      }
    }
  }

  /**
   * Build the imports object to pass to instantiate()
   * This injects Host capabilities into the WASM guest
   */
  #imports = (imports: TWasmImports) => {
    this.#mounts(imports)

    return {
      // Host-side callbacks
      [`local:tdsk/host-callback`]: {
        onToken: imports.onToken,
      },
      [`local:tdsk/tools`]: {
        readFile: imports.readFile,
        webSearch: imports.webSearch,
        writeFile: imports.writeFile,
        deleteFile: imports.deleteFile,
        fileExists: imports.fileExists,
        getFileStats: imports.getFileStats,
        executeShell: imports.executeShell,
        listDirectory: imports.listDirectory,
        createDirectory: imports.createDirectory,
        executeCustomTool: imports.executeCustomTool,
      },
      // WASI environment injection
      [`wasi:cli/environment@0.2.0`]: {
        getEnvironment: () => {
          const envVars: [string, string][] = []
          if (imports.config)
            Object.entries(imports.config).forEach(([key, value]) =>
              envVars.push([key, String(value)])
            )

          return envVars
        },
      },
      // WASI filesystem preopens
      [`wasi:filesystem/preopens@0.2.0`]: {
        getDirectories: () => Array.from(this.preopens?.entries() || []),
      },
    }
  }

  #instantiate = async (wasmImports: Record<string, any>, wasmModule: any) => {
    // getCoreModule function resolves WASM core module paths
    // The transpiled code exports core modules (agent.core.wasm, etc.)
    const getCoreModule = (path: string) => wasmModule[path]
    const instantiated = await wasmModule.instantiate(
      getCoreModule,
      wasmImports,
      wasmModule.instantiateCore
    )

    this.log(`[WasmBridge] WASM instantiation successful`)
    this.log(`[WasmBridge] Available exports:`, Object.keys(instantiated))

    this.instance = {
      exports: instantiated,
      imports: wasmImports,
      prompt: instantiated.processRequest,
    }

    return this.instance
  }

  /**
   * Initialize WASM instance with VFS and capabilities
   * Loads the compiled WASM agent and injects Host Bridge capabilities
   */
  init = async (imports: TWasmImports): Promise<TWasmInstance> => {
    try {
      this.log(`[WasmBridge] Initializing WASM instance...`)
      this.log(`[WasmBridge] Loading module from:`, this.#wasmPath)

      const wasmModule = await import(this.#wasmPath)
      const wasmImports = this.#imports(imports)

      // Instantiate the WASM component with our imports
      // The --instantiation flag generates this function with signature:
      // instantiate(getCoreModule, imports, instantiateCore?)
      this.log(`[WasmBridge] Instantiating WASM with custom imports`)
      this.log(`[WasmBridge] - Config entries:`, Object.keys(imports.config || {}).length)
      this.log(`[WasmBridge] - VFS mounts:`, Object.keys(imports.vfsMounts || {}).length)

      return await this.#instantiate(wasmImports, wasmModule)
    } catch (error) {
      if (this.logging) console.error(`[WasmBridge] Initialization failed:`, error)

      throw new Error(
        `WasmBridge initialization failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Call the WASM process function
   * @throws Error if instance not initialized
   */
  prompt = async (prompt: string): Promise<void> => {
    if (!this.instance)
      throw new Error(`WasmBridge not initialized. Call initialize() first.`)

    this.log(`[WasmBridge] Processing request:`, prompt.slice(0, 100))

    return this.instance.prompt(prompt)
  }

  /**
   * Cleanup WASM resources and close VFS handles
   */
  cleanup = async (): Promise<void> => {
    this.log(`[WasmBridge] Cleaning up WASM resources`)

    // Clear mount points (actual VFS cleanup happens via WASM runtime)
    if (this.preopens) {
      this.log(`[WasmBridge] Clearing ${this.preopens.size} VFS mounts`)
      this.preopens.clear()
    }

    this.instance = undefined
  }
}
