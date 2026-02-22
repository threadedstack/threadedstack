import type { Thread } from '@tdsk/domain'
import { getContextThreads, setContextThreads } from '@TAF/state/accessors'

export const upsertThread = (contextKey: string, thread: Thread) => {
  const current = getContextThreads(contextKey) || {}
  setContextThreads(contextKey, { ...current, [thread.id]: thread })
}
