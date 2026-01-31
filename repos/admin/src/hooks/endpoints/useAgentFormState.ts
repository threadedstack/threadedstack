import type { Endpoint } from '@tdsk/domain'

import { useEffect } from 'react'
import { EEndpointType } from '@tdsk/domain'
import { initializeAgentForm, resetAgentForm } from '@TAF/actions/endpoints/local'
import { useAgentFormState as useAgentFormStateSelector } from '@TAF/state/selectors'

export const useAgentFormState = (endpoint?: Endpoint | null) => {
  const [state] = useAgentFormStateSelector()

  useEffect(() => {
    if (endpoint?.type === EEndpointType.agent) {
      initializeAgentForm(endpoint)
    } else if (!endpoint) {
      resetAgentForm()
    }
  }, [endpoint])

  return state
}
