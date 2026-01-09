import { reposApi } from '@TAF/services'
import { setRepos, getRepos } from '@TAF/state/accessors'

export type TDeleteRepoResult = {
  success?: boolean
  error?: Error
}

export const deleteRepo = async (repoId: string): Promise<TDeleteRepoResult> => {
  const resp = await reposApi.delete(repoId)

  if (resp.error) {
    return { error: resp.error }
  }

  // Remove repo from state
  const currentRepos = getRepos() || {}
  const { [repoId]: deleted, ...remainingRepos } = currentRepos
  setRepos(remainingRepos)

  return { success: true }
}
