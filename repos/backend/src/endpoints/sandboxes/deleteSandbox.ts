import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const deleteSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.delete,
      EPermResource.sandbox,
      `Sandbox`,
      (data) => ({ orgId: data.orgId })
    )

    const { data, error } = await db.services.sandbox.delete(id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
