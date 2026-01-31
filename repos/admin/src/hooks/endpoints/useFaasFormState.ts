import { useEffect } from 'react'
import type { Endpoint } from '@tdsk/domain'
import { EEndpointType } from '@tdsk/domain'
import { initializeFaasForm, resetFaasForm } from '@TAF/actions/endpoints/local'
import { useFaasFormState as useFaasFormStateSelector } from '@TAF/state/selectors'

export const useFaasFormState = (endpoint?: Endpoint | null) => {
  const [state] = useFaasFormStateSelector()

  useEffect(() => {
    if (endpoint?.type === EEndpointType.faas) {
      initializeFaasForm(endpoint)
    } else if (!endpoint) {
      resetFaasForm()
    }
  }, [endpoint])

  return state
}
