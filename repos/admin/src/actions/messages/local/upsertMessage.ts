import type { Message } from '@tdsk/domain'

import { setMessages, getMessages } from '@TAF/state/accessors'

export const upsertMessage = (message: Message) => {
  setMessages({ ...getMessages(), [message.id]: message })
}
