import type { Thread } from '@tdsk/domain'
import { getContextThreads, setContextThreads } from '@TAF/state/accessors'

export const upsertThreads = (contextKey: string, threads: Thread[]) => {
  const current = getContextThreads(contextKey) || {}
  setContextThreads(contextKey, {
    ...current,
    ...Object.fromEntries(threads.map((t) => [t.id, t])),
  })
}
