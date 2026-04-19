import type { atomWithReset } from 'jotai/utils'
import type { TOpenSession } from '@TTH/types'
import type { TViewportMode } from '@TTH/ast'

import { useMemo } from 'react'
import { useResetAtom } from 'jotai/utils'
import { userState } from '@TTH/state/user'
import { useAtom, useAtomValue } from 'jotai'
import { sessionModeAtom } from '@TTH/state/gui'
import { themeTypeState } from '@TTH/state/theme'
import {
  orgIdState,
  activeOrgState,
  sidebarOpenState,
  activeProjectState,
  activeOrgRoleState,
  activeProjectIdState,
} from '@TTH/state/app'
import {
  orgsAtom,
  projectsAtom,
  sandboxesAtom,
  openSessionsAtom,
  activeSessionAtom,
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
export const useActiveOrgRole = () => useRecState(activeOrgRoleState)

export const useSessionMode = (sessionId: string): TViewportMode => {
  const modeMap = useAtomValue(sessionModeAtom)
  return modeMap.get(sessionId) ?? `idle`
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

export const useSandboxMode = (sandboxId: string): TViewportMode => {
  const sessions = useSessionsForSandbox(sandboxId)
  const modeMap = useAtomValue(sessionModeAtom)
  for (const session of sessions) {
    const mode = modeMap.get(session.sessionId)
    if (mode && mode !== `idle`) return mode
  }
  return `idle`
}
