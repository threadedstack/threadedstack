import type { Thread } from '@tdsk/domain'
import { setContextThreads } from '@TAF/state/accessors'

export const setThreads = (contextKey: string, threads: Thread[]) => {
  const map = threads.reduce(
    (acc, thread) => {
      acc[thread.id] = thread
      return acc
    },
    {} as Record<string, Thread>
  )

  setContextThreads(contextKey, map)
}
