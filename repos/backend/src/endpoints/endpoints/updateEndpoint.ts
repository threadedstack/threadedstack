import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Endpoint, EPermAction, EPermResource } from '@tdsk/domain'
import { isObj } from '@keg-hub/jsutils/isObj'
import { HttpMethods } from '@TBE/constants/values'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

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

    const { name, url, method, headers = {}, options = {}, public: isPublic } = req.body

    const { data: existing, error: getError } = await db.services.endpoint.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existing) {
      res.status(404).json({ error: `Endpoint not found` })
      return
    }

    // Check permission based on endpoint's projectId - requires member+
    await checkPermission(req, EPermAction.update, EPermResource.endpoint, {
      projectId: existing.projectId,
    })

    // Validate HTTP method if provided
    if (method) {
      const lower = method.toLowerCase()
      if (!HttpMethods.includes(lower)) {
        res.status(400).json({
          error: `Invalid HTTP method. Must be one of: ${HttpMethods.join(', ')}`,
        })
        return
      }
    }

    // Validate headers is an object if provided
    if (headers && !isObj(headers)) {
      res.status(400).json({ error: `Headers must be an object` })
      return
    }

    // Validate options is an object if provided
    if (options && !isObj(options)) {
      res.status(400).json({ error: `Options must be an object` })
      return
    }

    const updateData = new Endpoint({ id })

    if (url !== undefined) updateData.url = url
    if (name !== undefined) updateData.name = name
    if (headers !== undefined) updateData.headers = headers
    if (options !== undefined) updateData.options = options
    if (isPublic !== undefined) updateData.public = isPublic
    if (method !== undefined) updateData.method = method.toUpperCase()

    const { data, error } = await db.services.endpoint.update(updateData)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}
