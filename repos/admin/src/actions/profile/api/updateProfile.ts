import type { User } from '@tdsk/domain'

import { usersApi } from '@TAF/services'
import { setUser } from '@TAF/state/accessors'

export type TUpdateProfileResult = {
  error?: Error
  data?: User
}

export const updateProfile = async (
  userId: string,
  userData: Partial<User>
): Promise<TUpdateProfileResult> => {
  const resp = await usersApi.update(userId, {
    first: userData.first,
    last: userData.last,
    email: userData.email,
    image: userData.image,
  })

  if (resp.error) return { error: resp.error }

  resp.data && setUser(resp.data)

  return resp
}
