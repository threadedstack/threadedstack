import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { signShellToken } from '@TBE/services/sessionToken'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import {
  Exception,
  EPermAction,
  EPermResource,
  EContainerState,
  DefaultWorkdir,
  DefaultMaxInstances,
} from '@tdsk/domain'

export const connectSandbox: TEndpointConfig = {
  path: `/:id/connect`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.exec, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db, config } = req.app.locals
    const { podName: requestedPod, newInstance } = req.body

    const { projectId } = req.params
    if (!projectId)
      throw new Exception(400, `projectId is required to connect to a sandbox`)

    const sandbox = await resolveSandbox(db.services.sandbox, id, projectId)
    const workdir = sandbox.config.workdir || DefaultWorkdir
    const sandboxId = sandbox.id
    const maxInstances = sandbox.config.maxInstances ?? DefaultMaxInstances

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    let podName: string | undefined

    if (requestedPod) {
      const validated = await sb.findActivePod(requestedPod, sandbox.orgId, sandboxId)
      if (!validated)
        throw new Exception(
          404,
          `Pod ${requestedPod} is not an active instance of this sandbox`
        )
      podName = validated
    } else {
      const runningPods = await sb.findRunningPods(sandboxId, sandbox.orgId)

      if (!newInstance && runningPods.length > 0)
        throw new Exception(
          400,
          `podName or newInstance required when instances exist`,
          `INSTANCE_SELECTION_REQUIRED`,
          runningPods.map((p) => `${p} (sessions: ${sb.getSessions(p).length})`)
        )
    }

    if (!podName) {
      const activePods = await sb.findActivePods(sandboxId, sandbox.orgId)
      const activeCount = activePods.length + sb.countStarting(sandboxId)
      if (activeCount >= maxInstances)
        throw new Exception(
          409,
          `Instance limit reached (${activeCount}/${maxInstances})`,
          `INSTANCE_LIMIT_REACHED`,
          activePods.map((p) => `${p} (sessions: ${sb.getSessions(p).length})`)
        )

      sb.markStarting(sandboxId)
      try {
        podName = await sb.startPod({
          projectId,
          sandboxId,
          orgId: sandbox.orgId,
          userId: req.user!.id,
          egressOpts: config.egress,
        })
      } catch (err) {
        sb.clearStarting(sandboxId)
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
        try {
          await sb.stopPod(podName)
        } catch (cleanupErr) {
          logger.warn(`[Sandbox] Failed to cleanup pod ${podName} after start failure`, {
            error: (cleanupErr as Error).message,
          })
        }
        throw err
      } finally {
        sb.clearStarting(sandboxId)
      }
    }

    let initError: string | undefined
    try {
      const sbInstance = await sb.getSandbox(podName)
      const check = await sbInstance.exec(`cat`, [`/tmp/tdsk-init-error.log`])
      if (check.exitCode === 0 && check.output?.trim()) {
        initError = check.output.trim()
        logger.warn(`[Sandbox] initScript failed for pod ${podName}: ${initError}`)
      }
    } catch (err) {
      logger.debug(
        `[Sandbox] initScript error check failed for pod ${podName}:`,
        (err as Error).message
      )
    }

    let password = sb.getPassword(podName)
    if (!password) password = await sb.recoverPassword(podName)
    if (!password) throw new Exception(500, `Could not retrieve SSH password for pod`)

    const shellToken = signShellToken({
      sandboxId,
      userId: req.user!.id,
      orgId: sandbox.orgId,
    })

    const alias = sandbox.getProjectAlias(projectId)

    res.status(200).json({
      data: {
        podName,
        workdir,
        password,
        sandboxId,
        port: 2222,
        shellToken,
        command: `tsa ssh ${alias || sandboxId}`,
        ...(alias && { alias }),
        ...(initError && { initError }),
      },
    })
  },
}
