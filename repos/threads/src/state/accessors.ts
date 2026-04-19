import type { EThemeType } from '@TTH/types'
import type { TOpenSession } from '@TTH/types'
import type { User, Sandbox, Organization, Project, TRoleType } from '@tdsk/domain'

import { createStore } from 'jotai'
import { userState } from '@TTH/state/user'
import { themeTypeState, defThemeType } from '@TTH/state/theme'
import {
  defOrgId,
  orgIdState,
  defSidebarOpen,
  sidebarOpenState,
  defActiveOrgRole,
  defActiveProjectId,
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

export const store = createStore()

export const getThemeType = () => store.get(themeTypeState)
export const resetThemeType = () => store.set(themeTypeState, defThemeType)
export const setThemeType = (type: EThemeType) => store.set(themeTypeState, type)

export const getSidebarOpen = () => store.get(sidebarOpenState)
export const resetSidebarOpen = () => store.set(sidebarOpenState, defSidebarOpen)
export const setSidebarOpen = (status: boolean) => store.set(sidebarOpenState, status)

export const getOrgId = () => store.get(orgIdState)
export const resetOrgId = () => store.set(orgIdState, defOrgId)
export const setOrgId = (orgId: string) => store.set(orgIdState, orgId)

export const getActiveOrgRole = () => store.get(activeOrgRoleState)
export const resetActiveOrgRole = () => store.set(activeOrgRoleState, defActiveOrgRole)
export const setActiveOrgRole = (role: TRoleType | null) =>
  store.set(activeOrgRoleState, role)

export const getUser = () => store.get(userState)
export const resetUser = () => store.set(userState, undefined)
export const setUser = (user: User) => store.set(userState, user)

export const getOpenSessions = () => store.get(openSessionsAtom)
export const setOpenSession = (sessionId: string, session: TOpenSession) => {
  const map = new Map(store.get(openSessionsAtom))
  map.set(sessionId, session)
  store.set(openSessionsAtom, map)
}
export const removeOpenSession = (sessionId: string) => {
  const map = new Map(store.get(openSessionsAtom))
  map.delete(sessionId)
  store.set(openSessionsAtom, map)
}

export const getActiveSession = () => store.get(activeSessionAtom)
export const setActiveSession = (sessionId: string | null) =>
  store.set(activeSessionAtom, sessionId)

export const getSessionsForSandbox = (sandboxId: string): TOpenSession[] => {
  const all = store.get(openSessionsAtom)
  const result: TOpenSession[] = []
  for (const session of all.values()) {
    if (session.sandboxId === sandboxId) result.push(session)
  }
  return result
}

export const getSandboxes = () => store.get(sandboxesAtom)
export const setSandboxes = (sandboxes: Sandbox[]) => store.set(sandboxesAtom, sandboxes)

export const getOrgs = () => store.get(orgsAtom)
export const setOrgs = (orgs: Organization[]) => store.set(orgsAtom, orgs)

export const getProjects = () => store.get(projectsAtom)
export const setProjects = (projects: Project[]) => store.set(projectsAtom, projects)

export const getActiveProjectId = () => store.get(activeProjectIdState)
export const resetActiveProjectId = () =>
  store.set(activeProjectIdState, defActiveProjectId)
export const setActiveProjectId = (projectId: string) =>
  store.set(activeProjectIdState, projectId)
