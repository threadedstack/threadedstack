import type { Response } from 'express'
import type { TRequest, TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { signShellToken } from '@TBE/services/sessionToken'

export const monitorToken: TEndpointConfig = {
  path: `/monitor/token`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.read, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: `Authentication required` })
      return
    }

    const orgId = req.params.orgId
    if (!orgId) {
      res.status(400).json({ error: `Org ID required` })
      return
    }

    const token = signShellToken({ userId: req.user.id, orgId })

    res.status(200).json({ data: { token } })
  },
}
