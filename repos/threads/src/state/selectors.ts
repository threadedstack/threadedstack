import type { atomWithReset } from 'jotai/utils'
import type { TToolState } from '@tdsk/domain'

import { useAtom, useAtomValue } from 'jotai'
import { useResetAtom } from 'jotai/utils'
import { userState } from '@TTH/state/user'
import { themeTypeState } from '@TTH/state/theme'
import {
  sidebarOpenState,
  orgIdState,
  activeProjectIdState,
  activeOrgState,
  activeProjectState,
} from '@TTH/state/app'
import {
  sessionEventsAtom,
  sessionToolStateAtom,
  openSessionsAtom,
  activeSessionAtom,
  sandboxesAtom,
  orgsAtom,
  projectsAtom,
} from '@TTH/state/sessions'

const useRecState = <T = any>(state: ReturnType<typeof atomWithReset<T>>) => {
  const [current, setCurrent] = useAtom(state)
  const resetCurrent = useResetAtom(state)

  return [current, setCurrent, resetCurrent] as [
    T,
    typeof setCurrent,
    typeof resetCurrent,
  ]
}

export const useUser = () => useRecState(userState)
export const useThemeType = () => useRecState(themeTypeState)
export const useSidebarOpen = () => useRecState(sidebarOpenState)
export const useOrgId = () => useRecState(orgIdState)[0]

export const useSessionEvents = (sandboxId: string) => {
  const [eventsMap] = useRecState(sessionEventsAtom)
  return eventsMap.get(sandboxId) ?? []
}

export const useToolState = (sandboxId: string) => {
  const [stateMap] = useRecState(sessionToolStateAtom)
  return stateMap.get(sandboxId) ?? ('idle' as TToolState)
}

export const useOpenSessions = () => useRecState(openSessionsAtom)[0]
export const useActiveSession = () => useRecState(activeSessionAtom)[0]
export const useSandboxes = () => useRecState(sandboxesAtom)[0]
export const useOrgs = () => useRecState(orgsAtom)[0]
export const useProjects = () => useRecState(projectsAtom)[0]

export const useActiveOrgId = () => useRecState(orgIdState)
export const useActiveOrg = () => useAtomValue(activeOrgState)
export const useActiveProjectId = () => useRecState(activeProjectIdState)
export const useActiveProject = () => useAtomValue(activeProjectState)
