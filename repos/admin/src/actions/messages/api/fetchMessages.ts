import { messagesApi } from '@TAF/services'
import { upsertMessages } from '@TAF/actions/messages/local/upsertMessages'

export type TFetchMessagesOpts = {
  orgId: string
  agentId: string
  threadId: string
}

export const fetchMessages = async (opts: TFetchMessagesOpts) => {
  const { orgId, agentId, threadId } = opts
  const resp = await messagesApi.listByThread(orgId, agentId, threadId)
  if (resp.error) return { error: resp.error }
  upsertMessages(resp.data)

  return resp
}
