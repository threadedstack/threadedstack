import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { EContainerState, EScheduleType } from '@tdsk/domain'
import { hydrateOrphanedRuns } from './rehydrator'

vi.mock('@tdsk/domain', async () => {
  const actual = await vi.importActual<typeof import('@tdsk/domain')>('@tdsk/domain')
  return {
    ...actual,
    // Keep SandboxRuntimeConfigs and EContainerState real; nothing else is
    // touched by the rehydrator that would need a shim.
  }
})

vi.mock('@TBE/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

/**
 * Build a mock app with pluggable pod-state and pgrep responses. The rehydrator
 * dispatches watchers asynchronously — tests use `flushMicrotasks + advance
 * timers` to force the watcher loop through one full pass without waiting the
 * real 30 seconds.
 */
const buildApp = (opts: {
  runs?: any[]
  markAsError?: any
  schedule?: any
  sandboxRecord?: any
  podStates?: EContainerState[]
  pgrepResult?: { success: boolean; exitCode?: number } | Error
  completeResp?: any
}) => {
  const podStates = opts.podStates ?? []
  let stateIdx = 0

  const listRunning = vi.fn().mockResolvedValue({ data: opts.runs ?? [] })
  const markAsError =
    opts.markAsError ?? vi.fn().mockResolvedValue({ data: { count: 0, ids: [] } })
  const complete = vi.fn().mockResolvedValue(opts.completeResp ?? { data: {} })
  const scheduleGet = vi.fn().mockResolvedValue({ data: opts.schedule })
  const markRun = vi.fn().mockResolvedValue({ data: {} })
  const listBySchedule = vi.fn().mockResolvedValue({ data: opts.recentRuns ?? [] })
  const sandboxGet = vi.fn().mockResolvedValue({ data: opts.sandboxRecord })

  const getPodState = vi.fn().mockImplementation(async () => {
    const s = podStates[stateIdx] ?? podStates[podStates.length - 1]
    stateIdx += 1
    return s
  })

  const sbInstance = {
    exec: vi.fn().mockImplementation(async () => {
      if (opts.pgrepResult instanceof Error) throw opts.pgrepResult
      return opts.pgrepResult ?? { success: false, exitCode: 1 }
    }),
  }
  const getSandbox = vi.fn().mockResolvedValue(sbInstance)
  const stopPod = vi.fn().mockResolvedValue(undefined)

  return {
    locals: {
      db: {
        services: {
          schedule: { get: scheduleGet, markRun },
          sandbox: { get: sandboxGet },
          scheduleRun: { listRunning, markAsError, complete, listBySchedule },
        },
      },
      sandbox: { getPodState, getSandbox, stopPod },
      kube: { readPodLogs: vi.fn().mockResolvedValue(``) },
      s3: {
        active: false,
        createUploadStream: vi.fn(),
      },
      config: {},
    },
    // Expose the mocks for assertions.
    __: {
      listRunning,
      markAsError,
      complete,
      scheduleGet,
      markRun,
      listBySchedule,
      sandboxGet,
      getPodState,
      getSandbox,
      stopPod,
      sbInstance,
    },
  } as any
}

const baseRun = (overrides: Partial<any> = {}) => ({
  id: `sr_1`,
  orgId: `og_1`,
  scheduleId: `sd_1`,
  instanceId: `pod-1`,
  startedAt: new Date().toISOString(),
  ...overrides,
})

const baseSchedule = {
  id: `sd_1`,
  sandboxId: `sb_1`,
  timeoutMs: 60_000,
}

const baseSandbox = {
  id: `sb_1`,
  config: { runtime: `claude-code` },
}

describe(`hydrateOrphanedRuns`, () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it(`does nothing when no runs are still running`, async () => {
    const app = buildApp({ runs: [] })
    await hydrateOrphanedRuns(app)
    expect(app.__.markAsError).not.toHaveBeenCalled()
    expect(app.__.getPodState).not.toHaveBeenCalled()
  })

  it(`marks runs with no instanceId as error via markAsError (pre-pod orphan)`, async () => {
    const run = baseRun({ instanceId: null })
    const app = buildApp({ runs: [run] })

    await hydrateOrphanedRuns(app)

    expect(app.__.markAsError).toHaveBeenCalledTimes(1)
    const [ids, reason] = app.__.markAsError.mock.calls[0]
    expect(ids).toEqual([`sr_1`])
    expect(reason).toMatch(/Orphaned before pod start/)
    expect(app.__.getPodState).not.toHaveBeenCalled()
  })

  it(`completes as error when pod phase is Failed`, async () => {
    const app = buildApp({
      runs: [baseRun()],
      schedule: baseSchedule,
      sandboxRecord: baseSandbox,
      podStates: [EContainerState.Failed],
    })

    await hydrateOrphanedRuns(app)
    // Dispatch is fire-and-forget; drain pending async work under fake timers.
    await vi.runAllTimersAsync()

    expect(app.__.complete).toHaveBeenCalledTimes(1)
    const [, payload] = app.__.complete.mock.calls[0]
    expect(payload.status).toBe(`error`)
    expect(payload.error).toMatch(/Failed/)
    expect(app.__.stopPod).toHaveBeenCalledWith(`pod-1`)
  })

  it(`completes as success when pod phase is Succeeded`, async () => {
    const app = buildApp({
      runs: [baseRun()],
      schedule: baseSchedule,
      sandboxRecord: baseSandbox,
      podStates: [EContainerState.Succeeded],
    })

    await hydrateOrphanedRuns(app)
    await vi.runAllTimersAsync()

    expect(app.__.complete).toHaveBeenCalledTimes(1)
    const [, payload] = app.__.complete.mock.calls[0]
    expect(payload.status).toBe(`success`)
    expect(app.__.stopPod).toHaveBeenCalledWith(`pod-1`)
  })

  it(`re-queues a SEVERED prompt cycle to re-run shortly (deploy-severs-workcycle mitigation)`, async () => {
    const app = buildApp({
      runs: [baseRun()],
      schedule: { ...baseSchedule, enabled: true, type: EScheduleType.prompt },
      sandboxRecord: baseSandbox,
      // The real sever: pod still Running but the runtime (claude) already exited.
      podStates: [EContainerState.Running],
      pgrepResult: { success: false, exitCode: 1 },
      recentRuns: [],
    })

    await hydrateOrphanedRuns(app)
    await vi.runAllTimersAsync()

    // Marked success (severed null cycle) AND re-queued to re-run soon.
    expect(app.__.complete).toHaveBeenCalledTimes(1)
    expect(app.__.markRun).toHaveBeenCalledTimes(1)
    const [schedId, nextRunAt] = app.__.markRun.mock.calls[0]
    expect(schedId).toBe(`sd_1`)
    expect(nextRunAt.getTime()).toBeGreaterThan(Date.now())
  })

  it(`does NOT re-queue when recent runs are already mostly severs (loop guard)`, async () => {
    const app = buildApp({
      runs: [baseRun()],
      schedule: { ...baseSchedule, enabled: true, type: EScheduleType.prompt },
      sandboxRecord: baseSandbox,
      podStates: [EContainerState.Running],
      pgrepResult: { success: false, exitCode: 1 },
      recentRuns: [
        { error: `Rehydrated after backend restart — a` },
        { error: `Rehydrated after backend restart — b` },
        { error: `Rehydrated after backend restart — c` },
      ],
    })

    await hydrateOrphanedRuns(app)
    await vi.runAllTimersAsync()

    expect(app.__.complete).toHaveBeenCalledTimes(1)
    expect(app.__.markRun).not.toHaveBeenCalled()
  })

  it(`does NOT re-queue a disabled or non-prompt schedule`, async () => {
    const app = buildApp({
      runs: [baseRun()],
      schedule: { ...baseSchedule, enabled: false, type: EScheduleType.prompt },
      sandboxRecord: baseSandbox,
      podStates: [EContainerState.Running],
      pgrepResult: { success: false, exitCode: 1 },
    })

    await hydrateOrphanedRuns(app)
    await vi.runAllTimersAsync()

    expect(app.__.markRun).not.toHaveBeenCalled()
  })

  it(`Running pod + pgrep says runtime is gone (exit 1) => success`, async () => {
    const app = buildApp({
      runs: [baseRun()],
      schedule: baseSchedule,
      sandboxRecord: baseSandbox,
      podStates: [EContainerState.Running],
      pgrepResult: { success: false, exitCode: 1 },
    })

    await hydrateOrphanedRuns(app)
    // Watcher dispatch is fire-and-forget; wait for the first sleep-tick.
    await vi.advanceTimersByTimeAsync(31_000)

    expect(app.__.complete).toHaveBeenCalled()
    const [, payload] = app.__.complete.mock.calls.at(-1)!
    expect(payload.status).toBe(`success`)
    expect(payload.error).toMatch(/Rehydrated after backend restart/)
    expect(app.__.stopPod).toHaveBeenCalledWith(`pod-1`)
  })

  it(`Running pod + pgrep says runtime alive => keeps watching, marks timeout once the post-restart grace window also elapses`, async () => {
    const started = new Date(Date.now() - 61_000).toISOString()
    const app = buildApp({
      runs: [baseRun({ startedAt: started })],
      schedule: baseSchedule, // timeoutMs = 60_000 — already elapsed before watching even starts
      sandboxRecord: baseSandbox,
      // Every poll: pod still Running.
      podStates: [
        EContainerState.Running,
        EContainerState.Running,
        EContainerState.Running,
      ],
      // pgrep says runtime is still there.
      pgrepResult: { success: true },
    })

    await hydrateOrphanedRuns(app)
    // Grace window (2 poll intervals = 60s from watch start) must fully elapse
    // before the already-expired original deadline is enforced.
    await vi.advanceTimersByTimeAsync(61_000)

    expect(app.__.complete).toHaveBeenCalled()
    const [, payload] = app.__.complete.mock.calls.at(-1)!
    expect(payload.status).toBe(`timeout`)
    expect(app.__.stopPod).toHaveBeenCalledWith(`pod-1`)
  })

  it(`skips pgrep when runtime is custom and falls back to deadline enforcement after the grace window`, async () => {
    const started = new Date(Date.now() - 61_000).toISOString()
    const app = buildApp({
      runs: [baseRun({ startedAt: started })],
      schedule: baseSchedule,
      // Custom runtime has no runtimeCommand → resolveRuntimeBinary returns null
      sandboxRecord: { id: `sb_1`, config: { runtime: `custom` } },
      podStates: [
        EContainerState.Running,
        EContainerState.Running,
        EContainerState.Running,
      ],
    })

    await hydrateOrphanedRuns(app)
    await vi.advanceTimersByTimeAsync(61_000)

    // pgrep should NEVER be called for a custom runtime.
    expect(app.__.sbInstance.exec).not.toHaveBeenCalled()
    // Deadline elapsed → timeout status.
    expect(app.__.complete).toHaveBeenCalled()
    const [, payload] = app.__.complete.mock.calls.at(-1)!
    expect(payload.status).toBe(`timeout`)
  })

  it(`a transient Failed reading during the watch loop is confirmed before being treated as terminal (recovers => keeps watching)`, async () => {
    const app = buildApp({
      runs: [baseRun()],
      schedule: baseSchedule,
      sandboxRecord: baseSandbox,
      // inspectAndDispatch's initial read: Running (dispatches to the watch
      // loop instead of completing immediately). Watch-loop poll 1: Failed
      // (transient 404). Confirmation re-check: Running (recovered). Watch
      // loop poll 2: Succeeded.
      podStates: [
        EContainerState.Running,
        EContainerState.Failed,
        EContainerState.Running,
        EContainerState.Succeeded,
      ],
    })

    await hydrateOrphanedRuns(app)
    await vi.runAllTimersAsync()

    expect(app.__.complete).toHaveBeenCalledTimes(1)
    const [, payload] = app.__.complete.mock.calls[0]
    expect(payload.status).toBe(`success`)
  })

  it(`a Failed reading confirmed by a second read during the watch loop completes as error`, async () => {
    const app = buildApp({
      runs: [baseRun()],
      schedule: baseSchedule,
      sandboxRecord: baseSandbox,
      // inspectAndDispatch's initial read: Running. Watch-loop poll 1: Failed.
      // Confirmation re-check: still Failed.
      podStates: [
        EContainerState.Running,
        EContainerState.Failed,
        EContainerState.Failed,
      ],
    })

    await hydrateOrphanedRuns(app)
    await vi.runAllTimersAsync()

    expect(app.__.complete).toHaveBeenCalledTimes(1)
    const [, payload] = app.__.complete.mock.calls[0]
    expect(payload.status).toBe(`error`)
    expect(payload.error).toMatch(/confirmed on re-check/)
    expect(app.__.stopPod).toHaveBeenCalledWith(`pod-1`)
  })

  it(`does not kill a run on the first post-restart poll just because backend downtime already exceeded the original deadline`, async () => {
    // Run started 10 minutes ago against a 60s timeout — the deadline was blown
    // long before this backend process even existed to watch it.
    const started = new Date(Date.now() - 10 * 60_000).toISOString()
    const app = buildApp({
      runs: [baseRun({ startedAt: started })],
      schedule: baseSchedule, // timeoutMs = 60_000
      sandboxRecord: baseSandbox,
      podStates: Array(6).fill(EContainerState.Running),
      pgrepResult: { success: true }, // runtime still genuinely alive
    })

    await hydrateOrphanedRuns(app)

    // First poll tick: without the grace window this would already be well
    // past the (already-elapsed) deadline and get killed immediately.
    await vi.advanceTimersByTimeAsync(31_000)
    expect(app.__.complete).not.toHaveBeenCalled()

    // Once the full grace window (60s from watch start) elapses, enforcement
    // resumes as normal.
    await vi.advanceTimersByTimeAsync(30_000)
    expect(app.__.complete).toHaveBeenCalled()
    const [, payload] = app.__.complete.mock.calls.at(-1)!
    expect(payload.status).toBe(`timeout`)
    expect(app.__.stopPod).toHaveBeenCalledWith(`pod-1`)
  })
})
