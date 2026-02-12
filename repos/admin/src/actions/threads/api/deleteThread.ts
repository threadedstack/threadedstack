import { threadsApi } from '@TAF/services'
import { removeThread } from '@TAF/actions/threads/local/removeThread'

export const deleteThread = async (orgId: string, agentId: string, id: string) => {
  const resp = await threadsApi.delete(orgId, agentId, id)
  if (resp.error) return { error: resp.error }
  resp.data?.success && removeThread(id)

  return resp
}
