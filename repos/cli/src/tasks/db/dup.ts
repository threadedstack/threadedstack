import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const dupAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `dup`, log: params?.log, config })
}

export const dup: TTask = {
  name: `dup`,
  alias: [`up`],
  action: dupAct,
  example: `pnpm tdsk db dup`,
  description: `Update migration format (drizzle-kit up)`,
  options: {
    log: sharedOpts.shared.log,
  },
}
