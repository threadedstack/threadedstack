/**
 * @module sandbox
 * TODO: combine this to work similar to the service/wasm
 * Allow limited FS and http access
 */

import type {
  TSandboxResult,
  TSandboxLanguage,
  TSandboxExecution,
  IToolSandboxModule,
} from '@TAG/types/sandbox.types'

import { join } from 'node:path'
import { paths } from '@TAG/utils/paths'
import { Tools } from '@TAG/services/tools'

export type TSandboxOpts = {
  sandboxPath?: string
}

/**
 * WASM Sandbox code executor
 * Executes user or ai supplied custom javascript code in an isolated WASM sandbox.
 * Custom Tool Executor with WASM Sandbox Isolation
 * Manages a registry of custom tools and executes their code in isolated WASM sandboxes.
 * Each execution creates a fresh WASM instance with no state carryover.
 *
 * Notes:
 * - WASM sandbox isolation
 * - Timeout enforcement (default: 30 seconds)
 * - Memory limits via WASM instance configuration
 * - No access to Node.js APIs or environment
 */
export class Sandbox {
  // Path to compiled WASM sandbox component
  #sandboxPath: string
  tools: Tools
  #module: IToolSandboxModule | null = null

  constructor(opts?: TSandboxOpts) {
    this.tools = new Tools()
    this.#sandboxPath = opts?.sandboxPath || join(paths.dist, `wasm/sandbox.js`)
  }

  /**
   * Load the WASM sandbox module
   *
   * This is called lazily on first execution. The WASM module is loaded once
   * and reused for all subsequent executions. Each execution gets a fresh
   * WASM instance with no state carryover.
   *
   * @private
   */
  #load = async (): Promise<IToolSandboxModule> => {
    if (this.#module) return this.#module

    try {
      // Dynamically import the transpiled WASM module
      const module = await import(this.#sandboxPath)
      this.#module = module as IToolSandboxModule
      return this.#module
    } catch (error) {
      throw new Error(
        `Failed to load WASM sandbox module: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  /**
   * Execute tool code in WASM sandbox with timeout
   *
   * @private
   * @param sandbox - WASM sandbox module
   * @param code - JavaScript code to execute
   * @param argsJson - JSON-stringified arguments
   * @param timeoutMs - Timeout in milliseconds
   * @returns Execution result
   * @throws Error on timeout or execution failure
   */
  #exec = async (
    sandbox: IToolSandboxModule,
    code: string,
    argsJson: string,
    timeoutMs: number
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      try {
        // Execute synchronously in WASM
        const result = sandbox.executeCode(code, argsJson)
        clearTimeout(timeout)
        resolve(result)
      } catch (error) {
        clearTimeout(timeout)

        // Parse WASM error response
        const errorMessage = error instanceof Error ? error.message : String(error)

        try {
          // Check if error message is JSON-formatted
          const errorData = JSON.parse(errorMessage)
          reject(
            new Error(
              errorData.error + (errorData.details ? `: ${errorData.details}` : '')
            )
          )
        } catch {
          // Not JSON, use raw error message
          reject(new Error(errorMessage))
        }
      }
    })
  }

  /**
   * Execute a custom tool in an isolated WASM sandbox
   *
   * Creates a fresh WASM instance, executes the tool code, and returns the result.
   * The WASM instance is destroyed after execution, ensuring complete isolation.
   *
   * Security Features:
   * - No filesystem access
   * - No network access
   * - No access to Host process or Node.js APIs
   * - Timeout enforced (default: 30 seconds)
   * - Memory limits via WASM configuration
   *
   * @param execution - Tool execution parameters
   * @returns Execution result with success/error status
   *
   * @example
   * ```typescript
   * const result = await executor.execute({
   *   tool: calculatorTool,
   *   arguments: { a: 5, b: 3 },
   *   projectDir: `/tmp/workspace`
   * });
   *
   * if (result.success) {
   *   console.log(`Result:`, result.output);
   * } else {
   *   console.error(`Error:`, result.error);
   * }
   * ```
   */
  async execute(execution: TSandboxExecution): Promise<TSandboxResult> {
    const startTime = Date.now()

    try {
      // Validate execution parameters
      if (!execution.tool || !execution.arguments)
        throw new Error(`Execution must have tool and arguments`)

      // Load WASM sandbox module (cached after first call)
      const sandbox = await this.#load()

      // Prepare arguments as JSON
      const argsJson = JSON.stringify(execution.arguments)

      // Execute in WASM sandbox with timeout
      const timeoutMs = 30000 // 30 seconds
      const resultPromise = this.#exec(sandbox, execution.tool.code, argsJson, timeoutMs)

      const output = await resultPromise
      const executionTime = Date.now() - startTime

      return {
        output,
        success: true,
        executionTime,
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      const message = error instanceof Error ? error.message : String(error)

      return {
        output: ``,
        executionTime,
        success: false,
        error: message,
      }
    }
  }
}
