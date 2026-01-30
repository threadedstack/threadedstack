import type { Thread } from '@tdsk/domain'
import { setThreads, getThreads } from '@TAF/state/accessors'

export const upsertThreads = (threads: Thread[]) => {
  const current = getThreads() || {}
  const threadsMap = threads.reduce(
    (acc, thread) => {
      acc[thread.id] = thread
      return acc
    },
    {} as Record<string, Thread>
  )

  setThreads({ ...current, ...threadsMap })
}
