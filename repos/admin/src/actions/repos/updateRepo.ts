import type { Repo } from '@tdsk/domain'

import { reposApi } from '@TAF/services'
import { setRepos, getRepos } from '@TAF/state/accessors'

export type TUpdateRepoInput = {
  name?: string
  gitUrl?: string
  branch?: string
  meta?: Record<string, any>
}

export type TUpdateRepoResult = {
  repo?: Repo
  error?: Error
}

export const updateRepo = async (
  id: string,
  input: TUpdateRepoInput
): Promise<TUpdateRepoResult> => {
  const resp = await reposApi.update(id, input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update repos state with the updated repo
    const currentRepos = getRepos() || {}
    setRepos({ ...currentRepos, [resp.data.id]: resp.data })
  }

  return { repo: resp.data }
}
