import type { Repo } from '@tdsk/domain'

import { reposApi } from '@TAF/services'
import { setRepos, getRepos } from '@TAF/state/accessors'

export type TFetchRepoResult = {
  repo?: Repo
  error?: Error
}

export const fetchRepo = async (repoId: string): Promise<TFetchRepoResult> => {
  const resp = await reposApi.get(repoId)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update repos state with the fetched repo
    const currentRepos = getRepos() || {}
    setRepos({ ...currentRepos, [resp.data.id]: resp.data })
  }

  return { repo: resp.data }
}
