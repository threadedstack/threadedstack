import { auth } from '@TAF/services/auth'
import { setBearerUser } from '@TAF/actions/auth/local/setBearerUser'

export const loginWithEmail = async (email: string, password: string) => {
  const resp = await auth.signInWithEmail(email, password)
  if (resp.error) return resp

  return await setBearerUser(resp, `loginWithEmail`)
}
