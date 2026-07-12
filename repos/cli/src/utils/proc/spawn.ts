import type { ChildProcess } from 'node:child_process'

import hq from 'alias-hq'
import { Logger } from '@tdsk/logger'
import { spawn as cps } from 'node:child_process'
import { emptyArr } from '@keg-hub/jsutils/emptyArr'
import { emptyObj } from '@keg-hub/jsutils/emptyObj'

export type TSpawn = {
  cmd: string
  cwd?: string
  log?: boolean
  args?: string[]
  output?: boolean
  detached?: boolean
  envs?: Record<string, string>
  close?: (code: number) => void
  stdout?: (data: string) => void
  stderr?: (data: string) => void
  error?: (err: Error | string) => void
  exit?: (code: number, pid: string) => void
  stdio?: `pipe` | `ignore` | `inherit` | Array<`pipe` | `ignore` | `inherit` | number>
  /**
   * Written to the child's stdin and closed once the process spawns — the
   * safe way to hand a secret (e.g. a docker login password) to a child
   * process without it ever touching argv (visible via `ps aux` /
   * `/proc/<pid>/cmdline`) or a captured `[Running CMD]` log line. Forces
   * stdin to `pipe` regardless of the `stdio` option.
   */
  stdin?: string
}

/** Flags whose immediately-following arg is a secret and must never be logged. */
const SensitiveArgFlags = new Set([`-p`, `-P`, `--password`, `--token`, `--secret`])

/**
 * Defense-in-depth redaction for the `[Running CMD]` log line: mask the value
 * immediately following a known secret-bearing flag. The docker login fix
 * keeps the password out of argv entirely (piped via stdin instead), but this
 * guards any other/future caller that passes a secret as a CLI arg.
 */
const redactArgs = (args: string[]): string[] => {
  const redacted = [...args]
  for (let i = 0; i < redacted.length - 1; i++)
    if (SensitiveArgFlags.has(redacted[i])) redacted[i + 1] = `***REDACTED***`
  return redacted
}

export type TSpawnProm = Promise<number> & {
  process?: ChildProcess
}

/**
 * Array to capture process exits and call handleExit method
 */
const events = (child: ChildProcess) => {
  ;[`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`].forEach(
    (event) =>
      process.on(event, () => {
        if ((child as any).__spOnExitCalled) return

        ;(child as any).__spOnExitCalled = true
        child.kill(`SIGKILL`)
      })
  )
}

export const spawn = async (props: TSpawn) => {
  let finished = false
  let child: ChildProcess

  const prom: TSpawnProm = new Promise(async (res, rej) => {
    try {
      const {
        cmd,
        log,
        stdin,
        error,
        close,
        stdout,
        stderr,
        output,
        exit: onexit,
        envs = emptyObj,
        args = emptyArr,
        detached = false,
        stdio = `inherit`,
      } = props

      const cwd = props.cwd || hq.get(`webpack`)[`@ROOT`]
      log && Logger.pair(`[Running CMD]`, [cmd, ...redactArgs(args)].join(` `))

      // `stdin` always needs a pipe on fd 0 regardless of the caller's stdio
      // choice for stdout/stderr — string stdio applies to all three fds, so
      // expand it into an array with just stdin overridden to `pipe`.
      const resolvedStdio: TSpawn[`stdio`] =
        stdin === undefined
          ? stdio
          : Array.isArray(stdio)
            ? [`pipe`, stdio[1] ?? `inherit`, stdio[2] ?? `inherit`]
            : [`pipe`, stdio, stdio]

      child = cps(cmd, args, {
        cwd,
        stdio: resolvedStdio,
        env: { ...process.env, ...envs },
      })

      if (stdin !== undefined) {
        child.stdin?.write(stdin)
        child.stdin?.end()
      }

      detached && stdio !== `inherit` && child.unref()

      child?.stdout?.setEncoding?.(`utf-8`)
      child?.stderr?.setEncoding?.(`utf-8`)

      child?.on(`close`, async (code) => {
        prom.process = undefined
        await close?.(code)
        if (finished) return
        finished = true
        res(code)
      })

      child?.on(`exit`, async (code, pid) => {
        prom.process = undefined
        await onexit?.(code, pid)
        if (finished) return
        finished = true
        res(code)
      })

      child?.on(`error`, async (err) => {
        prom.process = undefined
        await error?.(err)
        finished = true
        rej(err)
      })

      child?.stdout?.on?.(`data`, async (data) => {
        output && Logger.stdout(data)
        await stdout?.(data)
      })

      child?.stderr?.on?.(`data`, async (data) => {
        output && Logger.stderr(data)
        await stderr?.(data)
      })

      events(child)
    } catch (err) {
      prom.process = undefined
      await props?.error?.(err)
      finished = true
      rej(err)
    }
  })

  prom.process = child

  return prom
}
