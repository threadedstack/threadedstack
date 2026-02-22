import type { Thread } from '@tdsk/domain'
import { getContextThreads, setContextThreads } from '@TAF/state/accessors'

export const upsertThreads = (contextKey: string, threads: Thread[]) => {
  const current = getContextThreads(contextKey) || {}
  const threadsMap = threads.reduce(
    (acc, thread) => {
      acc[thread.id] = thread
      return acc
    },
    {} as Record<string, Thread>
  )

  setContextThreads(contextKey, { ...current, ...threadsMap })
}
