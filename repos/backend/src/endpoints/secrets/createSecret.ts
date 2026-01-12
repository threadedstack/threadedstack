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
 * POST /secrets - Create a new secret
 */
export const createSecret: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { name, value, orgId, repoId, providerId } = req.body

    if (!name) {
      res.status(400).json({ error: `Secret name is required` })
      return
    }

    if (!value) {
      res.status(400).json({ error: `Secret value is required` })
      return
    }

    const hasOrg = !!orgId
    const hasRepo = !!repoId
    const hasProvider = !!providerId

    if (!hasOrg && !hasRepo && !hasProvider) {
      res.status(400).json({ error: `Secret must belong to an org, repo, or provider` })
      return
    }

    if ((hasOrg && hasRepo) || (hasOrg && hasProvider && hasRepo)) {
      res.status(400).json({
        error: `Secret can only belong to one of: org, repo, or provider (exclusive arc)`,
      })
      return
    }

    try {
      // Derive encryption key using the owner's ID
      const refId = orgId || repoId || providerId
      const derivedKey = await deriveKey(refId)

      const { iv, encrypted, authTag } = await encryptValue(derivedKey, value)
      const encryptedValue = encodeEncrypted(iv, authTag, encrypted)
      const hashKey = createHashKey(name)

      const secret = new Secret({
        name,
        hashKey,
        encryptedValue,
        ...(orgId && { orgId }),
        ...(repoId && { repoId }),
        ...(providerId && { providerId }),
      })

      const { data, error } = await db.services.secret.create(secret)
      error
        ? res.status(500).json({ error: error.message })
        : res.status(201).json({ data: data.sanitize() })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to encrypt secret`
      res.status(500).json({ error: message })
    }
  },
}
