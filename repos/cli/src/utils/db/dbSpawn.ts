import type { TTaskActionArgs } from '@TSCL/types'

import path from 'node:path'
import { DBEnvFilter } from '@TSCL/constants'
import { spawn } from '@TSCL/utils/proc/spawn'
import { filterEnvs } from '@TSCL/utils/helpers/filterEnvs'

export type TDbSpawn = {
  log?: boolean
  script: string
  args?: string[]
  config: TTaskActionArgs[`config`]
  /** Forwarded to spawn() — undefined (the default) keeps callers like the
   * interactive `db push`/`db studio` tasks unbounded. */
  timeoutMs?: number
}

export const dbSpawn = async (opts: TDbSpawn) => {
  const { script, args = [], log, config, timeoutMs } = opts
  const filtered = filterEnvs(DBEnvFilter, config.envs)

  return spawn({
    log,
    timeoutMs,
    cmd: `pnpm`,
    args: [script, ...args],
    cwd: path.join(config.paths.repos, `database`),
    envs: {
      NODE_ENV: process.env.NODE_ENV || `local`,
      ...filtered,
    },
  })
}
