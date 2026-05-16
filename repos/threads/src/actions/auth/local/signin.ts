import type { TAuthProvider } from '@tdsk/components'

import { auth } from '@TTH/services/auth'
import { apiService } from '@TTH/services/api'
import { setUser } from '@TTH/state/accessors'
import { resetInit } from '@TTH/actions/init'

export const signin = async (provider?: TAuthProvider) => {
  const resp = await auth.signin(provider)

  if (resp.error) return resp

  if (resp.user) {
    try {
      await apiService.bearer(resp)
    } catch (err) {
      console.warn(`[signin] Failed to set bearer token:`, err)
    }
    setUser(resp.user)
    resetInit()
  }

  return resp
}
