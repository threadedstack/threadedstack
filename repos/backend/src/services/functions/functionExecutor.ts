import type {
  ISandbox,
  TFunctionRequest,
  TFunctionContext,
  TFunctionExecResult,
} from '@tdsk/domain'

import { transform } from 'esbuild'
import { logger } from '@TBE/utils/logger'
import { createSandboxProvider } from '@tdsk/sandbox'
import { EFunLanguage, ESandboxType } from '@tdsk/domain'
import {
  PoolTtlMS,
  PoolMaxSize,
  MaxOutputBytes,
  DefaultTimeoutMS,
} from '@TBE/constants/values'

type TPoolEntry = { sandbox: ISandbox; lastUsed: number }
const pool: TPoolEntry[] = []
let poolTimer: ReturnType<typeof setInterval> | null = null

const cleanExpired = (): void => {
  const now = Date.now()
  let i = pool.length
  while (i--) {
    if (now - pool[i].lastUsed > PoolTtlMS) {
      const [entry] = pool.splice(i, 1)
      entry.sandbox.close().catch((err: unknown) => {
        logger.warn(
          `Failed to close expired sandbox: ${err instanceof Error ? err.message : String(err)}`
        )
      })
    }
  }
  if (!pool.length && poolTimer) {
    clearInterval(poolTimer)
    poolTimer = null
  }
}

const acquireSandbox = async (timeout: number): Promise<ISandbox> => {
  cleanExpired()
  const entry = pool.pop()
  if (entry) return entry.sandbox

  const provider = createSandboxProvider(ESandboxType.local)
  return provider.create({ provider: ESandboxType.local, timeout })
}

const releaseSandbox = async (sandbox: ISandbox): Promise<void> => {
  if (pool.length >= PoolMaxSize) {
    await sandbox.close().catch((err: unknown) => {
      logger.warn(
        `Failed to close sandbox (pool full): ${err instanceof Error ? err.message : String(err)}`
      )
    })
    return
  }
  try {
    await sandbox.reset()
    pool.push({ sandbox, lastUsed: Date.now() })
    if (!poolTimer) {
      poolTimer = setInterval(cleanExpired, 60_000)
      poolTimer.unref?.()
    }
  } catch (resetErr: unknown) {
    logger.warn(
      `Sandbox reset failed, closing instead: ${resetErr instanceof Error ? resetErr.message : String(resetErr)}`
    )
    await sandbox.close().catch((closeErr: unknown) => {
      logger.warn(
        `Failed to close sandbox after reset failure: ${closeErr instanceof Error ? closeErr.message : String(closeErr)}`
      )
    })
  }
}

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
 * Sandboxes are pooled for reuse — V8 isolate creation is expensive.
 */
export class FunctionExecutor {
  /**
   * Execute a function record inside a local sandbox using V8 isolate evaluation.
   *
   * 1. If TypeScript, strip types via esbuild
   * 2. Acquire a sandbox from the pool (or create new)
   * 3. Build wrapper code that imports and calls the handler
   * 4. Evaluate the wrapper via sandbox.evaluate() with function code as module
   * 5. Parse and validate the result (cap output at MaxOutputBytes)
   * 6. Return sandbox to pool on success, close on error
   */
  static execute = async (
    func: TFunctionRecord,
    opts?: TExecuteOpts
  ): Promise<TFunctionExecResult> => {
    const startTime = Date.now()
    let sandbox: ISandbox | undefined
    let pooled = false

    try {
      // 1. Transpile TypeScript if needed
      let code = func.content
      if (func.language === EFunLanguage.typescript) {
        const result = await transform(code, { loader: `ts`, format: `esm` })
        code = result.code
      }

      // 2. Acquire sandbox from pool (or create new)
      sandbox = await acquireSandbox(opts?.timeout || DefaultTimeoutMS)

      // 3. Build wrapper that imports 'function' module and calls handler
      const wrapperCode = buildWrapperCode(opts?.request || {}, opts?.context || {})

      // 4. Evaluate via V8 isolate with function code registered as module
      const evalResult = await sandbox.evaluate(wrapperCode, {
        timeout: opts?.timeout || DefaultTimeoutMS,
        modules: { function: code },
      })

      // Sandbox executed successfully — return to pool
      pooled = true
      await releaseSandbox(sandbox)

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
      if (outputStr.length > MaxOutputBytes) {
        return {
          success: false,
          output: null,
          duration: Date.now() - startTime,
          error: `Function output exceeded maximum size of ${MaxOutputBytes} bytes`,
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
      if (sandbox && !pooled) {
        await sandbox.close().catch((err: unknown) => {
          logger.error(
            `Failed to close sandbox for function ${func.id}: ${err instanceof Error ? err.message : String(err)}`
          )
        })
      }
    }
  }
}
