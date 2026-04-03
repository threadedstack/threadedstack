import { EEndpointType } from '@tdsk/domain'

export const getConfigTabLabel = (type?: string): string => {
  switch (type) {
    case EEndpointType.proxy:
      return `Proxy`
    case EEndpointType.faas:
      return `Function`
    case EEndpointType.agent:
      return `Agent`
    default:
      return `Config`
  }
}
