import type { SessionEngine } from '@TTH/services/gui/engine/sessionEngine'
import type {
  User,
  Sandbox,
  Project,
  TRoleType,
  TPermission,
  Organization,
  TPortsResponse,
  TSandboxSession,
  TSBInstancesResp,
  PermissionOverride,
} from '@tdsk/domain'
import type {
  TDocument,
  TFeedEvent,
  EThemeType,
  TFileEntry,
  TOpenSession,
  TViewportMode,
  TCursorPosition,
  TFileCacheEntry,
  TFileTreeAction,
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
  defFileTreeOpen,
  waitlistedState,
  sidebarOpenState,
  defActiveOrgRole,
  fileTreeOpenState,
  defActiveProjectId,
  activeOrgRoleState,
  defContextPanelOpen,
  activeProjectIdState,
  contextPanelOpenState,
  defPermissionOverrides,
  permissionOverridesState,
  defActiveOrgResolvedPerms,
  activeOrgResolvedPermsState,
} from '@TTH/state/app'

import {
  defSavingFiles,
  defFileTreeData,
  defFileTreeRoot,
  savingFilesState,
  defFileTreeAction,
  fileTreeRootState,
  defCursorPosition,
  fileTreeDataState,
  defLoadingFolders,
  defExpandedFolders,
  defOpenEditorFiles,
  loadingFoldersState,
  defFileContentCache,
  cursorPositionState,
  defActiveEditorFile,
  fileTreeActionState,
  expandedFoldersState,
  openEditorFilesState,
  activeEditorFileState,
  fileContentCacheState,
} from '@TTH/state/editor'

import {
  orgsAtom,
  projectsAtom,
  sandboxesAtom,
  sandboxPortsAtom,
  openSessionsAtom,
  activeSessionAtom,
  backendSessionsAtom,
  sandboxInstancesAtom,
} from '@TTH/state/sessions'

export const store = createStore()

export const getWaitlisted = () => store.get(waitlistedState)
export const resetWaitlisted = () => store.set(waitlistedState, false)
export const setWaitlisted = (val: boolean) => store.set(waitlistedState, val)

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

export const getPermissionOverrides = () => store.get(permissionOverridesState)
export const resetPermissionOverrides = () =>
  store.set(permissionOverridesState, defPermissionOverrides)
export const setPermissionOverrides = (overrides: PermissionOverride[] | undefined) =>
  store.set(permissionOverridesState, overrides)

export const getActiveOrgResolvedPerms = () => store.get(activeOrgResolvedPermsState)
export const resetActiveOrgResolvedPerms = () =>
  store.set(activeOrgResolvedPermsState, defActiveOrgResolvedPerms)
export const setActiveOrgResolvedPerms = (perms: TPermission[] | `super` | undefined) =>
  store.set(activeOrgResolvedPermsState, perms)

export const getContextPanelOpen = () => store.get(contextPanelOpenState)
export const resetContextPanelOpen = () =>
  store.set(contextPanelOpenState, defContextPanelOpen)
export const setContextPanelOpen = (open: boolean) =>
  store.set(contextPanelOpenState, open)

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

export const getFileTreeOpen = () => store.get(fileTreeOpenState)
export const resetFileTreeOpen = () => store.set(fileTreeOpenState, defFileTreeOpen)
export const setFileTreeOpen = (open: boolean) => store.set(fileTreeOpenState, open)

export const getOpenEditorFiles = () => store.get(openEditorFilesState)
export const resetOpenEditorFiles = () =>
  store.set(openEditorFilesState, defOpenEditorFiles)
export const setOpenEditorFiles = (files: string[]) =>
  store.set(openEditorFilesState, files)

export const getActiveEditorFile = () => store.get(activeEditorFileState)
export const resetActiveEditorFile = () =>
  store.set(activeEditorFileState, defActiveEditorFile)
export const setActiveEditorFile = (file: string | null) =>
  store.set(activeEditorFileState, file)

export const getBackendSessions = () => store.get(backendSessionsAtom)
export const resetBackendSessions = () => store.set(backendSessionsAtom, new Map())
export const setBackendSessions = (sandboxId: string, sessions: TSandboxSession[]) => {
  const map = new Map(store.get(backendSessionsAtom))
  map.set(sandboxId, sessions)
  store.set(backendSessionsAtom, map)
}
export const getBackendSessionsForSandbox = (sandboxId: string) =>
  store.get(backendSessionsAtom).get(sandboxId) ?? []

export const getSandboxPorts = () => store.get(sandboxPortsAtom)
export const resetSandboxPorts = () => store.set(sandboxPortsAtom, new Map())
export const setSandboxPorts = (instanceId: string, ports: TPortsResponse) => {
  const map = new Map(store.get(sandboxPortsAtom))
  map.set(instanceId, ports)
  store.set(sandboxPortsAtom, map)
}

export const getFileTreeData = () => store.get(fileTreeDataState)
export const resetFileTreeData = () => store.set(fileTreeDataState, defFileTreeData)
export const setFileTreeData = (data: Map<string, TFileEntry[]>) =>
  store.set(fileTreeDataState, data)

export const getExpandedFolders = () => store.get(expandedFoldersState)
export const resetExpandedFolders = () =>
  store.set(expandedFoldersState, defExpandedFolders)
export const setExpandedFolders = (folders: Set<string>) =>
  store.set(expandedFoldersState, folders)

export const getLoadingFolders = () => store.get(loadingFoldersState)
export const resetLoadingFolders = () => store.set(loadingFoldersState, defLoadingFolders)
export const setLoadingFolders = (folders: Set<string>) =>
  store.set(loadingFoldersState, folders)

export const getFileContentCache = () => store.get(fileContentCacheState)
export const resetFileContentCache = () =>
  store.set(fileContentCacheState, defFileContentCache)
export const setFileContentCache = (cache: Map<string, TFileCacheEntry>) =>
  store.set(fileContentCacheState, cache)

export const getCursorPosition = () => store.get(cursorPositionState)
export const resetCursorPosition = () => store.set(cursorPositionState, defCursorPosition)
export const setCursorPosition = (pos: TCursorPosition) =>
  store.set(cursorPositionState, pos)

export const getFileTreeRoot = () => store.get(fileTreeRootState)
export const resetFileTreeRoot = () => store.set(fileTreeRootState, defFileTreeRoot)
export const setFileTreeRoot = (root: string) => store.set(fileTreeRootState, root)

export const getSavingFiles = () => store.get(savingFilesState)
export const resetSavingFiles = () => store.set(savingFilesState, defSavingFiles)
export const setSavingFiles = (files: Set<string>) => store.set(savingFilesState, files)

export const getFileTreeAction = () => store.get(fileTreeActionState)
export const resetFileTreeAction = () => store.set(fileTreeActionState, defFileTreeAction)
export const setFileTreeAction = (action: TFileTreeAction | null) =>
  store.set(fileTreeActionState, action)

export const getSandboxInstances = () => store.get(sandboxInstancesAtom)
export const resetSandboxInstances = () => store.set(sandboxInstancesAtom, new Map())
export const setSandboxInstances = (sandboxId: string, data: TSBInstancesResp) => {
  const map = new Map(store.get(sandboxInstancesAtom))
  map.set(sandboxId, data)
  store.set(sandboxInstancesAtom, map)
}
