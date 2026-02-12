import { threadsApi } from '@TAF/services'
import { upsertThreads } from '@TAF/actions/threads/local/upsertThreads'

export type TFetchThreadsOpts = {
  orgId: string
  agentId: string
}

export const fetchThreads = async (opts: TFetchThreadsOpts) => {
  const { orgId, agentId } = opts
  const resp = await threadsApi.list(orgId, agentId)
  if (resp.error) return { error: resp.error }
  upsertThreads(resp.data)

  return resp
}
