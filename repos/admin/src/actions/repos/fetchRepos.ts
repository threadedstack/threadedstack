import type { Repo } from '@tdsk/domain'

import { reposApi } from '@TAF/services'
import { setRepos } from '@TAF/state/accessors'

export type TFetchReposResult = {
  repos?: Record<string, Repo>
  error?: Error
}

export type TFetchRepos = {
  orgId?: string
}

export const fetchRepos = async (opts?: TFetchRepos): Promise<TFetchReposResult> => {
  const resp = opts?.orgId ? await reposApi.listByOrg(opts?.orgId) : await reposApi.list()

  if (resp.error) return resp

  setRepos(resp.data)
  return { repos: resp.data }
}
