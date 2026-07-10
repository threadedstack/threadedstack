import type { TDatabase } from '@tdsk/database'
import type {
  ISandbox,
  TRecordQuery,
  TFunctionRequest,
  TFunctionContext,
  TScanContentInput,
  TTaskSourceSignal,
  IRecordsCapability,
  TFunctionExecResult,
} from '@tdsk/domain'

import { transform } from 'esbuild'
import { logger } from '@TBE/utils/logger'
import { buildConnectorBridges, connectContextCode } from './connectorCapability'
import { scanTaskProposal } from '@TBE/utils/agent/taskScan'
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
  /**
   * Host-side db handle used to build the Function's project-scoped `records`
   * capability. It stays entirely host-side — it is NEVER serialized into, set
   * on, or otherwise crossed into the V8 isolate. When present, the executor
   * exposes `context.records` to the handler via a platform-mediated bridge —
   * and, because that is when the bridge surface exists at all, the
   * dependency-free `context.scan` capability rides along with it.
   */
  db?: TDatabase
  /**
   * Endpoint refs (id or name) this execution may reach via `context.connect`.
   * Fail-closed: absent/empty means NO connector access. The caller (the agent
   * invoke path) supplies the grant — authorship of a Function does not by itself
   * confer access to any project endpoint.
   */
  connectEndpoints?: string[]
}

/** Bridge-callback names exposed to the isolate for the records capability. */
const RecordsBridge = {
  get: `records.get`,
  query: `records.query`,
  count: `records.count`,
  delete: `records.delete`,
  upsert: `records.upsert`,
} as const

/**
 * Build the project-scoped records capability from the host db service. Runs
 * entirely host-side; each method resolves + operates within the Function's own
 * project, so a Function can only read/write its own project's collections.
 */
const createRecordsCapability = (
  db: TDatabase,
  projectId: string
): IRecordsCapability => ({
  query: async (collection, query) => {
    const { data, error } = await db.services.record.query(
      projectId,
      collection,
      query ?? {}
    )
    if (error) throw new Error(`records.query failed: ${error.message}`)
    return (data ?? []).map((rec) => ({
      id: rec.id,
      data: rec.data as Record<string, unknown>,
    }))
  },
  get: async (collection, id) => {
    const { data, error } = await db.services.record.get(projectId, collection, id)
    if (error) throw new Error(`records.get failed: ${error.message}`)
    return data ? { id: data.id, data: data.data as Record<string, unknown> } : null
  },
  upsert: async (collection, record) => {
    const { data, error } = await db.services.record.upsert(projectId, collection, record)
    if (error || !data)
      throw new Error(`records.upsert failed: ${error?.message ?? `unknown`}`)
    return { id: data.id }
  },
  delete: async (collection, id) => {
    const { data, error } = await db.services.record.delete(projectId, collection, id)
    if (error) throw new Error(`records.delete failed: ${error.message}`)
    return { deleted: Boolean(data) }
  },
  // The Phase-1 record service counts a collection's total; the query arg is
  // accepted for API symmetry but not filtered (filtered count is not offered
  // by the underlying service).
  count: async (collection) => {
    const { data, error } = await db.services.record.count(projectId, collection)
    if (error) throw new Error(`records.count failed: ${error.message}`)
    return data ?? 0
  },
})

/**
 * Wrap the project-scoped records capability as JSON-marshalling host bridges.
 * The isolate invokes each bridge with a JSON args array and receives a JSON
 * result — the only thing that crosses the boundary is serialized data, never
 * the db handle or the live capability object.
 */
const buildRecordsBridges = (
  db: TDatabase,
  projectId: string
): Record<string, (argsJson: string) => Promise<string>> => {
  const records = createRecordsCapability(db, projectId)
  return {
    [RecordsBridge.query]: async (argsJson) => {
      const [collection, query] = JSON.parse(argsJson) as [string, TRecordQuery?]
      return JSON.stringify(await records.query(collection, query))
    },
    [RecordsBridge.get]: async (argsJson) => {
      const [collection, id] = JSON.parse(argsJson) as [string, string]
      return JSON.stringify(await records.get(collection, id))
    },
    [RecordsBridge.upsert]: async (argsJson) => {
      const [collection, record] = JSON.parse(argsJson) as [
        string,
        { id?: string; data: Record<string, unknown> },
      ]
      return JSON.stringify(await records.upsert(collection, record))
    },
    [RecordsBridge.delete]: async (argsJson) => {
      const [collection, id] = JSON.parse(argsJson) as [string, string]
      return JSON.stringify(await records.delete(collection, id))
    },
    [RecordsBridge.count]: async (argsJson) => {
      const [collection, query] = JSON.parse(argsJson) as [string, TRecordQuery?]
      return JSON.stringify(await records.count(collection, query))
    },
  }
}

/** Bridge-callback names exposed to the isolate for the scan capability. */
const ScanBridge = {
  content: `scan.content`,
} as const

/**
 * Wrap the deterministic content scanner as a JSON-marshalling host bridge.
 * The bridge runs the REAL `scanTaskProposal` engine host-side (fail-closed
 * text scan over title/description/evidence/sourceSignal); only the JSON input
 * and the JSON verdict cross the isolate boundary — never the rules/regexes.
 * The scanner is pure and dependency-free (no db, no I/O), so the bridge needs
 * no host handles: it can be injected whenever bridges are built.
 */
const buildScanBridges = (): Record<string, (argsJson: string) => Promise<string>> => ({
  [ScanBridge.content]: async (argsJson) => {
    const [input] = JSON.parse(argsJson) as [TScanContentInput?]
    return JSON.stringify(
      scanTaskProposal({
        title: input?.title ?? ``,
        description: input?.description ?? ``,
        evidence: input?.evidence ?? ``,
        // The scanner only ever joins sourceSignal into the text it scans —
        // the enum constraint on proposals is irrelevant to scanning, so the
        // capability accepts arbitrary text for it.
        sourceSignal: (input?.sourceSignal ?? ``) as TTaskSourceSignal,
      })
    )
  },
})

/**
 * Reconstruct `context.scan` inside the isolate from the `__hostCall` host
 * bridge — same marshalling shape as `recordsContextCode`: JSON args out, JSON
 * verdict back. Only emitted when the scan bridge is passed in.
 */
const scanContextCode = `context.scan = (() => {
  const call = (name, args) => __hostCall(name, JSON.stringify(args)).then((r) => JSON.parse(r));
  return {
    content: (input) => call('${ScanBridge.content}', [input]),
  };
})();`

/**
 * Reconstruct `context.records` inside the isolate from the `__hostCall` host
 * bridge. Each method marshals a JSON args array out through the bridge and
 * parses the JSON result back — the isolate never touches a db handle. Only
 * emitted when a records capability is bridged in (backward compatible).
 */
const recordsContextCode = `context.records = (() => {
  const call = (name, args) => __hostCall(name, JSON.stringify(args)).then((r) => JSON.parse(r));
  return {
    query: (collection, query) => call('${RecordsBridge.query}', [collection, query]),
    get: (collection, id) => call('${RecordsBridge.get}', [collection, id]),
    upsert: (collection, record) => call('${RecordsBridge.upsert}', [collection, record]),
    delete: (collection, id) => call('${RecordsBridge.delete}', [collection, id]),
    count: (collection, query) => call('${RecordsBridge.count}', [collection, query]),
  };
})();`

/**
 * Build the wrapper code that imports the user function module,
 * calls the handler with the serialized input, and exports the result.
 */
const buildWrapperCode = (
  request: TFunctionRequest,
  context: TFunctionContext,
  withRecords = false,
  withScan = false,
  withConnect = false
): string => {
  const requestJson = JSON.stringify(request)
  const contextJson = JSON.stringify(context)

  return `import handler from 'function';
const request = JSON.parse(${JSON.stringify(requestJson)});
const context = JSON.parse(${JSON.stringify(contextJson)});
${withRecords ? `${recordsContextCode}\n` : ``}${withScan ? `${scanContextCode}\n` : ``}${withConnect ? `${connectContextCode}\n` : ``}let output;
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

      // Build the host-bridge surface (only when a db handle is supplied and the
      // function is project-scoped). The records bridge closures keep the db
      // handle host-side; the scan bridge is dependency-free and rides along
      // whenever the surface is built — only callback refs + JSON payloads cross
      // into the isolate. The bridgeless path stays byte-identical.
      // `connect` rides the same db-gated bridge surface, but ONLY when the
      // caller granted endpoints (fail-closed) — so it is inert for every
      // existing Function/caller that passes no connectEndpoints.
      const withConnect = Boolean(
        opts?.db && func.projectId && opts?.connectEndpoints?.length
      )
      const bridges =
        opts?.db && func.projectId
          ? {
              ...buildRecordsBridges(opts.db, func.projectId),
              ...buildScanBridges(),
              ...(withConnect
                ? buildConnectorBridges(opts.db, func.projectId, opts.connectEndpoints!)
                : {}),
            }
          : undefined

      // 3. Build wrapper that imports 'function' module and calls handler
      const wrapperCode = buildWrapperCode(
        opts?.request || {},
        opts?.context || {},
        Boolean(bridges),
        Boolean(bridges),
        withConnect
      )

      // 4. Evaluate via V8 isolate with function code registered as module
      const evalResult = await sandbox.evaluate(wrapperCode, {
        timeout: opts?.timeout || DefaultTimeoutMS,
        modules: { function: code },
        ...(bridges ? { bridges } : {}),
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
