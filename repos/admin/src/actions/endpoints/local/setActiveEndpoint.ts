import type { Endpoint } from '@tdsk/domain'

import { isStr } from '@keg-hub/jsutils/isStr'
import { setActiveEndpointId } from '@TAF/state/accessors'

export const setActiveEndpoint = (ep: string | Endpoint) => {
  const id = isStr(ep) ? ep : ep.id
  id && setActiveEndpointId(id)
}
