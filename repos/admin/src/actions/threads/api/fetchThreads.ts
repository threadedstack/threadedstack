import { threadsApi } from '@TAF/services'
import { upsertThreads } from '@TAF/actions/threads/local/upsertThreads'

// TODO: add type for data argument
export const fetchThreads = async (data?: Record<string, any>) => {
  const resp = await threadsApi.list(data)
  if (resp.error) return { error: resp.error }
  upsertThreads(resp.data)

  return resp
}
