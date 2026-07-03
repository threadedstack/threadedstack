import type { TApp } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { TScheduleExecutor } from '@TBE/services/scheduler/scheduler'
import type {
  Agent,
  Schedule,
  TStreamEvent,
  TSandboxResult,
  TKubeSandboxConfig,
  TSandboxRuntimeId,
} from '@tdsk/domain'

import { AgentRunner } from '@tdsk/agent'
import { logger } from '@TBE/utils/logger'
import { ExecTimeoutMS } from '@TBE/constants/sandbox'
import {
  EMsgType,
  EAgentBrain,
  EContentType,
  EScheduleType,
  SandboxRuntimeConfigs,
} from '@tdsk/domain'
import { resolveAgentConfig } from '@TBE/utils/agent/resolveAgentConfig'

/** Max characters of the previous report composed into a CLI-brain prompt (tail-capped) */
const PrevReportMaxChars = 8000

/** Max bytes of stdout buffered in memory for CLI-brain message persistence (tail-capped) */
const StdoutBufferMaxBytes = 256 * 1024

/** Escape single quotes so text can be embedded in a single-quoted shell argument. */
function escapePromptArg(text: string): string {
  return text.replace(/'/g, `'\\''`)
}

/**
 * Single-pass placeholder substitution for prompt command templates.
 * A function replacer is immune to `$&`/`` $` ``-style replacement patterns
 * in the substituted text (souls, prompts, and previous reports are arbitrary
 * text — prior LLM output realistically contains `$` sequences, and shell
 * escaping itself produces `'\''` adjacent to `$`). A single pass also cannot
 * re-match placeholder text introduced by an earlier substitution (e.g. a soul
 * containing the literal text `{prompt}` must never consume the template's
 * real `{prompt}` placeholder). Placeholders without a provided value are
 * left untouched.
 */
function substitutePlaceholders(
  template: string,
  values: Partial<Record<`prompt` | `soul`, string>>
): string {
  return template.replace(/\{(prompt|soul)\}/g, (match, key: `prompt` | `soul`) => {
    const value = values[key]
    return value === undefined ? match : value
  })
}

/**
 * Resolve the prompt command template for a sandbox config,
 * validating that a template exists and carries the {prompt} placeholder.
 */
function resolvePromptTemplate(sandboxConfig: TKubeSandboxConfig): string {
  const template =
    sandboxConfig.promptCommand ||
    SandboxRuntimeConfigs[sandboxConfig.runtime as TSandboxRuntimeId]?.promptCommand

  if (!template)
    throw new Error(`No prompt command template for runtime "${sandboxConfig.runtime}"`)

  if (!template.includes(`{prompt}`))
    throw new Error(
      `Prompt command template for runtime "${sandboxConfig.runtime}" is missing {prompt} placeholder`
    )

  return template
}

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

  const template = resolvePromptTemplate(sandboxConfig)
  return substitutePlaceholders(template, {
    prompt: escapePromptArg(schedule.prompt),
  })
}

/**
 * Load a sandbox record and resolve its effective config for the schedule's
 * project, warning when the project has no sandbox-specific overrides.
 */
async function resolveEffectiveSandboxConfig(
  db: TDatabase,
  sandboxId: string,
  schedule: Schedule
): Promise<TKubeSandboxConfig> {
  const { data: sandboxRecord } = await db.services.sandbox.get(sandboxId)
  if (!sandboxRecord) throw new Error(`Sandbox config not found: ${sandboxId}`)

  const effective = sandboxRecord.getEffectiveConfig
    ? sandboxRecord.getEffectiveConfig(schedule.projectId)
    : sandboxRecord

  if (effective === sandboxRecord && schedule.projectId)
    logger.warn(
      `[Executor] Schedule ${schedule.id} — no project-specific config for project ${schedule.projectId}; using base sandbox config`
    )

  return effective.config as TKubeSandboxConfig
}

/** Race a promise against the resolved execution timeout (per-schedule override or shared default). */
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
  onStdout: (chunk: string) => void,
  onPodStart: (instanceId: string) => void
): Promise<{ instanceId?: string }> {
  const { db } = app.locals

  if (!schedule.agentId) throw new Error(`runAgentSchedule called without agentId`)
  if (!schedule.prompt)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no prompt`)
  // threads.user_id is NOT NULL while schedules.user_id is nullable (onDelete: set null),
  // so a missing user must fail loudly here, not as a raw DB constraint error mid-run.
  if (!schedule.userId)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no userId`)

  // onPodStart records the pod name in the caller's teardown variable the
  // moment resolveAgentConfig starts it — a later throw (readiness wait,
  // runner init, LLM config) can no longer leak the pod until the idle reaper.
  const config = await resolveAgentConfig(schedule.agentId, db, app, {
    userId: schedule.userId,
    projectId: schedule.projectId,
    onPodStart,
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
    llmConfigs: config.llmConfigs,
    environment: config.environment,
    sandboxConfig: config.sandboxConfig,
    onExecuteFunction: config.onExecuteFunction,
    customFunctions: config.customFunctions || [],
    onEvent: (event: TStreamEvent) => onStdout(`${JSON.stringify(event)}\n`),
  })

  await handle.waitForIdle()

  return { instanceId: config.sandboxConfig?.options?.podName as string | undefined }
}

/**
 * Fetch the most recent assistant message text from the continuity thread,
 * tail-capped at PrevReportMaxChars. Returns an empty string when the thread
 * has no assistant messages; a load failure only degrades context (logged),
 * it never fails the run.
 */
async function fetchPreviousReport(db: TDatabase, threadId: string): Promise<string> {
  const { data: messages, error } = await db.services.message.listByThread(threadId)
  if (error) {
    logger.error(
      `[Executor] Failed to load previous messages for thread ${threadId}:`,
      error.message
    )
    return ``
  }

  const lastAssistant = [...(messages || [])]
    .reverse()
    .find((message) => message.type === EMsgType.assistant)
  if (!lastAssistant) return ``

  const text = (lastAssistant.content || [])
    .filter(
      (part): part is { type: `text`; text: string } =>
        part?.type === EContentType.text && typeof (part as any).text === `string`
    )
    .map((part) => part.text)
    .join(`\n`)

  return text.length > PrevReportMaxChars ? text.slice(-PrevReportMaxChars) : text
}

/**
 * Compose the CLI-brain shell command from the runtime's prompt template.
 * The soul is substituted into a {soul} placeholder when the template has one,
 * otherwise prepended to the prompt payload (soul, then previous report, then prompt).
 */
function buildCliCommand(
  schedule: Schedule,
  agent: Agent,
  sandboxConfig: TKubeSandboxConfig,
  previousReport: string
): string {
  const template = resolvePromptTemplate(sandboxConfig)
  const reportSection = previousReport
    ? `## Your previous report\n${previousReport}\n\n`
    : ``

  if (template.includes(`{soul}`))
    return substitutePlaceholders(template, {
      soul: escapePromptArg(agent.soul || ``),
      prompt: escapePromptArg(`${reportSection}${schedule.prompt}`),
    })

  const soulSection = agent.soul ? `${agent.soul}\n\n` : ``
  return substitutePlaceholders(template, {
    prompt: escapePromptArg(`${soulSection}${reportSection}${schedule.prompt}`),
  })
}

type TCliRunHooks = {
  onPodStart: (instanceId: string) => void
  onStdout: (chunk: string | Buffer) => void
  onStderr: (chunk: string | Buffer) => void
}

/**
 * Runtime-brain execution path: run the schedule prompt through the CLI AI tool
 * in the agent's body sandbox pod (via the runtime's promptCommand) and persist
 * the tool's output into the durable continuity thread. Deliberately avoids
 * resolveAgentConfig — runtime-brain agents may have zero agent providers; their
 * credentials ride on the body sandbox's provider links.
 */
async function runCliAgentSchedule(
  app: TApp,
  schedule: Schedule,
  agent: Agent,
  hooks: TCliRunHooks
): Promise<TSandboxResult> {
  const { db, sandbox } = app.locals

  if (!schedule.agentId) throw new Error(`runCliAgentSchedule called without agentId`)
  if (!schedule.prompt)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no prompt`)
  // threads.user_id is NOT NULL while schedules.user_id is nullable (onDelete: set null),
  // so a missing user must fail loudly here, not as a raw DB constraint error mid-run.
  if (!schedule.userId)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no userId`)

  const bodySandboxId = agent.environment?.sandboxId || schedule.sandboxId
  if (!bodySandboxId)
    throw new Error(
      `Schedule ${schedule.id} agent has runtime brain but no body sandbox — set agent.environment.sandboxId or schedule.sandboxId`
    )

  const threadId = await resolveContinuityThread(db, schedule, schedule.orgId)
  const previousReport = await fetchPreviousReport(db, threadId)

  const instanceId = await sandbox!.startPod({
    orgId: schedule.orgId,
    userId: schedule.userId,
    sandboxId: bodySandboxId,
    projectId: schedule.projectId,
    egressOpts: app.locals.config.egress,
  })
  // Recorded immediately via hook so the caller's finally block always reaps the pod,
  // even when a later step throws
  hooks.onPodStart(instanceId)

  logger.info(`[Executor] Schedule ${schedule.id} — CLI-brain pod started: ${instanceId}`)

  // The pod is created asynchronously (and clones repos before the entrypoint
  // command runs) — exec'ing before it is ready fails with "not running".
  // instanceId is already recorded via onPodStart, so the caller's finally
  // block still reaps the pod when this wait throws.
  await sandbox!.waitForPodReady(instanceId, { cloneCheck: true })

  const sandboxConfig = await resolveEffectiveSandboxConfig(db, bodySandboxId, schedule)
  const command = buildCliCommand(schedule, agent, sandboxConfig, previousReport)

  // Accumulate raw Buffers with byte accounting and decode ONCE at the end.
  // Decoding each chunk individually corrupts multibyte characters split
  // across chunk boundaries (U+FFFD), and capping by string length counts
  // UTF-16 code units instead of bytes. Trimming from the FRONT keeps the
  // tail; a leading partial character after a byte-boundary trim is acceptable.
  const stdoutChunks: Buffer[] = []
  let stdoutBytes = 0
  const bufferStdout = (chunk: string | Buffer) => {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    stdoutChunks.push(buf)
    stdoutBytes += buf.length
    while (stdoutBytes > StdoutBufferMaxBytes) {
      const excess = stdoutBytes - StdoutBufferMaxBytes
      const head = stdoutChunks[0]
      if (head.length <= excess) {
        stdoutChunks.shift()
        stdoutBytes -= head.length
      } else {
        stdoutChunks[0] = head.subarray(excess)
        stdoutBytes -= excess
      }
    }
  }

  const sbInstance = await sandbox!.getSandbox(instanceId)

  const sbExecPromise = sbInstance.execStreaming
    ? sbInstance.execStreaming(command, [], {
        onStdout: (chunk: Buffer) => {
          bufferStdout(chunk)
          hooks.onStdout(chunk)
        },
        onStderr: (chunk: Buffer) => hooks.onStderr(chunk),
      })
    : sbInstance.exec(command).then((r) => {
        if (r.output) {
          bufferStdout(r.output)
          hooks.onStdout(r.output)
        }
        return r
      })

  const result = await withTimeout(sbExecPromise, schedule.timeoutMs ?? ExecTimeoutMS)

  // Only successful runs feed the continuity thread — never poison it with garbage.
  // Persistence failures are logged, not fatal: the report is still in S3.
  if (result.success) {
    const stdoutText = Buffer.concat(stdoutChunks).toString(`utf8`)
    const { error: userErr } = await db.services.message.create({
      threadId,
      type: EMsgType.user,
      orgId: schedule.orgId,
      content: [{ type: EContentType.text, text: schedule.prompt }],
    })
    const { error: assistantErr } = await db.services.message.create({
      threadId,
      type: EMsgType.assistant,
      orgId: schedule.orgId,
      content: [{ type: EContentType.text, text: stdoutText }],
    })
    if (userErr || assistantErr)
      logger.error(
        `[Executor] Schedule ${schedule.id} — failed to persist CLI-brain messages to thread ${threadId}:`,
        (userErr || assistantErr)?.message
      )
  }

  return result
}

export function createScheduleExecutor(app: TApp): TScheduleExecutor {
  return async (schedule: Schedule) => {
    const { db, sandbox, s3 } = app.locals
    if (!sandbox)
      throw new Error(
        `Sandbox service not available — cannot execute schedule ${schedule.id}`
      )

    const start = Date.now()
    // Per-schedule override with the shared execution timeout as the fallback
    const timeoutMs = schedule.timeoutMs ?? ExecTimeoutMS

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
        const { data: scheduleAgent, error: agentErr } = await db.services.agent.get(
          schedule.agentId
        )
        if (agentErr)
          throw new Error(`Failed to load agent ${schedule.agentId}: ${agentErr.message}`)
        if (!scheduleAgent) throw new Error(`Agent not found: ${schedule.agentId}`)

        if (scheduleAgent.brain === EAgentBrain.runtime) {
          const result = await runCliAgentSchedule(app, schedule, scheduleAgent, {
            onPodStart: (id) => (instanceId = id),
            onStdout: (chunk) => stdoutUpload?.stream.write(chunk),
            onStderr: (chunk) => stderrUpload?.stream.write(chunk),
          })

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
            `[Executor] Schedule ${schedule.id} — CLI-brain run completed in ${Date.now() - start}ms`
          )
          return
        }

        const agentRun = await withTimeout(
          runAgentSchedule(
            app,
            schedule,
            (chunk) => stdoutUpload?.stream.write(chunk),
            // Captured immediately after startPod so the finally block reaps
            // the pod even when a later step throws before the run returns
            (id) => (instanceId = id)
          ),
          timeoutMs
        )
        // Preserves teardown for agents whose podName came from a pre-existing
        // environment.instanceId (no startPod, so onPodStart never fires)
        instanceId = agentRun.instanceId ?? instanceId

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

      // instanceId is already assigned, so the finally block still reaps the
      // pod when the readiness wait throws (Failed pod, timeout, etc.)
      await sandbox.waitForPodReady(instanceId, { cloneCheck: true })

      const sandboxConfig = await resolveEffectiveSandboxConfig(
        db,
        schedule.sandboxId,
        schedule
      )
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
          () => reject(new Error(`Timed out after ${timeoutMs / 1000}s`)),
          timeoutMs
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
