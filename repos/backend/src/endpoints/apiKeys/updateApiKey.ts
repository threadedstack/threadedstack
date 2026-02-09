import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { ApiKey, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'
import { validateExpiresAt, validateApiScopes } from '@TBE/utils/auth/validateApiKey'

/**
 * PUT /api-keys/:id - Update an API key
 * Requires admin+ role
 */
export const updateApiKey: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { name, scopes, expiresAt, rateLimit, active } = req.body

    await requireResourceWithPermission(
      req,
      db.services.apiKey,
      id,
      EPermAction.update,
      EPermResource.apiKey,
      `API key`
    )

    if (scopes) {
      const { valid, error } = validateApiScopes(scopes)
      if (!valid || error) throw new Exception(400, error || `Invalid scopes.`)
    }

    if (expiresAt) {
      const { valid, error } = validateExpiresAt(expiresAt)
      if (!valid || error) throw new Exception(400, error || `Invalid expiration date`)
    }

    try {
      const update = new ApiKey({ id })

      if (name !== undefined) update.name = name
      if (scopes !== undefined) update.scopes = scopes
      if (active !== undefined) update.active = active
      if (rateLimit !== undefined) update.rateLimit = Number.parseInt(rateLimit, 10)
      if (expiresAt !== undefined)
        update.expiresAt = expiresAt ? new Date(expiresAt) : null

      const { data, error } = await db.services.apiKey.update(update)

      if (error) throw new Exception(500, error.message)

      res.status(200).json({ data: data.sanitize() })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to update API key`
      throw new Exception(500, message)
    }
  },
}
