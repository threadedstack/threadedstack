import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { isObj } from '@keg-hub/jsutils/isObj'
import { HttpMethods } from '@TBE/constants/values'
import { getEPService } from '@TBE/services/endpoints'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Endpoint, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /endpoints - Create a new endpoint
 * Requires member+ role in project's org
 */
export const createEndpoint: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const {
      name,
      path,
      type,
      method,
      headers = {},
      options = {},
      public: isPublic,
    } = req.body
    const projectId = req.params.projectId || req.body.projectId

    if (!type) throw new Exception(400, `Endpoint type is required`)
    if (!name) throw new Exception(400, `Endpoint name is required`)

    if (!method) throw new Exception(400, `Endpoint method is required`)

    if (!projectId) throw new Exception(400, `Endpoint projectId is required`)

    // Check permission - requires member+
    // Include orgId so org-level roles (e.g., org admin) are considered
    await checkPermission(req, EPermAction.create, EPermResource.endpoint, {
      orgId: req.params.orgId,
      projectId,
    })

    // Validate HTTP method
    const lower = method.toLowerCase()
    if (!HttpMethods.includes(lower))
      throw new Exception(
        400,
        `Invalid HTTP method. Must be one of: ${HttpMethods.join(', ')}`
      )

    if (headers && !isObj(headers)) throw new Exception(400, `Headers must be an object`)

    if (options && !isObj(options)) throw new Exception(400, `Options must be an object`)

    // Type-specific validation (e.g., proxy needs url, faas needs functionId)
    const service = getEPService(type)
    service.validateOptions(options)

    const endpointData = new Endpoint({
      name,
      path,
      type,
      projectId,
      method: lower,
      ...(headers && { headers }),
      ...(options && { options }),
      ...(isPublic !== undefined && { public: isPublic }),
    })

    const { data, error } = await db.services.endpoint.create(endpointData)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
