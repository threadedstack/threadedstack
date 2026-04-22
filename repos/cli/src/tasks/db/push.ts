import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const pushAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `push`, log: params?.log, config })
}

export const push: TTask = {
  name: `push`,
  alias: [`ph`],
  action: pushAct,
  example: `pnpm tdsk db push --env production`,
  description: `Push schema directly to database (interactive — confirms destructive changes)`,
  options: {
    log: sharedOpts.shared.log,
  },
}
