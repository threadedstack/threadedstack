import type { TApp } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { TScheduleExecutor } from '@TBE/services/scheduler/scheduler'
import type {
  Schedule,
  TStreamEvent,
  TKubeSandboxConfig,
  TSandboxRuntimeId,
} from '@tdsk/domain'

import { AgentRunner } from '@tdsk/agent'
import { logger } from '@TBE/utils/logger'
import { ExecTimeoutMS } from '@TBE/constants/sandbox'
import { EScheduleType, SandboxRuntimeConfigs } from '@tdsk/domain'
import { resolveAgentConfig } from '@TBE/utils/agent/resolveAgentConfig'

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

/** Race a promise against the shared execution timeout. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms)
    timer.unref()
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer!))
}

/**
 * Resolve the durable continuity thread for an agent-backed schedule.
 * Reuses schedule.threadId when set; otherwise creates one and persists it
 * back onto the schedule so subsequent heartbeats share the same episodic thread.
 * A persist failure (error or zero rows matched) throws and fails the run —
 * otherwise every heartbeat would silently orphan a new thread, defeating
 * durable continuity.
 */
async function resolveContinuityThread(
  db: TDatabase,
  schedule: Schedule,
  orgId: string
): Promise<string> {
  if (schedule.threadId) return schedule.threadId

  const { data: thread, error } = await db.services.thread.create({
    orgId,
    userId: schedule.userId as string,
    agentId: schedule.agentId,
    projectId: schedule.projectId,
    name: `Heartbeat ${schedule.id}`,
  })
  if (error || !thread)
    throw new Error(`Failed to create continuity thread: ${error?.message || 'unknown'}`)

  const { data: updated, error: updErr } = await db.services.schedule.update({
    id: schedule.id,
    threadId: thread.id,
  })
  if (updErr || !updated)
    throw new Error(
      `Failed to persist continuity thread ${thread.id} on schedule ${schedule.id}: ${updErr?.message || `schedule not found`}`
    )

  return thread.id
}

/**
 * Agent-brain execution path: resolve the agent's config and run the agent
 * against the durable continuity thread, streaming events to stdout.
 * Returns the started pod name (if any) so the caller can tear it down.
 */
async function runAgentSchedule(
  app: TApp,
  schedule: Schedule,
  onStdout: (chunk: string) => void
): Promise<{ instanceId?: string }> {
  const { db } = app.locals

  if (!schedule.agentId) throw new Error(`runAgentSchedule called without agentId`)
  if (!schedule.prompt)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no prompt`)
  // threads.user_id is NOT NULL while schedules.user_id is nullable (onDelete: set null),
  // so a missing user must fail loudly here, not as a raw DB constraint error mid-run.
  if (!schedule.userId)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no userId`)

  const config = await resolveAgentConfig(schedule.agentId, db, app, {
    userId: schedule.userId,
    projectId: schedule.projectId,
  })

  const threadId = await resolveContinuityThread(db, schedule, config.orgId)

  const handle = await AgentRunner.run({
    prompt: schedule.prompt,
    userId: schedule.userId,
    agentId: schedule.agentId,
    threadId,
    soul: config.soul,
    db: config.db,
    orgId: config.orgId,
    tools: config.tools,
    skills: config.skills,
    llmConfig: config.llmConfig,
    environment: config.environment,
    sandboxConfig: config.sandboxConfig,
    onExecuteFunction: config.onExecuteFunction,
    customFunctions: config.customFunctions || [],
    onEvent: (event: TStreamEvent) => onStdout(`${JSON.stringify(event)}\n`),
  })

  await handle.waitForIdle()

  return { instanceId: config.sandboxConfig?.options?.podName as string | undefined }
}

export function createScheduleExecutor(app: TApp): TScheduleExecutor {
  return async (schedule: Schedule) => {
    const { db, sandbox, s3 } = app.locals
    if (!sandbox)
      throw new Error(
        `Sandbox service not available — cannot execute schedule ${schedule.id}`
      )

    const start = Date.now()

    // Agent-backed schedules validate userId inside runAgentSchedule so the
    // failure is recorded on the run; pod schedules fail fast before pod start
    if (!schedule.agentId && !schedule.userId)
      throw new Error(
        `Schedule ${schedule.id} has no userId — cannot start pod without ownership`
      )

    const { data: run, error: runErr } = await db.services.scheduleRun.create({
      status: `running`,
      orgId: schedule.orgId,
      startedAt: new Date(),
      scheduleId: schedule.id,
      projectId: schedule.projectId,
    })

    if (runErr || !run) {
      logger.error(`[Executor] Failed to create schedule run record:`, runErr?.message)
      throw new Error(`Failed to create schedule run: ${runErr?.message || 'unknown'}`)
    }

    const stdoutKey = `${schedule.orgId}/runs/${run.id}/stdout`
    const stderrKey = `${schedule.orgId}/runs/${run.id}/stderr`
    const stdoutUpload = s3.createUploadStream(stdoutKey)
    const stderrUpload = s3.createUploadStream(stderrKey)

    let instanceId: string | undefined
    let markedComplete = false

    const finalizeUploads = async (): Promise<boolean> => {
      stdoutUpload?.stream.end()
      stderrUpload?.stream.end()
      try {
        await Promise.all([stdoutUpload?.done(), stderrUpload?.done()])
        return true
      } catch (uploadErr) {
        logger.error(
          `[Executor] Schedule ${schedule.id} — S3 upload failed:`,
          (uploadErr as Error).message
        )
        return false
      }
    }

    try {
      if (schedule.agentId) {
        const agentRun = await withTimeout(
          runAgentSchedule(app, schedule, (chunk) => stdoutUpload?.stream.write(chunk)),
          ExecTimeoutMS
        )
        instanceId = agentRun.instanceId

        const uploadOk = await finalizeUploads()
        const { error: completeErr } = await db.services.scheduleRun.complete(run.id, {
          instanceId,
          durationMs: Date.now() - start,
          status: `success`,
          ...(uploadOk && { stdoutKey, stderrKey }),
        })
        completeErr
          ? logger.error(
              `[Executor] Failed to write completion record for run ${run.id} (schedule ${schedule.id}): ${completeErr.message}`
            )
          : (markedComplete = true)

        logger.info(
          `[Executor] Schedule ${schedule.id} — agent run completed in ${Date.now() - start}ms`
        )
        return
      }

      instanceId = await sandbox.startPod({
        orgId: schedule.orgId,
        userId: schedule.userId,
        sandboxId: schedule.sandboxId,
        projectId: schedule.projectId,
        egressOpts: app.locals.config.egress,
      })

      logger.info(`[Executor] Schedule ${schedule.id} — pod started: ${instanceId}`)

      const { data: sandboxRecord } = await db.services.sandbox.get(schedule.sandboxId)
      if (!sandboxRecord)
        throw new Error(`Sandbox config not found: ${schedule.sandboxId}`)

      const effective = sandboxRecord.getEffectiveConfig
        ? sandboxRecord.getEffectiveConfig(schedule.projectId)
        : sandboxRecord

      if (effective === sandboxRecord && schedule.projectId)
        logger.warn(
          `[Executor] Schedule ${schedule.id} — no project-specific config for project ${schedule.projectId}; using base sandbox config`
        )

      const sandboxConfig = effective.config as TKubeSandboxConfig
      const command = resolveScheduleCommand(schedule, sandboxConfig)

      const sbInstance = await sandbox.getSandbox(instanceId)

      const sbExecPromise = sbInstance.execStreaming
        ? sbInstance.execStreaming(command, [], {
            onStdout: (chunk) => stdoutUpload?.stream.write(chunk),
            onStderr: (chunk) => stderrUpload?.stream.write(chunk),
          })
        : sbInstance.exec(command).then((r) => {
            if (r.output) stdoutUpload?.stream.write(r.output)
            return r
          })

      let execTimer: ReturnType<typeof setTimeout>
      const timeoutPromise = new Promise<never>((_, reject) => {
        execTimer = setTimeout(
          () => reject(new Error(`Timed out after ${ExecTimeoutMS / 1000}s`)),
          ExecTimeoutMS
        )
        execTimer.unref()
      })

      let result
      try {
        result = await Promise.race([sbExecPromise, timeoutPromise])
      } finally {
        clearTimeout(execTimer!)
      }

      const uploadOk = await finalizeUploads()

      const { error: completeErr } = await db.services.scheduleRun.complete(run.id, {
        instanceId,
        error: result.error,
        durationMs: Date.now() - start,
        status: result.success ? `success` : `error`,
        ...(uploadOk && { stdoutKey, stderrKey }),
      })

      completeErr
        ? logger.error(
            `[Executor] Failed to write completion record for run ${run.id} (schedule ${schedule.id}): ${completeErr.message}`
          )
        : (markedComplete = true)

      if (!result.success)
        throw new Error(
          result.error || `Command exited with non-zero code ${result.exitCode}`
        )

      logger.info(
        `[Executor] Schedule ${schedule.id} — completed successfully in ${Date.now() - start}ms`
      )
    } catch (err: any) {
      if (!markedComplete) {
        const uploadOk = await finalizeUploads()

        const isTimeout = err?.message?.includes(`Timed out`)
        await db.services.scheduleRun
          .complete(run.id, {
            instanceId,
            durationMs: Date.now() - start,
            error: err?.message || String(err),
            status: isTimeout ? `timeout` : `error`,
            ...(uploadOk && { stdoutKey, stderrKey }),
          })
          .catch((e: any) =>
            logger.error(
              `[Executor] Failed to mark run ${run.id} (schedule ${schedule.id}) as error:`,
              e
            )
          )
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
        }
      }
    }
  }
}
