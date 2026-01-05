import type { WritableAtom } from 'jotai'

import { useResetAtom } from 'jotai/utils'

import { useAtom } from 'jotai'
import { userState } from '@TAF/state/user'
import { sidebarOpenState } from '@TAF/state/app'
import { themeTypeState } from '@TAF/state/theme'
import { providersState } from '@TAF/state/providers'
import { teamsState, activeTeamIdState } from '@TAF/state/teams'
import { reposState, activeRepoIdState } from '@TAF/state/repos'

const useRecState = <T=any>(state:WritableAtom<T, unknown[], void>) => {
  const [current, setCurrent] = useAtom(state)
  const resetCurrent = useResetAtom(state)

  return [current, setCurrent, resetCurrent] as [T, typeof setCurrent, typeof resetCurrent]
}

export const useUser = () => useRecState(userState)
export const useProviders = () => useRecState(providersState)
export const useThemeType = () => useRecState(themeTypeState)
export const useSidebarOpen = () => useRecState(sidebarOpenState)
export const useTeams = () => useRecState(teamsState)
export const useActiveTeamId = () => useRecState(activeTeamIdState)
export const useRepos = () => useRecState(reposState)
export const useActiveRepoId = () => useRecState(activeRepoIdState)

