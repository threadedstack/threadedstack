import { auth } from '@TAF/services/auth'
import { setUser } from '@TAF/state/accessors'

export const signin = async (provider: string) => {
  const resp = await auth.signin(provider)

  if (resp.error) return resp

  resp.user && setUser(resp.user)

  return resp
}
