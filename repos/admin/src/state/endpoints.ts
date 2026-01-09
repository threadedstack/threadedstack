import type { Endpoint } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const endpointsState = atomWithReset<Record<string, Endpoint>>(undefined)
export const activeEndpointIdState = atomWithReset<string>(undefined)
