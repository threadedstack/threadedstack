/**
 * Minimal stdout logger. The resident runtime is the pod's MAIN process — its
 * stdout IS the pod log stream — so a timestamped console wrapper is the whole
 * logging story (no winston: the runtime ships as one small self-contained
 * bundle run by bare `node`).
 */

export type TResidentLog = {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

const stamp = () => new Date().toISOString()

export const log: TResidentLog = {
  info: (...args) => console.log(`[${stamp()}] [resident]`, ...args),
  warn: (...args) => console.warn(`[${stamp()}] [resident]`, ...args),
  error: (...args) => console.error(`[${stamp()}] [resident]`, ...args),
  debug: (...args) => {
    if (process.env.TDSK_RESIDENT_DEBUG)
      console.log(`[${stamp()}] [resident:debug]`, ...args)
  },
}
