import type { TAuthProvider } from '@tdsk/components'

import { auth } from '@TAF/services/auth'
import { setBearerUser } from '@TAF/actions/auth/local/setBearerUser'

export const signin = async (provider?: TAuthProvider) => {
  const resp = await auth.signin(provider)

  if (resp.error) return resp

  return await setBearerUser(resp, `signin`)
}
