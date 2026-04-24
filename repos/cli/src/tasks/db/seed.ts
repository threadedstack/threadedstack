import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const seedAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `seed`, log: params?.log, config })
}

export const seed: TTask = {
  name: `seed`,
  alias: [`sd`],
  action: seedAct,
  example: `tdsk db seed --env production`,
  description: `Seed the database with fullorg test data`,
  options: {
    log: sharedOpts.shared.log,
  },
}
