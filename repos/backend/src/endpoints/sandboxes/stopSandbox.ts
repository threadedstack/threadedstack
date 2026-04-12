import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const stopSandbox: TEndpointConfig = {
  path: `/:id/stop`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { podName } = req.body

    if (!podName) throw new Exception(400, `podName is required`)

    const sandbox = await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.delete,
      EPermResource.sandbox,
      `Sandbox`,
      (sb) => ({ orgId: sb.orgId })
    )

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    await sb.validatePodOwnership(podName, sandbox.orgId, req.params.projectId)
    await sb.stopPod(podName)

    res.status(200).json({ data: { success: true } })
  },
}
