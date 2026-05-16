import { query } from '@TTH/services/query'
import { storage } from '@TTH/services/storage'
import { resetInit } from '@TTH/actions/init'
import { destroyAllEngines } from '@TTH/actions/gui/destroyAllEngines'
import { closeAllSessions } from '@TTH/actions/sessions/closeAllSessions'
import { clearAllStoredSessions } from '@TTH/utils/sessionStorage'
import {
  StorageKeyPrefix,
  SettingsStorageKey,
  ApiHeadersStorageKey,
  ActiveOrgIdStorageKey,
} from '@TTH/constants/storage'
import {
  resetUser,
  resetOrgs,
  resetOrgId,
  resetProjects,
  resetSandboxes,
  resetThemeType,
  resetSidebarOpen,
  resetOpenSessions,
  resetActiveOrgRole,
  resetBackendSessions,
  resetActiveProjectId,
} from '@TTH/state/accessors'

export const reset = () => {
  try {
    closeAllSessions()
  } catch (err) {
    console.warn(`[reset] closeAllSessions failed:`, err)
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
  resetUser?.()
  resetOrgs?.()
  resetOrgId?.()
  resetProjects?.()
  resetSandboxes?.()
  resetThemeType?.()
  resetSidebarOpen?.()
  resetActiveOrgRole?.()
  resetActiveProjectId?.()
  resetOpenSessions?.()
  resetBackendSessions?.()

  storage.remove(ActiveOrgIdStorageKey)
  storage.remove(SettingsStorageKey)
  storage.remove(ApiHeadersStorageKey)
  storage.removeByPrefix(StorageKeyPrefix)

  clearAllStoredSessions()
}
