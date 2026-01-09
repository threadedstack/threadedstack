import type { Repo } from '@tdsk/domain'

import { reposApi } from '@TAF/services'
import { setRepos, getRepos } from '@TAF/state/accessors'

export type TCreateRepoInput = {
  name: string
  teamId: string
  gitUrl?: string
  branch?: string
}

export type TCreateRepoResult = {
  repo?: Repo
  error?: Error
}

export const createRepo = async (input: TCreateRepoInput): Promise<TCreateRepoResult> => {
  const resp = await reposApi.create(input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update repos state with the new repo
    const currentRepos = getRepos() || {}
    setRepos({ ...currentRepos, [resp.data.id]: resp.data })
  }

  return { repo: resp.data }
}
