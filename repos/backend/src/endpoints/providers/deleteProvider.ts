import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
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

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existing) {
      res.status(404).json({ error: `Provider not found` })
      return
    }

    // Check permission based on provider's scope
    const context = {
      orgId: existing.orgId || undefined,
      projectId: existing.projectId || undefined,
    }

    await checkPermission(req, EPermAction.delete, EPermResource.provider, context)

    // Delete the provider
    const { data, error } = await db.services.provider.delete(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data: { success: true, id } })
  },
}
