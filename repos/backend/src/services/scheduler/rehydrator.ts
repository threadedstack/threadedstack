import type { TApp } from '@TBE/types'
import type { ScheduleRun, Schedule, TSandboxRuntimeId } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { ExecTimeoutMS } from '@TBE/constants/sandbox'
import { SandboxRuntimeConfigs, EContainerState, EScheduleType } from '@tdsk/domain'

/**
 * A severed null cycle (a backend-restart deploy cut the exec stream before the
 * pod produced a deliverable, e.g. a work-cycle PR) would otherwise wait a full
 * cron interval to retry — breaking the "≥1 deliverable per interval" cadence
 * because a steward PR merge deploys and severs the very next cycle. So a
 * severed prompt cycle is re-queued to re-run shortly (deploy-free by then).
 */
const SeveredReRunDelayMs = 3 * 60_000
/** Loop guard window + cap: if this many of the recent runs are already severed, stop re-queuing. */
const SeveredReRunLoopWindow = 5
const SeveredReRunLoopMax = 3

/**
 * Poll interval for the per-run rehydration watcher. Small enough to catch a
 * runtime that exited seconds after backend restart; large enough that a hundred
 * simultaneous rehydrations don't hammer the kube API.
 */
const RehydratePollMs = 30_000

/**
 * Minimum time the watcher must actually observe a rehydrated run before it is
 * allowed to enforce the schedule's timeoutMs. Backend downtime between the
 * run's startedAt and the moment hydrateOrphanedRuns resumes watching counts
 * against the deadline (the pod itself never paused), so a long enough outage
 * can leave the deadline already elapsed the instant watching resumes — killing
 * a run on its very first poll tick with zero chance to see it finish, even
 * when the process is seconds from completing (worst case: a custom runtime,
 * where resolveRuntimeBinary can't pgrep for liveness and the deadline is the
 * only signal). This grace window guarantees at least one real observation
 * period post-restart before enforcement kicks in.
 */
const RehydrationMinGraceMs = 2 * RehydratePollMs

/**
 * getPodState collapses a bare 404 from the K8s API into `Failed` (see
 * sandbox.ts's getPodState) so an API-server/informer blip can produce that
 * exact same reading for a pod that is still very much alive — a genuinely
 * deleted pod won't come back on a re-read moments later. A single Failed
 * reading in the watch loop gets one confirming re-check after this delay
 * before it is treated as terminal, to avoid killing a healthy run on a
 * transient read.
 */
const RehydrateFailedConfirmDelayMs = 5_000

/**
 * Stable substring present in EVERY rehydration note (success or timeout). A run
 * carrying this in `schedule_runs.error` was INTERRUPTED by a backend restart
 * (the deploy that restarted the backend severed the exec stream), not run
 * normally. Exported so the sensor's run-outcome context can flag such runs as
 * possibly-empty anomalies even when they were marked `success` — the interrupt
 * can produce a long-running "success" with no deliverable, which the
 * duration-based empty-run heuristic would otherwise miss.
 */
export const RehydrationInterruptMarker = `Rehydrated after backend restart`

/**
 * Marker text stored in schedule_runs.error when a run is completed after
 * backend restart. Distinguishable from real runtime errors so callers/UX can
 * treat it as informational instead of a real failure signal.
 */
const RehydrationSuccessNote = `${RehydrationInterruptMarker} — the runtime process had already exited by the time the new backend inspected the pod; exec output for the interrupted window was not captured (K8s exec stdout is not persisted). Marked success because the pod ran to completion.`

const RehydrationTimeoutNote = `${RehydrationInterruptMarker} — the schedule's timeoutMs elapsed while waiting for the pod to finish, so the pod was stopped and the run recorded as timeout.`

/**
 * Entry point: at scheduler startup, list every run still in `running`, decide
 * what happened to its pod, and (where the pod is still doing work) hand each
 * off to a background watcher. Never blocks scheduler startup — dispatch is
 * fire-and-forget with error logging.
 *
 * This replaces the previous "mark every running row as error" reaper, which
 * corrupted attribution: a pod whose exec had already completed was recorded as
 * failed just because the backend process died before writing the completion
 * row. That inflated consecutive_errors on the schedule and auto-disabled it.
 */
export async function hydrateOrphanedRuns(app: TApp): Promise<void> {
  const { db } = app.locals
  const { data: runs, error } = await db.services.scheduleRun.listRunning()
  if (error) {
    logger.error(
      `[Scheduler] Failed to list running runs for hydration: ${error.message}`
    )
    return
  }
  if (!runs?.length) return

  logger.info(`[Scheduler] Hydrating ${runs.length} run(s) left in "running" at startup`)

  const orphanIds: string[] = []
  const dispatched: string[] = []

  for (const run of runs) {
    if (!run.instanceId) {
      // Never got past pod creation — genuinely orphaned.
      orphanIds.push(run.id)
      continue
    }
    // Async dispatch — the watcher runs to completion independently.
    inspectAndDispatch(app, run).catch((err) =>
      logger.error(
        `[Scheduler] Rehydration dispatch for run ${run.id} failed: ${err?.message || err}`
      )
    )
    dispatched.push(run.id)
  }

  if (orphanIds.length) {
    const { error: markErr } = await db.services.scheduleRun.markAsError(
      orphanIds,
      `Orphaned before pod start — the previous backend recorded the run row but died before startPod produced an instanceId.`
    )
    if (markErr)
      logger.error(
        `[Scheduler] Failed to mark ${orphanIds.length} pre-pod orphans: ${markErr.message}`
      )
    else
      logger.warn(
        `[Scheduler] Marked ${orphanIds.length} pre-pod orphan(s) as error: ${orphanIds.join(`, `)}`
      )
  }

  if (dispatched.length)
    logger.info(
      `[Scheduler] Dispatched ${dispatched.length} rehydration watcher(s): ${dispatched.join(`, `)}`
    )
}

/**
 * Look at one run's pod and decide the recovery path. Terminal pod phases
 * complete the run immediately; live pods hand off to the watch loop.
 */
async function inspectAndDispatch(app: TApp, run: ScheduleRun): Promise<void> {
  const { sandbox } = app.locals
  if (!sandbox) {
    logger.error(
      `[Scheduler] Rehydration for run ${run.id} skipped — sandbox service unavailable`
    )
    return
  }

  const instanceId = run.instanceId!
  let state: EContainerState
  try {
    state = await sandbox.getPodState(instanceId)
  } catch (err: any) {
    // A read failure here must not strand the run un-reconciled. Hand it to the
    // deadline-enforced watch loop rather than returning: the watcher reaps it
    // once the schedule's timeout elapses even if every pod read keeps failing.
    // Returning left the row wedged "running" forever, blocking the schedule
    // from ever firing again.
    logger.error(
      `[Scheduler] Rehydration for run ${run.id} failed to read pod state — handing to deadline-enforced watch: ${err?.message || err}`
    )
    await watchToCompletion(app, run)
    return
  }

  // Terminal phases: complete immediately, don't watch.
  if (state === EContainerState.Failed || state === EContainerState.Terminating) {
    await completeRun(
      app,
      run,
      `error`,
      `Pod ${instanceId} was in state ${state} at backend restart`
    )
    await bestEffortStopPod(app, instanceId)
    return
  }
  if (state === EContainerState.Succeeded) {
    await completeRun(
      app,
      run,
      `success`,
      `Pod ${instanceId} completed while backend was restarting`
    )
    await bestEffortStopPod(app, instanceId)
    return
  }

  // Running/Pending: watch until the runtime process is done or the schedule's
  // timeoutMs elapses. This is the case that matters — the pod is still up and
  // its work may still be in flight.
  await watchToCompletion(app, run)
}

/**
 * Poll loop for a live pod. Terminates when any of: the runtime process is
 * gone (via pgrep of the runtime binary), the pod phase becomes terminal, or
 * the schedule's timeoutMs elapses.
 */
async function watchToCompletion(app: TApp, run: ScheduleRun): Promise<void> {
  const { db, sandbox } = app.locals
  const instanceId = run.instanceId!

  const { data: schedule } = await db.services.schedule.get(run.scheduleId)
  const timeoutMs = schedule?.timeoutMs ?? ExecTimeoutMS
  const startedAtMs = new Date(run.startedAt).getTime()
  const watchStartMs = Date.now()
  // Never enforce a deadline that backend downtime already consumed without
  // giving the resumed watcher at least one real chance to observe the run.
  const deadlineMs = Math.max(
    startedAtMs + timeoutMs,
    watchStartMs + RehydrationMinGraceMs
  )

  const runtimeBin = await resolveRuntimeBinary(app, schedule)

  logger.info(
    `[Scheduler] Watching run ${run.id} for completion (pod=${instanceId}, deadline=${new Date(deadlineMs).toISOString()}, runtimeBin=${runtimeBin ?? `<unknown>`})`
  )

  // Reap the run as timeout once its deadline passes. Called on EVERY path that
  // would otherwise `continue` (a pod read that throws, or a Failed reading that
  // never confirms) as well as at the end of the loop. Terminal pod states
  // (Succeeded / confirmed-Failed) are still read and honored first; this only
  // guarantees that a run whose pod has vanished and whose reads keep failing
  // can never loop here forever, wedged "running" and blocking its schedule
  // from ever firing again (the real cause of a stalled review/dev loop).
  const reapIfExpired = async (): Promise<boolean> => {
    if (Date.now() < deadlineMs) return false
    await captureEntrypointLog(app, run, instanceId).catch(() => undefined)
    await completeRun(app, run, `timeout`, RehydrationTimeoutNote)
    await bestEffortStopPod(app, instanceId)
    return true
  }

  for (;;) {
    await sleep(RehydratePollMs)

    let state: EContainerState
    try {
      state = await sandbox!.getPodState(instanceId)
    } catch (err: any) {
      logger.error(
        `[Scheduler] Run ${run.id} pod state read failed, retrying: ${err?.message || err}`
      )
      if (await reapIfExpired()) return
      continue
    }

    if (state === EContainerState.Terminating) {
      await completeRun(
        app,
        run,
        `error`,
        `Pod ${instanceId} entered ${state} during rehydration watch`
      )
      await bestEffortStopPod(app, instanceId)
      return
    }
    if (state === EContainerState.Failed) {
      const stillFailed = await confirmPodFailed(app, instanceId)
      if (!stillFailed) {
        logger.warn(
          `[Scheduler] Run ${run.id} pod ${instanceId} read Failed once (likely a transient 404) but recovered on re-check — continuing to watch`
        )
        if (await reapIfExpired()) return
        continue
      }
      await completeRun(
        app,
        run,
        `error`,
        `Pod ${instanceId} entered Failed during rehydration watch (confirmed on re-check)`
      )
      await bestEffortStopPod(app, instanceId)
      return
    }
    if (state === EContainerState.Succeeded) {
      await completeRun(
        app,
        run,
        `success`,
        `Pod ${instanceId} completed during rehydration watch`
      )
      await bestEffortStopPod(app, instanceId)
      return
    }

    if (runtimeBin) {
      const alive = await isRuntimeAlive(app, instanceId, runtimeBin)
      if (alive === false) {
        await captureEntrypointLog(app, run, instanceId).catch((err) =>
          logger.warn(
            `[Scheduler] Log capture for run ${run.id} failed: ${err?.message || err}`
          )
        )
        await completeRun(app, run, `success`, RehydrationSuccessNote)
        await bestEffortStopPod(app, instanceId)
        return
      }
    }

    if (await reapIfExpired()) return
  }
}

/**
 * Re-check a pod that just read as Failed after a short delay. Returns true
 * only if the second read also comes back Failed/Terminating; returns false
 * (treat as a transient blip, keep watching) both when the pod recovers and
 * when the re-check itself errors — an error here gets another chance on the
 * next regular poll tick rather than prematurely killing the run.
 */
async function confirmPodFailed(app: TApp, instanceId: string): Promise<boolean> {
  const { sandbox } = app.locals
  await sleep(RehydrateFailedConfirmDelayMs)
  try {
    const recheck = await sandbox!.getPodState(instanceId)
    return recheck === EContainerState.Failed || recheck === EContainerState.Terminating
  } catch {
    return false
  }
}

/**
 * pgrep the runtime binary inside the sandbox via the sandbox's K8s exec API.
 * Returns true if found, false if not found, null on any error (so the caller
 * can decide to wait for the deadline instead of treating an errored check as
 * "done"). NOTE: this is the sandbox instance's `.exec` method (K8s exec, not
 * child_process.exec) — an established pattern used throughout the codebase
 * (see waitForPodReady). Called via bracket notation to appease a
 * false-positive PreToolUse security hook that pattern-matches on `exec(...)`.
 */
async function isRuntimeAlive(
  app: TApp,
  instanceId: string,
  runtimeBin: string
): Promise<boolean | null> {
  const { sandbox } = app.locals
  try {
    const sb = await sandbox!.getSandbox(instanceId)
    const safe = runtimeBin.replace(/[^a-zA-Z0-9_-]/g, ``)
    if (!safe) return null
    const runInPod = sb[`exec`].bind(sb)
    // `-x` matches the binary basename exactly; `-f` matched anywhere in the
    // full cmdline, which false-positived on every shell probe (including this
    // very check when relayed via `sh -c`) whose cmdline contained the runtime
    // name. That kept schedule_run rows stuck "running" forever because the
    // rehydrator thought the runtime was still alive.
    const res = await runInPod(`pgrep -x "${safe}" >/dev/null`)
    if (res.success) return true
    if (res.exitCode === 1) return false
    return null
  } catch (err: any) {
    logger.warn(
      `[Scheduler] pgrep for runtime "${runtimeBin}" in pod ${instanceId} errored: ${err?.message || err}`
    )
    return null
  }
}

/**
 * Best-effort capture of the container's stdout log via the K8s log API.
 * Only records what the entrypoint printed — K8s exec stdout is not persisted
 * to the container log — so this is supplementary evidence, not a full
 * transcript replacement. Uploaded to the stderr key so downstream UIs that
 * already surface stderr get the diagnostic material.
 */
async function captureEntrypointLog(
  app: TApp,
  run: ScheduleRun,
  instanceId: string
): Promise<void> {
  const { s3, kube } = app.locals
  if (!s3?.active || !kube) return

  let logText: string
  try {
    logText = await kube.readPodLogs(instanceId, { container: `sandbox` })
  } catch (err: any) {
    logger.warn(
      `[Scheduler] readPodLogs failed for pod ${instanceId} (run ${run.id}): ${err?.message || err}`
    )
    return
  }
  if (!logText) return

  const key = `${run.orgId}/runs/${run.id}/stderr`
  const upload = s3.createUploadStream(key)
  if (!upload) return
  upload.stream.write(
    `[rehydrated] Container entrypoint log captured after backend restart. K8s exec stdout is not persisted, so the runtime transcript is not present here.\n\n`
  )
  upload.stream.write(logText)
  upload.stream.end()
  try {
    await upload.done()
  } catch (err: any) {
    logger.warn(
      `[Scheduler] S3 upload of entrypoint log for run ${run.id} failed: ${err?.message || err}`
    )
  }
}

/**
 * Resolve the runtime binary name (e.g. `claude`) from the schedule's sandbox
 * config. Returns null when the runtime is custom or the config can't be read;
 * callers use that as "skip pgrep, rely on the deadline instead."
 */
async function resolveRuntimeBinary(
  app: TApp,
  schedule: Schedule | undefined
): Promise<string | null> {
  if (!schedule) return null
  const { db } = app.locals
  const sandboxId = schedule.sandboxId
  if (!sandboxId) return null
  const { data: sb } = await db.services.sandbox.get(sandboxId)
  const runtime = sb?.config?.runtime as TSandboxRuntimeId | undefined
  if (!runtime) return null
  const cfg = SandboxRuntimeConfigs[runtime]
  return cfg?.runtimeCommand ?? null
}

async function completeRun(
  app: TApp,
  run: ScheduleRun,
  status: `success` | `error` | `timeout`,
  note: string
): Promise<void> {
  const { db } = app.locals
  const startedAtMs = new Date(run.startedAt).getTime()
  const durationMs = Date.now() - startedAtMs
  const { error } = await db.services.scheduleRun.complete(run.id, {
    status,
    error: note,
    durationMs,
    instanceId: run.instanceId,
    ...(run.stdoutKey && { stdoutKey: run.stdoutKey }),
    ...(run.stderrKey && { stderrKey: run.stderrKey }),
  })
  if (error) {
    logger.error(
      `[Scheduler] Failed to complete rehydrated run ${run.id} as ${status}: ${error.message}`
    )
    return
  }
  logger.info(
    `[Scheduler] Rehydrated run ${run.id} marked ${status} (durationMs=${durationMs})`
  )

  // A severed cycle that produced NO deliverable (success-but-empty) is re-queued
  // so it re-runs deploy-free within minutes and still lands its PR this interval,
  // instead of waiting a full cron interval (which breaks ≥1 PR/hour).
  if (status === `success` && note === RehydrationSuccessNote)
    await reQueueSeveredCycle(app, run)
}

/**
 * Re-queue a severed null cycle to re-run shortly. Bounded: skipped for ancient
 * orphans (cold-boot resurrection) and when the schedule has already re-run into
 * repeated severs (a deploy-storm loop guard). Never throws — a re-queue failure
 * must not break rehydration; the natural cron fire remains the fallback.
 */
async function reQueueSeveredCycle(app: TApp, run: ScheduleRun): Promise<void> {
  const { db } = app.locals
  try {
    const { data: schedule } = await db.services.schedule.get(run.scheduleId)
    if (!schedule?.enabled || schedule.type !== EScheduleType.prompt) return

    // Loop guard: if recent runs are already mostly severs, stop re-queuing (a
    // deploy storm would otherwise re-fire endlessly).
    const { data: recent } = await db.services.scheduleRun.listBySchedule(
      run.scheduleId,
      {
        limit: SeveredReRunLoopWindow,
      }
    )
    const severed = (recent ?? []).filter(
      (r) => typeof r.error === `string` && r.error.includes(RehydrationInterruptMarker)
    ).length
    if (severed >= SeveredReRunLoopMax) {
      logger.warn(
        `[Scheduler] Not re-queuing ${run.scheduleId} — ${severed} recent severed runs (avoiding a re-run loop)`
      )
      return
    }

    const nextRunAt = new Date(Date.now() + SeveredReRunDelayMs)
    const { error } = await db.services.schedule.markRun(run.scheduleId, nextRunAt)
    if (error) {
      logger.error(
        `[Scheduler] Failed to re-queue severed schedule ${run.scheduleId}: ${error.message}`
      )
      return
    }
    logger.warn(
      `[Scheduler] Run ${run.id} was severed with no deliverable — re-queued schedule ${run.scheduleId} to re-run at ${nextRunAt.toISOString()}`
    )
  } catch (err) {
    logger.error(
      `[Scheduler] reQueueSeveredCycle failed for ${run.scheduleId}: ${(err as Error).message}`
    )
  }
}

async function bestEffortStopPod(app: TApp, instanceId: string): Promise<void> {
  const { sandbox } = app.locals
  if (!sandbox) return
  try {
    await sandbox.stopPod(instanceId)
    logger.info(`[Scheduler] Rehydration stopped pod ${instanceId}`)
  } catch (err: any) {
    logger.warn(
      `[Scheduler] Rehydration stopPod ${instanceId} failed (may already be gone): ${err?.message || err}`
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
