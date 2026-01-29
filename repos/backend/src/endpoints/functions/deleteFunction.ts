import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

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
    if (fetchError) throw new Exception(500, fetchError.message)
    if (!func) throw new Exception(404, `Function not found`)

    // Check permission
    await checkPermission(req, EPermAction.delete, EPermResource.function, {
      projectId: func.projectId,
    })

    const { error } = await db.services.function.delete(id)
    if (error) throw new Exception(500, error.message)
    res.status(200).json({ success: true })
  },
}
