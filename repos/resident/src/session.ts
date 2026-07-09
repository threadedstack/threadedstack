import type { ChildProcess } from 'node:child_process'
import type {
  TTurnResult,
  TSessionState,
  TProviderFallback,
} from './types/resident.types'

import path from 'node:path'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { log } from './log'
import {
  matchTransientSignal,
  CliMaxTransientRetries,
  CliTransientRetryDelaysMs,
  CliSameProviderRetriesBeforeFailover,
} from '@tdsk/domain'
import {
  ClaudeCliBin,
  ClaudeCliEnv,
  buildTurnArgs,
  parseClaudeJsonOutput,
} from './claudeCli'
import {
  DefaultWorkdir,
  ChildKillGraceMs,
  SessionStateFile,
  TurnOutputMaxChars,
  DefaultTurnTimeoutMs,
  CheckpointSummaryMaxChars,
} from './constants'

export type TSpawnFn = typeof spawn

export type TSessionManagerOpts = {
  /** Session state home on disk (survives container restarts on the workspace volume). */
  stateDir: string
  workdir?: string
  turnTimeoutMs?: number
  outputMaxChars?: number
  killGraceMs?: number
  /** Injectable child-process boundary for tests. */
  spawnFn?: TSpawnFn
  /** Extra env for the claude child (merged over process.env). */
  env?: Record<string, string>
  /**
   * Ordered fallback provider env overlays. On a TRANSIENT primary failure the
   * turn re-runs against each in order (its env overlays ANTHROPIC_AUTH_TOKEN/
   * BASE_URL for that invocation) — the in-pod mirror of the scheduled
   * executor's provider failover.
   */
  fallbackEnvs?: TProviderFallback[]
  /** Backoff (ms) before each same-provider transient retry. Tests inject [0]. */
  retryDelaysMs?: number[]
}

export type TSessionManager = {
  hasSession: () => boolean
  getSessionId: () => string | undefined
  getState: () => TSessionState
  getCheckpointSummary: () => string | undefined
  /** Run one serialized turn against the persistent session (`--resume` continuity). */
  runTurn: (prompt: string) => Promise<TTurnResult>
  /** Compaction rotation: drop the session id, stash the summary for the next seed. */
  rotateSession: (checkpointSummary?: string) => void
}

/** Tail-cap a string so the end (the part that carries results) survives. */
const tailCap = (text: string, max: number): string =>
  text.length > max ? text.slice(-max) : text

/**
 * The session manager: one persistent claude session driven as one child
 * process PER TURN (`claude -p --resume <id>` — state on disk, crash-tolerant,
 * naturally serialized). The session id is learned from the first turn's JSON
 * envelope and persisted to `<stateDir>/session` so a recreated pod resumes
 * where it left off. Turn/byte counters live in the same state for the
 * compactor.
 */
export const createSessionManager = (opts: TSessionManagerOpts): TSessionManager => {
  const spawnFn = opts.spawnFn ?? spawn
  const workdir = opts.workdir ?? DefaultWorkdir
  const killGraceMs = opts.killGraceMs ?? ChildKillGraceMs
  const turnTimeoutMs = opts.turnTimeoutMs ?? DefaultTurnTimeoutMs
  const outputMaxChars = opts.outputMaxChars ?? TurnOutputMaxChars
  const fallbackEnvs = opts.fallbackEnvs ?? []
  const retryDelaysMs = opts.retryDelaysMs ?? CliTransientRetryDelaysMs
  const stateFile = path.join(opts.stateDir, SessionStateFile)

  /**
   * A transient upstream signal in the turn result — scanned over BOTH the
   * assistant output (the CLI JSON envelope's `result`, where an "API Error:
   * 529"/overloaded lands) and stderr. Reuses the executor's exact detector.
   */
  const transientSignal = (result: TTurnResult): string | undefined =>
    matchTransientSignal(result.output) ?? matchTransientSignal(result.error ?? ``)

  const loadState = (): TSessionState => {
    try {
      const parsed = JSON.parse(readFileSync(stateFile, `utf8`))
      if (parsed && typeof parsed === `object`)
        return {
          sessionId:
            typeof parsed.sessionId === `string` && parsed.sessionId.length
              ? parsed.sessionId
              : undefined,
          turnCount: typeof parsed.turnCount === `number` ? parsed.turnCount : 0,
          totalBytes: typeof parsed.totalBytes === `number` ? parsed.totalBytes : 0,
          checkpointSummary:
            typeof parsed.checkpointSummary === `string`
              ? parsed.checkpointSummary
              : undefined,
        }
    } catch {
      // Missing or corrupt state → fresh session (the seed prompt rebuilds identity)
    }
    return { turnCount: 0, totalBytes: 0 }
  }

  let state = loadState()

  const persist = () => {
    try {
      mkdirSync(opts.stateDir, { recursive: true })
      writeFileSync(stateFile, JSON.stringify(state))
    } catch (err) {
      log.error(`Failed to persist session state:`, (err as Error).message)
    }
  }

  const runChild = (
    prompt: string,
    providerEnv: Record<string, string> = {}
  ): Promise<TTurnResult> =>
    new Promise((resolve) => {
      const startedAt = Date.now()
      const args = buildTurnArgs(prompt, state.sessionId)

      let child: ChildProcess
      try {
        child = spawnFn(ClaudeCliBin, args, {
          cwd: workdir,
          // providerEnv LAST so a fallback provider's token/base-URL overrides
          // the pod-default (primary) provider env for this single attempt.
          env: { ...process.env, ...opts.env, ...ClaudeCliEnv, ...providerEnv },
        }) as ChildProcess
      } catch (err) {
        return resolve({
          ok: false,
          output: ``,
          timedOut: false,
          durationMs: Date.now() - startedAt,
          error: (err as Error).message,
        })
      }

      let stdout = ``
      let stderr = ``
      let settled = false
      let timedOut = false

      child.stdout?.on(`data`, (chunk: Buffer | string) => {
        stdout = tailCap(stdout + String(chunk), outputMaxChars)
      })
      child.stderr?.on(`data`, (chunk: Buffer | string) => {
        stderr = tailCap(stderr + String(chunk), outputMaxChars)
      })

      const timer = setTimeout(() => {
        timedOut = true
        child.kill(`SIGTERM`)
        const hardKill = setTimeout(() => child.kill(`SIGKILL`), killGraceMs)
        hardKill.unref?.()
      }, turnTimeoutMs)
      timer.unref?.()

      const settle = (exitCode: number | null, error?: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)

        const parsed = parseClaudeJsonOutput(stdout)
        const ok = !timedOut && exitCode === 0 && !parsed.isError && !error

        resolve({
          ok,
          timedOut,
          output: parsed.resultText,
          sessionId: parsed.sessionId,
          exitCode: exitCode ?? undefined,
          durationMs: Date.now() - startedAt,
          error:
            error ??
            (timedOut
              ? `Turn timed out after ${turnTimeoutMs / 1000}s`
              : ok
                ? undefined
                : tailCap(stderr, 2000) || `claude exited with code ${exitCode}`),
        })
      }

      child.on(`error`, (err) => settle(null, err.message))
      child.on(`close`, (code) => settle(code))
    })

  return {
    hasSession: () => Boolean(state.sessionId),
    getSessionId: () => state.sessionId,
    getState: () => ({ ...state }),
    getCheckpointSummary: () => state.checkpointSummary,

    runTurn: async (prompt: string) => {
      // Ordered provider attempts: the primary runs with the pod-default env;
      // each fallback overlays its own env so its token/base-URL override the
      // pod defaults for that invocation. Every attempt --resumes the SAME
      // (pre-turn) session id, so failover keeps continuity. Mirrors the
      // scheduled executor's failover (same caps + transient detector).
      const attempts: Array<{ brand: string; env: Record<string, string> }> = [
        { brand: `primary`, env: {} },
        ...fallbackEnvs.map((fb) => ({ brand: fb.brand, env: fb.env })),
      ]

      let result!: TTurnResult
      for (let p = 0; p < attempts.length; p++) {
        const hasNext = p < attempts.length - 1
        // Brief same-provider transient retries while a fallback remains; the
        // terminal provider exhausts the full transient-retry budget.
        const maxRetries = hasNext
          ? CliSameProviderRetriesBeforeFailover
          : CliMaxTransientRetries

        result = await runChild(prompt, attempts[p].env)
        for (let a = 0; !result.ok && a < maxRetries; a++) {
          const signal = transientSignal(result)
          if (!signal) break // non-transient → a same-provider retry won't help
          const delay = retryDelaysMs[a] ?? retryDelaysMs[retryDelaysMs.length - 1]
          log.warn(
            `Turn transient failure on ${attempts[p].brand} — retry ${a + 1}/${maxRetries} in ${delay}ms: ${signal}`
          )
          await new Promise((r) => setTimeout(r, delay))
          result = await runChild(prompt, attempts[p].env)
        }

        if (result.ok) break
        // Only a transient failure warrants failing over to the next provider.
        const signal = transientSignal(result)
        if (!signal) break
        if (hasNext)
          log.warn(
            `Provider failover ${attempts[p].brand} → ${attempts[p + 1].brand}: ${signal}`
          )
      }

      // Persist the session id ONLY from a successful attempt — a failed
      // attempt may report a half-written session that would poison --resume.
      if (result.ok && result.sessionId) state.sessionId = result.sessionId
      state.turnCount += 1
      state.totalBytes += Buffer.byteLength(prompt) + Buffer.byteLength(result.output)
      persist()

      return { ...result, sessionId: state.sessionId }
    },

    rotateSession: (checkpointSummary?: string) => {
      state = {
        turnCount: 0,
        totalBytes: 0,
        checkpointSummary: checkpointSummary
          ? tailCap(checkpointSummary, CheckpointSummaryMaxChars)
          : undefined,
      }
      persist()
      log.info(
        `Session rotated (checkpoint summary ${checkpointSummary ? `stored` : `empty`})`
      )
    },
  }
}
