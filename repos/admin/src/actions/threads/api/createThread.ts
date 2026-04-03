import type { Thread } from '@tdsk/domain'
import { threadsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertThread } from '@TAF/actions/threads/local/upsertThread'

export const createThread = async (
  orgId: string,
  agentId: string,
  data: Partial<Thread>,
  contextKey: string = 'org'
) => {
  const resp = await threadsApi.create(orgId, agentId, data)
  if (resp.error) return { error: resp.error }

  resp.data && upsertThread(contextKey, resp.data)
  resp.data && query.upsertListCache(threadsApi.cache.list(agentId), resp.data)

  return resp
}
