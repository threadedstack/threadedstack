import type { Endpoint } from '@tdsk/domain'
import type { TKeyValuePair } from '@TAF/types'
import type { TFaasFormState } from '@TAF/types/endpoints.types'

import { initFaasFromEndpoint } from '@TAF/utils/endpoints'
import {
  setFaasFormState,
  getFaasFormState,
  resetFaasFormState,
} from '@TAF/state/accessors'

export const setFaasFormField = <K extends keyof TFaasFormState>(
  field: K,
  value: TFaasFormState[K]
) => {
  const current = getFaasFormState()
  if (current) {
    setFaasFormState({ ...current, [field]: value })
  }
}

export const setFaasEnvVars = (envVars: TKeyValuePair[]) =>
  setFaasFormField(`envVars`, envVars)

export const setFaasArguments = (args: TKeyValuePair[]) =>
  setFaasFormField(`arguments`, args)

export const initializeFaasForm = (endpoint: Endpoint) => {
  const initializedState = initFaasFromEndpoint(endpoint)
  setFaasFormState(initializedState)
}

export const resetFaasForm = () => {
  resetFaasFormState()
}
