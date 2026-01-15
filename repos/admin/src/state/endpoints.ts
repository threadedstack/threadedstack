import type { Endpoint } from '@tdsk/domain'

import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'

export const endpointsState = atomWithReset<Record<string, Endpoint>>(undefined)
export const activeEndpointIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `endpoints` && part))
)
