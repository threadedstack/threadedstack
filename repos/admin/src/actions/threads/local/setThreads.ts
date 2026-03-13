import type { Thread } from '@tdsk/domain'
import { setContextThreads } from '@TAF/state/accessors'

export const setThreads = (contextKey: string, threads: Thread[]) => {
  setContextThreads(contextKey, Object.fromEntries(threads.map((t) => [t.id, t])))
}
