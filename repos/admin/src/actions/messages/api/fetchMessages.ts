import { messagesApi } from '@TAF/services'
import { upsertMessages } from '@TAF/actions/messages/local/upsertMessages'

export const fetchMessages = async (data?: Record<string, any>) => {
  const resp = await messagesApi.list(data)
  if (resp.error) return { error: resp.error }
  upsertMessages(resp.data)

  return resp
}
