import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import {
  Secret,
  deriveKey,
  encryptValue,
  createHashKey,
  encodeEncrypted,
} from '@tdsk/domain'

/**
 * PUT /secrets/:id - Update an existing secret
 */
export const updateSecret: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { name, value } = req.body

    const { data: existing, error: getError } = await db.services.secret.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existing) {
      res.status(404).json({ error: `Secret not found` })
      return
    }

    try {
      const update = new Secret({ id })

      if (name) {
        update.name = name
        update.hashKey = createHashKey(name)
      }

      if (value) {
        const refId = existing.orgId || existing.repoId || existing.providerId
        const derivedKey = await deriveKey(refId)
        const { iv, encrypted, authTag } = await encryptValue(derivedKey, value)
        update.encryptedValue = encodeEncrypted(iv, authTag, encrypted)
      }

      const { data, error } = await db.services.secret.update(update)

      error
        ? res.status(500).json({ error: error.message })
        : res.status(200).json({ data: data.sanitize() })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to update secret`
      res.status(500).json({ error: message })
    }
  },
}
