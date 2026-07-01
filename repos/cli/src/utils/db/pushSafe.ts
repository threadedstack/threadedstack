import type { TTaskActionArgs } from '@TSCL/types'

import path from 'node:path'
import { Logger } from '@tdsk/logger'
import { spawn as cps } from 'node:child_process'
import { DBEnvFilter } from '@TSCL/constants'
import { taskError } from '@TSCL/utils/tasks/error'
import { filterEnvs } from '@TSCL/utils/helpers/filterEnvs'

export type TPushSafe = {
  log?: boolean
  timeoutMs?: number
  config: TTaskActionArgs[`config`]
}

/**
 * Signals in drizzle-kit output that mean a destructive / interactive
 * migration — matching any of these aborts the automated push immediately.
 */
const DESTRUCTIVE_RE =
  /(data.?loss|about to (delete|drop|truncate|remove)|Yes, I want to|No, abort|created or renamed from)/i

/**
 * Runs a non-interactive, additive-only `drizzle-kit push`.
 *
 * stdin is detached so drizzle can never block on a confirmation prompt.
 * If a destructive change is detected (via output signal) or the push hangs
 * past the timeout, the deploy aborts with instructions to run it manually.
 * Additive changes (new tables/columns) apply without prompts and succeed.
 */
export const pushSafe = async (opts: TPushSafe): Promise<void> => {
  const { config, log, timeoutMs = 120_000 } = opts
  const env = process.env.NODE_ENV || `production`
  const filtered = filterEnvs(DBEnvFilter, config.envs)
  const cwd = path.join(config.paths.repos, `database`)

  log && Logger.pair(`[Running CMD]`, `pnpm push (${cwd})`)

  let destructive = false
  // Accumulate output so a destructive warning split across stream chunks
  // is still matched (keep only the tail to bound memory).
  let buffer = ``
  const watch = (data: Buffer | string) => {
    buffer += String(data)
    if (buffer.length > 16_384) buffer = buffer.slice(-16_384)
    if (DESTRUCTIVE_RE.test(buffer)) destructive = true
  }

  const { code, timedOut } = await new Promise<{ code: number; timedOut: boolean }>(
    (resolve) => {
      let done = false
      let timeout = false

      const child = cps(`pnpm`, [`push`], {
        cwd,
        // Detach stdin so an interactive prompt gets EOF instead of hanging
        stdio: [`ignore`, `pipe`, `pipe`],
        env: { ...process.env, NODE_ENV: env, ...filtered },
      })

      const timer = setTimeout(() => {
        timeout = true
        child.kill(`SIGKILL`)
      }, timeoutMs)

      child.stdout?.setEncoding(`utf-8`)
      child.stderr?.setEncoding(`utf-8`)
      child.stdout?.on(`data`, (data) => {
        Logger.stdout(data)
        watch(data)
      })
      child.stderr?.on(`data`, (data) => {
        Logger.stderr(data)
        watch(data)
      })

      const finish = (exitCode: number) => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve({ code: exitCode, timedOut: timeout })
      }

      child.on(`error`, () => finish(1))
      // null exit code = terminated by signal (our timeout kill or OOM) → failure
      child.on(`close`, (exitCode) => finish(exitCode == null ? 1 : exitCode))
    }
  )

  if (destructive || timedOut)
    taskError(
      [
        `Destructive database schema change detected — the automated deploy will not apply`,
        `data-loss migrations. Review and apply it manually:\n`,
        `  tdsk db push --env ${env}\n`,
        `Then re-run the deploy.`,
      ].join(` `)
    )

  if (code !== 0) taskError(`Database schema push failed (exit code ${code})`)
}
