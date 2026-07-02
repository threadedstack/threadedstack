import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const runMock = vi.fn()
vi.mock(`@tdsk/agent`, () => ({
  AgentRunner: { run: (...args: unknown[]) => runMock(...args) },
}))

const resolveAgentConfigMock = vi.fn()
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: (...args: unknown[]) => resolveAgentConfigMock(...args),
}))

import { createScheduleExecutor } from './executor'
import { ExecTimeoutMS } from '@TBE/constants/sandbox'

const buildApp = () => {
  const services = {
    scheduleRun: {
      create: vi.fn().mockResolvedValue({ data: { id: `run-1` } }),
      complete: vi.fn().mockResolvedValue({}),
    },
    thread: { create: vi.fn().mockResolvedValue({ data: { id: `th_new` } }) },
    schedule: { update: vi.fn().mockResolvedValue({ data: { id: `sd_1` } }) },
  }
  const s3 = {
    createUploadStream: vi.fn(() => ({
      stream: { write: vi.fn(), end: vi.fn() },
      done: vi.fn().mockResolvedValue(undefined),
    })),
  }
  const sandbox = { stopPod: vi.fn().mockResolvedValue(undefined) }
  return {
    services,
    app: { locals: { db: { services }, sandbox, s3, config: { egress: {} } } } as any,
  }
}

const agentSchedule = (overrides: Record<string, unknown> = {}) => ({
  id: `sd_1`,
  orgId: `org-1`,
  userId: `us_1`,
  projectId: `pr-1`,
  sandboxId: `sb-1`,
  agentId: `ag_1`,
  prompt: `Review platform state`,
  cronExpression: `0 * * * *`,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  resolveAgentConfigMock.mockResolvedValue({
    orgId: `org-1`,
    soul: `SOUL`,
    db: {},
    skills: [],
    tools: [],
    customFunctions: [],
    environment: {},
    llmConfig: { model: `m`, provider: `anthropic` },
    sandboxConfig: { provider: `local` },
    onExecuteFunction: vi.fn(),
  })
  runMock.mockResolvedValue({ waitForIdle: vi.fn().mockResolvedValue(undefined) })
})

describe(`createScheduleExecutor — agent-backed schedule`, () => {
  it(`runs the agent with the soul, prompt, and a new continuity thread`, async () => {
    const { app, services } = buildApp()
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule() as any)

    expect(runMock).toHaveBeenCalledTimes(1)
    const runArgs = runMock.mock.calls[0][0]
    expect(runArgs.soul).toBe(`SOUL`)
    expect(runArgs.prompt).toBe(`Review platform state`)
    expect(runArgs.agentId).toBe(`ag_1`)
    expect(runArgs.threadId).toBe(`th_new`)
    expect(services.schedule.update).toHaveBeenCalledWith({
      id: `sd_1`,
      threadId: `th_new`,
    })
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `success` })
    )
  })

  it(`reuses an existing continuity thread and does not create a new one`, async () => {
    const { app, services } = buildApp()
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule({ threadId: `th_existing` }) as any)

    expect(services.thread.create).not.toHaveBeenCalled()
    expect(runMock.mock.calls[0][0].threadId).toBe(`th_existing`)
  })

  it(`records an error when an agent-backed schedule has no prompt`, async () => {
    const { app, services } = buildApp()
    const executor = createScheduleExecutor(app)
    await expect(executor(agentSchedule({ prompt: undefined }) as any)).rejects.toThrow(
      /no prompt/
    )
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error` })
    )
  })

  it(`records an error when an agent-backed schedule has no userId`, async () => {
    const { app, services } = buildApp()
    const executor = createScheduleExecutor(app)
    await expect(executor(agentSchedule({ userId: undefined }) as any)).rejects.toThrow(
      /no userId/
    )
    expect(services.thread.create).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error` })
    )
  })

  it(`records an error run when persisting the continuity thread fails`, async () => {
    const { app, services } = buildApp()
    services.schedule.update.mockResolvedValue({ error: new Error(`db down`) })
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toThrow(
      /Failed to persist continuity thread/
    )
    expect(runMock).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error` })
    )
  })

  it(`records an error run when the schedule vanished before the thread persisted`, async () => {
    const { app, services } = buildApp()
    services.schedule.update.mockResolvedValue({})
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toThrow(
      /Failed to persist continuity thread/
    )
    expect(runMock).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error` })
    )
  })

  it(`tears down the agent's pod after a successful run`, async () => {
    const { app, services } = buildApp()
    resolveAgentConfigMock.mockResolvedValue({
      orgId: `org-1`,
      soul: `SOUL`,
      db: {},
      skills: [],
      tools: [],
      customFunctions: [],
      environment: {},
      llmConfig: { model: `m`, provider: `anthropic` },
      sandboxConfig: { provider: `kubernetes`, options: { podName: `pod-1` } },
      onExecuteFunction: vi.fn(),
    })
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule() as any)

    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `success` })
    )
    expect(app.locals.sandbox.stopPod).toHaveBeenCalledWith(`pod-1`)
  })

  it(`marks the run as timeout when the agent run exceeds ExecTimeoutMS`, async () => {
    vi.useFakeTimers()
    try {
      const { app, services } = buildApp()
      runMock.mockResolvedValue({
        waitForIdle: vi.fn(() => new Promise(() => {})),
      })
      const executor = createScheduleExecutor(app)

      const execPromise = executor(agentSchedule() as any)
      const rejection = expect(execPromise).rejects.toThrow(/Timed out/)
      await vi.advanceTimersByTimeAsync(ExecTimeoutMS + 1000)
      await rejection

      expect(services.scheduleRun.complete).toHaveBeenCalledWith(
        `run-1`,
        expect.objectContaining({ status: `timeout` })
      )
    } finally {
      vi.useRealTimers()
    }
  })
})
