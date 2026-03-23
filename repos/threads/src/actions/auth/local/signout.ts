import { nav } from '@TTH/services/nav'
import { auth } from '@TTH/services/auth'
import { apiService } from '@TTH/services/api'
import { reset } from '@TTH/actions/auth/local/reset'
import { tokenRefresh } from '@TTH/services/tokenRefresh'

export const signout = async () => {
  tokenRefresh.stop()

  try {
    await auth.signout()
  } catch {}

  apiService.clearBearer()
  reset()
  nav.signin()
}
