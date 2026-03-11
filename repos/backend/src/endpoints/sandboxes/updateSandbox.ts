import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const updateSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.update,
      EPermResource.sandbox,
      `Sandbox`,
      (data) => ({ orgId: data.orgId })
    )

    const { name, config } = req.body
    const { data, error } = await db.services.sandbox.update({
      id,
      ...(name !== undefined && { name }),
      ...(config !== undefined && { config }),
    })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
