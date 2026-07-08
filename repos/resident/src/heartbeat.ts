import type {
  TResidentApi,
  TResidentConfig,
  TResidentStatus,
} from './types/resident.types'

import { log } from './log'
import { HeartbeatIntervalMs } from './constants'

export type THeartbeatOpts = {
  api: TResidentApi
  getConfig: () => TResidentConfig
  getStatus: () => TResidentStatus
  intervalMs?: number
}

export type THeartbeat = {
  start: () => void
  stop: () => void
  /** One status write (also what the interval calls) — awaitable for tests. */
  beat: () => Promise<void>
}

/**
 * Periodic liveness + current-activity write, dispatched through the
 * `heartbeat` Function named in config (config-driven — an unconfigured
 * heartbeat is skipped with a debug line, never assumed). The watchdog (R3)
 * reads these to decide pod recreation.
 */
export const createHeartbeat = (opts: THeartbeatOpts): THeartbeat => {
  const intervalMs = opts.intervalMs ?? HeartbeatIntervalMs
  let timer: ReturnType<typeof setInterval> | undefined
  let warnedUnconfigured = false

  const beat = async () => {
    const fnName = opts.getConfig().functions?.heartbeat
    if (!fnName) {
      if (!warnedUnconfigured) {
        warnedUnconfigured = true
        log.debug(`No functions.heartbeat configured — heartbeat writes skipped`)
      }
      return
    }

    const status = opts.getStatus()
    const res = await opts.api.dispatch([{ function: fnName, args: { ...status } }])
    if (!res.ok) log.warn(`Heartbeat dispatch failed: ${res.error ?? res.status}`)
    else if (res.data?.[0] && !res.data[0].ok)
      log.warn(`Heartbeat rejected: ${res.data[0].error}`)
  }

  return {
    beat,
    start: () => {
      if (timer) return
      timer = setInterval(() => {
        void beat().catch((err) => log.error(`Heartbeat error:`, err))
      }, intervalMs)
      // Ref'd on purpose — see loop.ts: unref'd timers let the process exit.
    },
    stop: () => {
      if (timer) clearInterval(timer)
      timer = undefined
    },
  }
}
