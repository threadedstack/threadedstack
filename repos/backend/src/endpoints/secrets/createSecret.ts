import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import {
  Secret,
  deriveKey,
  EPermAction,
  encryptValue,
  createHashKey,
  EPermResource,
  encodeEncrypted,
} from '@tdsk/domain'

/**
 * POST /secrets - Create a new secret
 * Requires admin+ role in the org/project
 */
export const createSecret: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { name, value, orgId, projectId, providerId } = req.body

    if (!name) {
      res.status(400).json({ error: `Secret name is required` })
      return
    }

    if (!value) {
      res.status(400).json({ error: `Secret value is required` })
      return
    }

    const hasOrg = !!orgId
    const hasProject = !!projectId
    const hasProvider = !!providerId

    if (!hasOrg && !hasProject && !hasProvider) {
      res
        .status(400)
        .json({ error: `Secret must belong to an org, project, or provider` })
      return
    }

    if ((hasOrg && hasProject) || (hasOrg && hasProvider && hasProject)) {
      res.status(400).json({
        error: `Secret can only belong to one of: org, project, or provider (exclusive arc)`,
      })
      return
    }

    // Check permission - requires admin+
    await checkPermission(req, EPermAction.create, EPermResource.secret, {
      orgId,
      projectId,
    })

    try {
      // Derive encryption key using the owner's ID
      const refId = orgId || projectId || providerId
      const derivedKey = await deriveKey(refId)

      const { iv, encrypted, authTag } = await encryptValue(derivedKey, value)
      const encryptedValue = encodeEncrypted(iv, authTag, encrypted)
      const hashKey = createHashKey(name)

      const secret = new Secret({
        name,
        hashKey,
        encryptedValue,
        ...(orgId && { orgId }),
        ...(projectId && { projectId }),
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
