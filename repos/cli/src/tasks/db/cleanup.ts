import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const cleanupAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `cleanup`, log: params?.log, config })
}

export const cleanup: TTask = {
  name: `cleanup`,
  alias: [`clean`, `cl`],
  action: cleanupAct,
  example: `pnpm tdsk db cleanup`,
  description: `Remove non-seed data while preserving seed fixtures`,
  options: {
    log: sharedOpts.shared.log,
  },
}
