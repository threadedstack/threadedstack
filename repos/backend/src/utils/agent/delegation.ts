import type { TDatabase } from '@tdsk/database'
import type { IDelegateProvider } from '@tdsk/agent'
import type { TApp, TDelegateProviderCtx } from '@TBE/types'
import type {
  ISandbox,
  TDelegateInput,
  TDelegateCritic,
  TDelegateResult,
  TSandboxResult,
  TSandboxRuntimeId,
  TKubeSandboxConfig,
} from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { buildEnvPrefix } from '@TBE/utils/agent/memory'
import {
  DelegationMaxDepth,
  DelegationDepthEnvVar,
  SandboxRuntimeConfigs,
  DelegationMaxTimeoutMs,
  DelegationOutputMaxChars,
  DelegationConcurrencyCap,
  DelegationCriticMaxRounds,
  DelegationDefaultTimeoutMs,
} from '@tdsk/domain'
import {
  escapePromptArg,
  foregroundEnvPrefix,
  resolvePromptTemplate,
  substitutePlaceholders,
} from '@TBE/utils/agent/promptCommand'

/** Max characters of task text composed into the critic prompt */
const CriticTaskMaxChars = 2000

/** Max characters of child output composed into the critic prompt (tail-capped) */
const CriticOutputMaxChars = 4000

/** Max characters kept from the critic's reason line */
const CriticReasonMaxChars = 500

/** Wall-clock timeout for a single critic assessment pass */
const CriticTimeoutMs = 2 * 60_000

/** No `g` flag — safe for both `.test` and `.match` (no shared lastIndex) */
const CriticVerdictRegex = /VERDICT:\s*(PASS|FAIL)/i

type TCappedExec = {
  result: TSandboxResult
  output: string
  timedOut: boolean
}

/**
 * In-flight delegation counts per pod. Module-scoped (not per provider
 * closure) so concurrent sessions delegating into the SAME body pod share one
 * cap. Counts only AWAITED delegations: a timed-out child is abandoned rather
 * than killed (the K8s exec API offers no kill), so its slot is released —
 * real pod load is ultimately bounded by the pod's cgroup limits.
 */
const activeByPod = new Map<string, number>()

/**
 * Run a command in the pod (ISandbox.exec/execStreaming — the K8s exec API,
 * not child_process) with a tail-capped stdout buffer and a wall-clock
 * timeout. Mirrors the executor's stdout handling: raw Buffers are accumulated
 * with byte accounting and decoded ONCE at the end (per-chunk decoding corrupts
 * multibyte characters split across chunk boundaries), trimming from the FRONT
 * so the tail survives. On timeout the K8s exec session is abandoned, not
 * killed — the child keeps running in the pod (same semantics as the schedule
 * executor's timeout); the timeout only bounds how long the delegation waits.
 */
const execCapped = async (
  sbInstance: ISandbox,
  command: string,
  timeoutMs: number
): Promise<TCappedExec> => {
  const chunks: Buffer[] = []
  let bytes = 0
  const push = (chunk: Buffer | string) => {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    chunks.push(buf)
    bytes += buf.length
    while (bytes > DelegationOutputMaxChars) {
      const excess = bytes - DelegationOutputMaxChars
      const head = chunks[0]
      if (head.length <= excess) {
        chunks.shift()
        bytes -= head.length
      } else {
        chunks[0] = head.subarray(excess)
        bytes -= excess
      }
    }
  }

  // ISandbox.exec()/execStreaming() — sandbox methods, not child_process
  const execPromise = sbInstance.execStreaming
    ? sbInstance.execStreaming(command, [], { onStdout: (chunk) => push(chunk) })
    : sbInstance.exec(command).then((res) => {
        if (res.output) push(res.output)
        return res
      })
  // A late rejection after the timeout wins the race must never crash the
  // process — the raced promise below still surfaces pre-timeout rejections.
  execPromise.catch(() => {})

  let timer!: ReturnType<typeof setTimeout>
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
    timer.unref()
  })

  const raced = await Promise.race([execPromise, timeout]).finally(() =>
    clearTimeout(timer)
  )
  const output = Buffer.concat(chunks).toString(`utf8`).slice(-DelegationOutputMaxChars)

  if (!raced) return { timedOut: true, output, result: { success: false, output } }
  return { timedOut: false, output, result: raced }
}

/**
 * Run the bounded critic assessment: one in-pod CLI pass (same promptCommand
 * mechanism as the child itself) judging whether the output shows the task was
 * genuinely completed, parsed to a strict VERDICT line. Returns null when the
 * critic is unavailable (exec failure, timeout, unparseable verdict) — success
 * then stays grounded on the child's exit code alone. Bounded to
 * DelegationCriticMaxRounds passes; a round is only repeated on critic
 * failure, never to re-litigate a parsed verdict.
 *
 * The critic is an advisory quality signal, NOT a trust boundary: its prompt
 * embeds the child's stdout, so steering text in that output can flip the
 * verdict. Nothing security-relevant hangs off `passed` — it only shapes the
 * success boolean reported back to the same-org delegating agent.
 */
const runCritic = async (
  sbInstance: ISandbox,
  command: string
): Promise<TDelegateCritic | null> => {
  for (let round = 0; round < DelegationCriticMaxRounds; round++) {
    try {
      const res = await execCapped(sbInstance, command, CriticTimeoutMs)
      if (res.timedOut || !res.result.success) {
        logger.warn(
          `[Delegation] Critic pass ${round + 1}/${DelegationCriticMaxRounds} failed: ${
            res.timedOut ? `timeout` : res.result.error || `non-zero exit`
          }`
        )
        continue
      }

      const match = res.output.match(CriticVerdictRegex)
      if (!match) {
        logger.warn(
          `[Delegation] Critic pass ${round + 1}/${DelegationCriticMaxRounds} verdict unparseable`
        )
        continue
      }

      const passed = match[1].toUpperCase() === `PASS`
      const afterVerdict = res.output.slice(
        res.output.indexOf(match[0]) + match[0].length
      )
      const reason =
        afterVerdict
          .split(`\n`)[0]
          .replace(/^[\s:.,-]+/, ``)
          .trim() ||
        (passed
          ? `Output shows the task was completed`
          : `Output does not show the task was completed`)
      return { passed, reason: reason.slice(0, CriticReasonMaxChars) }
    } catch (err) {
      logger.warn(
        `[Delegation] Critic pass ${round + 1}/${DelegationCriticMaxRounds} exec error: ${
          (err as Error).message
        }`
      )
    }
  }
  return null
}

/** Compose the critic prompt for a completed child run. */
const buildCriticPrompt = (
  task: string,
  output: string,
  exitCode: number | undefined
): string =>
  [
    `You are a strict critic reviewing the result of a delegated task. Judge ONLY whether the output shows the task was genuinely completed.`,
    `## Task\n${task.slice(0, CriticTaskMaxChars)}`,
    `## Exit code\n${exitCode ?? `unknown`}`,
    `## Output (tail)\n${output.slice(-CriticOutputMaxChars)}`,
    `Respond with exactly one line starting with "VERDICT: PASS" or "VERDICT: FAIL", followed by a one-sentence reason.`,
  ].join(`\n\n`)

/**
 * Build the backend IDelegateProvider bridging the delegateTask tool to a
 * bounded in-pod child coding process (the runtime's promptCommand via the K8s
 * exec API) — the same mechanism as runCliAgentSchedule, deliberately NOT a
 * nested AgentRunner (pi-mono has no turn cap). Mirrors createMemoryProvider:
 * a pure closure over app + db scoped to one org/agent.
 *
 * Bounds enforced here (in addition to the agent-side tool refusal):
 * - depth: a provider created at depth >= DelegationMaxDepth refuses, and the
 *   depth is threaded into the child env (defense in depth — an in-pod CLI
 *   cannot call delegateTask, but the contract survives new execution paths)
 * - concurrency: at most DelegationConcurrencyCap in-flight delegations per
 *   provider instance (immediate rejection, no queueing)
 * - runtime: caller-provided timeouts are clamped to DelegationMaxTimeoutMs
 * - output: child stdout is tail-capped to DelegationOutputMaxChars
 * - critic: at most DelegationCriticMaxRounds assessment passes, run only for
 *   clean (exit 0) children — a non-zero exit is already a grounded failure
 */
export const createDelegateProvider = (
  app: TApp,
  db: TDatabase,
  orgId: string,
  agentId: string,
  ctx: TDelegateProviderCtx,
  depth = 0
): IDelegateProvider => {
  // Effective body-sandbox config resolved lazily on the first delegate() call
  // (agents that never delegate must not pay a DB load at resolve time)
  let kubeConfigPromise: Promise<TKubeSandboxConfig | null> | null = null
  const resolveKubeConfig = (): Promise<TKubeSandboxConfig | null> => {
    kubeConfigPromise ??= (async () => {
      if (!ctx.sandboxId) return null
      const { data: record } = await db.services.sandbox.get(ctx.sandboxId)
      if (!record) return null

      // Defense in depth: the body sandbox must belong to the agent's org
      if (record.orgId && record.orgId !== orgId) {
        logger.warn(
          `[Delegation] Sandbox ${ctx.sandboxId} does not belong to org ${orgId}`
        )
        return null
      }

      const effective = record.getEffectiveConfig
        ? record.getEffectiveConfig(ctx.projectId as string)
        : record
      return (effective.config as TKubeSandboxConfig) ?? null
    })()
    return kubeConfigPromise
  }

  /** Resolve the child prompt-command template (input runtime override first). */
  const resolveTemplate = async (runtime?: TSandboxRuntimeId): Promise<string> => {
    if (runtime) {
      const template = SandboxRuntimeConfigs[runtime]?.promptCommand
      if (!template || !template.includes(`{prompt}`))
        throw new Error(`No prompt command template for runtime "${runtime}"`)
      return template
    }

    const kubeConfig = await resolveKubeConfig()
    if (!kubeConfig)
      throw new Error(`Delegation body sandbox config not found for agent ${agentId}`)
    return resolvePromptTemplate(kubeConfig)
  }

  const failed = (error: string): TDelegateResult => ({
    success: false,
    output: ``,
    error,
  })

  return {
    delegate: async (input: TDelegateInput): Promise<TDelegateResult> => {
      // Server-side depth guard — the agent tool refuses first (defense in depth)
      if (depth >= DelegationMaxDepth)
        return failed(`Max delegation depth (${DelegationMaxDepth}) reached`)

      if (!input.task?.trim()) return failed(`Delegation requires a non-empty task`)

      const podName = ctx.podName
      if (!podName)
        return failed(`Delegation requires a running Kubernetes body sandbox pod`)

      const { sandbox } = app.locals
      if (!sandbox) return failed(`Sandbox service not available`)

      const active = activeByPod.get(podName) ?? 0
      if (active >= DelegationConcurrencyCap)
        return failed(
          `Delegation concurrency cap (${DelegationConcurrencyCap}) reached — wait for an in-flight delegation to finish`
        )

      activeByPod.set(podName, active + 1)
      try {
        let template: string
        try {
          template = await resolveTemplate(input.runtime)
        } catch (err) {
          return failed((err as Error).message)
        }

        // Advisory tool constraints — in-pod CLIs have no uniform
        // tool-restriction flag, so this is a prompt constraint by design
        const constraints = input.tools?.length
          ? `Tool constraints: you may only use these tools: ${input.tools.join(`, `)}.\n\n`
          : ``
        const childPrompt = `${constraints}${input.task}`

        // Delegated children are task workers, not the persona — {soul} is
        // substituted empty rather than left as a literal placeholder
        const baseCommand = substitutePlaceholders(template, {
          soul: ``,
          prompt: escapePromptArg(childPrompt),
        })
        // The delegated child is itself a one-shot CLI in the disposable pod, so
        // it needs the same foreground guard as scheduled runs — a backgrounded
        // command dies with the pod and hands back an incomplete result. Runtime
        // precedence mirrors resolveTemplate (explicit input runtime, else the
        // body sandbox's). The depth env prefix rides alongside it.
        const runtime = input.runtime ?? (await resolveKubeConfig())?.runtime
        const envPrefix = [
          foregroundEnvPrefix(runtime),
          buildEnvPrefix({ [DelegationDepthEnvVar]: String(depth + 1) }),
        ]
          .filter(Boolean)
          .join(` `)
        const command = `${envPrefix} ${baseCommand}`

        // Number.isFinite rejects NaN/Infinity from a malformed tool call —
        // Math.max(NaN, 1000) is NaN and setTimeout(…, NaN) fires immediately
        const requestedTimeout = Number.isFinite(input.timeoutMs as number)
          ? (input.timeoutMs as number)
          : DelegationDefaultTimeoutMs
        const timeoutMs = Math.min(
          Math.max(requestedTimeout, 1000),
          DelegationMaxTimeoutMs
        )

        const sbInstance = await sandbox.getSandbox(podName)
        const child = await execCapped(sbInstance, command, timeoutMs)

        if (child.timedOut)
          return {
            success: false,
            output: child.output,
            error: `Delegated task timed out after ${timeoutMs / 1000}s`,
          }

        const exitOk = child.result.success
        const result: TDelegateResult = {
          success: exitOk,
          output: child.output,
          exitCode: child.result.exitCode,
          ...(exitOk
            ? {}
            : {
                error:
                  child.result.error ||
                  `Child process exited with code ${child.result.exitCode}`,
              }),
        }

        if (!exitOk) return result

        const criticCommand = `${envPrefix} ${substitutePlaceholders(template, {
          soul: ``,
          prompt: escapePromptArg(
            buildCriticPrompt(input.task, child.output, child.result.exitCode)
          ),
        })}`
        const critic = await runCritic(sbInstance, criticCommand)

        // Critic unavailable → success stays grounded on the exit code alone
        if (!critic) return result

        return {
          ...result,
          critic,
          success: critic.passed,
          ...(critic.passed ? {} : { error: `Critic rejected: ${critic.reason}` }),
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`[Delegation] delegate failed for agent ${agentId}: ${message}`)
        return failed(message)
      } finally {
        const remaining = (activeByPod.get(podName) ?? 1) - 1
        remaining > 0 ? activeByPod.set(podName, remaining) : activeByPod.delete(podName)
      }
    },
  }
}
