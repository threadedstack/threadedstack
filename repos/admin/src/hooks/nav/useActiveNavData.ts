import { useMemo } from 'react'
import { useOrgs, useRepos, useActiveOrgId, useActiveRepoId } from '@TAF/state/selectors'

export const useActiveNavData = () => {
  const [orgs] = useOrgs()
  const [repos] = useRepos()
  const [activeOrgId] = useActiveOrgId()
  const [activeRepoId] = useActiveRepoId()

  return useMemo(
    () => ({
      orgId: activeOrgId,
      org: activeOrgId && orgs?.[activeOrgId],
      repoId: activeRepoId,
      repo: activeRepoId && repos?.[activeRepoId],
    }),
    [orgs, repos, activeOrgId, activeRepoId]
  )
}
