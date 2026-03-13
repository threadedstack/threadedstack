import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import {
  Secret,
  Exception,
  deriveKey,
  EPermAction,
  encryptValue,
  EPermResource,
  createHashKey,
  encodeEncrypted,
} from '@tdsk/domain'

/**
 * PUT /secrets/:id - Update an existing secret
 * Requires admin+ role
 */
export const updateSecret: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { name, value, description } = req.body

    const { data: existing, error: getError } = await db.services.secret.get(id)
    if (getError) throw new Exception(500, getError.message)
    if (!existing) throw new Exception(404, `Secret not found`)

    // Check permission based on secret's scope - requires admin+
    await checkPermission(req, EPermAction.update, EPermResource.secret, {
      orgId: existing.orgId,
      projectId: existing.projectId,
    })

    try {
      const update = new Secret({ id })

      if (name) {
        update.name = name
        update.hashKey = createHashKey(name)
      }

      if (value) {
        const refId = existing.orgId || existing.projectId || existing.providerId
        const derivedKey = await deriveKey(refId)
        const { iv, encrypted, authTag } = await encryptValue(derivedKey, value)
        update.encryptedValue = encodeEncrypted(iv, authTag, encrypted)
      }

      if (description) update.description = description

      const { data, error } = await db.services.secret.update(update)

      if (error) throw new Exception(500, error.message)

      res.status(200).json({ data: data.sanitize() })
    } catch (err) {
      if (err instanceof Exception) throw err

      const message = err instanceof Error ? err.message : `Failed to update secret`
      throw new Exception(500, message)
    }
  },
}
