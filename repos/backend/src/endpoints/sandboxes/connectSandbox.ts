import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { signShellToken } from '@TBE/services/sessionToken'
import { SetupReadyTimeoutMS } from '@TBE/constants/sandbox'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import {
  Exception,
  EPermAction,
  EPermResource,
  DefaultWorkdir,
  EContainerState,
  DefaultMaxInstances,
} from '@tdsk/domain'

export const connectSandbox: TEndpointConfig = {
  path: `/:id/connect`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.connect, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db, config } = req.app.locals
    const { newInstance, instanceId: requestedInstance, sessionId } = req.body

    const { projectId } = req.params
    const sandbox = await resolveSandbox(
      db.services.sandbox,
      id,
      projectId,
      req.params.orgId
    )
    const workdir = sandbox.config.workdir || DefaultWorkdir
    const sandboxId = sandbox.id
    const maxInstances = sandbox.config.maxInstances ?? DefaultMaxInstances

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    let instanceId: string | undefined

    if (requestedInstance) {
      const validated = await sb.findActiveInstance(
        requestedInstance,
        sandbox.orgId,
        sandboxId
      )
      if (!validated)
        throw new Exception(
          404,
          `Instance ${requestedInstance} is not an active instance of this sandbox`
        )
      instanceId = validated
    } else {
      const runningInstances = await sb.findRunningInstances(sandboxId, sandbox.orgId)

      if (!newInstance && runningInstances.length > 0) {
        if (sessionId) {
          const resolved = sb.findInstanceForSession(sessionId, sandboxId)
          if (resolved && runningInstances.includes(resolved)) instanceId = resolved
        }

        if (!instanceId)
          throw new Exception(
            400,
            `instanceId or newInstance required when instances exist`,
            `INSTANCE_SELECTION_REQUIRED`,
            runningInstances.map((p) => `${p} (sessions: ${sb.getSessions(p).length})`)
          )
      }
    }

    if (!instanceId) {
      const activeInstances = await sb.findActiveInstances(sandboxId, sandbox.orgId)
      const activeCount = activeInstances.length + sb.countStarting(sandboxId)
      if (activeCount >= maxInstances)
        throw new Exception(
          409,
          `Instance limit reached (${activeCount}/${maxInstances})`,
          `INSTANCE_LIMIT_REACHED`,
          activeInstances.map((p) => `${p} (sessions: ${sb.getSessions(p).length})`)
        )

      sb.markStarting(sandboxId)
      try {
        instanceId = await sb.startPod({
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
      let loggedConditionsAfterPending = false
      const maxWait = config.sandbox?.maxWait ?? 120_000
      const pollInterval = config.sandbox?.pollInterval ?? 2_000
      const conditionCheckDelayMs = 30_000
      logger.info(
        `[Sandbox] Waiting for instance ${instanceId} to reach Running state...`
      )

      try {
        while (state !== EContainerState.Running && Date.now() - start < maxWait) {
          await new Promise((r) => setTimeout(r, pollInterval))
          try {
            state = await sb.getPodState(instanceId)
          } catch (err) {
            logger.warn(
              `[Sandbox] Error polling instance ${instanceId} state:`,
              (err as Error).message
            )
            continue
          }
          if (state !== prevState) {
            logger.info(`[Sandbox] Instance ${instanceId} state: ${prevState} → ${state}`)
            prevState = state
          }
          if (state === EContainerState.Failed || state === EContainerState.Terminating) {
            throw new Exception(500, `Pod failed to start`)
          }
          if (
            state === EContainerState.Pending &&
            !loggedConditionsAfterPending &&
            Date.now() - start >= conditionCheckDelayMs
          ) {
            loggedConditionsAfterPending = true
            const conditions = await sb.getPodConditionSummary(instanceId)
            if (conditions)
              logger.warn(
                `[Sandbox] Instance ${instanceId} still Pending after ${conditionCheckDelayMs / 1000}s — conditions: ${conditions}`
              )
          }
        }

        if (state !== EContainerState.Running) {
          const conditions = await sb.getPodConditionSummary(instanceId)
          logger.error(
            `[Sandbox] Instance ${instanceId} did not start within ${maxWait}ms (last state: ${state})${conditions ? ` — conditions: ${conditions}` : ``}`
          )
          throw new Exception(
            504,
            `Pod did not reach Running state within timeout${conditions ? ` (${conditions})` : ``}`
          )
        }

        // Gate interactive connect on the workspace-ready marker so the session
        // doesn't land in a pod whose setup script (dependency install) is still
        // running. Non-fatal on timeout — the pod IS running (waitForPodReady
        // warns and returns), so a slow/absent marker never blocks the connect.
        await sb.waitForPodReady(instanceId, {
          cloneCheck: true,
          timeoutMs: SetupReadyTimeoutMS,
        })
      } catch (err) {
        try {
          await sb.stopPod(instanceId)
        } catch (cleanupErr) {
          logger.warn(
            `[Sandbox] Failed to cleanup instance ${instanceId} after start failure`,
            {
              error: (cleanupErr as Error).message,
            }
          )
        }
        throw err
      } finally {
        sb.clearStarting(sandboxId)
        sb.broadcastInstanceList(sandboxId, sandbox.orgId).catch(() => {})
      }
    }

    let initError: string | undefined
    try {
      const sbInstance = await sb.getSandbox(instanceId)
      const check = await sbInstance.exec(`cat`, [`/tmp/tdsk-init-error.log`])
      if (check.exitCode === 0 && check.output?.trim()) {
        initError = check.output.trim()
        logger.warn(
          `[Sandbox] initScript failed for instance ${instanceId}: ${initError}`
        )
      }
    } catch (err) {
      logger.debug(
        `[Sandbox] initScript error check failed for instance ${instanceId}:`,
        (err as Error).message
      )
    }

    const shellToken = signShellToken({
      sandboxId,
      userId: req.user!.id,
      orgId: sandbox.orgId,
    })

    const alias = sandbox.getProjectAlias(projectId)

    const subdomain = req.app.locals.kube?.findSubdomainByInstance(instanceId)
    const portUrlTemplate = subdomain ? sb.buildPortUrlTemplate(subdomain) : undefined

    res.status(200).json({
      data: {
        workdir,
        sandboxId,
        port: 2222,
        instanceId,
        shellToken,
        command: `tsa ssh ${alias || sandboxId}`,
        ...(alias && { alias }),
        ...(initError && { initError }),
        ...(subdomain && { subdomain }),
        ...(portUrlTemplate && { portUrlTemplate }),
      },
    })
  },
}
