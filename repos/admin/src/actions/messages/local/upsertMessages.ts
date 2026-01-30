import type { Message } from '@tdsk/domain'

import { setMessages, getMessages } from '@TAF/state/accessors'

export const upsertMessages = (messages: Message[]) => {
  const currentMessages = getMessages() || {}
  const messagesMap = messages.reduce(
    (acc, message) => {
      acc[message.id] = message
      return acc
    },
    {} as Record<string, Message>
  )
  setMessages({ ...currentMessages, ...messagesMap })
}
