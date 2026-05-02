import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const stopSandbox: TEndpointConfig = {
  path: `/:id/stop`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.exec, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { podName, force } = req.body

    if (!podName) throw new Exception(400, `podName is required`)

    const sandbox = await resolveSandbox(db.services.sandbox, id, req.params.projectId)

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    await sb.validatePodOwnership(podName, sandbox.orgId, req.params.projectId)

    const activeSessions = sb.getSessions(podName)
    if (activeSessions.length > 0 && !force) {
      res.status(409).json({
        error: { message: `Active sessions exist`, code: `ACTIVE_SESSIONS` },
        data: { activeSessions },
      })
      return
    }

    await sb.gracefulStopPod(podName, sandbox.id)

    res.status(200).json({ data: { success: true } })
  },
}
