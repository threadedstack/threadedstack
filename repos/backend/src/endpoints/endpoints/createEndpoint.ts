import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { isObj } from '@keg-hub/jsutils/isObj'
import { HttpMethods } from '@TBE/constants/values'
import { Exception } from '@TBE/utils/errors/exception'
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
      url,
      path,
      method,
      projectId,
      headers = {},
      options = {},
      public: isPublic,
    } = req.body

    // Validate required fields
    if (!name) throw new Exception(400, `Endpoint name is required`)

    if (!url) throw new Exception(400, `Endpoint URL is required`)

    if (!method) throw new Exception(400, `Endpoint method is required`)

    if (!projectId) throw new Exception(400, `Endpoint projectId is required`)

    // Check permission - requires member+
    await checkPermission(req, EPermAction.create, EPermResource.endpoint, {
      projectId,
    })

    // Validate HTTP method
    const lower = method.toLowerCase()
    if (!HttpMethods.includes(lower))
      throw new Exception(
        400,
        `Invalid HTTP method. Must be one of: ${HttpMethods.join(', ')}`
      )

    if (headers && isObj(headers)) throw new Exception(400, `Headers must be an object`)

    if (options && isObj(options)) throw new Exception(400, `Options must be an object`)

    const endpointData = new Endpoint({
      name,
      url,
      path,
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
