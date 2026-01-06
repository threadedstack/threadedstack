import hq from 'alias-hq'
import { Logger } from '@tdsk/logger'
import { execSync } from 'node:child_process'
import { emptyArr } from '@keg-hub/jsutils/emptyArr'
import { emptyObj } from '@keg-hub/jsutils/emptyObj'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'

export type TExec = {
  cwd?: string
  log?: boolean
  args?: string[]
  cmd: string | string[]
  envs?: Record<string, string>
  stdio?: `pipe` | `ignore` | `inherit` | Array<`pipe` | `ignore` | `inherit` | number>
}

export const exec = (props: TExec) => {
  const { cmd, log, envs = emptyObj, args = emptyArr, stdio = `inherit` } = props

  try {
    const cwd = props.cwd || hq.get(`webpack`)[`@ROOT`]
    const command = [...ensureArr(cmd), ...args].join(` `)

    log && Logger.pair(`[Running CMD]`, command)

    return execSync(command, {
      cwd,
      stdio,
      env: { ...process.env, ...envs },
    })
  } catch (e: any) {
    throw new Error(`Failed to execute command: ${cmd}. ${e.message || e}`)
  }
}
