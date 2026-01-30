import type { Thread } from '@tdsk/domain'
import { setThreads, getThreads } from '@TAF/state/accessors'

export const upsertThread = (thread: Thread) => {
  setThreads({ ...getThreads(), [thread.id]: thread })
}
