import { auth } from '@TAF/services/auth'
import { reset } from '@TAF/actions/auth/local/reset'

export const signout = async () => {
  await auth.signout()
  reset()
}
