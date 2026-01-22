import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { endpoint } from './endpoint'

/**
 * Proxy endpoints for proxying requests through configured endpoints
 * Mounted at /proxy
 */
export const proxy: TEndpointConfig = {
  path: `/proxy`,
  method: EPMethod.Use,
  endpoints: {
    endpoint,
  },
}
