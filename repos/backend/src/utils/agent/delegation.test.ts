import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  ESandboxRuntime,
  DelegationMaxDepth,
  DelegationDepthEnvVar,
  DelegationMaxTimeoutMs,
  DelegationOutputMaxChars,
  DelegationConcurrencyCap,
  DelegationTimeoutSlackMs,
  DelegationCriticMaxRounds,
  DelegationDefaultTimeoutMs,
} from '@tdsk/domain'
import { createDelegateProvider } from './delegation'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const passVerdict = {
  success: true,
  exitCode: 0,
  output: `VERDICT: PASS - the diff matches the task`,
}

const makeMocks = () => {
  // exec-only sandbox instance (no execStreaming) so output rides on the result
  const exec = vi.fn()
  const sbInstance = { exec }
  const getSandbox = vi.fn().mockResolvedValue(sbInstance)
  const sandboxGet = vi.fn().mockResolvedValue({
    data: {
      orgId: `og_1`,
      config: { runtime: ESandboxRuntime.claudeCode },
    },
  })
  return {
    exec,
    getSandbox,
    sandboxGet,
    app: { locals: { sandbox: { getSandbox } } } as any,
    db: { services: { sandbox: { get: sandboxGet } } } as any,
  }
}

const ctx = { podName: `pod-1`, sandboxId: `sb_1`, projectId: `pj_1` }

describe(`createDelegateProvider`, () => {
  let m: ReturnType<typeof makeMocks>
  beforeEach(() => {
    vi.clearAllMocks()
    m = makeMocks()
  })

  describe(`refusals (no exec)`, () => {
    it(`refuses when created at depth >= DelegationMaxDepth`, async () => {
      const provider = createDelegateProvider(
        m.app,
        m.db,
        `og_1`,
        `ag_1`,
        ctx,
        DelegationMaxDepth
      )
      const res = await provider.delegate({ task: `do work` })
      expect(res.success).toBe(false)
      expect(res.error).toContain(`Max delegation depth`)
      expect(m.exec).not.toHaveBeenCalled()
    })

    it(`refuses an empty task`, async () => {
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `   ` })
      expect(res.success).toBe(false)
      expect(res.error).toContain(`non-empty task`)
      expect(m.exec).not.toHaveBeenCalled()
    })

    it(`refuses when there is no body sandbox pod`, async () => {
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, {
        sandboxId: `sb_1`,
      })
      const res = await provider.delegate({ task: `do work` })
      expect(res.success).toBe(false)
      expect(res.error).toContain(`Kubernetes body sandbox pod`)
      expect(m.exec).not.toHaveBeenCalled()
    })

    it(`refuses when the sandbox service is unavailable`, async () => {
      const app = { locals: {} } as any
      const provider = createDelegateProvider(app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `do work` })
      expect(res.success).toBe(false)
      expect(res.error).toContain(`Sandbox service not available`)
    })

    it(`shares the concurrency cap across provider instances for the same pod`, async () => {
      // Two sessions (two provider instances) delegating into the SAME pod
      // must share one cap — the per-pod counter is module-scoped
      let release!: (value: unknown) => void
      const gate = new Promise((resolve) => (release = resolve))
      m.exec.mockImplementation(() => gate.then(() => passVerdict))

      const providerA = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const providerB = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const inFlight = Array.from({ length: DelegationConcurrencyCap }, () =>
        providerA.delegate({ task: `long task` })
      )
      await new Promise((resolve) => setImmediate(resolve))

      const rejected = await providerB.delegate({ task: `other session` })
      expect(rejected.success).toBe(false)
      expect(rejected.error).toContain(`concurrency cap`)

      release(null)
      await Promise.all(inFlight)
    })

    it(`rejects delegations past the concurrency cap without queueing`, async () => {
      // First DelegationConcurrencyCap delegations hang on exec; the next
      // one must be rejected immediately
      let release!: (value: unknown) => void
      const gate = new Promise((resolve) => (release = resolve))
      m.exec.mockImplementation(() => gate.then(() => passVerdict))

      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const inFlight = Array.from({ length: DelegationConcurrencyCap }, () =>
        provider.delegate({ task: `long task` })
      )
      // Let the in-flight delegations reach their exec await
      await new Promise((resolve) => setImmediate(resolve))

      const rejected = await provider.delegate({ task: `one too many` })
      expect(rejected.success).toBe(false)
      expect(rejected.error).toContain(`concurrency cap`)

      release(null)
      await Promise.all(inFlight)

      // Slots free up after completion — the next delegation runs again
      m.exec.mockResolvedValue(passVerdict)
      const after = await provider.delegate({ task: `after drain` })
      expect(after.error ?? ``).not.toContain(`concurrency cap`)
    })
  })

  describe(`template resolution`, () => {
    it(`resolves the template from the body sandbox config`, async () => {
      m.exec.mockResolvedValue(passVerdict)
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix the bug` })

      expect(res.success).toBe(true)
      expect(m.sandboxGet).toHaveBeenCalledWith(`sb_1`)
      expect(m.getSandbox).toHaveBeenCalledWith(`pod-1`)
      const command = m.exec.mock.calls[0][0] as string
      expect(command).toContain(`claude -p 'fix the bug'`)
    })

    it(`threads the child depth env into the command`, async () => {
      m.exec.mockResolvedValue(passVerdict)
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx, 0)
      await provider.delegate({ task: `fix the bug` })

      const command = m.exec.mock.calls[0][0] as string
      expect(command).toContain(`${DelegationDepthEnvVar}='1'`)
    })

    it(`guards the claude-code child and critic commands against backgrounding`, async () => {
      m.exec.mockResolvedValue(passVerdict)
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      await provider.delegate({ task: `fix the bug` })

      // Both the child (call 0) and the critic (call 1) are one-shot CLIs in the
      // disposable pod, so both must disable background tasks.
      const childCommand = m.exec.mock.calls[0][0] as string
      const criticCommand = m.exec.mock.calls[1][0] as string
      expect(childCommand).toContain(`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`)
      expect(criticCommand).toContain(`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`)
    })

    it(`omits the claude-code guard for a non-claude runtime`, async () => {
      m.exec.mockResolvedValue(passVerdict)
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      await provider.delegate({ task: `fix it`, runtime: ESandboxRuntime.codex })

      const command = m.exec.mock.calls[0][0] as string
      expect(command).not.toContain(`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`)
    })

    it(`uses a runtime override without loading the body sandbox`, async () => {
      m.exec.mockResolvedValue(passVerdict)
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      await provider.delegate({ task: `fix it`, runtime: ESandboxRuntime.codex })

      expect(m.sandboxGet).not.toHaveBeenCalled()
      const command = m.exec.mock.calls[0][0] as string
      expect(command).toContain(`codex exec 'fix it'`)
    })

    it(`fails on an unknown runtime override`, async () => {
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it`, runtime: `nope` as any })
      expect(res.success).toBe(false)
      expect(res.error).toContain(`No prompt command template`)
      expect(m.exec).not.toHaveBeenCalled()
    })

    it(`fails when the body sandbox belongs to another org`, async () => {
      m.sandboxGet.mockResolvedValue({
        data: { orgId: `og_OTHER`, config: { runtime: ESandboxRuntime.claudeCode } },
      })
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it` })
      expect(res.success).toBe(false)
      expect(res.error).toContain(`body sandbox config not found`)
      expect(m.exec).not.toHaveBeenCalled()
    })

    it(`includes advisory tool constraints in the child prompt`, async () => {
      m.exec.mockResolvedValue(passVerdict)
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      await provider.delegate({ task: `fix it`, tools: [`readFile`, `shellExec`] })

      const command = m.exec.mock.calls[0][0] as string
      expect(command).toContain(`you may only use these tools: readFile, shellExec`)
      expect(command).toContain(`fix it`)
    })
  })

  describe(`structured results + critic`, () => {
    it(`returns a grounded failure on a non-zero exit and skips the critic`, async () => {
      m.exec.mockResolvedValue({
        success: false,
        exitCode: 2,
        error: `build failed`,
        output: `error output`,
      })
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it` })

      expect(res.success).toBe(false)
      expect(res.exitCode).toBe(2)
      expect(res.error).toBe(`build failed`)
      expect(res.output).toContain(`error output`)
      // Only the child ran — no critic pass for a grounded failure
      expect(m.exec).toHaveBeenCalledTimes(1)
    })

    it(`passes when the child exits 0 and the critic passes`, async () => {
      m.exec
        .mockResolvedValueOnce({ success: true, exitCode: 0, output: `did the work` })
        .mockResolvedValueOnce({
          success: true,
          exitCode: 0,
          output: `VERDICT: PASS - output matches the task`,
        })
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it` })

      expect(res.success).toBe(true)
      expect(res.exitCode).toBe(0)
      expect(res.output).toBe(`did the work`)
      expect(res.critic).toEqual({
        passed: true,
        reason: `output matches the task`,
      })
      // Critic prompt embeds the child's output + a strict verdict instruction
      const criticCommand = m.exec.mock.calls[1][0] as string
      expect(criticCommand).toContain(`VERDICT: PASS`)
      expect(criticCommand).toContain(`did the work`)
    })

    it(`fails when the critic rejects a clean exit`, async () => {
      m.exec
        .mockResolvedValueOnce({ success: true, exitCode: 0, output: `did nothing` })
        .mockResolvedValueOnce({
          success: true,
          exitCode: 0,
          output: `VERDICT: FAIL - no changes were made`,
        })
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it` })

      expect(res.success).toBe(false)
      expect(res.exitCode).toBe(0)
      expect(res.critic).toEqual({ passed: false, reason: `no changes were made` })
      expect(res.error).toContain(`Critic rejected`)
    })

    it(`keeps exit-code-grounded success when the critic is unparseable, bounded to DelegationCriticMaxRounds`, async () => {
      m.exec.mockResolvedValueOnce({ success: true, exitCode: 0, output: `done` })
      // Every critic pass returns garbage — no verdict line
      m.exec.mockResolvedValue({ success: true, exitCode: 0, output: `hmm, unclear` })

      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it` })

      expect(res.success).toBe(true)
      expect(res.critic).toBeUndefined()
      expect(m.exec).toHaveBeenCalledTimes(1 + DelegationCriticMaxRounds)
    })

    it(`keeps exit-code-grounded success when the critic run itself fails`, async () => {
      m.exec.mockResolvedValueOnce({ success: true, exitCode: 0, output: `done` })
      m.exec.mockResolvedValue({ success: false, exitCode: 1, output: `` })

      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it` })

      expect(res.success).toBe(true)
      expect(res.critic).toBeUndefined()
    })

    it(`returns a failed result when the child times out`, async () => {
      // Child exec never resolves; timeoutMs clamps up to the 1s floor
      m.exec.mockImplementation(() => new Promise(() => {}))
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it`, timeoutMs: 1 })

      expect(res.success).toBe(false)
      expect(res.error).toContain(`timed out after 1s`)
      // Only the child attempt — no critic on timeout
      expect(m.exec).toHaveBeenCalledTimes(1)
    }, 10_000)

    it(`falls back to the default timeout on a non-finite timeoutMs`, async () => {
      // Math.max(NaN, 1000) is NaN and setTimeout(…, NaN) fires immediately —
      // the finite guard must keep a fast child from reporting a bogus timeout
      m.exec.mockResolvedValue(passVerdict)
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it`, timeoutMs: Number.NaN })

      expect(res.success).toBe(true)
      expect(res.error).toBeUndefined()
    })

    it(`returns a failed result when getSandbox throws`, async () => {
      m.getSandbox.mockRejectedValue(new Error(`pod not running`))
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it` })
      expect(res.success).toBe(false)
      expect(res.error).toBe(`pod not running`)
    })
  })

  describe(`streaming exec path`, () => {
    it(`tail-caps and decodes streamed stdout once`, async () => {
      const execStreaming = vi.fn()
      // Child call streams two chunks; critic call streams a verdict
      execStreaming.mockImplementationOnce(
        async (_cmd: string, _args: string[], opts: any) => {
          opts.onStdout(Buffer.from(`chunk one `))
          opts.onStdout(Buffer.from(`chunk two`))
          return { success: true, exitCode: 0, output: `` }
        }
      )
      execStreaming.mockImplementationOnce(
        async (_cmd: string, _args: string[], opts: any) => {
          opts.onStdout(Buffer.from(`VERDICT: PASS - ok`))
          return { success: true, exitCode: 0, output: `` }
        }
      )
      m.getSandbox.mockResolvedValue({ exec: m.exec, execStreaming })

      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it` })

      expect(res.success).toBe(true)
      expect(res.output).toBe(`chunk one chunk two`)
      expect(res.critic?.passed).toBe(true)
      expect(m.exec).not.toHaveBeenCalled()
    })

    it(`front-trims streamed stdout beyond DelegationOutputMaxChars, keeping the tail`, async () => {
      // Three chunks totaling well past the cap exercise both trim branches
      // (whole-chunk shift and partial subarray); only the tail must survive
      const chunkSize = Math.ceil((DelegationOutputMaxChars * 1.7) / 3)
      const chunks = [`a`.repeat(chunkSize), `b`.repeat(chunkSize), `c`.repeat(chunkSize)]
      const execStreaming = vi.fn()
      execStreaming.mockImplementationOnce(
        async (_cmd: string, _args: string[], opts: any) => {
          for (const chunk of chunks) opts.onStdout(Buffer.from(chunk))
          return { success: true, exitCode: 0, output: `` }
        }
      )
      // Critic pass returns an unparseable verdict — success stays exit-grounded
      execStreaming.mockResolvedValueOnce({ success: true, exitCode: 0, output: `` })
      m.getSandbox.mockResolvedValue({ exec: m.exec, execStreaming })

      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const res = await provider.delegate({ task: `fix it` })

      expect(res.success).toBe(true)
      expect(res.output).toHaveLength(DelegationOutputMaxChars)
      expect(res.output).toBe(chunks.join(``).slice(-DelegationOutputMaxChars))
    })

    // The wall-clock race in execCapped never aborts the exec, so the child's
    // own bound must be the SAME already-clamped budget the delegation waits
    // on. Without it the child was capped at the provider's wedged-pod guard
    // and every delegation longer than that guard failed on a dead letter.
    const streamOnce = (text: string) => async (_c: string, _a: string[], opts: any) => {
      opts.onStdout(Buffer.from(text))
      return { success: true, exitCode: 0, output: `` }
    }

    it(`bounds the child exec with the caller's budget`, async () => {
      const execStreaming = vi.fn()
      execStreaming.mockImplementationOnce(streamOnce(`done`))
      execStreaming.mockImplementationOnce(streamOnce(`VERDICT: PASS - ok`))
      m.getSandbox.mockResolvedValue({ exec: m.exec, execStreaming })

      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      await provider.delegate({ task: `fix it`, timeoutMs: 5 * 60_000 })

      expect(execStreaming.mock.calls[0][2].timeoutMs).toBe(5 * 60_000)
    })

    it(`bounds the child exec with DelegationDefaultTimeoutMs when none is requested`, async () => {
      const execStreaming = vi.fn()
      execStreaming.mockImplementationOnce(streamOnce(`done`))
      execStreaming.mockImplementationOnce(streamOnce(`VERDICT: PASS - ok`))
      m.getSandbox.mockResolvedValue({ exec: m.exec, execStreaming })

      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      await provider.delegate({ task: `fix it` })

      expect(execStreaming.mock.calls[0][2].timeoutMs).toBe(DelegationDefaultTimeoutMs)
    })

    it(`bounds the child exec with the CLAMPED budget when the caller overshoots the cap`, async () => {
      const execStreaming = vi.fn()
      execStreaming.mockImplementationOnce(streamOnce(`done`))
      execStreaming.mockImplementationOnce(streamOnce(`VERDICT: PASS - ok`))
      m.getSandbox.mockResolvedValue({ exec: m.exec, execStreaming })

      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      await provider.delegate({ task: `fix it`, timeoutMs: DelegationMaxTimeoutMs * 10 })

      expect(execStreaming.mock.calls[0][2].timeoutMs).toBe(DelegationMaxTimeoutMs)
    })

    // Fake timers, deliberately: these assert where the deadline boundary sits,
    // and on real timers the child's rejection and the race's own deadline are
    // the same instant give or take libuv's rounding — which decides the branch
    // under test and turns the assertion into a coin flip in CI.
    const rejectAfter = (elapsedMs: number) =>
      vi.fn(async (_c: string, _a: string[], opts: any) => {
        opts.onStdout(Buffer.from(`partial work`))
        await new Promise((resolve) => setTimeout(resolve, elapsedMs))
        throw new Error(`runInPod timed out after ${opts.timeoutMs}ms for pod pod-1`)
      })

    const delegateWithClock = async (execStreaming: ReturnType<typeof vi.fn>) => {
      m.getSandbox.mockResolvedValue({ exec: m.exec, execStreaming })
      const provider = createDelegateProvider(m.app, m.db, `og_1`, `ag_1`, ctx)
      const settled = provider.delegate({ task: `fix it`, timeoutMs: 1000 })
      await vi.advanceTimersByTimeAsync(1000)
      return settled
    }

    it(`reports the timed-out result with the captured tail when the exec rejects at the deadline`, async () => {
      vi.useFakeTimers()
      try {
        const res = await delegateWithClock(rejectAfter(1000))

        expect(res.success).toBe(false)
        expect(res.output).toBe(`partial work`)
        expect(res.error).toBe(`Delegated task timed out after 1s`)
      } finally {
        vi.useRealTimers()
      }
    })

    it(`still reports timed out when the child's own timer fires a hair EARLY`, async () => {
      vi.useFakeTimers()
      try {
        // Node can run a setTimeout callback before its full delay has elapsed
        // (libuv compares against a cached loop time), so the child's deadline
        // rejection can arrive at timeoutMs - 1. DelegationTimeoutSlackMs is
        // what keeps that from being misread as a genuine failure and throwing
        // the captured tail away.
        const res = await delegateWithClock(rejectAfter(1000 - 1))

        expect(res.success).toBe(false)
        expect(res.output).toBe(`partial work`)
        expect(res.error).toBe(`Delegated task timed out after 1s`)
      } finally {
        vi.useRealTimers()
      }
    })

    it(`propagates a genuine failure that rejects before the slack window opens`, async () => {
      vi.useFakeTimers()
      try {
        // Comfortably outside the slack: a real mid-run crash, not a deadline.
        const res = await delegateWithClock(
          rejectAfter(1000 - DelegationTimeoutSlackMs - 1)
        )

        expect(res.success).toBe(false)
        expect(res.error).toContain(`runInPod timed out after 1000ms`)
        expect(res.error).not.toContain(`Delegated task timed out`)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
