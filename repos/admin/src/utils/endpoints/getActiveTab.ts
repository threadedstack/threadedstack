import { EEndpointDetailTab } from '@TAF/types'

export const getActiveTab = (pathname: string): EEndpointDetailTab => {
  if (pathname.endsWith(`/config`)) return EEndpointDetailTab.config
  if (pathname.endsWith(`/test`)) return EEndpointDetailTab.test
  return EEndpointDetailTab.endpoint
}
