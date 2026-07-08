import type { ChildProcess } from 'node:child_process'
import type { TTurnResult, TSessionState } from './types/resident.types'

import path from 'node:path'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { log } from './log'
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
  const stateFile = path.join(opts.stateDir, SessionStateFile)

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

  const runChild = (prompt: string): Promise<TTurnResult> =>
    new Promise((resolve) => {
      const startedAt = Date.now()
      const args = buildTurnArgs(prompt, state.sessionId)

      let child: ChildProcess
      try {
        child = spawnFn(ClaudeCliBin, args, {
          cwd: workdir,
          env: { ...process.env, ...opts.env, ...ClaudeCliEnv },
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
      const result = await runChild(prompt)

      if (result.sessionId) state.sessionId = result.sessionId
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
