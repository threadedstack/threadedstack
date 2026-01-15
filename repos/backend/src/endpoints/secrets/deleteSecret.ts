import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /secrets/:id - Delete a secret
 * Requires admin+ role
 */
export const deleteSecret: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data: existing, error: getError } = await db.services.secret.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existing) {
      res.status(404).json({ error: `Secret not found` })
      return
    }

    // Check permission based on secret's scope - requires admin+
    await checkPermission(req, EPermAction.delete, EPermResource.secret, {
      orgId: existing.orgId,
      projectId: existing.projectId,
    })

    const { error } = await db.services.secret.delete(id)

    error
      ? res.status(500).json({ error: error.message })
      : res.status(200).json({ data: { success: true, id } })
  },
}
