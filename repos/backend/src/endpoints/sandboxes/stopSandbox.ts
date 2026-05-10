import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
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
    const { podName, force, stopAll } = req.body

    const sandbox = await resolveSandbox(db.services.sandbox, id, req.params.projectId)

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    const userId = req.user?.id
    if (!userId) throw new Exception(401, `Authenticated user required`)

    if (stopAll) {
      const activePods = await sb.findActivePods(sandbox.id, sandbox.orgId)

      if (!force) {
        const otherSessions = activePods.flatMap((p: string) =>
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
        activePods.map((p: string) => sb.gracefulStopPod(p, sandbox.id))
      )
      const failed: string[] = []
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === `rejected`) {
          failed.push(activePods[i])
          logger.error(
            `[Sandbox] stopAll: failed to stop pod ${activePods[i]}:`,
            (results[i] as PromiseRejectedResult).reason?.message
          )
        }
      }

      res.status(200).json({
        data: {
          success: failed.length === 0,
          stoppedCount: activePods.length - failed.length,
          ...(failed.length > 0 && { failedPods: failed }),
        },
      })
      return
    }

    if (!podName) throw new Exception(400, `podName is required`)

    await sb.validatePodOwnership(podName, sandbox.orgId, req.params.projectId)

    const activeSessions = sb.getSessions(podName).filter((s) => s.userId !== userId)
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
