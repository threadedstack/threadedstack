import type {
  TFunctionRequest,
  TFunctionContext,
  TFunctionExecResult,
} from '@tdsk/domain'

import { transform } from 'esbuild'
import { logger } from '@TBE/utils/logger'
import { EFunLanguage } from '@tdsk/domain'
import { createSandboxProvider } from '@tdsk/sandbox'

// TODO: Move this to be constants, should not be hardcoded
/** 1 MB output cap */
const MAX_OUTPUT_BYTES = 1_048_576

/** Default execution timeout in ms */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Runner wrapper that imports the function module, parses input from
 * the __FUNCTION_INPUT__ env var, calls the handler, and writes JSON to stdout.
 */
const RUNNER_CODE = `import handler from './function.mjs';
const input = JSON.parse(process.env.__FUNCTION_INPUT__ || '{}');
try {
  const result = await handler(input.request || {}, input.context || {});
  process.stdout.write(JSON.stringify({ success: true, output: result }));
} catch (err) {
  process.stdout.write(JSON.stringify({
    success: false,
    error: err instanceof Error ? err.message : String(err),
  }));
}
`

type TFunctionRecord = {
  id: string
  name: string
  content: string
  language: string
  projectId: string
}

type TExecuteOpts = {
  request?: TFunctionRequest
  context?: TFunctionContext
  timeout?: number
}

/**
 * FunctionExecutor
 *
 * Executes user-defined functions inside a sandboxed environment.
 * TypeScript functions are transpiled via esbuild before execution.
 * The sandbox is always torn down in a finally block.
 */
export class FunctionExecutor {
  /**
   * Execute a function record inside a local sandbox.
   *
   * 1. If TypeScript, strip types via esbuild
   * 2. Create a local sandbox with __FUNCTION_INPUT__ as an env var
   * 3. Write the function code + runner wrapper to the sandbox
   * 4. Run the runner via `node runner.mjs`
   * 5. Parse the stdout JSON as TFunctionExecResult
   * 6. Always close the sandbox in finally
   */
  static execute = async (
    func: TFunctionRecord,
    opts?: TExecuteOpts
  ): Promise<TFunctionExecResult> => {
    const startTime = Date.now()
    let sandbox

    try {
      // 1. Transpile TypeScript if needed
      let code = func.content
      if (func.language === EFunLanguage.typescript) {
        const result = await transform(code, { loader: `ts`, format: `esm` })
        code = result.code
      }

      // 2. Build the input payload for the env var
      const inputPayload = JSON.stringify({
        request: opts?.request || {},
        context: opts?.context || {},
      })

      // 3. Create a local sandbox with the input as an env var
      const provider = createSandboxProvider(`local`)
      sandbox = await provider.create({
        provider: `local`,
        timeout: opts?.timeout || DEFAULT_TIMEOUT_MS,
        envVars: {
          __FUNCTION_INPUT__: inputPayload,
        },
      })

      // 4. Write function code and runner wrapper
      await sandbox.writeFile(`/workspace/function.mjs`, code)
      await sandbox.writeFile(`/workspace/runner.mjs`, RUNNER_CODE)

      // 5. Run the runner in the sandbox
      const sandboxResult = await sandbox.exec(`node`, [`runner.mjs`])

      // 6. Parse the output
      const rawOutput = sandboxResult.output || ``

      // Cap output at 1MB
      if (rawOutput.length > MAX_OUTPUT_BYTES) {
        return {
          success: false,
          output: null,
          duration: Date.now() - startTime,
          error: `Function output exceeded maximum size of ${MAX_OUTPUT_BYTES} bytes`,
        }
      }

      if (!sandboxResult.success) {
        return {
          success: false,
          output: null,
          duration: Date.now() - startTime,
          error:
            sandboxResult.error ||
            `Function execution failed with exit code ${sandboxResult.exitCode}`,
        }
      }

      // Try to parse JSON output from the runner
      try {
        const parsed = JSON.parse(rawOutput)
        return {
          success: parsed.success ?? false,
          output: parsed.output ?? null,
          duration: Date.now() - startTime,
          error: parsed.error,
        }
      } catch {
        // If output is not JSON, return raw output
        return {
          success: true,
          output: rawOutput,
          duration: Date.now() - startTime,
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`FunctionExecutor error for function ${func.id}: ${message}`)

      return {
        success: false,
        output: null,
        duration: Date.now() - startTime,
        error: message,
      }
    } finally {
      if (sandbox) {
        await sandbox.close().catch((err: unknown) => {
          logger.error(
            `Failed to close sandbox for function ${func.id}: ${err instanceof Error ? err.message : String(err)}`
          )
        })
      }
    }
  }
}
