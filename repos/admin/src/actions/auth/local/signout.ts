import { auth } from '@TAF/services/auth'
import { resetUser } from '@TAF/state/accessors'

export const signout = async () => {
  const valid = await auth.signout()
  resetUser()
}
