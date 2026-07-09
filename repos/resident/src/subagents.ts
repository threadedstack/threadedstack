import type { ChildProcess } from 'node:child_process'
import type { TSpawnFn } from './session'
import type {
  TSpawnRequest,
  TSubAgentResult,
  TProviderFallback,
} from './types/resident.types'

import { spawn } from 'node:child_process'

import { log } from './log'
import {
  DelegationMaxDepth,
  matchTransientSignal,
  DelegationDepthEnvVar,
  extractLastFencedBlock,
  DelegationOutputMaxChars,
  DelegationMaxTimeoutMs,
  DelegationDefaultTimeoutMs,
} from '@tdsk/domain'
import { SpawnBlockFence, ChildKillGraceMs } from './constants'
import {
  ClaudeCliBin,
  ClaudeCliEnv,
  buildTurnArgs,
  parseClaudeJsonOutput,
} from './claudeCli'

export type TSubAgentPoolOpts = {
  maxConcurrent: number
  /** Delegation depth of THIS process (defaults to the depth env var). */
  depth?: number
  workdir?: string
  timeoutMs?: number
  outputMaxChars?: number
  killGraceMs?: number
  spawnFn?: TSpawnFn
  env?: Record<string, string>
  /** Ordered fallback provider env overlays — a sub-agent fails over on a transient failure. */
  fallbackEnvs?: TProviderFallback[]
  /** Completion sink — the loop enqueues these as internal events. */
  onComplete: (result: TSubAgentResult) => void
}

export type TSubAgentPool = {
  /** Start a bounded in-pod child (fresh claude session). Refusals are returned, not thrown. */
  spawnSubAgent: (request: TSpawnRequest) => { ok: boolean; error?: string }
  activeCount: () => number
}

/**
 * Parse the resident-local ```tdsk-spawn``` fence out of a turn's output —
 * a JSON array of `{ key?, prompt, timeoutMs? }` sub-agent requests.
 */
export const parseSpawnBlock = (text: string): TSpawnRequest[] => {
  const block = extractLastFencedBlock(text, SpawnBlockFence)
  if (block === undefined) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(block)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const requests: TSpawnRequest[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>
    if (typeof item.prompt !== `string` || !item.prompt.trim().length) continue
    requests.push({
      prompt: item.prompt,
      key: typeof item.key === `string` && item.key.length ? item.key : undefined,
      timeoutMs: typeof item.timeoutMs === `number` ? item.timeoutMs : undefined,
    })
  }
  return requests
}

const tailCap = (text: string, max: number): string =>
  text.length > max ? text.slice(-max) : text

/**
 * Bounded in-pod sub-agents: `claude -p` children with FRESH sessions (no
 * --resume), mirroring delegation.ts semantics — concurrency cap, depth env
 * guard (defense in depth for any future path that could re-delegate),
 * wall-clock timeout, tail-capped output. Completions flow back to the loop
 * through onComplete as internal events; the resident stays responsive while
 * children run.
 */
export const createSubAgentPool = (opts: TSubAgentPoolOpts): TSubAgentPool => {
  const spawnFn = opts.spawnFn ?? spawn
  const killGraceMs = opts.killGraceMs ?? ChildKillGraceMs
  const outputMaxChars = opts.outputMaxChars ?? DelegationOutputMaxChars
  const depth =
    opts.depth ?? Number.parseInt(process.env[DelegationDepthEnvVar] ?? `0`, 10) ?? 0

  let active = 0
  let spawnSeq = 0

  return {
    activeCount: () => active,

    spawnSubAgent: (request: TSpawnRequest) => {
      if (depth >= DelegationMaxDepth)
        return {
          ok: false,
          error: `Max delegation depth (${DelegationMaxDepth}) reached`,
        }

      if (active >= opts.maxConcurrent)
        return {
          ok: false,
          error: `Sub-agent concurrency cap (${opts.maxConcurrent}) reached — wait for an in-flight sub-agent to finish`,
        }

      const key = request.key ?? `sub-agent-${++spawnSeq}`
      const requested = Number.isFinite(request.timeoutMs as number)
        ? (request.timeoutMs as number)
        : (opts.timeoutMs ?? DelegationDefaultTimeoutMs)
      const timeoutMs = Math.min(Math.max(requested, 1000), DelegationMaxTimeoutMs)

      // Ordered provider attempts: the primary uses the pod-default env; each
      // fallback overlays its own env. On a TRANSIENT failure with a fallback
      // remaining, the sub-agent re-spawns against the next provider (best
      // effort — no same-provider retry). One concurrency slot spans all
      // attempts (counted once here, released once on the terminal outcome).
      const attempts: Array<{ brand: string; env: Record<string, string> }> = [
        { brand: `primary`, env: {} },
        ...(opts.fallbackEnvs ?? []).map((fb) => ({ brand: fb.brand, env: fb.env })),
      ]

      active += 1
      const startedAt = Date.now()

      const launch = (attemptIndex: number): { ok: boolean; error?: string } => {
        const attempt = attempts[attemptIndex]
        let child: ChildProcess
        try {
          child = spawnFn(ClaudeCliBin, buildTurnArgs(request.prompt), {
            cwd: opts.workdir,
            // attempt.env LAST so a fallback provider's token/base-URL overrides
            // the pod-default provider env for this attempt.
            env: {
              ...process.env,
              ...opts.env,
              ...ClaudeCliEnv,
              ...attempt.env,
              [DelegationDepthEnvVar]: String(depth + 1),
            },
          }) as ChildProcess
        } catch (err) {
          active -= 1
          // A first-attempt spawn failure is a refusal (never started). A later
          // attempt's failure must still report completion — the caller already
          // saw {ok:true} for this sub-agent.
          if (attemptIndex > 0)
            opts.onComplete({
              key,
              ok: false,
              timedOut: false,
              output: `sub-agent spawn failed: ${(err as Error).message}`,
              durationMs: Date.now() - startedAt,
            })
          return { ok: false, error: (err as Error).message }
        }

        let stdout = ``
        let settled = false
        let timedOut = false

        child.stdout?.on(`data`, (chunk: Buffer | string) => {
          stdout = tailCap(stdout + String(chunk), outputMaxChars)
        })
        child.stderr?.on(`data`, (chunk: Buffer | string) => {
          stdout = tailCap(stdout + String(chunk), outputMaxChars)
        })

        const timer = setTimeout(() => {
          timedOut = true
          child.kill(`SIGTERM`)
          const hardKill = setTimeout(() => child.kill(`SIGKILL`), killGraceMs)
          hardKill.unref?.()
        }, timeoutMs)
        timer.unref?.()

        const settle = (exitCode: number | null, error?: string) => {
          if (settled) return
          settled = true
          clearTimeout(timer)

          const parsed = parseClaudeJsonOutput(stdout)
          const ok = !timedOut && exitCode === 0 && !parsed.isError && !error

          // Transient failure with a fallback remaining → try the next provider.
          const signal = !ok && !timedOut ? matchTransientSignal(stdout) : undefined
          if (signal && attemptIndex + 1 < attempts.length) {
            log.warn(
              `Sub-agent ${key} provider failover ${attempt.brand} → ${
                attempts[attemptIndex + 1].brand
              }: ${signal}`
            )
            launch(attemptIndex + 1)
            return
          }

          active -= 1
          log.info(
            `Sub-agent ${key} finished (ok=${ok}, exit=${exitCode ?? `n/a`}, timedOut=${timedOut})`
          )
          opts.onComplete({
            key,
            ok,
            timedOut,
            output: tailCap(parsed.resultText, outputMaxChars),
            exitCode: exitCode ?? undefined,
            durationMs: Date.now() - startedAt,
          })
        }

        child.on(`error`, (err) => settle(null, err.message))
        child.on(`close`, (code) => settle(code))
        return { ok: true }
      }

      const launched = launch(0)
      if (launched.ok)
        log.info(`Sub-agent ${key} started (depth ${depth + 1}, timeout ${timeoutMs}ms)`)
      return launched
    },
  }
}
