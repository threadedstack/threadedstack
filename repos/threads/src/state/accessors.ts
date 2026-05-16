import type { SessionEngine } from '@TTH/services/gui/engine/sessionEngine'
import type {
  User,
  Sandbox,
  Project,
  TRoleType,
  Organization,
  TSandboxSession,
} from '@tdsk/domain'
import type {
  TDocument,
  TFeedEvent,
  EThemeType,
  TOpenSession,
  TViewportMode,
  TTerminalSettings,
} from '@TTH/types'

import { createStore } from 'jotai'
import { userState } from '@TTH/state/user'
import { storage } from '@TTH/services/storage'
import { terminalSettingsAtom } from '@TTH/state/terminal'
import { validateTerminal } from '@TTH/utils/terminal/validate'
import { themeTypeState, defThemeType } from '@TTH/state/theme'
import { DefaultTerminalSettings } from '@TTH/constants/terminal'
import { TerminalSettingsStorageKey } from '@TTH/constants/storage'
import { guiASTState, guiModeState, guiFeedState, guiEngineState } from '@TTH/state/gui'

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
  backendSessionsAtom,
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
export const resetOpenSessions = () => store.set(openSessionsAtom, new Map())
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
export const resetActiveSession = () => store.set(activeSessionAtom, null)
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
export const resetSandboxes = () => store.set(sandboxesAtom, [])
export const setSandboxes = (sandboxes: Sandbox[]) => store.set(sandboxesAtom, sandboxes)

export const getOrgs = () => store.get(orgsAtom)
export const resetOrgs = () => store.set(orgsAtom, [])
export const setOrgs = (orgs: Organization[]) => store.set(orgsAtom, orgs)

export const getProjects = () => store.get(projectsAtom)
export const resetProjects = () => store.set(projectsAtom, [])
export const setProjects = (projects: Project[]) => store.set(projectsAtom, projects)

export const getActiveProjectId = () => store.get(activeProjectIdState)
export const resetActiveProjectId = () =>
  store.set(activeProjectIdState, defActiveProjectId)
export const setActiveProjectId = (projectId: string) =>
  store.set(activeProjectIdState, projectId)

export const getTerminalSettings = () => store.get(terminalSettingsAtom)
export const resetTerminalSettings = () => {
  store.set(terminalSettingsAtom, DefaultTerminalSettings)
  storage.remove(TerminalSettingsStorageKey)
}
export const setTerminalSettings = (settings: TTerminalSettings) => {
  const validated = validateTerminal(settings)
  store.set(terminalSettingsAtom, validated)
  storage.set<TTerminalSettings>(TerminalSettingsStorageKey, validated)
}

export const getGuiAsts = () => store.get(guiASTState)
export const resetGuiAsts = () => store.set(guiASTState, new Map())
export const setGuiAsts = (asts: Map<string, TDocument>) => store.set(guiASTState, asts)
export const getGuiFeeds = () => store.get(guiFeedState)
export const resetGuiFeeds = () => store.set(guiFeedState, new Map())
export const setGuiFeeds = (feeds: Map<string, TFeedEvent[]>) =>
  store.set(guiFeedState, feeds)
export const getGuiModes = () => store.get(guiModeState)
export const resetGuiModes = () => store.set(guiModeState, new Map())
export const setGuiModes = (modes: Map<string, TViewportMode>) =>
  store.set(guiModeState, modes)
export const getGuiEngines = () => store.get(guiEngineState)
export const resetGuiEngines = () => store.set(guiEngineState, new Map())
export const setGuiEngines = (engines: Map<string, SessionEngine>) =>
  store.set(guiEngineState, engines)

export const getBackendSessions = () => store.get(backendSessionsAtom)
export const resetBackendSessions = () => store.set(backendSessionsAtom, new Map())
export const setBackendSessions = (sandboxId: string, sessions: TSandboxSession[]) => {
  const map = new Map(store.get(backendSessionsAtom))
  map.set(sandboxId, sessions)
  store.set(backendSessionsAtom, map)
}
export const getBackendSessionsForSandbox = (sandboxId: string) =>
  store.get(backendSessionsAtom).get(sandboxId) ?? []
