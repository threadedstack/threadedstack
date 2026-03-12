import type { Endpoint } from '@tdsk/domain'
import type { TKeyValuePair } from '@TAF/types'
import type { TProxyFormState } from '@TAF/types/endpoints.types'

import { initProxyFromEndpoint } from '@TAF/utils/endpoints'
import {
  setProxyFormState,
  getProxyFormState,
  resetProxyFormState,
} from '@TAF/state/accessors'

export const setProxyFormField = <K extends keyof TProxyFormState>(
  field: K,
  value: TProxyFormState[K]
) => {
  const current = getProxyFormState()
  if (current) {
    setProxyFormState({ ...current, [field]: value })
  }
}

export const setProxyHeaders = (headers: TKeyValuePair[]) =>
  setProxyFormField(`headers`, headers)

export const setProxyOAuthParams = (params: TKeyValuePair[]) =>
  setProxyFormField(`oauthParams`, params)

export const initializeProxyForm = (endpoint: Endpoint) => {
  const initializedState = initProxyFromEndpoint(endpoint)
  setProxyFormState(initializedState)
}

export const resetProxyForm = () => {
  resetProxyFormState()
}
