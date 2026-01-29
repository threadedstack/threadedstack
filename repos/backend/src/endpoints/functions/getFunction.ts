import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

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
    if (error) throw new Exception(500, error.message)
    if (!func) throw new Exception(404, `Function not found`)

    // Check permission
    await checkPermission(req, EPermAction.read, EPermResource.function, {
      projectId: func.projectId,
    })

    res.status(200).json({ data: func })
  },
}
