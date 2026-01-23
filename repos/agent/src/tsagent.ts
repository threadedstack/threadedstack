import type { TTSAgentOpts, TInitOpts } from '@TAG/types'

import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Mutex } from '@TAG/services/mutex'
import { WasmBridge } from '@TAG/services/wasm'
import { Executor } from '@TAG/services/executor'

/**
 * TSAgent - Main Agent class exported from this package
 * Exposes methods and properties for interfacing with the WASM agent
 *
 * Architecture:
 * - Each request spawns a fresh WASM instance for isolation
 * - Mutex ensures serial execution per projectId
 * - Executor provides secure shell access via Host Bridge
 * - WasmBridge handles WASM instantiation and VFS mounting
 */
export class TSAgent {
  temp: string
  mutex: Mutex
  exec: Executor
  bridge: WasmBridge

  constructor(opts?: TTSAgentOpts) {
    this.temp = opts?.tempDir ?? os.tmpdir()
    this.mutex = new Mutex(opts?.mutex)
    this.exec = new Executor(opts?.exec)
    this.bridge = new WasmBridge(opts?.bridge)
  }

  /**
   * Run the AI agent for a given prompt
   *
   * @param opts - Configuration including prompt, LLM config, projectId, and callback
   *
   * Flow:
   * 1. Acquire mutex lock for projectId (prevent concurrent access)
   * 2. Create/ensure project directory exists
   * 3. Mount VFS (map host directory to WASM /data)
   * 4. Instantiate WASM with capabilities (tools, HTTP, env vars)
   * 5. Execute agent's processRequest function
   * 6. Release lock (CRITICAL - always happens via finally)
   */
  run = async (opts: TInitOpts): Promise<void> => {
    const { prompt, config, projectId, onTokenCallback } = opts

    const projectDir = path.resolve(this.temp, projectId)
    let releaseLock: (() => void) | undefined

    try {
      // 1. Acquire Lock - Ensures serial execution per project
      releaseLock = await this.mutex.acquire(projectId)

      // 2. Ensure project directory exists
      await fs.mkdir(projectDir, { recursive: true })

      // 3. Initialize WASM with full bridge setup
      // This would use preview2-shim to:
      // - Mount VFS (projectDir -> /data)
      // - Inject WASI capabilities (filesystem, clocks, HTTP)
      // - Provide tool implementations (executeShell, webSearch)
      // - Inject environment variables (LLM config)

      const wasmImports = {
        // Tool implementations
        'local:agent/imports': {
          onToken: (t: string) => onTokenCallback(t),
        },
        'local:agent/tools': {
          executeShell: (c: string, a: string[]) => this.exec.exec(c, a, projectDir),
          webSearch: (q: string) => 'Search Not Implemented', // TODO: Implement
        },
        // Environment variables for WASM guest
        'wasi:cli/environment': {
          getEnvironment: () => ({
            AGENT_URL: config.url,
            AGENT_PATH: config.path,
            AGENT_MODEL: config.model,
            AGENT_API_KEY: config.apiKey,
            AGENT_PROVIDER: config.provider,
            AGENT_MAX_TOKENS: String(config.maxTokens ?? 100000),
          }),
        },
      }

      // 4. Call WASM agent (stub - actual implementation requires compiled WASM)
      // const { processRequest } = await this.bridge.initialize(wasmImports)
      // await processRequest(prompt)

      // Temporary implementation until WASM is compiled:
      onTokenCallback('[Agent] WASM agent not yet compiled. Run build script first.\n')
      onTokenCallback(`[Agent] Would process prompt: ${prompt}\n`)
    } catch (err: any) {
      console.error(`[TSAgent Error] ${err.message}`)
      onTokenCallback(`[Error] ${err.message}\n`)
      throw err
    } finally {
      // CRITICAL: Always release lock, even on error
      if (releaseLock) releaseLock()
    }
  }

  /**
   * Get mutex statistics
   */
  getStats = () => {
    return {
      activeLocks: this.mutex.getActiveLocks(),
      tempDir: this.temp,
    }
  }

  /**
   * Cleanup all resources
   */
  cleanup = async (): Promise<void> => {
    this.mutex.clearAll()
    await this.bridge.cleanup()
  }
}
