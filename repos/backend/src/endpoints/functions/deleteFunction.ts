import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

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

    await requireResourceWithPermission(
      req,
      db.services.function,
      id,
      EPermAction.delete,
      EPermResource.function,
      `Function`,
      (data) => ({ orgId: req.params.orgId, projectId: data.projectId })
    )

    const { error } = await db.services.function.delete(id)
    if (error) throw new Exception(500, error.message)
    res.status(200).json({ data: { success: true } })
  },
}
