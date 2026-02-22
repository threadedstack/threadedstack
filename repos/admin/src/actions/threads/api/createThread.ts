import type { Thread } from '@tdsk/domain'
import { threadsApi } from '@TAF/services'
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

  return resp
}
