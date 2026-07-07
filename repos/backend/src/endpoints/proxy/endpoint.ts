import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { getEPService } from '@TBE/services/endpoints'
import { EEndpointType, Exception } from '@tdsk/domain'
import { parseJsonBody } from '@TBE/utils/parseJsonBody'
import { authenticateRequest } from '@TBE/utils/auth/authenticateRequest'

/**
 * GET/POST/PUT/PATCH/DELETE /proxy/:projectId/:endpointId/*
 *
 * Dispatches endpoint execution to the appropriate service based on type.
 * Supports proxy, FaaS, and agent endpoint types.
 *
 * Auth is deferred until after the endpoint is loaded from the DB:
 * - Public endpoints skip authentication entirely
 * - Non-public endpoints authenticate via proxy-forwarded headers
 *
 * Body parsing is also deferred:
 * - Proxy endpoints skip body parsing (forward raw bodies upstream)
 * - FaaS and Agent endpoints parse JSON body before execution
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

    if (error) throw new Exception(500, error.message)
    if (!ep) throw new Exception(404, `Endpoint not found`)

    // Get the appropriate service for this endpoint type
    const service = getEPService(ep.type, db)

    // Validate project ownership
    service.validateProject(ep, projectId)

    // Authenticate non-public endpoints (auth can't happen before DB lookup)
    if (!ep.public) {
      await authenticateRequest(req, res)

      // Enforce project-scoped API key boundaries (auth stored on res.locals by authenticateRequest)
      const auth = res.locals.auth
      if (auth?.projectId && auth.projectId !== projectId) {
        logger.warn({
          message: `Project-scoped key blocked from different project endpoint`,
          path: req.path,
          keyProjectId: auth.projectId,
          targetProjectId: projectId,
        })
        throw new Exception(403, `API key does not have access to this project`)
      }
    }

    // Check permissions (skipped for public endpoints)
    await service.checkPermission(req, ep)

    // Parse JSON body for FaaS and Agent types (proxy forwards raw body)
    if (ep.type !== EEndpointType.proxy) req.body = await parseJsonBody(req)

    // Validate HTTP method matches endpoint config (for all types)
    service.validateMethod(req, ep)

    // Execute endpoint via type-specific service
    await service.execute(req, res, ep)
  },
}
