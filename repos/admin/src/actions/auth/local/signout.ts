import posthog from 'posthog-js'
import { nav } from '@TAF/services/nav'
import { auth } from '@TAF/services/auth'
import { apiService } from '@TAF/services/api'
import { reset } from '@TAF/actions/auth/local/reset'
import { tokenRefresh } from '@TAF/services/tokenRefresh'

export const signout = async () => {
  tokenRefresh.stop()

  try {
    await auth.signout()
  } catch (err) {
    console.warn(`[signout] Server signout failed:`, err)
  }

  posthog.reset()
  apiService.clearBearer()
  reset()
  nav.signin()
}
