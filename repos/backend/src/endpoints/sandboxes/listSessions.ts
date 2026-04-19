import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { requireResource } from '@TBE/utils/auth/requireResource'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const listSessions: TEndpointConfig = {
  path: `/:id/sessions`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const sandbox = await requireResource(db.services.sandbox, id, `Sandbox`)

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    const podName = await sb.findRunningPod(id, sandbox.orgId)
    const sessions = podName ? sb.getSessions(podName) : []

    res.status(200).json({ data: sessions })
  },
}
