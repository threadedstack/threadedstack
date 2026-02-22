import { getContextThreads, setContextThreads } from '@TAF/state/accessors'

export const removeThread = (contextKey: string, id: string) => {
  const current = getContextThreads(contextKey) || {}
  const { [id]: _, ...rest } = current
  setContextThreads(contextKey, rest)
}
