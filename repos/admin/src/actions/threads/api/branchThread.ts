import { Message } from '@tdsk/domain'
import { threadsApi } from '@TAF/services'
import { upsertThread } from '@TAF/actions/threads/local/upsertThread'
import { upsertMessages } from '@TAF/actions/messages/local/upsertMessages'

export type TBranchThreadOpts = {
  orgId: string
  agentId: string
  threadId: string
  messageId: string
}

export const branchThread = async (opts: TBranchThreadOpts) => {
  const { orgId, agentId, threadId, messageId } = opts
  const resp = await threadsApi.branch(orgId, agentId, threadId, messageId)
  if (resp.error) return { error: resp.error }

  if (resp.data) {
    upsertThread(resp.data)
    const messages = (resp.data as any).messages
    messages?.length && upsertMessages(messages.map((m: any) => new Message(m)))
  }

  return resp
}
