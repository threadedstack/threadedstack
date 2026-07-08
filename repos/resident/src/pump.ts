import type { TAgentAction } from '@tdsk/domain'
import type { TPumpReport, TResidentApi, TResidentConfig } from './types/resident.types'

import { log } from './log'
import {
  parseActionsBlock,
  MemoriesBlockFence,
  extractLastFencedBlock,
} from '@tdsk/domain'
import {
  DispatchMaxAttempts,
  DispatchRetryDelaysMs,
  DispatchMaxActionsPerCall,
} from './constants'

export type TActionPumpOpts = {
  api: TResidentApi
  getConfig: () => TResidentConfig
  chunkSize?: number
  maxAttempts?: number
  retryDelaysMs?: number[]
  /** Injectable backoff sleeper for tests. */
  sleepFn?: (ms: number) => Promise<void>
}

export type TActionPump = {
  /** Parse + dispatch every effect in one turn's output. */
  pump: (outputText: string) => Promise<TPumpReport>
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Extract ```tdsk-memories``` entries and convert them into `writeMemory`
 * dispatch actions when that Function name is configured. The platform side
 * (clamping, kind validation) belongs to the Function — the pump only drops
 * entries without a non-empty text.
 */
const extractMemoryActions = (
  text: string,
  writeMemoryFn: string | undefined
): { actions: TAgentAction[]; skipped: number } => {
  const block = extractLastFencedBlock(text, MemoriesBlockFence)
  if (block === undefined) return { actions: [], skipped: 0 }

  let parsed: unknown
  try {
    parsed = JSON.parse(block)
  } catch {
    return { actions: [], skipped: 0 }
  }
  if (!Array.isArray(parsed)) return { actions: [], skipped: 0 }

  const entries = parsed.filter(
    (raw): raw is Record<string, unknown> =>
      Boolean(raw) &&
      typeof raw === `object` &&
      typeof (raw as any).text === `string` &&
      (raw as any).text.trim().length > 0
  )
  if (!entries.length) return { actions: [], skipped: 0 }

  if (!writeMemoryFn) {
    // Config-driven, no platform assumption: without a configured writeMemory
    // Function the memories are logged and skipped, never silently dropped.
    log.warn(
      `Turn emitted ${entries.length} tdsk-memories entr${entries.length === 1 ? `y` : `ies`} but no functions.writeMemory is configured — skipping`
    )
    return { actions: [], skipped: entries.length }
  }

  return {
    skipped: 0,
    actions: entries.map((entry) => ({
      function: writeMemoryFn,
      args: {
        text: entry.text,
        ...(typeof entry.importance === `number` ? { importance: entry.importance } : {}),
        ...(typeof entry.kind === `string` ? { kind: entry.kind } : {}),
        ...(entry.meta && typeof entry.meta === `object` ? { meta: entry.meta } : {}),
      },
    })),
  }
}

/**
 * The action pump: parse ```tdsk-actions``` (the shared ② parser) +
 * ```tdsk-memories``` out of EVERY turn's output and POST them to the R1
 * dispatch endpoint immediately — chunked to the endpoint's 20-action cap,
 * retried with backoff on transport/5xx failures, every action's result
 * logged. 4xx responses are terminal (a malformed request never heals by
 * retrying).
 */
export const createActionPump = (opts: TActionPumpOpts): TActionPump => {
  const { api, getConfig } = opts
  const sleepFn = opts.sleepFn ?? defaultSleep
  const chunkSize = opts.chunkSize ?? DispatchMaxActionsPerCall
  const maxAttempts = opts.maxAttempts ?? DispatchMaxAttempts
  const retryDelaysMs = opts.retryDelaysMs ?? DispatchRetryDelaysMs

  const dispatchChunk = async (chunk: TAgentAction[]) => {
    let lastError: string | undefined
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0)
        await sleepFn(
          retryDelaysMs[attempt - 1] ?? retryDelaysMs[retryDelaysMs.length - 1] ?? 1000
        )

      const res = await api.dispatch(chunk)
      if (res.ok) return res

      lastError = res.error ?? `status ${res.status}`
      // Client errors are terminal; transport (status 0) and 5xx retry
      if (res.status >= 400 && res.status < 500) break
      log.warn(
        `Dispatch attempt ${attempt + 1}/${maxAttempts} failed (${lastError}) — ${
          attempt + 1 < maxAttempts ? `retrying` : `giving up`
        }`
      )
    }
    return { ok: false as const, status: 0, error: lastError }
  }

  return {
    pump: async (outputText: string): Promise<TPumpReport> => {
      const config = getConfig()
      const actions = parseActionsBlock(outputText)
      const memories = extractMemoryActions(outputText, config.functions?.writeMemory)
      const all = [...actions, ...memories.actions]

      const report: TPumpReport = {
        total: all.length,
        dispatched: 0,
        failed: 0,
        allowlistRejected: 0,
        memoriesSkipped: memories.skipped,
      }
      if (!all.length) return report

      for (let i = 0; i < all.length; i += chunkSize) {
        const chunk = all.slice(i, i + chunkSize)
        const res = await dispatchChunk(chunk)

        if (!res.ok || !res.data) {
          report.failed += chunk.length
          log.error(
            `Dispatch failed for ${chunk.length} action(s): ${res.error ?? `unknown`}`
          )
          continue
        }

        chunk.forEach((action, idx) => {
          const result = res.data?.[idx]
          if (result?.ok) {
            report.dispatched += 1
            log.info(`Dispatched action ${action.function}`)
          } else {
            report.failed += 1
            const error = result?.error ?? `no result returned`
            if (/not allowed/i.test(error)) report.allowlistRejected += 1
            log.warn(`Action ${action.function} rejected: ${error}`)
          }
        })
      }

      return report
    },
  }
}
