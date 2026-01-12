import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Endpoint } from '@tdsk/domain'
import { HttpMethods } from '@TBE/constants/values'

/**
 * POST /endpoints - Create a new endpoint
 */
export const createEndpoint: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const {
      name,
      url,
      method,
      repoId,
      headers = {},
      options = {},
      public: isPublic,
    } = req.body

    // Validate required fields
    if (!name) {
      res.status(400).json({ error: `Endpoint name is required` })
      return
    }

    if (!url) {
      res.status(400).json({ error: `Endpoint URL is required` })
      return
    }

    if (!method) {
      res.status(400).json({ error: `Endpoint method is required` })
      return
    }

    if (!repoId) {
      res.status(400).json({ error: `Endpoint repoId is required` })
      return
    }

    // Validate HTTP method
    const lower = method.toLowerCase()
    if (!HttpMethods.includes(lower)) {
      res.status(400).json({
        error: `Invalid HTTP method. Must be one of: ${HttpMethods.join(', ')}`,
      })
      return
    }

    // Validate headers is an object if provided
    if (headers && typeof headers !== 'object') {
      res.status(400).json({ error: `Headers must be an object` })
      return
    }

    // Validate options is an object if provided
    if (options && typeof options !== 'object') {
      res.status(400).json({ error: `Options must be an object` })
      return
    }

    const endpointData = new Endpoint({
      name,
      url,
      repoId,
      method: lower,
      ...(headers && { headers }),
      ...(options && { options }),
      ...(isPublic !== undefined && { public: isPublic }),
    })

    const { data, error } = await db.services.endpoint.create(endpointData)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ data })
  },
}
