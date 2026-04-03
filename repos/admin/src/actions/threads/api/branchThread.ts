import { Message } from '@tdsk/domain'
import { threadsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertThread } from '@TAF/actions/threads/local/upsertThread'
import { upsertMessages } from '@TAF/actions/messages/local/upsertMessages'

export type TBranchThreadOpts = {
  orgId: string
  agentId: string
  threadId: string
  messageId: string
  contextKey?: string
}

export const branchThread = async (opts: TBranchThreadOpts) => {
  const { orgId, agentId, threadId, messageId, contextKey = 'org' } = opts
  const resp = await threadsApi.branch(orgId, agentId, threadId, messageId)
  if (resp.error) return { error: resp.error }

  if (resp.data) {
    upsertThread(contextKey, resp.data)
    query.upsertListCache(threadsApi.cache.list(agentId), resp.data)
    const messages = (resp.data as any).messages
    if (messages?.length) {
      upsertMessages(
        resp.data.id,
        messages.map((m: any) => new Message(m))
      )
    }
  }

  return resp
}
