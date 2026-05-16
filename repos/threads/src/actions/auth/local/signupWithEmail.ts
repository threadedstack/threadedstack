import { auth } from '@TTH/services/auth'
import { apiService } from '@TTH/services/api'
import { setUser } from '@TTH/state/accessors'
import { resetInit } from '@TTH/actions/init'

export const signupWithEmail = async (email: string, password: string) => {
  const resp = await auth.signUpWithEmail(email, password)
  if (resp.error) return resp

  if (resp.user) {
    try {
      await apiService.bearer(resp)
    } catch {}
    setUser(resp.user)
    resetInit()
  }

  return resp
}
