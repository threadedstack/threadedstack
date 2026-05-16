import { auth } from '@TAF/services/auth'
import { setBearerUser } from '@TAF/actions/auth/local/setBearerUser'

export const signupWithEmail = async (email: string, password: string) => {
  const resp = await auth.signUpWithEmail(email, password)
  if (resp.error) return resp
  return await setBearerUser(resp, `signupWithEmail`)
}
