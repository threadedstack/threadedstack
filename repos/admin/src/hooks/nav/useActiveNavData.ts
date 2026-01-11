import { useMemo } from 'react'
import {
  useTeams,
  useRepos,
  useActiveTeamId,
  useActiveRepoId,
} from '@TAF/state/selectors'

export const useActiveNavData = () => {
  const [teams] = useTeams()
  const [repos] = useRepos()
  const [activeTeamId] = useActiveTeamId()
  const [activeRepoId] = useActiveRepoId()

  return useMemo(
    () => ({
      teamId: activeTeamId,
      team: activeTeamId && teams?.[activeTeamId],
      repoId: activeRepoId,
      repo: activeRepoId && repos?.[activeRepoId],
    }),
    [teams, repos, activeTeamId, activeRepoId]
  )
}
