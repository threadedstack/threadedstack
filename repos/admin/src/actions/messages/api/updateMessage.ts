import { messagesApi } from '@TAF/services'
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
  resp.data && upsertMessage(resp.data)

  return resp
}
