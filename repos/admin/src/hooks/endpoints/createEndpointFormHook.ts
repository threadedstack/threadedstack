import type { Endpoint, TEndpointType } from '@tdsk/domain'
import { useEffect } from 'react'

export const createEndpointFormHook = <T>(
  type: TEndpointType,
  useSelector: () => [T, ...any[]],
  initialize: (endpoint: Endpoint) => void,
  reset: () => void
) => {
  return (endpoint?: Endpoint | null): T => {
    const [state] = useSelector()

    useEffect(() => {
      if (endpoint?.type === type) initialize(endpoint)
      else if (!endpoint) reset()
    }, [endpoint])

    return state
  }
}
