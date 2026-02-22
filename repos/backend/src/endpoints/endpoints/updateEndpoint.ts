import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { isObj } from '@keg-hub/jsutils/isObj'
import { HttpMethods } from '@TBE/constants/values'
import { Exception } from '@TBE/utils/errors/exception'
import { Endpoint, EPermAction, EPermResource } from '@tdsk/domain'
import { getEPService } from '@TBE/services/endpoints'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

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

    const existing = await requireResourceWithPermission(
      req,
      db.services.endpoint,
      id,
      EPermAction.update,
      EPermResource.endpoint,
      `Endpoint`,
      (data) => ({ orgId: req.params.orgId, projectId: data.projectId })
    )

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

    // Type-specific validation when type or options change
    if (options !== undefined || type !== undefined) {
      const effectiveType = type || existing.type
      const effectiveOptions = options !== undefined ? options : existing.options
      const service = getEPService(effectiveType)
      if (effectiveOptions) service.validateOptions(effectiveOptions)
    }

    const updateData = new Endpoint({ id, type: existing.type })

    if (type !== undefined) updateData.type = type
    if (name !== undefined) updateData.name = name
    if (path !== undefined) updateData.path = path
    if (headers !== undefined) updateData.headers = headers
    if (options !== undefined) updateData.options = options
    if (isPublic !== undefined) updateData.public = isPublic
    if (method !== undefined) updateData.method = method.toLowerCase()

    const { data, error } = await db.services.endpoint.update(updateData)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
