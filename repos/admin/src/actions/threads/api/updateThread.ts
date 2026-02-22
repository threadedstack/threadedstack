import type { Thread } from '@tdsk/domain'
import { threadsApi } from '@TAF/services'
import { upsertThread } from '@TAF/actions/threads/local/upsertThread'

export const updateThread = async (
  orgId: string,
  agentId: string,
  id: string,
  data: Partial<Thread>,
  contextKey: string = 'org'
) => {
  const resp = await threadsApi.update(orgId, agentId, id, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertThread(contextKey, resp.data)

  return resp
}
