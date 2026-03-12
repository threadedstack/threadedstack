import type { Message } from '@tdsk/domain'
import { getThreadMessages, setThreadMessages } from '@TAF/state/accessors'

export const upsertMessages = (threadId: string, messages: Message[]) => {
  const current = getThreadMessages(threadId) || {}
  const messagesMap = Object.fromEntries(
    messages.map((message) => [message.id, message])
  ) as Record<string, Message>
  setThreadMessages(threadId, { ...current, ...messagesMap })
}
