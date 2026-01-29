import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /api-keys/:id - Get API key by ID (metadata only)
 * Requires admin+ role
 */
export const getApiKey: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { data, error } = await db.services.apiKey.get(id)

    if (error) {
      throw new Exception(500, error.message)
    }

    if (!data) {
      throw new Exception(404, `API key not found`)
    }

    // Check permission based on API key's orgId - requires admin+
    await checkPermission(req, EPermAction.read, EPermResource.apiKey, {
      orgId: data.orgId,
    })

    res.status(200).json({ data: data.sanitize() })
  },
}
