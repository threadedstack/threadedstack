import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { getEPService } from '@TBE/services/endpoints'

/**
 * GET/POST/PUT/PATCH/DELETE /proxy/:projectId/:endpointId/*
 *
 * Dispatches endpoint execution to the appropriate service based on type.
 * Supports proxy, FaaS, and agent endpoint types.
 */
export const endpoint: TEndpointConfig = {
  path: `/:projectId/:endpointId`,
  method: EPMethod.All,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId, endpointId } = req.params

    if (!projectId || !endpointId)
      throw new Exception(400, `Project ID and Endpoint ID are required`)

    // Fetch endpoint from database
    const { data: ep, error } = await db.services.endpoint.get(endpointId)

    if (error || !ep) throw new Exception(404, `Endpoint not found`)

    // Get the appropriate service for this endpoint type
    const service = getEPService(ep.type)

    // Validate project ownership
    service.validateProject(ep, projectId)

    // Check permissions (skipped for public endpoints)
    await service.checkPermission(req, ep)

    // Validate HTTP method matches endpoint config (for all types)
    service.validateMethod(req, ep)

    // Execute endpoint via type-specific service
    await service.execute(req, res, ep, db)
  },
}
