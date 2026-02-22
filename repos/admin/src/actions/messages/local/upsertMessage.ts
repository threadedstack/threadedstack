import type { Message } from '@tdsk/domain'
import { getThreadMessages, setThreadMessages } from '@TAF/state/accessors'

export const upsertMessage = (threadId: string, message: Message) => {
  const current = getThreadMessages(threadId) || {}
  setThreadMessages(threadId, { ...current, [message.id]: message })
}
