import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { requireResource } from '@TBE/utils/auth/requireResource'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /api-keys/:id - Revoke/delete an API key
 * Requires admin+ role
 */
export const deleteApiKey: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.apiKey)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const existing = await requireResource(db.services.apiKey, id, `API key`)

    const { error } = await db.services.apiKey.revoke(id)
    if (error) throw new Exception(500, error.message)

    logger.info({
      apiKeyId: id,
      name: existing.name,
      message: `API key revoked`,
    })

    res.status(200).json({ data: { success: true, id } })
  },
}
