import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { requireResource } from '@TBE/utils/auth/requireResource'
import { Exception, EContainerState, EPermAction, EPermResource } from '@tdsk/domain'

export const getSandboxStatus: TEndpointConfig = {
  path: `/:id/status`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const podName = req.query.podName as string

    if (!podName) throw new Exception(400, `podName query parameter is required`)

    const sandbox = await requireResource(db.services.sandbox, id, `Sandbox`)

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    try {
      await sb.validatePodOwnership(podName, sandbox.orgId, req.params.projectId)
    } catch (err) {
      if (err instanceof Exception && err.status === 404) {
        res.status(200).json({ data: { podName, state: EContainerState.Failed } })
        return
      }
      throw err
    }

    const state = await sb.getPodState(podName)

    res.status(200).json({ data: { podName, state } })
  },
}
