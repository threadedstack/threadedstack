import type { TApp, TEndpoint, TRequest, TEndpointConfig } from '@TBE/types'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import type { TReqHandler } from '@tdsk/domain'

type TEPCallable = Omit<TEndpointConfig, `action`> & {
  action: TReqHandler<TRequest>
}

export const getEndpointCfg = (mockApp: TApp, endpoint?: TEndpoint): TEPCallable =>
  (isFunc(endpoint) ? endpoint(mockApp) : endpoint) as TEPCallable
