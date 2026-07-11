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
import { ScheduleClaimConflictError } from './scheduler'
import { ExecTimeoutMS, SetupReadyTimeoutMS } from '@TBE/constants/sandbox'

const buildApp = () => {
  const sbInstance = {
    execStreaming: vi.fn(
      async (
        _cmd: string,
        _args: string[],
        opts: {
          onStdout: (c: string | Buffer) => void
          onStderr: (c: string | Buffer) => void
        }
      ): Promise<{
        output: string
        success: boolean
        exitCode: number
        error?: string
      }> => {
        opts.onStdout(`CLI REPORT`)
        return { output: ``, success: true, exitCode: 0 }
      }
    ),
    exec: vi.fn().mockResolvedValue({ output: ``, success: true, exitCode: 0 }),
  }
  const services = {
    scheduleRun: {
      claimRunning: vi.fn().mockResolvedValue({ data: { id: `run-1` } }),
      complete: vi.fn().mockResolvedValue({}),
      setInstance: vi.fn().mockResolvedValue({ data: { id: `run-1` } }),
    },
    thread: { create: vi.fn().mockResolvedValue({ data: { id: `th_new` } }) },
    schedule: { update: vi.fn().mockResolvedValue({ data: { id: `sd_1` } }) },
    agent: {
      get: vi.fn().mockResolvedValue({ data: { id: `ag_1`, brain: `api` } }),
    },
    message: {
      create: vi.fn().mockResolvedValue({ data: { id: `msg_1` } }),
      listByThread: vi.fn().mockResolvedValue({ data: [] }),
    },
    sandbox: {
      get: vi.fn().mockResolvedValue({
        data: { config: { runtime: `claude-code` } },
      }),
    },
  }
  const s3 = {
    createUploadStream: vi.fn(() => ({
      stream: { write: vi.fn(), end: vi.fn() },
      done: vi.fn().mockResolvedValue(undefined),
    })),
  }
  const sandbox = {
    stopPod: vi.fn().mockResolvedValue(undefined),
    startPod: vi.fn().mockResolvedValue(`pod-cli-1`),
    getSandbox: vi.fn().mockResolvedValue(sbInstance),
    waitForPodReady: vi.fn().mockResolvedValue(undefined),
  }
  return {
    services,
    sbInstance,
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
    llmConfigs: [
      { model: `m`, provider: `anthropic` },
      { model: `m2`, provider: `openai` },
    ],
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
    // The full provider failover chain flows through to the runner
    expect(runArgs.llmConfigs).toEqual([
      { model: `m`, provider: `anthropic` },
      { model: `m2`, provider: `openai` },
    ])
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

  it(`stops the pod when the runner rejects after resolveAgentConfig started it`, async () => {
    const { app, services } = buildApp()
    resolveAgentConfigMock.mockImplementation(
      async (_agentId: unknown, _db: unknown, _app: unknown, opts: any) => {
        // Pod starts inside resolveAgentConfig — the hook reports it immediately
        opts?.onPodStart?.(`pod-early`)
        return {
          orgId: `org-1`,
          soul: `SOUL`,
          db: {},
          skills: [],
          tools: [],
          customFunctions: [],
          environment: {},
          llmConfig: { model: `m`, provider: `anthropic` },
          sandboxConfig: { provider: `kubernetes`, options: { podName: `pod-early` } },
          onExecuteFunction: vi.fn(),
        }
      }
    )
    // Runner init throws AFTER the pod exists — pre-hook this leaked the pod
    runMock.mockRejectedValue(new Error(`runner init exploded`))
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toThrow(/runner init exploded/)
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error`, instanceId: `pod-early` })
    )
    expect(app.locals.sandbox.stopPod).toHaveBeenCalledWith(`pod-early`)
  })

  it(`stops the pod when resolveAgentConfig itself throws after starting it`, async () => {
    const { app, services } = buildApp()
    resolveAgentConfigMock.mockImplementation(
      async (_agentId: unknown, _db: unknown, _app: unknown, opts: any) => {
        opts?.onPodStart?.(`pod-early`)
        // e.g. the in-resolve readiness wait failed
        throw new Error(`Pod pod-early will never become ready (state: Failed)`)
      }
    )
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toThrow(/never become ready/)
    expect(runMock).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error`, instanceId: `pod-early` })
    )
    expect(app.locals.sandbox.stopPod).toHaveBeenCalledWith(`pod-early`)
  })

  it(`records an error run when a surfaced LLM failure rejects waitForIdle`, async () => {
    const { app, services } = buildApp()
    runMock.mockResolvedValue({
      waitForIdle: vi.fn().mockRejectedValue(new Error(`Your credit balance is too low`)),
    })
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toThrow(
      /credit balance is too low/
    )
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({
        status: `error`,
        error: `Your credit balance is too low`,
      })
    )
  })

  it(`loads the agent and records an error when the agent no longer exists`, async () => {
    const { app, services } = buildApp()
    services.agent.get.mockResolvedValue({ data: undefined })
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toThrow(/Agent not found/)
    expect(runMock).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error` })
    )
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

  it(`honors schedule.timeoutMs over ExecTimeoutMS on the api-brain path`, async () => {
    vi.useFakeTimers()
    try {
      const { app, services } = buildApp()
      runMock.mockResolvedValue({
        waitForIdle: vi.fn(() => new Promise(() => {})),
      })
      const executor = createScheduleExecutor(app)

      // 120s override — far below the 60-minute ExecTimeoutMS default
      const execPromise = executor(agentSchedule({ timeoutMs: 120_000 }) as any)
      const rejection = expect(execPromise).rejects.toThrow(/Timed out after 120s/)
      await vi.advanceTimersByTimeAsync(121_000)
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

describe(`createScheduleExecutor — atomic cross-replica claim`, () => {
  it(`throws ScheduleClaimConflictError and never starts a pod when another replica already claimed the running slot`, async () => {
    // Simulates the losing side of two replicas racing the same due schedule:
    // ScheduleRun.claimRunning's partial-unique-index INSERT ... ON CONFLICT
    // DO NOTHING affected zero rows elsewhere, surfaced here as conflict:true.
    const { app, services } = buildApp()
    services.scheduleRun.claimRunning.mockResolvedValue({ data: null, conflict: true })
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toBeInstanceOf(
      ScheduleClaimConflictError
    )

    // No duplicate run: neither brain path executes, no pod is ever started.
    expect(runMock).not.toHaveBeenCalled()
    expect(app.locals.sandbox.startPod).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).not.toHaveBeenCalled()
  })

  it(`proceeds normally when the claim succeeds (no conflict)`, async () => {
    const { app, services } = buildApp()
    services.scheduleRun.claimRunning.mockResolvedValue({ data: { id: `run-1` } })
    const executor = createScheduleExecutor(app)

    await executor(agentSchedule() as any)

    expect(runMock).toHaveBeenCalledTimes(1)
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `success` })
    )
  })
})

describe(`createScheduleExecutor — runtime-brain (CLI) agent schedule`, () => {
  const runtimeAgent = (overrides: Record<string, unknown> = {}) => ({
    id: `ag_1`,
    orgId: `org-1`,
    brain: `runtime`,
    soul: `CLI SOUL`,
    environment: { sandboxId: `sb-body` },
    ...overrides,
  })

  it(`runs the CLI tool in the agent's body sandbox and persists the report`, async () => {
    const { app, services, sbInstance } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule() as any)

    // The CLI brain never uses the pi runner or its provider-backed config
    expect(runMock).not.toHaveBeenCalled()
    expect(resolveAgentConfigMock).not.toHaveBeenCalled()

    // Pod started with the agent's body sandbox, not the schedule sandbox.
    // With no providers linked the chain is empty (primary env + placeholders
    // both empty) but is still passed so startPod skips its own ai resolution.
    expect(app.locals.sandbox.startPod).toHaveBeenCalledWith({
      orgId: `org-1`,
      userId: `us_1`,
      sandboxId: `sb-body`,
      projectId: `pr-1`,
      egressOpts: {},
      providerChain: { primaryEnv: {}, placeholders: {} },
    })

    // Readiness (phase + clone) wait sits between pod creation and the exec
    expect(app.locals.sandbox.waitForPodReady).toHaveBeenCalledWith(`pod-cli-1`, {
      cloneCheck: true,
      timeoutMs: SetupReadyTimeoutMS,
    })
    expect(app.locals.sandbox.startPod.mock.invocationCallOrder[0]).toBeLessThan(
      app.locals.sandbox.waitForPodReady.mock.invocationCallOrder[0]
    )
    expect(app.locals.sandbox.waitForPodReady.mock.invocationCallOrder[0]).toBeLessThan(
      app.locals.sandbox.getSandbox.mock.invocationCallOrder[0]
    )

    // Prompt command template applied with the soul prepended to the payload,
    // and the run-scoped idempotency token prefixed as an env var on every attempt.
    const command = sbInstance.execStreaming.mock.calls[0][0]
    expect(command).toBe(
      `env TDSK_IDEMPOTENCY_KEY='run-1' CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 claude -p 'CLI SOUL\n\nReview platform state'`
    )

    // User message carries the raw configured prompt; assistant carries stdout
    expect(services.message.create).toHaveBeenNthCalledWith(1, {
      threadId: `th_new`,
      type: `user`,
      orgId: `org-1`,
      content: [{ type: `text`, text: `Review platform state` }],
    })
    expect(services.message.create).toHaveBeenNthCalledWith(2, {
      threadId: `th_new`,
      type: `assistant`,
      orgId: `org-1`,
      content: [{ type: `text`, text: `CLI REPORT` }],
    })

    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `success`, instanceId: `pod-cli-1` })
    )
    expect(app.locals.sandbox.stopPod).toHaveBeenCalledWith(`pod-cli-1`)
  })

  it(`substitutes the soul into a {soul} placeholder when the template has one`, async () => {
    const { app, services, sbInstance } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    services.sandbox.get.mockResolvedValue({
      data: {
        config: {
          runtime: `custom`,
          promptCommand: `mytool --soul '{soul}' -p '{prompt}'`,
        },
      },
    })
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule() as any)

    const command = sbInstance.execStreaming.mock.calls[0][0]
    expect(command).toBe(
      `env TDSK_IDEMPOTENCY_KEY='run-1' mytool --soul 'CLI SOUL' -p 'Review platform state'`
    )
  })

  it(`includes the previous assistant report in the composed command`, async () => {
    const { app, services, sbInstance } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    services.message.listByThread.mockResolvedValue({
      data: [
        { type: `user`, content: [{ type: `text`, text: `old prompt` }] },
        { type: `assistant`, content: [{ type: `text`, text: `OLD REPORT` }] },
        { type: `user`, content: [{ type: `text`, text: `tool result` }] },
      ],
    })
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule({ threadId: `th_existing` }) as any)

    expect(services.message.listByThread).toHaveBeenCalledWith(`th_existing`)
    const command = sbInstance.execStreaming.mock.calls[0][0]
    expect(command).toBe(
      `env TDSK_IDEMPOTENCY_KEY='run-1' CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 claude -p 'CLI SOUL\n\n## Your previous report\nOLD REPORT\n\nReview platform state'`
    )
  })

  it(`records an error run and writes no assistant message when the CLI exec fails`, async () => {
    const { app, services, sbInstance } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    sbInstance.execStreaming.mockResolvedValue({
      output: ``,
      success: false,
      exitCode: 1,
      error: `CLI exploded`,
    })
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toThrow(/CLI exploded/)
    expect(services.message.create).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error`, error: `CLI exploded` })
    )
    expect(app.locals.sandbox.stopPod).toHaveBeenCalledWith(`pod-cli-1`)
  })

  it(`falls back to an exit-code message when the CLI exec fails with no error string`, async () => {
    const { app, services, sbInstance } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    sbInstance.execStreaming.mockResolvedValue({
      output: ``,
      success: false,
      exitCode: 7,
    })
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toThrow(
      /Command exited with non-zero code 7/
    )
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({
        status: `error`,
        error: `Command exited with non-zero code 7`,
      })
    )
  })

  it(`records an error when neither the agent environment nor the schedule has a sandbox`, async () => {
    const { app, services } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent({ environment: {} }) })
    const executor = createScheduleExecutor(app)

    await expect(
      executor(agentSchedule({ sandboxId: undefined }) as any)
    ).rejects.toThrow(/no body sandbox/)
    expect(app.locals.sandbox.startPod).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error` })
    )
  })

  it(`preserves $-replacement sequences in the prompt verbatim`, async () => {
    const { app, services, sbInstance } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    const executor = createScheduleExecutor(app)
    await executor(
      agentSchedule({ prompt: `Budget is $& and prefix is $\` today` }) as any
    )

    const command = sbInstance.execStreaming.mock.calls[0][0]
    expect(command).toBe(
      `env TDSK_IDEMPOTENCY_KEY='run-1' CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 claude -p 'CLI SOUL\n\nBudget is $& and prefix is $\` today'`
    )
  })

  it(`preserves $-replacement sequences in a pod schedule's prompt verbatim`, async () => {
    const { app, sbInstance } = buildApp()
    const executor = createScheduleExecutor(app)
    await executor(
      agentSchedule({ agentId: undefined, prompt: `pay $& then $\` please` }) as any
    )

    const command = sbInstance.execStreaming.mock.calls[0][0]
    expect(command).toBe(
      `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 claude -p 'pay $& then $\` please'`
    )
  })

  it(`waits for pod readiness between startPod and exec on the pod-schedule path`, async () => {
    const { app, sbInstance } = buildApp()
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule({ agentId: undefined }) as any)

    expect(app.locals.sandbox.waitForPodReady).toHaveBeenCalledWith(`pod-cli-1`, {
      cloneCheck: true,
      timeoutMs: SetupReadyTimeoutMS,
    })
    expect(app.locals.sandbox.startPod.mock.invocationCallOrder[0]).toBeLessThan(
      app.locals.sandbox.waitForPodReady.mock.invocationCallOrder[0]
    )
    expect(app.locals.sandbox.waitForPodReady.mock.invocationCallOrder[0]).toBeLessThan(
      app.locals.sandbox.getSandbox.mock.invocationCallOrder[0]
    )
    expect(sbInstance.execStreaming).toHaveBeenCalled()
  })

  it(`falls back to an exit-code message when the pod-schedule exec fails with no error string`, async () => {
    const { app, services, sbInstance } = buildApp()
    sbInstance.execStreaming.mockResolvedValue({
      output: ``,
      success: false,
      exitCode: 3,
    })
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule({ agentId: undefined }) as any)).rejects.toThrow(
      /Command exited with non-zero code 3/
    )
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({
        status: `error`,
        error: `Command exited with non-zero code 3`,
      })
    )
  })

  it(`records an error run and still stops the pod when the readiness wait fails on the CLI-brain path`, async () => {
    const { app, services } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    app.locals.sandbox.waitForPodReady.mockRejectedValue(
      new Error(`Pod pod-cli-1 will never become ready (state: Failed)`)
    )
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toThrow(
      /will never become ready/
    )
    // The exec never ran — the pod was never usable
    expect(app.locals.sandbox.getSandbox).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({
        status: `error`,
        instanceId: `pod-cli-1`,
        error: `Pod pod-cli-1 will never become ready (state: Failed)`,
      })
    )
    // instanceId was recorded before the wait, so the finally block reaps the pod
    expect(app.locals.sandbox.stopPod).toHaveBeenCalledWith(`pod-cli-1`)
  })

  it(`does not let a soul containing literal {prompt} consume the template placeholder`, async () => {
    const { app, services, sbInstance } = buildApp()
    services.agent.get.mockResolvedValue({
      data: runtimeAgent({ soul: `Use {prompt} wisely` }),
    })
    services.sandbox.get.mockResolvedValue({
      data: {
        config: {
          runtime: `custom`,
          promptCommand: `mytool --soul '{soul}' -p '{prompt}'`,
        },
      },
    })
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule() as any)

    const command = sbInstance.execStreaming.mock.calls[0][0]
    expect(command).toBe(
      `env TDSK_IDEMPOTENCY_KEY='run-1' mytool --soul 'Use {prompt} wisely' -p 'Review platform state'`
    )
  })

  it(`reassembles multibyte characters split across stdout chunks`, async () => {
    const { app, services, sbInstance } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    const bytes = Buffer.from(`report 🚀 done`, `utf8`)
    // Split mid-emoji (🚀 is 4 bytes starting at index 7)
    const splitAt = 9
    sbInstance.execStreaming.mockImplementation(async (_cmd, _args, opts) => {
      opts.onStdout(bytes.subarray(0, splitAt))
      opts.onStdout(bytes.subarray(splitAt))
      return { output: ``, success: true, exitCode: 0 }
    })
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule() as any)

    expect(services.message.create).toHaveBeenNthCalledWith(2, {
      threadId: `th_new`,
      type: `assistant`,
      orgId: `org-1`,
      content: [{ type: `text`, text: `report 🚀 done` }],
    })
  })

  it(`caps buffered stdout at the byte limit, keeping only the tail`, async () => {
    const capBytes = 256 * 1024
    const { app, services, sbInstance } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    sbInstance.execStreaming.mockImplementation(async (_cmd, _args, opts) => {
      opts.onStdout(Buffer.from(`x`.repeat(capBytes)))
      opts.onStdout(Buffer.from(`TAIL_MARKER`))
      return { output: ``, success: true, exitCode: 0 }
    })
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule() as any)

    const assistantCall = services.message.create.mock.calls[1][0]
    const text = assistantCall.content[0].text as string
    expect(text.length).toBe(capBytes)
    expect(text.endsWith(`TAIL_MARKER`)).toBe(true)
    expect(text.startsWith(`x`)).toBe(true)
  })

  it(`marks the run as timeout and stops the pod when the CLI run exceeds ExecTimeoutMS`, async () => {
    vi.useFakeTimers()
    try {
      const { app, services, sbInstance } = buildApp()
      services.agent.get.mockResolvedValue({ data: runtimeAgent() })
      sbInstance.execStreaming.mockImplementation(() => new Promise(() => {}))
      const executor = createScheduleExecutor(app)

      const execPromise = executor(agentSchedule() as any)
      const rejection = expect(execPromise).rejects.toThrow(/Timed out/)
      await vi.advanceTimersByTimeAsync(ExecTimeoutMS + 1000)
      await rejection

      expect(services.scheduleRun.complete).toHaveBeenCalledWith(
        `run-1`,
        expect.objectContaining({ status: `timeout` })
      )
      expect(app.locals.sandbox.stopPod).toHaveBeenCalledWith(`pod-cli-1`)
    } finally {
      vi.useRealTimers()
    }
  })

  it(`honors schedule.timeoutMs over ExecTimeoutMS on the CLI-brain path`, async () => {
    vi.useFakeTimers()
    try {
      const { app, services, sbInstance } = buildApp()
      services.agent.get.mockResolvedValue({ data: runtimeAgent() })
      sbInstance.execStreaming.mockImplementation(() => new Promise(() => {}))
      const executor = createScheduleExecutor(app)

      // 120s override — far below the 60-minute ExecTimeoutMS default
      const execPromise = executor(agentSchedule({ timeoutMs: 120_000 }) as any)
      const rejection = expect(execPromise).rejects.toThrow(/Timed out after 120s/)
      await vi.advanceTimersByTimeAsync(121_000)
      await rejection

      expect(services.scheduleRun.complete).toHaveBeenCalledWith(
        `run-1`,
        expect.objectContaining({ status: `timeout` })
      )
      expect(app.locals.sandbox.stopPod).toHaveBeenCalledWith(`pod-cli-1`)
    } finally {
      vi.useRealTimers()
    }
  })

  it(`honors schedule.timeoutMs over ExecTimeoutMS on the pod-schedule path`, async () => {
    vi.useFakeTimers()
    try {
      const { app, services, sbInstance } = buildApp()
      sbInstance.execStreaming.mockImplementation(() => new Promise(() => {}))
      const executor = createScheduleExecutor(app)

      // 120s override — far below the 60-minute ExecTimeoutMS default
      const execPromise = executor(
        agentSchedule({ agentId: undefined, timeoutMs: 120_000 }) as any
      )
      const rejection = expect(execPromise).rejects.toThrow(/Timed out after 120s/)
      await vi.advanceTimersByTimeAsync(121_000)
      await rejection

      expect(services.scheduleRun.complete).toHaveBeenCalledWith(
        `run-1`,
        expect.objectContaining({ status: `timeout` })
      )
      expect(app.locals.sandbox.stopPod).toHaveBeenCalledWith(`pod-cli-1`)
    } finally {
      vi.useRealTimers()
    }
  })

  it(`still succeeds when persisting the continuity messages fails`, async () => {
    const { app, services } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    services.message.create.mockResolvedValue({ error: new Error(`persist fail`) })
    const executor = createScheduleExecutor(app)

    await executor(agentSchedule() as any)

    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `success` })
    )
    expect(app.locals.sandbox.stopPod).toHaveBeenCalledWith(`pod-cli-1`)
  })

  // ── Provider failover (Wave E) ──────────────────────────────────────

  // A claude-code body sandbox linked to a priority-ordered ai provider chain:
  // anthropic-oauth (primary), zai (fallback 0), openrouter (fallback 1).
  const chainSandboxRecord = (
    links = [
      {
        priority: 0,
        provider: {
          id: `pv0`,
          type: `ai`,
          brand: `anthropic`,
          secretId: `sc_anth`,
          options: { authMethod: `oauth` },
        },
      },
      {
        priority: 1,
        provider: {
          id: `pv1`,
          type: `ai`,
          brand: `zai`,
          secretId: `sc_zai`,
          options: {},
        },
      },
      {
        priority: 2,
        provider: {
          id: `pv2`,
          type: `ai`,
          brand: `openrouter`,
          secretId: `sc_or`,
        },
      },
    ]
  ) => ({
    orgId: `org-1`,
    config: { runtime: `claude-code` },
    providerLinks: links,
    getEffectiveConfig() {
      return this
    },
  })

  // Drive execStreaming from a queue: each call emits the queued stdout then
  // resolves with the queued success/error. Extra calls repeat the last entry.
  const queueExec = (
    sbInstance: any,
    results: Array<{ success: boolean; stdout?: string; error?: string }>
  ) => {
    let i = 0
    sbInstance.execStreaming.mockImplementation(
      async (_cmd: string, _args: string[], opts: any) => {
        const r = results[Math.min(i, results.length - 1)]
        i++
        if (r.stdout) opts.onStdout(Buffer.from(r.stdout, `utf8`))
        return {
          output: ``,
          error: r.error,
          success: r.success,
          exitCode: r.success ? 0 : 1,
        }
      }
    )
  }

  it(`fails over from a transient primary to the zai fallback and persists its report`, async () => {
    vi.useFakeTimers()
    try {
      const { app, services, sbInstance } = buildApp()
      services.agent.get.mockResolvedValue({ data: runtimeAgent() })
      services.sandbox.get.mockResolvedValue({ data: chainSandboxRecord() })
      queueExec(sbInstance, [
        { success: false, stdout: `API Error: 529 Overloaded` },
        { success: false, stdout: `529 Overloaded` },
        { success: true, stdout: `ZAI REPORT` },
      ])
      const executor = createScheduleExecutor(app)

      const p = executor(agentSchedule() as any)
      await vi.advanceTimersByTimeAsync(60_000)
      await p

      // startPod received the primary provider's env (anthropic-oauth) + all
      // three domain-scoped placeholders as the pod default.
      const startArgs = app.locals.sandbox.startPod.mock.calls[0][0]
      expect(startArgs.providerChain.primaryEnv.CLAUDE_CODE_OAUTH_TOKEN).toMatch(
        /^tdsk_ph_/
      )
      expect(Object.keys(startArgs.providerChain.placeholders)).toHaveLength(3)

      // calls: 0 = primary base, 1 = primary same-provider retry, 2 = zai fallback
      // Every attempt carries the same run-scoped TDSK_IDEMPOTENCY_KEY.
      const calls = sbInstance.execStreaming.mock.calls
      expect(calls[0][0]).toBe(
        `env TDSK_IDEMPOTENCY_KEY='run-1' CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 claude -p 'CLI SOUL\n\nReview platform state'`
      )
      expect(calls[1][0]).toBe(
        `env TDSK_IDEMPOTENCY_KEY='run-1' CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 claude -p 'CLI SOUL\n\nReview platform state'`
      )
      expect(calls[2][0]).toContain(`ANTHROPIC_BASE_URL='https://api.z.ai/api/anthropic'`)
      expect(calls[2][0]).toMatch(
        /^env TDSK_IDEMPOTENCY_KEY='run-1' ANTHROPIC_AUTH_TOKEN='tdsk_ph_/
      )
      expect(calls[2][0]).toContain(`claude -p 'CLI SOUL\n\nReview platform state'`)

      // The zai fallback's report is the persisted assistant message
      expect(services.message.create).toHaveBeenNthCalledWith(2, {
        threadId: `th_new`,
        type: `assistant`,
        orgId: `org-1`,
        content: [{ type: `text`, text: `ZAI REPORT` }],
      })
      expect(services.scheduleRun.complete).toHaveBeenCalledWith(
        `run-1`,
        expect.objectContaining({ status: `success` })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it(`advances through a transient zai fallback to the openrouter fallback`, async () => {
    vi.useFakeTimers()
    try {
      const { app, services, sbInstance } = buildApp()
      services.agent.get.mockResolvedValue({ data: runtimeAgent() })
      services.sandbox.get.mockResolvedValue({ data: chainSandboxRecord() })
      queueExec(sbInstance, [
        { success: false, stdout: `529 Overloaded` }, // primary
        { success: false, stdout: `529 Overloaded` }, // primary retry
        { success: false, stdout: `rate limit exceeded` }, // zai
        { success: false, stdout: `rate limit exceeded` }, // zai retry
        { success: true, stdout: `OPENROUTER REPORT` }, // openrouter
      ])
      const executor = createScheduleExecutor(app)

      const p = executor(agentSchedule() as any)
      await vi.advanceTimersByTimeAsync(60_000)
      await p

      const calls = sbInstance.execStreaming.mock.calls
      // Final attempt targets openrouter with its own base URL prefixed inline,
      // still carrying the same run-scoped idempotency token as every attempt.
      const last = calls[calls.length - 1][0]
      expect(last).toContain(`ANTHROPIC_BASE_URL='https://openrouter.ai/api'`)
      expect(last).toMatch(
        /^env TDSK_IDEMPOTENCY_KEY='run-1' ANTHROPIC_AUTH_TOKEN='tdsk_ph_/
      )

      expect(services.message.create).toHaveBeenNthCalledWith(2, {
        threadId: `th_new`,
        type: `assistant`,
        orgId: `org-1`,
        content: [{ type: `text`, text: `OPENROUTER REPORT` }],
      })
      expect(services.scheduleRun.complete).toHaveBeenCalledWith(
        `run-1`,
        expect.objectContaining({ status: `success` })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it(`does NOT fail over on a non-transient failure`, async () => {
    const { app, services, sbInstance } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    services.sandbox.get.mockResolvedValue({ data: chainSandboxRecord() })
    sbInstance.execStreaming.mockResolvedValue({
      output: ``,
      success: false,
      exitCode: 1,
      error: `Your credit balance is too low`,
    })
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toThrow(
      /credit balance is too low/
    )

    // Exactly one exec: no same-provider retry, no failover to zai/openrouter
    expect(sbInstance.execStreaming).toHaveBeenCalledTimes(1)
    expect(services.message.create).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error` })
    )
    expect(app.locals.sandbox.stopPod).toHaveBeenCalledWith(`pod-cli-1`)
  })

  it(`with no fallbacks, a transient primary recovers via same-provider retry (Wave B)`, async () => {
    vi.useFakeTimers()
    try {
      const { app, services, sbInstance } = buildApp()
      services.agent.get.mockResolvedValue({ data: runtimeAgent() })
      services.sandbox.get.mockResolvedValue({
        data: chainSandboxRecord([
          {
            priority: 0,
            provider: {
              id: `pv0`,
              type: `ai`,
              brand: `anthropic`,
              secretId: `sc_anth`,
              options: { authMethod: `oauth` },
            },
          },
        ]),
      })
      queueExec(sbInstance, [
        { success: false, stdout: `API Error: 503` },
        { success: true, stdout: `RECOVERED REPORT` },
      ])
      const executor = createScheduleExecutor(app)

      const p = executor(agentSchedule() as any)
      await vi.advanceTimersByTimeAsync(60_000)
      await p

      const calls = sbInstance.execStreaming.mock.calls
      // Both attempts use the same base command — never an ai-provider failover
      // prefix (the foreground guard is part of the base command, not a failover) —
      // plus the same run-scoped idempotency token on both attempts.
      expect(calls).toHaveLength(2)
      for (const call of calls)
        expect(call[0]).toBe(
          `env TDSK_IDEMPOTENCY_KEY='run-1' CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 claude -p 'CLI SOUL\n\nReview platform state'`
        )

      expect(services.message.create).toHaveBeenNthCalledWith(2, {
        threadId: `th_new`,
        type: `assistant`,
        orgId: `org-1`,
        content: [{ type: `text`, text: `RECOVERED REPORT` }],
      })
      expect(services.scheduleRun.complete).toHaveBeenCalledWith(
        `run-1`,
        expect.objectContaining({ status: `success` })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it(`throws a provider-config error when a linked provider has no domain scope`, async () => {
    const { app, services } = buildApp()
    services.agent.get.mockResolvedValue({ data: runtimeAgent() })
    services.sandbox.get.mockResolvedValue({
      data: chainSandboxRecord([
        {
          priority: 0,
          // custom brand with a secret but no allowedDomains/baseUrl → fail closed
          provider: { id: `pv0`, type: `ai`, brand: `custom`, secretId: `sc_x` },
        },
      ]),
    })
    const executor = createScheduleExecutor(app)

    await expect(executor(agentSchedule() as any)).rejects.toThrow(
      /Provider auth configuration error/
    )
    // Resolution failed before the pod started
    expect(app.locals.sandbox.startPod).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error` })
    )
  })
})
