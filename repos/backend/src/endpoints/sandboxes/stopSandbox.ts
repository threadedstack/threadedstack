import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const stopSandbox: TEndpointConfig = {
  path: `/:id/stop`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.exec, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { instanceId, force, stopAll } = req.body

    const sandbox = await resolveSandbox(
      db.services.sandbox,
      id,
      req.params.projectId,
      req.params.orgId
    )

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    const userId = req.user?.id
    if (!userId) throw new Exception(401, `Authenticated user required`)

    if (force || stopAll) {
      await checkPermission(req, EPermAction.manage, EPermResource.sandboxSession, {
        orgId: sandbox.orgId,
      })
    }

    if (stopAll) {
      const activeInstances = await sb.findActiveInstances(sandbox.id, sandbox.orgId)

      if (!force) {
        const otherSessions = activeInstances.flatMap((p: string) =>
          sb.getSessions(p).filter((s) => s.userId !== userId)
        )
        if (otherSessions.length > 0) {
          res.status(409).json({
            error: {
              message: `Active sessions exist on one or more instances`,
              code: `ACTIVE_SESSIONS`,
            },
            data: { activeSessions: otherSessions },
          })
          return
        }
      }

      const results = await Promise.allSettled(
        activeInstances.map((p: string) => sb.gracefulStopPod(p, sandbox.id))
      )
      const failed: string[] = []
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === `rejected`) {
          failed.push(activeInstances[i])
          logger.error(
            `[Sandbox] stopAll: failed to stop instance ${activeInstances[i]}:`,
            (results[i] as PromiseRejectedResult).reason?.message
          )
        }
      }

      res.status(200).json({
        data: {
          success: failed.length === 0,
          stoppedCount: activeInstances.length - failed.length,
          ...(failed.length > 0 && { failedInstances: failed }),
        },
      })
      return
    }

    if (!instanceId) throw new Exception(400, `instanceId is required`)

    await sb.validateInstanceOwnership(instanceId, sandbox.orgId, req.params.projectId)

    const activeSessions = sb.getSessions(instanceId).filter((s) => s.userId !== userId)
    if (activeSessions.length > 0 && !force) {
      res.status(409).json({
        error: { message: `Active sessions exist`, code: `ACTIVE_SESSIONS` },
        data: { activeSessions },
      })
      return
    }

    await sb.gracefulStopPod(instanceId, sandbox.id)

    res.status(200).json({ data: { success: true } })
  },
}
