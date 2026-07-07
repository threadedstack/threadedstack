import type { BaseEndpoint } from './base'
import type { TDatabase } from '@tdsk/database'

import { EEndpointType } from '@tdsk/domain'
import { Exception } from '@tdsk/domain'
import { FaaSEndpoint } from '@TBE/services/endpoints/faasEndpoint'
import { ProxyEndpoint } from '@TBE/services/endpoints/proxyEndpoint'
import { AgentEndpoint } from '@TBE/services/endpoints/agentEndpoint'

/**
 * Module-level singleton registry, built lazily on first use.
 * `db` isn't available at import time (app.locals.db is set during app
 * bootstrap), so the registry is built on the first getEPService() call
 * instead — using the db from that call for every service's lifetime.
 * ProxyEndpoint's internal ProxyService is truly shared across the app
 * lifecycle, so the registry itself must stay a singleton.
 */
let registry: Map<string, BaseEndpoint> | null = null

/**
 * Get the endpoint service for a given endpoint type.
 * @param type - The endpoint type (proxy, faas, agent)
 * @param db - The app's database instance (same singleton every call)
 * @returns The appropriate endpoint service instance
 * @throws Exception(400) if type is not supported
 */
export const getEPService = (type: string, db: TDatabase): BaseEndpoint => {
  if (!registry) {
    registry = new Map<string, BaseEndpoint>([
      [EEndpointType.proxy, new ProxyEndpoint(db)],
      [EEndpointType.faas, new FaaSEndpoint(db)],
      [EEndpointType.agent, new AgentEndpoint(db)],
    ])
  }

  const service = registry.get(type)
  if (!service) throw new Exception(400, `Unsupported endpoint type: ${type}`)
  return service
}
