import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { isObj } from '@keg-hub/jsutils/isObj'
import { HttpMethods } from '@TBE/constants/values'
import { authorize } from '@TBE/middleware/authorize'
import { getEPService } from '@TBE/services/endpoints'
import { requireResource } from '@TBE/utils/auth/requireResource'
import { Endpoint, Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /endpoints/:id - Update an existing endpoint
 * Requires member+ role
 */
export const updateEndpoint: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.endpoint)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { name, path, type, method, headers, options, public: isPublic } = req.body

    const existing = await requireResource(db.services.endpoint, id, `Endpoint`)

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

    // Type-specific validation when options change
    // Skip validation when type changes without new options — the existing options
    // belong to the old type and are expected to be invalid for the new type.
    // The old options will be cleared when the user configures the new type.
    const typeChanged = type !== undefined && type !== existing.type
    if (options !== undefined) {
      const effectiveType = type || existing.type
      const service = getEPService(effectiveType, db)
      if (options) service.validateOptions(options)
    } else if (!typeChanged && type !== undefined) {
      const service = getEPService(type, db)
      if (existing.options) service.validateOptions(existing.options)
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
