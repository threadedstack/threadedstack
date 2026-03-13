import type { Message } from '@tdsk/domain'
import { setThreadMessages } from '@TAF/state/accessors'

export const setMessages = (threadId: string, messages: Message[]) => {
  const map = Object.fromEntries(
    messages.map((message) => [message.id, message])
  ) as Record<string, Message>
  setThreadMessages(threadId, map)
}
