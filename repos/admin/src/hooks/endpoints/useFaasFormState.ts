import { EEndpointType } from '@tdsk/domain'
import { createEndpointFormHook } from './createEndpointFormHook'
import { initializeFaasForm, resetFaasForm } from '@TAF/actions/endpoints/local'
import { useFaasFormState as useFaasFormStateSelector } from '@TAF/state/selectors'

export const useFaasFormState = createEndpointFormHook(
  EEndpointType.faas,
  useFaasFormStateSelector,
  initializeFaasForm,
  resetFaasForm
)
