import { auth } from '@TAF/services/auth'
import { setUser } from '@TAF/state/accessors'

export const initAuth = async () => {
  const data = await auth.session()
  data.user && setUser(data.user)

  return data
}
