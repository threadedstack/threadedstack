import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { ApiKey } from '@tdsk/domain'
import { validateExpiresAt, validateApiScopes } from '@TBE/utils/auth/validateApiKey'

/**
 * PUT /api-keys/:id - Update an API key
 */
export const updateApiKey: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { name, scopes, expiresAt, rateLimit, active } = req.body

    const { data: existing, error: getError } = await db.services.apiKey.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existing) {
      res.status(404).json({ error: `API key not found` })
      return
    }

    if (scopes) {
      const { valid, error } = validateApiScopes(scopes)
      if (!valid || error) {
        res.status(400).json({ error: error || `Invalid scopes.` })
        return
      }
    }

    if (expiresAt) {
      const { valid, error } = validateExpiresAt(expiresAt)
      if (!valid || error) {
        res.status(400).json({ error: error || `Invalid expiration date` })
        return
      }
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

      error
        ? res.status(500).json({ error: error.message })
        : res.status(200).json({ data: data.sanitize() })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to update API key`
      res.status(500).json({ error: message })
    }
  },
}
