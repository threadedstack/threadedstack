import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
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
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existing) {
      res.status(404).json({ error: `API key not found` })
      return
    }

    // Check permission based on API key's orgId - requires admin+
    await checkPermission(req, EPermAction.delete, EPermResource.apiKey, {
      orgId: existing.orgId,
    })

    const { error } = await db.services.apiKey.revoke(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    logger.info({
      apiKeyId: id,
      name: existing.name,
      message: `API key revoked`,
    })

    res.status(200).json({ data: { success: true, id } })
  },
}
