import type { TAuthResp } from '@tdsk/components'

import { apiService } from '@TAF/services/api'
import { setUser } from '@TAF/state/accessors'

export const setBearerUser = async (resp: TAuthResp, tag = `setBearerUser`) => {
  if (resp.user) {
    try {
      await apiService.bearer(resp)
    } catch (err) {
      console.warn(`[${tag}] Failed to set bearer token:`, err)
    }
    setUser(resp.user)
  }

  return resp
}
