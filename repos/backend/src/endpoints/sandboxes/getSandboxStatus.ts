import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EContainerState, EPermAction, EPermResource } from '@tdsk/domain'

export const getSandboxStatus: TEndpointConfig = {
  path: `/:id/status`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const instanceId = req.query.instanceId as string

    if (!instanceId) throw new Exception(400, `instanceId query parameter is required`)

    const sandbox = await resolveSandbox(
      db.services.sandbox,
      id,
      req.params.projectId,
      req.params.orgId
    )

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    try {
      await sb.validateInstanceOwnership(instanceId, sandbox.orgId, req.params.projectId)
    } catch (err) {
      if (err instanceof Exception && err.status === 404) {
        res.status(200).json({ data: { instanceId, state: EContainerState.Failed } })
        return
      }
      throw err
    }

    const state = await sb.getPodState(instanceId)

    res.status(200).json({ data: { instanceId, state } })
  },
}
