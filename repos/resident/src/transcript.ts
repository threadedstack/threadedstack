import type { TResidentApi, TResidentConfig } from './types/resident.types'

import { log } from './log'
import { TranscriptFieldMaxChars } from './constants'

export type TTranscriptOpts = {
  api: TResidentApi
  getConfig: () => TResidentConfig
  maxChars?: number
}

export type TTranscriptEntry = {
  /** The turn's trigger, e.g. `agenda:board-meeting`. */
  event: string
  input: string
  output: string
}

export type TTranscript = {
  append: (entry: TTranscriptEntry) => Promise<void>
}

/**
 * Turn observability: append each turn's in/out to the agent's continuity
 * thread through the `appendTranscript` Function named in config. Config-driven
 * like every housekeeping surface — unconfigured means skipped with a debug
 * line, and a failed append never fails the turn.
 */
export const createTranscript = (opts: TTranscriptOpts): TTranscript => {
  const maxChars = opts.maxChars ?? TranscriptFieldMaxChars
  let warnedUnconfigured = false

  const tailCap = (text: string) =>
    text.length > maxChars ? text.slice(-maxChars) : text

  return {
    append: async (entry: TTranscriptEntry) => {
      const fnName = opts.getConfig().functions?.appendTranscript
      if (!fnName) {
        if (!warnedUnconfigured) {
          warnedUnconfigured = true
          log.debug(
            `No functions.appendTranscript configured — transcript writes skipped`
          )
        }
        return
      }

      const res = await opts.api.dispatch([
        {
          function: fnName,
          args: {
            event: entry.event,
            input: tailCap(entry.input),
            output: tailCap(entry.output),
            at: new Date().toISOString(),
          },
        },
      ])
      if (!res.ok) log.warn(`Transcript dispatch failed: ${res.error ?? res.status}`)
      else if (res.data?.[0] && !res.data[0].ok)
        log.warn(`Transcript append rejected: ${res.data[0].error}`)
    },
  }
}
