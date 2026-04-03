import { messagesApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { removeMessage } from '@TAF/actions/messages/local/removeMessage'

export type TDeleteMessageOpts = {
  orgId: string
  agentId: string
  threadId: string
  messageId: string
}

export const deleteMessage = async (opts: TDeleteMessageOpts) => {
  const { orgId, agentId, threadId, messageId } = opts
  const resp = await messagesApi.delete(orgId, agentId, threadId, messageId)
  if (resp.error) return { error: resp.error }
  removeMessage(threadId, messageId)
  query.removeFromListCache(messagesApi.cache.byThread(threadId), messageId)
  query.client.removeQueries({ queryKey: messagesApi.cache.detail(messageId) })

  return resp
}
