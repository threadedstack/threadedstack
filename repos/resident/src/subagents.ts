import type { ChildProcess } from 'node:child_process'
import type { TSpawnFn } from './session'
import type { TSpawnRequest, TSubAgentResult } from './types/resident.types'

import { spawn } from 'node:child_process'

import { log } from './log'
import {
  DelegationMaxDepth,
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

      let child: ChildProcess
      try {
        child = spawnFn(ClaudeCliBin, buildTurnArgs(request.prompt), {
          cwd: opts.workdir,
          env: {
            ...process.env,
            ...opts.env,
            ...ClaudeCliEnv,
            [DelegationDepthEnvVar]: String(depth + 1),
          },
        }) as ChildProcess
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }

      active += 1
      const startedAt = Date.now()
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
        active -= 1

        const parsed = parseClaudeJsonOutput(stdout)
        const ok = !timedOut && exitCode === 0 && !parsed.isError && !error
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

      log.info(`Sub-agent ${key} started (depth ${depth + 1}, timeout ${timeoutMs}ms)`)
      return { ok: true }
    },
  }
}
