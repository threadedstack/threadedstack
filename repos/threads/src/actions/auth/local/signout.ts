import posthog from 'posthog-js'
import type { ERoutePath } from '@TTH/types'
import { nav } from '@TTH/services/nav'
import { auth } from '@TTH/services/auth'
import { apiService } from '@TTH/services/api'
import { reset } from '@TTH/actions/auth/local/reset'
import { tokenRefresh } from '@TTH/services/tokenRefresh'

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
  reset()

  if (props?.navigate === false) return
  props?.to ? nav.to(props?.to) : nav.signin()
}
