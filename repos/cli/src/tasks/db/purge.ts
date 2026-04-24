import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const purgeAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `purge`, log: params?.log, config })
}

export const purge: TTask = {
  name: `purge`,
  alias: [`prg`],
  action: purgeAct,
  example: `tdsk db purge --env local`,
  description: `Purge seeded data by ID (reverse FK order)`,
  options: {
    log: sharedOpts.shared.log,
  },
}
