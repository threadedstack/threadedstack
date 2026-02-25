import type {
  TFunctionRequest,
  TFunctionContext,
  TFunctionExecResult,
} from '@tdsk/domain'

import { transform } from 'esbuild'
import { logger } from '@TBE/utils/logger'
import { createSandboxProvider } from '@tdsk/sandbox'
import { EFunLanguage, ESandboxType } from '@tdsk/domain'

/** 1 MB output cap */
const MAX_OUTPUT_BYTES = 1_048_576

/** Default execution timeout in ms */
const DEFAULT_TIMEOUT_MS = 30_000

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
 * Build the wrapper code that imports the user function module,
 * calls the handler with the serialized input, and exports the result.
 */
const buildWrapperCode = (
  request: TFunctionRequest,
  context: TFunctionContext
): string => {
  const requestJson = JSON.stringify(request)
  const contextJson = JSON.stringify(context)

  return `import handler from 'function';
const request = JSON.parse(${JSON.stringify(requestJson)});
const context = JSON.parse(${JSON.stringify(contextJson)});
let output;
try {
  const raw = await handler(request, context);
  output = { success: true, output: JSON.parse(JSON.stringify(raw ?? null)) };
} catch (err) {
  output = { success: false, error: err?.message || String(err) };
}
export default output;`
}

/**
 * FunctionExecutor
 *
 * Executes user-defined functions inside an isolated V8 sandbox.
 * TypeScript functions are transpiled via esbuild before execution.
 * The sandbox is always torn down in a finally block.
 */
export class FunctionExecutor {
  /**
   * Execute a function record inside a local sandbox using V8 isolate evaluation.
   *
   * 1. If TypeScript, strip types via esbuild
   * 2. Create a local sandbox
   * 3. Register the function code as a named module
   * 4. Build wrapper code that imports and calls the handler
   * 5. Evaluate the wrapper via sandbox.evaluate()
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

      // 2. Create a local sandbox
      const provider = createSandboxProvider(ESandboxType.local)
      sandbox = await provider.create({
        provider: ESandboxType.local,
        timeout: opts?.timeout || DEFAULT_TIMEOUT_MS,
      })

      // 3. Build wrapper that imports 'function' module and calls handler
      const wrapperCode = buildWrapperCode(opts?.request || {}, opts?.context || {})

      // 4. Evaluate via V8 isolate with function code registered as module
      const evalResult = await sandbox.evaluate(wrapperCode, {
        timeout: opts?.timeout || DEFAULT_TIMEOUT_MS,
        modules: { function: code },
      })

      // 5. Parse the result
      const parsed = evalResult.result as
        | { success: boolean; output?: unknown; error?: string }
        | undefined

      if (!parsed) {
        return {
          success: false,
          output: null,
          duration: Date.now() - startTime,
          error: `Function produced no result`,
        }
      }

      // Cap output at 1MB
      const outputStr = JSON.stringify(parsed.output ?? null)
      if (outputStr.length > MAX_OUTPUT_BYTES) {
        return {
          success: false,
          output: null,
          duration: Date.now() - startTime,
          error: `Function output exceeded maximum size of ${MAX_OUTPUT_BYTES} bytes`,
        }
      }

      return {
        success: parsed.success ?? false,
        output: parsed.output ?? null,
        duration: Date.now() - startTime,
        error: parsed.error,
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
