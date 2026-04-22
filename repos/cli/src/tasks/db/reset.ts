import type { TTask, TTaskAction } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { taskError } from '@TSCL/utils/tasks/error'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const resetAct: TTaskAction = async (args) => {
  const { params, config } = args
  const env = process.env.NODE_ENV || `local`

  if (!params?.confirm && env !== `local`) {
    Logger.warn(
      `\n  This will DROP ALL tables, push schema, and re-seed the "${env}" database.`
    )
    Logger.warn(`  Pass --confirm to proceed.\n`)
    return taskError(
      `Destructive operation requires --confirm flag for non-local environments`
    )
  }

  if (env !== `local`)
    Logger.warn(`\n  Resetting "${env}" database (drop → push → seed)...\n`)

  await dbSpawn({ script: `rmf`, log: params?.log, config })
  await dbSpawn({ script: `push`, log: params?.log, config })
  await dbSpawn({ script: `seed`, log: params?.log, config })
}

export const reset: TTask = {
  name: `reset`,
  alias: [`rst`],
  action: resetAct,
  example: `pnpm tdsk db reset --env local --confirm`,
  description: `Full database reset: drop all tables, push schema, and seed (destructive)`,
  options: {
    log: sharedOpts.shared.log,
    confirm: {
      type: `boolean`,
      alias: [`force`, `yes`, `y`],
      description: `Confirm the destructive operation (required for non-local environments)`,
    },
  },
}
