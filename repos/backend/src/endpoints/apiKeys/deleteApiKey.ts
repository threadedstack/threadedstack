import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /api-keys/:id - Revoke/delete an API key
 * Requires admin+ role
 */
export const deleteApiKey: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data: existing, error: getError } = await db.services.apiKey.get(id)

    if (getError) {
      throw new Exception(500, getError.message)
    }

    if (!existing) {
      throw new Exception(404, `API key not found`)
    }

    // Check permission based on API key's orgId - requires admin+
    await checkPermission(req, EPermAction.delete, EPermResource.apiKey, {
      orgId: existing.orgId,
    })

    const { error } = await db.services.apiKey.revoke(id)

    if (error) {
      throw new Exception(500, error.message)
    }

    logger.info({
      apiKeyId: id,
      name: existing.name,
      message: `API key revoked`,
    })

    res.status(200).json({ data: { success: true, id } })
  },
}
