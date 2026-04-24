import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { signShellToken } from '@TBE/services/sessionToken'
import { requireResource } from '@TBE/utils/auth/requireResource'
import { Exception, EPermAction, EPermResource, EContainerState } from '@tdsk/domain'

export const connectSandbox: TEndpointConfig = {
  path: `/:id/connect`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.exec, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db, config } = req.app.locals

    const sandbox = await requireResource(db.services.sandbox, id, `Sandbox`)

    const { projectId } = req.params
    if (!projectId)
      throw new Exception(400, `projectId is required to connect to a sandbox`)

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    // Check for already-running or starting pod (prevents duplicate pod race)
    let podName = await sb.findRunningPod(id, sandbox.orgId)

    if (!podName) {
      // Also check Pending pods and in-progress starts
      const activePod = await sb.findActivePod(id, sandbox.orgId)
      if (activePod) {
        podName = activePod
      } else if (sb.isStarting(id)) {
        throw new Exception(409, `Sandbox is already starting`)
      }
    }

    if (!podName) {
      sb.markStarting(id)
      try {
        podName = await sb.startPod({
          projectId,
          sandboxId: id,
          orgId: sandbox.orgId,
          userId: req.user!.id,
          egressOpts: config.egress,
        })
      } catch (err) {
        sb.clearStarting(id)
        throw err
      }

      const start = Date.now()
      let state: EContainerState = EContainerState.Pending
      let prevState: EContainerState = state
      const maxWait = config.sandbox?.maxWait ?? 120_000
      const pollInterval = config.sandbox?.pollInterval ?? 2_000
      logger.info(`[Sandbox] Waiting for pod ${podName} to reach Running state...`)

      try {
        while (state !== EContainerState.Running && Date.now() - start < maxWait) {
          await new Promise((r) => setTimeout(r, pollInterval))
          try {
            state = await sb.getPodState(podName)
          } catch (err) {
            logger.warn(
              `[Sandbox] Error polling pod ${podName} state:`,
              (err as Error).message
            )
            continue
          }
          if (state !== prevState) {
            logger.info(`[Sandbox] Pod ${podName} state: ${prevState} → ${state}`)
            prevState = state
          }
          if (state === EContainerState.Failed || state === EContainerState.Terminating) {
            throw new Exception(500, `Pod failed to start`)
          }
        }

        if (state !== EContainerState.Running) {
          logger.error(
            `[Sandbox] Pod ${podName} did not start within ${maxWait}ms (last state: ${state})`
          )
          throw new Exception(504, `Pod did not reach Running state within timeout`)
        }
      } catch (err) {
        // Clean up failed/timed-out pod
        try {
          await sb.stopPod(podName)
        } catch (cleanupErr) {
          logger.warn(`[Sandbox] Failed to cleanup pod ${podName} after start failure`, {
            error: (cleanupErr as Error).message,
          })
        }
        throw err
      } finally {
        sb.clearStarting(id)
      }
    }

    // Check for initScript failure inside the pod (K8s Exec API, not host shell)
    let initError: string | undefined
    try {
      const sbInstance = await sb.getSandbox(podName)
      const check = await sbInstance.exec(`cat`, [`/tmp/tdsk-init-error.log`])
      if (check.exitCode === 0 && check.output?.trim()) {
        initError = check.output.trim()
        logger.warn(`[Sandbox] initScript failed for pod ${podName}: ${initError}`)
      }
    } catch {
      // Non-fatal — pod may not have the file or K8s exec may not be ready yet
    }

    let password = sb.getPassword(podName)
    if (!password) password = await sb.recoverPassword(podName)
    if (!password) throw new Exception(500, `Could not retrieve SSH password for pod`)

    const shellToken = signShellToken({
      sandboxId: id,
      userId: req.user!.id,
      orgId: sandbox.orgId,
    })

    res.status(200).json({
      data: {
        podName,
        password,
        port: 2222,
        shellToken,
        sandboxId: id,
        command: `tsa ssh ${id}`,
        ...(initError && { initError }),
      },
    })
  },
}
