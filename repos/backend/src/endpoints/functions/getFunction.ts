import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /_/functions/:id - Get function by ID
 * Requires member+ role in the project
 */
export const getFunction: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    const { data: func, error } = await db.services.function.get(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!func) {
      res.status(404).json({ error: `Function not found` })
      return
    }

    // Check permission
    await checkPermission(req, EPermAction.read, EPermResource.function, {
      projectId: func.projectId,
    })

    res.status(200).json({ data: func })
  },
}
