import type { Endpoint } from '@tdsk/domain'
import type { TKeyValuePair } from '@TAF/types'
import type { TAgentFormState } from '@TAF/types/endpoints.types'

import { initAgentFromEndpoint } from '@TAF/utils/endpoints'
import {
  setAgentFormState,
  getAgentFormState,
  resetAgentFormState,
} from '@TAF/state/accessors'

export const setAgentFormField = <K extends keyof TAgentFormState>(
  field: K,
  value: TAgentFormState[K]
) => {
  const current = getAgentFormState()
  current && setAgentFormState({ ...current, [field]: value })
}

export const setAgentEnvVars = (envVars: TKeyValuePair[]) =>
  setAgentFormField(`envVars`, envVars)

export const initializeAgentForm = (endpoint: Endpoint) => {
  const initializedState = initAgentFromEndpoint(endpoint)
  setAgentFormState(initializedState)
}

export const resetAgentForm = () => {
  resetAgentFormState()
}
