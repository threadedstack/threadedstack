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
}

export const dbSpawn = async (opts: TDbSpawn) => {
  const { script, args = [], log, config } = opts
  const filtered = filterEnvs(DBEnvFilter, config.envs)

  return spawn({
    log,
    cmd: `pnpm`,
    args: [script, ...args],
    cwd: path.join(config.paths.repos, `database`),
    envs: {
      NODE_ENV: process.env.NODE_ENV || `local`,
      ...filtered,
    },
  })
}
