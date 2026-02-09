import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

/**
 * DELETE /_/configs/:id - Delete config
 * Requires admin+ role in the org/project
 */
export const deleteConfig: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    await requireResourceWithPermission(
      req,
      db.services.config,
      id,
      EPermAction.delete,
      EPermResource.config,
      `Config`
    )

    const { error } = await db.services.config.delete(id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { success: true } })
  },
}
