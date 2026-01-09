import type { Repo } from '@tdsk/domain'

import { reposApi } from '@TAF/services'
import { setRepos } from '@TAF/state/accessors'

export type TFetchReposResult = {
  repos?: Record<string, Repo>
  error?: Error
}

export type TFetchRepos = {
  teamId?: string
}

export const fetchRepos = async (opts?: TFetchRepos): Promise<TFetchReposResult> => {
  const resp = opts?.teamId
    ? await reposApi.listByTeam(opts?.teamId)
    : await reposApi.list()

  if (resp.error) return resp

  setRepos(resp.data)
  return { repos: resp.data }
}
