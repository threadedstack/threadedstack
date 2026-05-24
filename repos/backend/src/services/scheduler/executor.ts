import type { TApp } from '@TBE/types'
import type { TScheduleExecutor } from '@TBE/services/scheduler/scheduler'
import type { Schedule, TKubeSandboxConfig, TSandboxRuntimeId } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { ExecTimeoutMS } from '@TBE/constants/sandbox'
import { EScheduleType, SandboxRuntimeConfigs } from '@tdsk/domain'

function resolveScheduleCommand(
  schedule: Schedule,
  sandboxConfig: TKubeSandboxConfig
): string {
  if (schedule.type === EScheduleType.shell) {
    if (!schedule.command)
      throw new Error(`Schedule ${schedule.id} has type=shell but no command`)
    return schedule.command
  }

  if (!schedule.prompt)
    throw new Error(`Schedule ${schedule.id} has type=prompt but no prompt`)

  const template =
    sandboxConfig.promptCommand ||
    SandboxRuntimeConfigs[sandboxConfig.runtime as TSandboxRuntimeId]?.promptCommand

  if (!template)
    throw new Error(`No prompt command template for runtime "${sandboxConfig.runtime}"`)

  if (!template.includes(`{prompt}`))
    throw new Error(
      `Prompt command template for runtime "${sandboxConfig.runtime}" is missing {prompt} placeholder`
    )

  const escaped = schedule.prompt.replace(/'/g, `'\\''`)
  return template.replace(`{prompt}`, escaped)
}

export function createScheduleExecutor(app: TApp): TScheduleExecutor {
  return async (schedule: Schedule) => {
    const { db, sandbox } = app.locals
    if (!sandbox)
      throw new Error(
        `Sandbox service not available — cannot execute schedule ${schedule.id}`
      )

    const start = Date.now()

    if (!schedule.userId)
      throw new Error(
        `Schedule ${schedule.id} has no userId — cannot start pod without ownership`
      )

    const { data: run, error: runErr } = await db.services.scheduleRun.create({
      status: `running`,
      orgId: schedule.orgId,
      startedAt: new Date(),
      scheduleId: schedule.id,
    })

    if (runErr || !run) {
      logger.error(`[Executor] Failed to create schedule run record:`, runErr?.message)
      throw new Error(`Failed to create schedule run: ${runErr?.message || 'unknown'}`)
    }

    let instanceId: string | undefined
    let markedComplete = false
    const outputChunks: string[] = []

    try {
      instanceId = await sandbox.startPod({
        orgId: schedule.orgId,
        userId: schedule.userId,
        sandboxId: schedule.sandboxId,
        egressOpts: app.locals.config.egress,
      })

      logger.info(`[Executor] Schedule ${schedule.id} — pod started: ${instanceId}`)

      const { data: sandboxRecord } = await db.services.sandbox.get(schedule.sandboxId)
      if (!sandboxRecord)
        throw new Error(`Sandbox config not found: ${schedule.sandboxId}`)

      const sandboxConfig = sandboxRecord.config as TKubeSandboxConfig
      const command = resolveScheduleCommand(schedule, sandboxConfig)

      const sbInstance = await sandbox.getSandbox(instanceId)

      const execPromise = sbInstance.execStreaming
        ? sbInstance.execStreaming(command, [], {
            onStdout: (chunk) => outputChunks.push(chunk.toString()),
            onStderr: (chunk) => outputChunks.push(chunk.toString()),
          })
        : sbInstance.exec(command).then((r) => {
            if (r.output) outputChunks.push(r.output)
            return r
          })

      let execTimer: ReturnType<typeof setTimeout>
      const timeoutPromise = new Promise<never>((_, reject) => {
        execTimer = setTimeout(
          () => reject(new Error(`Execution timed out after ${ExecTimeoutMS / 1000}s`)),
          ExecTimeoutMS
        )
        execTimer.unref()
      })

      let result
      try {
        result = await Promise.race([execPromise, timeoutPromise])
      } finally {
        clearTimeout(execTimer!)
      }

      const { error: completeErr } = await db.services.scheduleRun.complete(run.id, {
        instanceId,
        error: result.error,
        output: outputChunks.join(''),
        durationMs: Date.now() - start,
        status: result.success ? `success` : `error`,
      })

      completeErr
        ? logger.error(
            `[Executor] Schedule ${schedule.id} — failed to write completion record: ${completeErr.message}`
          )
        : (markedComplete = true)

      if (!result.success)
        throw new Error(result.error || `Command exited with code ${result.exitCode}`)

      logger.info(
        `[Executor] Schedule ${schedule.id} — completed successfully in ${Date.now() - start}ms`
      )
    } catch (err: any) {
      if (!markedComplete) {
        const isTimeout = err?.message?.includes(`timed out`)
        await db.services.scheduleRun
          .complete(run.id, {
            instanceId,
            output: outputChunks.join(''),
            durationMs: Date.now() - start,
            error: err?.message || String(err),
            status: isTimeout ? `timeout` : `error`,
          })
          .catch((e: any) => logger.error(`[Executor] Failed to mark run as error:`, e))
      }

      logger.error(`[Executor] Schedule ${schedule.id} failed:`, err?.message || err)
      throw err
    } finally {
      if (instanceId) {
        try {
          await sandbox.stopPod(instanceId)
          logger.info(`[Executor] Schedule ${schedule.id} — pod stopped: ${instanceId}`)
        } catch (stopErr: any) {
          logger.error(`[Executor] Failed to stop pod ${instanceId}:`, stopErr?.message)
          await db.services.scheduleRun
            .appendOutput(run.id, `\n[WARN] Pod cleanup failed: ${stopErr?.message}`)
            .catch((appendErr: any) =>
              logger.warn(
                `[Executor] Failed to append stop warning to run ${run.id}:`,
                appendErr?.message
              )
            )
        }
      }
    }
  }
}
