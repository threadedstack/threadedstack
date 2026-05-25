import { query } from '@TTH/services/query'
import { resetInit } from '@TTH/actions/init'
import { storage } from '@TTH/services/storage'
import { SessionStoragePrefix } from '@TTH/constants/storage'
import { sessionService } from '@TTH/services/sessionService'
import { monitorService } from '@TTH/services/monitorService'
import { destroyAllEngines } from '@TTH/actions/gui/destroyAllEngines'
import {
  StorageKeyPrefix,
  SettingsStorageKey,
  ApiHeadersStorageKey,
  ActiveOrgIdStorageKey,
  ShellSessionsStorageKey,
  ActiveProjectIdStorageKey,
} from '@TTH/constants/storage'
import {
  resetUser,
  resetOrgs,
  resetOrgId,
  resetProjects,
  resetSandboxes,
  resetThemeType,
  resetWaitlisted,
  resetSidebarOpen,
  resetOpenSessions,
  resetActiveOrgRole,
  resetActiveSession,
  resetBackendSessions,
  resetActiveProjectId,
} from '@TTH/state/accessors'

export const reset = () => {
  monitorService.disconnect()

  try {
    sessionService.reset()
  } catch (err) {
    console.warn(`[reset] sessionService.reset failed:`, err)
  }
  try {
    destroyAllEngines()
  } catch (err) {
    console.warn(`[reset] destroyAllEngines failed:`, err)
  }
  try {
    query.reset()
  } catch (err) {
    console.warn(`[reset] query.reset failed:`, err)
  }

  resetInit()
  resetUser()
  resetOrgs()
  resetOrgId()
  resetProjects()
  resetSandboxes()
  resetThemeType()
  resetWaitlisted()
  resetSidebarOpen()
  resetActiveOrgRole()
  resetActiveProjectId()
  resetActiveSession()
  resetOpenSessions()
  resetBackendSessions()

  storage.remove(SettingsStorageKey)
  storage.remove(ApiHeadersStorageKey)
  storage.remove(ActiveOrgIdStorageKey)
  storage.removeByPrefix(StorageKeyPrefix)
  storage.remove(ActiveProjectIdStorageKey)

  // Clear user-specific browser sessionStorage (reconnection data, shell sessions)
  // but NOT device preferences like theme or terminal settings
  sessionStorage.removeItem(ShellSessionsStorageKey)
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i)
    if (key?.startsWith(SessionStoragePrefix)) sessionStorage.removeItem(key)
  }
}
