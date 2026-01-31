import type { Endpoint } from '@tdsk/domain'

import { useEffect } from 'react'
import { EEndpointType } from '@tdsk/domain'
import { initializeProxyForm, resetProxyForm } from '@TAF/actions/endpoints/local'
import { useProxyFormState as useProxyFormStateSelector } from '@TAF/state/selectors'

export const useProxyFormState = (endpoint?: Endpoint | null) => {
  const [state] = useProxyFormStateSelector()

  useEffect(() => {
    if (endpoint?.type === EEndpointType.proxy) {
      initializeProxyForm(endpoint)
    } else if (!endpoint) {
      resetProxyForm()
    }
  }, [endpoint])

  return state
}
