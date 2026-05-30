import type { Atom } from 'jotai'

import { useAtomValue } from 'jotai'
import { userState } from '@TTH/state/user'
import { themeTypeState } from '@TTH/state/theme'
import { terminalSettingsAtom } from '@TTH/state/terminal'
import { guiASTState, guiFeedState, guiModeState, guiEngineState } from '@TTH/state/gui'
import {
  orgIdState,
  activeOrgState,
  waitlistedState,
  sidebarOpenState,
  fileTreeOpenState,
  activeProjectState,
  activeOrgRoleState,
  activeProjectIdState,
  contextPanelOpenState,
  permissionOverridesState,
  activeOrgResolvedPermsState,
} from '@TTH/state/app'
import {
  savingFilesState,
  fileTreeDataState,
  fileTreeRootState,
  fileTreeActionState,
  loadingFoldersState,
  cursorPositionState,
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

const useReadOnly = <T>(state: Atom<T>) => {
  const value = useAtomValue(state)
  return [value] as [T]
}

export const useUser = () => useReadOnly(userState)
export const useOrgId = () => useReadOnly(orgIdState)
export const useThemeType = () => useReadOnly(themeTypeState)
export const useWaitlisted = () => useReadOnly(waitlistedState)
export const useSidebarOpen = () => useReadOnly(sidebarOpenState)
export const useFileTreeOpen = () => useReadOnly(fileTreeOpenState)
export const useActiveOrgRole = () => useReadOnly(activeOrgRoleState)
export const useActiveOrgResolvedPerms = () => useReadOnly(activeOrgResolvedPermsState)
export const useOpenEditorFiles = () => useReadOnly(openEditorFilesState)
export const useContextPanelOpen = () => useReadOnly(contextPanelOpenState)
export const useActiveEditorFile = () => useReadOnly(activeEditorFileState)
export const usePermissionOverrides = () => useReadOnly(permissionOverridesState)

export const useOrgs = () => useReadOnly(orgsAtom)
export const useProjects = () => useReadOnly(projectsAtom)
export const useSandboxes = () => useReadOnly(sandboxesAtom)
export const useOpenSessions = () => useReadOnly(openSessionsAtom)
export const useActiveSession = () => useReadOnly(activeSessionAtom)

export const useActiveOrg = () => useReadOnly(activeOrgState)
export const useActiveProject = () => useReadOnly(activeProjectState)
export const useActiveProjectId = () => useReadOnly(activeProjectIdState)

export const useGuiAst = () => useReadOnly(guiASTState)
export const useGuiFeed = () => useReadOnly(guiFeedState)
export const useGuiModes = () => useReadOnly(guiModeState)
export const useGuiEngines = () => useReadOnly(guiEngineState)
export const useSandboxPorts = () => useReadOnly(sandboxPortsAtom)
export const useBackendSessions = () => useReadOnly(backendSessionsAtom)
export const useSandboxInstances = () => useReadOnly(sandboxInstancesAtom)
export const useTerminalSettings = () => useReadOnly(terminalSettingsAtom)

export const useSavingFiles = () => useReadOnly(savingFilesState)
export const useFileTreeRoot = () => useReadOnly(fileTreeRootState)
export const useFileTreeData = () => useReadOnly(fileTreeDataState)
export const useCursorPosition = () => useReadOnly(cursorPositionState)
export const useLoadingFolders = () => useReadOnly(loadingFoldersState)
export const useFileTreeAction = () => useReadOnly(fileTreeActionState)
export const useExpandedFolders = () => useReadOnly(expandedFoldersState)
export const useFileContentCache = () => useReadOnly(fileContentCacheState)
