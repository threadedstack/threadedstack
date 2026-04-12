import type { User, Sandbox, Organization, Project } from '@tdsk/domain'
import type { EThemeType } from '@TTH/types'
import type { TParsedEvent, TToolState } from '@tdsk/domain'
import type { TOpenSession } from '@TTH/types'

import { createStore } from 'jotai'
import { userState } from '@TTH/state/user'
import { themeTypeState, defThemeType } from '@TTH/state/theme'
import {
  defSidebarOpen,
  sidebarOpenState,
  defOrgId,
  orgIdState,
  defActiveProjectId,
  activeProjectIdState,
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

export const getUser = () => store.get(userState)
export const resetUser = () => store.set(userState, undefined)
export const setUser = (user: User) => store.set(userState, user)

export const getSessionEvents = (sandboxId: string) =>
  store.get(sessionEventsAtom).get(sandboxId) ?? []
export const setSessionEvents = (sandboxId: string, events: TParsedEvent[]) => {
  const map = new Map(store.get(sessionEventsAtom))
  map.set(sandboxId, events)
  store.set(sessionEventsAtom, map)
}
export const appendSessionEvent = (sandboxId: string, event: TParsedEvent) => {
  const map = new Map(store.get(sessionEventsAtom))
  const events = [...(map.get(sandboxId) ?? []), event]
  map.set(sandboxId, events)
  store.set(sessionEventsAtom, map)
}

export const clearSessionEvents = (sandboxId: string) => {
  const map = new Map(store.get(sessionEventsAtom))
  map.delete(sandboxId)
  store.set(sessionEventsAtom, map)
}

export const getToolState = (sandboxId: string) =>
  store.get(sessionToolStateAtom).get(sandboxId) ?? 'idle'
export const setToolState = (sandboxId: string, state: TToolState) => {
  const map = new Map(store.get(sessionToolStateAtom))
  map.set(sandboxId, state)
  store.set(sessionToolStateAtom, map)
}

export const getOpenSessions = () => store.get(openSessionsAtom)
export const setOpenSession = (sandboxId: string, session: TOpenSession) => {
  const map = new Map(store.get(openSessionsAtom))
  map.set(sandboxId, session)
  store.set(openSessionsAtom, map)
}
export const removeOpenSession = (sandboxId: string) => {
  const map = new Map(store.get(openSessionsAtom))
  map.delete(sandboxId)
  store.set(openSessionsAtom, map)
}

export const getActiveSession = () => store.get(activeSessionAtom)
export const setActiveSession = (sandboxId: string | null) =>
  store.set(activeSessionAtom, sandboxId)

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
