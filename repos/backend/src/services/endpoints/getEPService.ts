import type { BaseEndpoint } from './base'

import { EEndpointType } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'
import { FaaSEndpoint } from '@TBE/services/endpoints/faasEndpoint'
import { ProxyEndpoint } from '@TBE/services/endpoints/proxyEndpoint'
import { AgentEndpoint } from '@TBE/services/endpoints/agentEndpoint'

/**
 * Module-level singleton registry.
 * Services are instantiated once at import time.
 * ProxyEndpoint's internal ProxyService is truly shared across the app lifecycle.
 */
const registry = new Map<string, BaseEndpoint>([
  [EEndpointType.proxy, new ProxyEndpoint()],
  [EEndpointType.faas, new FaaSEndpoint()],
  [EEndpointType.agent, new AgentEndpoint()],
])

/**
 * Get the endpoint service for a given endpoint type.
 * @param type - The endpoint type (proxy, faas, agent)
 * @returns The appropriate endpoint service instance
 * @throws Exception(400) if type is not supported
 */
export const getEPService = (type: string): BaseEndpoint => {
  const service = registry.get(type)
  if (!service) throw new Exception(400, `Unsupported endpoint type: ${type}`)
  return service
}
