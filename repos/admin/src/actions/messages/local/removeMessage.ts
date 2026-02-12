import { setMessages, getMessages } from '@TAF/state/accessors'

export const removeMessage = (id: string) => {
  const current = getMessages() || {}
  const { [id]: _, ...rest } = current
  setMessages(rest)
}
