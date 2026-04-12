import type { atomWithReset } from 'jotai/utils'
import type { TToolState } from '@tdsk/domain'
import type { TOpenSession } from '@TTH/types'

import { useMemo } from 'react'
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

export const useSessionEvents = (sessionId: string) => {
  const [eventsMap] = useRecState(sessionEventsAtom)
  return eventsMap.get(sessionId) ?? []
}

export const useToolState = (sessionId: string) => {
  const [stateMap] = useRecState(sessionToolStateAtom)
  return stateMap.get(sessionId) ?? ('idle' as TToolState)
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

export const useSessionsForSandbox = (sandboxId: string): TOpenSession[] => {
  const [sessions] = useRecState(openSessionsAtom)
  return useMemo(() => {
    const result: TOpenSession[] = []
    for (const session of sessions.values()) {
      if (session.sandboxId === sandboxId) result.push(session)
    }
    return result
  }, [sessions, sandboxId])
}

export const useSandboxHasSession = (sandboxId: string): boolean => {
  const sessions = useSessionsForSandbox(sandboxId)
  return sessions.length > 0
}

export const useSandboxToolState = (sandboxId: string): TToolState => {
  const sessions = useSessionsForSandbox(sandboxId)
  const [stateMap] = useRecState(sessionToolStateAtom)
  for (const session of sessions) {
    const state = stateMap.get(session.sessionId)
    if (state && state !== `idle`) return state
  }
  return `idle` as TToolState
}
