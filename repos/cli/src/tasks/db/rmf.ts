import type { TTask, TTaskAction } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { taskError } from '@TSCL/utils/tasks/error'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const rmfAct: TTaskAction = async (args) => {
  const { params, config } = args
  const env = process.env.NODE_ENV || `local`

  if (!params?.confirm && env !== `local`) {
    Logger.warn(`\n  This will DROP ALL tables from the "${env}" database.`)
    Logger.warn(`  Pass --confirm to proceed.\n`)
    return taskError(
      `Destructive operation requires --confirm flag for non-local environments`
    )
  }

  if (env !== `local`) Logger.warn(`\n  Dropping ALL tables in "${env}" environment...\n`)

  await dbSpawn({ script: `rmf`, log: params?.log, config })
}

export const rmf: TTask = {
  name: `rmf`,
  alias: [`remove`, `dropall`],
  action: rmfAct,
  example: `pnpm tdsk db rmf --env local --confirm`,
  description: `DROP ALL Drizzle-managed tables with CASCADE (destructive)`,
  options: {
    log: sharedOpts.shared.log,
    confirm: {
      type: `boolean`,
      alias: [`force`, `yes`, `y`],
      description: `Confirm the destructive operation (required for non-local environments)`,
    },
  },
}
