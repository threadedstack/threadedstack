import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const deleteSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, sandbox: sbService } = req.app.locals
    const { id } = req.params

    const sandbox = await resolveSandbox(
      db.services.sandbox,
      id,
      req.params.projectId,
      req.params.orgId
    )

    if (sbService) {
      const activeSessions = sbService.getShellSessionsForSandbox(sandbox.id)
      if (activeSessions.length > 0) {
        throw new Exception(
          409,
          `Cannot delete sandbox with ${activeSessions.length} active session(s)`
        )
      }

      const runningInstances = await sbService.findActiveInstances(
        sandbox.id,
        sandbox.orgId
      )
      const results = await Promise.allSettled(
        runningInstances.map((instanceId) => sbService.stopPod(instanceId))
      )
      const failures = results.filter((r) => r.status === `rejected`)
      if (failures.length > 0) {
        throw new Exception(
          500,
          `Failed to stop ${failures.length} running instance(s) before deletion`
        )
      }
    }

    const { data, error } = await db.services.sandbox.delete(sandbox.id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
