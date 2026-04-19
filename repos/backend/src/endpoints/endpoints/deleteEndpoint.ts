import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { requireResource } from '@TBE/utils/auth/requireResource'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /endpoints/:id - Delete an endpoint
 * Requires admin+ role
 */
export const deleteEndpoint: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.endpoint)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    await requireResource(db.services.endpoint, id, `Endpoint`)
    const { data, error } = await db.services.endpoint.delete(id)

    if (error) throw new Exception(500, error.message)

    // Decrement endpoint quota for the org
    const orgId = req.params.orgId
    if (orgId && db.services.quota) {
      db.services.quota
        .decrement(orgId, getBillingPeriod(), `endpoints`)
        .catch((err: unknown) =>
          logger.error(`[quota] Failed to decrement endpoints for org=${orgId}:`, err)
        )
    }

    res.status(200).json({ data: { success: true, id } })
  },
}
