import { nav } from '@TAF/services/nav'
import { auth } from '@TAF/services/auth'
import { reset } from '@TAF/actions/auth/local/reset'

export const signout = async () => {
  try {
    await auth.signout()
  } catch (err) {}
  reset()
  nav.signin()
}
