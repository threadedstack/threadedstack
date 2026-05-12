import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const startSandbox: TEndpointConfig = {
  path: `/:id/start`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.exec, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db, config } = req.app.locals

    const { projectId } = req.params
    if (!projectId) throw new Exception(400, `projectId is required to start a sandbox`)

    const sandbox = await resolveSandbox(db.services.sandbox, id, projectId)

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    const instanceId = await sb.startPod({
      projectId,
      sandboxId: sandbox.id,
      orgId: sandbox.orgId,
      userId: req.user!.id,
      egressOpts: config.egress,
    })

    res.status(201).json({ data: { instanceId } })
  },
}
