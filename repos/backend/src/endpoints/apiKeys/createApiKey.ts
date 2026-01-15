import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { ApiKey, EPermAction, EPermResource } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { generateApiKey } from '@TBE/utils/auth/generateApiKey'
import { validateApiKey } from '@TBE/utils/auth/validateApiKey'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * POST /api-keys - Generate a new API key
 * Requires admin+ role in the org
 */
export const createApiKey: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { name, orgId, projectId, scopes, expiresAt, rateLimit } = req.body

    const { valid, error } = validateApiKey(req.body)
    if (!valid || error) {
      res.status(400).json({ error })
      return
    }

    // Check permission - requires admin+
    await checkPermission(req, EPermAction.create, EPermResource.apiKey, {
      orgId,
    })

    try {
      const { key, hash, prefix } = generateApiKey()
      const apiKeyData = new ApiKey({
        name,
        active: true,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: scopes || `read`,
        rateLimit: rateLimit || 100,
        ...(orgId && { orgId }),
        ...(projectId && { projectId }),
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
      })

      const { data, error } = await db.services.apiKey.create(apiKeyData)

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      logger.info({
        name,
        orgId,
        projectId,
        apiKeyId: data.id,
        message: `New API Key created`,
      })

      /**
       * **IMPORTANT** - Return the `key` ONLY on creation - it will never be shown again
       */
      data.key = key
      res.status(201).json({
        data,
        warning: `Store this API key securely. It will not be shown again.`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to create API key`
      res.status(500).json({ error: message })
    }
  },
}
