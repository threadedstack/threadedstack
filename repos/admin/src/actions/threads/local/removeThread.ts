import { setThreads, getThreads } from '@TAF/state/accessors'

export const removeThread = (id: string) => {
  const current = getThreads() || {}
  const { [id]: _, ...rest } = current
  setThreads(rest)
}
