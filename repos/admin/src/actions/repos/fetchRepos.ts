import type { Repo } from '@tdsk/domain'

import { reposApi } from '@TAF/services'
import { setRepos } from '@TAF/state/accessors'

export type TFetchReposResult = {
  repos?: Record<string, Repo>
  error?: Error
}

export const fetchRepos = async (): Promise<TFetchReposResult> => {
  const resp = await reposApi.list()

  if (resp.error) {
    return { error: resp.error }
  }

  const reposMap =
    resp.data?.reduce((acc: Record<string, Repo>, repo: Repo) => {
      acc[repo.id] = repo
      return acc
    }, {}) || {}

  setRepos(reposMap)
  return { repos: reposMap }
}
