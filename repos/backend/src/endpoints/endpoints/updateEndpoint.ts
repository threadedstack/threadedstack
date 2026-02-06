import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { isObj } from '@keg-hub/jsutils/isObj'
import { HttpMethods } from '@TBE/constants/values'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Endpoint, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /endpoints/:id - Update an existing endpoint
 * Requires member+ role
 */
export const updateEndpoint: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
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

    const { data: existing, error: getError } = await db.services.endpoint.get(id)

    if (getError) throw new Exception(500, getError.message)

    if (!existing) throw new Exception(404, `Endpoint not found`)

    // Check permission based on endpoint's projectId - requires member+
    await checkPermission(req, EPermAction.update, EPermResource.endpoint, {
      projectId: existing.projectId,
    })

    // Validate HTTP method if provided
    if (method) {
      const lower = method.toLowerCase()
      if (!HttpMethods.includes(lower))
        throw new Exception(
          400,
          `Invalid HTTP method. Must be one of: ${HttpMethods.join(', ')}`
        )
    }

    // Validate headers is an object if provided
    if (headers && !isObj(headers)) throw new Exception(400, `Headers must be an object`)

    // Validate options is an object if provided
    if (options && !isObj(options)) throw new Exception(400, `Options must be an object`)

    const updateData = new Endpoint({ id, type: existing.type })

    if (type !== undefined) updateData.type = type
    if (name !== undefined) updateData.name = name
    if (path !== undefined) updateData.path = path
    if (headers !== undefined) updateData.headers = headers
    if (options !== undefined) updateData.options = options
    if (isPublic !== undefined) updateData.public = isPublic
    if (method !== undefined) updateData.method = method.toUpperCase()

    const { data, error } = await db.services.endpoint.update(updateData)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
