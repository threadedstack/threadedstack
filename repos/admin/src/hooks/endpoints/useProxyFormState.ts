import { EEndpointType } from '@tdsk/domain'
import { createEndpointFormHook } from './createEndpointFormHook'
import { initializeProxyForm, resetProxyForm } from '@TAF/actions/endpoints/local'
import { useProxyFormState as useProxyFormStateSelector } from '@TAF/state/selectors'

export const useProxyFormState = createEndpointFormHook(
  EEndpointType.proxy,
  useProxyFormStateSelector,
  initializeProxyForm,
  resetProxyForm
)
