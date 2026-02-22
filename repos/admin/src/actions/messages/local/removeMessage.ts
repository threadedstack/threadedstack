import { getThreadMessages, setThreadMessages } from '@TAF/state/accessors'

export const removeMessage = (threadId: string, id: string) => {
  const current = getThreadMessages(threadId) || {}
  const { [id]: _, ...rest } = current
  setThreadMessages(threadId, rest)
}
