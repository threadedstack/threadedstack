import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const getSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const data = await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.read,
      EPermResource.sandbox,
      `Sandbox`,
      (data) => ({ orgId: data.orgId })
    )

    res.status(200).json({ data })
  },
}
