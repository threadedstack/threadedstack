import posthog from 'posthog-js'
import type { ERoutePath } from '@TAF/types'
import { nav } from '@TAF/services/nav'
import { auth } from '@TAF/services/auth'
import { query } from '@TAF/services/query'
import { storage } from '@TAF/services/storage'
import { apiService } from '@TAF/services/api'
import { reset } from '@TAF/actions/auth/local/reset'
import { tokenRefresh } from '@TAF/services/tokenRefresh'
import {
  StorageKeyPrefix,
  SettingsStorageKey,
  ApiHeadersStorageKey,
} from '@TAF/constants/storage'

type TSignOut = {
  to?: ERoutePath
  navigate?: boolean
}

export const signout = async (props: TSignOut = {}) => {
  tokenRefresh.stop()

  try {
    await auth.signout()
  } catch (err) {
    console.warn(`[signout] Server signout failed:`, err)
  }

  posthog.reset()
  apiService.clearBearer()

  try {
    query.reset()
  } catch (err) {
    console.warn(`[signout] query.reset failed:`, err)
  }
  try {
    reset()
  } catch (err) {
    console.warn(`[signout] state reset failed:`, err)
  }
  try {
    storage.remove(SettingsStorageKey)
    storage.remove(ApiHeadersStorageKey)
    storage.removeByPrefix(StorageKeyPrefix)
  } catch (err) {
    console.warn(`[signout] storage cleanup failed:`, err)
  }

  if (props?.navigate === false) return
  props?.to ? nav.to(props?.to) : nav.signin()
}
