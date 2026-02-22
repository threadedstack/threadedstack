import type { Message } from '@tdsk/domain'
import { getThreadMessages, setThreadMessages } from '@TAF/state/accessors'

export const upsertMessages = (threadId: string, messages: Message[]) => {
  const current = getThreadMessages(threadId) || {}
  const messagesMap = messages.reduce(
    (acc, message) => {
      acc[message.id] = message
      return acc
    },
    {} as Record<string, Message>
  )
  setThreadMessages(threadId, { ...current, ...messagesMap })
}
