import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /providers/:id - Delete a provider
 * Get provider first to find scope
 * Requires admin+ role in that scope
 */
export const deleteProvider: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    // Get existing provider to find its scope
    const { data: existing, error: getError } = await db.services.provider.get(id)

    if (getError) throw new Exception(500, getError.message)

    if (!existing) throw new Exception(404, `Provider not found`)

    // Check permission based on provider's scope
    const context = {
      orgId: existing.orgId || undefined,
      projectId: existing.projectId || undefined,
    }

    await checkPermission(req, EPermAction.delete, EPermResource.provider, context)

    // Delete the provider
    const { data, error } = await db.services.provider.delete(id)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { success: true, id } })
  },
}
