import { query } from '@TTH/services/query'
import { storage } from '@TTH/services/storage'
import { resetInit } from '@TTH/actions/init'
import { sessionService } from '@TTH/services/sessionService'
import { destroyAllEngines } from '@TTH/actions/gui/destroyAllEngines'
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
  resetActiveSession,
  resetBackendSessions,
  resetActiveProjectId,
} from '@TTH/state/accessors'

export const reset = () => {
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
  resetSidebarOpen()
  resetActiveOrgRole()
  resetActiveProjectId()
  resetActiveSession()
  resetOpenSessions()
  resetBackendSessions()

  storage.remove(ActiveOrgIdStorageKey)
  storage.remove(SettingsStorageKey)
  storage.remove(ApiHeadersStorageKey)
  storage.removeByPrefix(StorageKeyPrefix)
}
