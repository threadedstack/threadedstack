import type { TActionPump } from './pump'
import type { TSessionManager } from './session'
import type { TResidentConfig } from './types/resident.types'

import { log } from './log'
import { CheckpointPrompt } from './constants'

export type TCompactorOpts = {
  session: TSessionManager
  getConfig: () => TResidentConfig
  pump: TActionPump
}

export type TCompactor = {
  /** True when the session's turn/byte counters crossed the configured thresholds. */
  shouldCompact: () => boolean
  /**
   * Run the checkpoint turn (durable memories + summary), pump its effects,
   * then rotate the session id so the next turn seeds a fresh session from the
   * summary. Also the rolling-restart/SIGTERM checkpoint path.
   */
  compact: () => Promise<{ compacted: boolean }>
}

/**
 * The compactor — this session's /compact discipline: at the context threshold
 * the session is INSTRUCTED to write durable memories and a summary, then the
 * runtime rotates to a fresh session seeded from that summary.
 */
export const createCompactor = (opts: TCompactorOpts): TCompactor => {
  const { session, pump, getConfig } = opts

  return {
    shouldCompact: () => {
      if (!session.hasSession()) return false
      const { maxTurns, maxBytes } = getConfig().compaction
      const { turnCount, totalBytes } = session.getState()
      return turnCount >= maxTurns || totalBytes >= maxBytes
    },

    compact: async () => {
      if (!session.hasSession()) return { compacted: false }

      log.info(`Compaction threshold reached — running checkpoint turn`)
      const result = await session.runTurn(CheckpointPrompt)

      // Durable memories the checkpoint emitted ride the normal pump
      await pump.pump(result.output)

      const summary = result.ok && result.output.trim().length ? result.output : undefined
      if (!summary)
        log.warn(
          `Checkpoint turn produced no usable summary (${result.error ?? `empty output`}) — rotating with empty seed`
        )

      session.rotateSession(summary)
      return { compacted: true }
    },
  }
}
