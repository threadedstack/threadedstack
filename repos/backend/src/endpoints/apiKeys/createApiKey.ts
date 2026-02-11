import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@TBE/utils/errors/exception'
import { generateApiKey } from '@TBE/utils/auth/generateApiKey'
import { validateApiKey } from '@TBE/utils/auth/validateApiKey'
import { ApiKey, EPermAction, EPermResource } from '@tdsk/domain'
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
    const keyData = { ...req.body, orgId: req.params.orgId }

    const { valid, error } = validateApiKey(keyData)
    if (!valid || error) throw new Exception(400, error)

    const { name, orgId, scopes, projectId, expiresAt, rateLimit } = keyData

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

      if (error) throw new Exception(500, error.message)

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
      throw new Exception(500, message)
    }
  },
}
