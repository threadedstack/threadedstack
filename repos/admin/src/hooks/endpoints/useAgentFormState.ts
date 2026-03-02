import { EEndpointType } from '@tdsk/domain'
import { createEndpointFormHook } from './createEndpointFormHook'
import { initializeAgentForm, resetAgentForm } from '@TAF/actions/endpoints/local'
import { useAgentFormState as useAgentFormStateSelector } from '@TAF/state/selectors'

export const useAgentFormState = createEndpointFormHook(
  EEndpointType.agent,
  useAgentFormStateSelector,
  initializeAgentForm,
  resetAgentForm
)
