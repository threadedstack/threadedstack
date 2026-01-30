import { threadsApi } from '@TAF/services'
import { removeThread } from '@TAF/actions/threads/local/removeThread'

export const deleteThread = async (id: string) => {
  const resp = await threadsApi.delete(id)
  if (resp.error) return { error: resp.error }
  resp.data?.success && removeThread(id)

  return resp
}
