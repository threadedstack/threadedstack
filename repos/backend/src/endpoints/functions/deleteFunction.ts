import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /_/functions/:id - Delete function
 * Requires admin+ role in the project
 */
export const deleteFunction: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    const { data: func, error: fetchError } = await db.services.function.get(id)

    if (fetchError) {
      res.status(500).json({ error: fetchError.message })
      return
    }

    if (!func) {
      res.status(404).json({ error: 'Function not found' })
      return
    }

    // Check permission
    await checkPermission(req, EPermAction.delete, EPermResource.function, {
      projectId: func.projectId,
    })

    const { error } = await db.services.function.delete(id)
    error
      ? res.status(500).json({ error: error.message })
      : res.status(200).json({ success: true })
  },
}
