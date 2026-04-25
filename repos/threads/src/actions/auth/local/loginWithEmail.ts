import { auth } from '@TTH/services/auth'
import { setUser } from '@TTH/state/accessors'

export const loginWithEmail = async (email: string, password: string) => {
  const resp = await auth.signInWithEmail(email, password)
  if (resp.error) return resp

  resp.user && setUser(resp.user)
  return resp
}
