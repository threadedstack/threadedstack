import { messagesApi } from '@TAF/services'
import { setMessages } from '@TAF/actions/messages/local/setMessages'

export type TFetchMessagesOpts = {
  orgId: string
  agentId: string
  threadId: string
}

export const fetchMessages = async (opts: TFetchMessagesOpts) => {
  const { orgId, agentId, threadId } = opts
  const resp = await messagesApi.listByThread(orgId, agentId, threadId)
  if (resp.error) return { error: resp.error }
  resp.data && setMessages(threadId, resp.data)

  return resp
}
