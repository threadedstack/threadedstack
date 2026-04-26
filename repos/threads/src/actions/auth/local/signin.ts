import type { TAuthProvider } from '@tdsk/components'

import { auth } from '@TTH/services/auth'
import { setUser } from '@TTH/state/accessors'

export const signin = async (provider?: TAuthProvider) => {
  const resp = await auth.signin(provider)

  if (resp.error) return resp

  resp.user && setUser(resp.user)

  return resp
}
