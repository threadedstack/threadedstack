import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { requireResource } from '@TBE/utils/auth/requireResource'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /_/functions/:id - Delete function
 * Requires admin+ role in the project
 */
export const deleteFunction: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.function)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    await requireResource(db.services.function, id, `Function`)
    const { error } = await db.services.function.delete(id)
    if (error) throw new Exception(500, error.message)
    res.status(200).json({ data: { success: true } })
  },
}
