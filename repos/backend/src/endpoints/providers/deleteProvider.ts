import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

/**
 * DELETE /providers/:id - Delete a provider
 * Requires admin+ role in the provider's org
 */
export const deleteProvider: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    await requireResourceWithPermission(
      req,
      db.services.provider,
      id,
      EPermAction.delete,
      EPermResource.provider,
      `Provider`,
      (provider) => ({ orgId: provider.orgId })
    )

    const { data, error } = await db.services.provider.delete(id)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { success: true, id } })
  },
}
