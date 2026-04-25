import { auth } from '@TAF/services/auth'
import { setUser } from '@TAF/state/accessors'

export const signupWithEmail = async (email: string, password: string) => {
  const resp = await auth.signUpWithEmail(email, password)
  if (resp.error) return resp

  resp.user && setUser(resp.user)
  return resp
}
