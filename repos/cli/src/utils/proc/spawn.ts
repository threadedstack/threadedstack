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
}

export type TSpawnProm = Promise<number> & {
  process?: ChildProcess
}

/**
 * Array to capture process exits and call handleExit method
 */
const events = (child: ChildProcess) => {
  Array.from([`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`])
    // Loop over the events, and add each one to the current process
    // This way we watch for any time the current process is killed
    .map((event) =>
      process.on(event, (exitCode) => {
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
      log && Logger.pair(`[Running CMD]`, [cmd, ...args].join(` `))

      child = cps(cmd, args, {
        cwd,
        stdio,
        env: { ...process.env, ...envs },
      })

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
