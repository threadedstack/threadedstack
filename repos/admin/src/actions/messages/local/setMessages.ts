import type { Message } from '@tdsk/domain'
import { setThreadMessages } from '@TAF/state/accessors'

export const setMessages = (threadId: string, messages: Message[]) => {
  const map = messages.reduce(
    (acc, message) => {
      acc[message.id] = message
      return acc
    },
    {} as Record<string, Message>
  )
  setThreadMessages(threadId, map)
}
