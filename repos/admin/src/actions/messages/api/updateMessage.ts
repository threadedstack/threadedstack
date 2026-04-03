import { messagesApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertMessage } from '@TAF/actions/messages/local/upsertMessage'

export type TUpdateMessageOpts = {
  orgId: string
  agentId: string
  threadId: string
  messageId: string
  data: Record<string, any>
}

export const updateMessage = async (opts: TUpdateMessageOpts) => {
  const { orgId, agentId, threadId, messageId, data } = opts
  const resp = await messagesApi.update(orgId, agentId, threadId, messageId, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertMessage(threadId, resp.data)
  resp.data && query.upsertListCache(messagesApi.cache.byThread(threadId), resp.data)
  resp.data && query.updateDetailCache(messagesApi.cache.detail(messageId), resp.data)

  return resp
}
