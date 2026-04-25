import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const checkAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `check`, log: params?.log, config })
}

export const check: TTask = {
  name: `check`,
  alias: [`chk`],
  action: checkAct,
  example: `tdsk db check`,
  description: `Check migration consistency`,
  options: {
    log: sharedOpts.shared.log,
  },
}
