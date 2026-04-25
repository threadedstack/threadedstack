import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /secrets/:id - Delete a secret
 * Requires admin+ role
 */
export const deleteSecret: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.secret)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data: existing, error: getError } = await db.services.secret.get(id)
    if (getError) throw new Exception(500, getError.message)
    if (!existing) throw new Exception(404, `Secret not found`)

    // Check if any providers reference this secret as their API key
    const { data: linkedProviders } = await db.services.provider.list({
      where: { secretId: id },
    })
    if (linkedProviders?.length) {
      const name = linkedProviders[0].name
      throw new Exception(
        409,
        `Cannot delete secret — it is the API key for provider "${name}". Unlink or replace it first.`
      )
    }

    const { error } = await db.services.secret.delete(id)
    if (error) throw new Exception(500, error.message)

    // Decrement secret quota for the org
    const quotaOrgId = existing.orgId || req.params.orgId
    if (quotaOrgId && db.services.quota) {
      db.services.quota
        .decrement(quotaOrgId, getBillingPeriod(), `secrets`)
        .catch((err: unknown) =>
          logger.error(`[quota] Failed to decrement secrets for org=${quotaOrgId}:`, err)
        )
    }

    res.status(200).json({ data: { success: true, id } })
  },
}
