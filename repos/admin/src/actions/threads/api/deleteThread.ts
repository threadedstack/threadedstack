import { threadsApi } from '@TAF/services'
import { removeThread } from '@TAF/actions/threads/local/removeThread'

export const deleteThread = async (
  orgId: string,
  agentId: string,
  id: string,
  contextKey: string = 'org'
) => {
  const resp = await threadsApi.delete(orgId, agentId, id)
  if (resp.error) return { error: resp.error }
  resp.data?.success && removeThread(contextKey, id)

  return resp
}
