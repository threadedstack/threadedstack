import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

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

    const existing = await requireResourceWithPermission(
      req,
      db.services.apiKey,
      id,
      EPermAction.delete,
      EPermResource.apiKey,
      `API key`,
      (data) => ({
        orgId: data.orgId || req.params.orgId,
        projectId: data.projectId,
      })
    )

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
