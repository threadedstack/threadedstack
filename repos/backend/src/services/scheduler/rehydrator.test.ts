import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { EContainerState } from '@tdsk/domain'
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
          schedule: { get: scheduleGet },
          sandbox: { get: sandboxGet },
          scheduleRun: { listRunning, markAsError, complete },
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

  it(`Running pod + pgrep says runtime alive => keeps watching, marks timeout when deadline elapses`, async () => {
    const started = new Date(Date.now() - 61_000).toISOString()
    const app = buildApp({
      runs: [baseRun({ startedAt: started })],
      schedule: baseSchedule, // timeoutMs = 60_000 — already elapsed
      sandboxRecord: baseSandbox,
      // Every poll: pod still Running.
      podStates: [EContainerState.Running, EContainerState.Running],
      // pgrep says runtime is still there.
      pgrepResult: { success: true },
    })

    await hydrateOrphanedRuns(app)
    // One tick past the deadline check happens after the 30-second sleep.
    await vi.advanceTimersByTimeAsync(31_000)

    expect(app.__.complete).toHaveBeenCalled()
    const [, payload] = app.__.complete.mock.calls.at(-1)!
    expect(payload.status).toBe(`timeout`)
    expect(app.__.stopPod).toHaveBeenCalledWith(`pod-1`)
  })

  it(`skips pgrep when runtime is custom and falls back to deadline enforcement`, async () => {
    const started = new Date(Date.now() - 61_000).toISOString()
    const app = buildApp({
      runs: [baseRun({ startedAt: started })],
      schedule: baseSchedule,
      // Custom runtime has no runtimeCommand → resolveRuntimeBinary returns null
      sandboxRecord: { id: `sb_1`, config: { runtime: `custom` } },
      podStates: [EContainerState.Running, EContainerState.Running],
    })

    await hydrateOrphanedRuns(app)
    await vi.advanceTimersByTimeAsync(31_000)

    // pgrep should NEVER be called for a custom runtime.
    expect(app.__.sbInstance.exec).not.toHaveBeenCalled()
    // Deadline elapsed → timeout status.
    expect(app.__.complete).toHaveBeenCalled()
    const [, payload] = app.__.complete.mock.calls.at(-1)!
    expect(payload.status).toBe(`timeout`)
  })
})
