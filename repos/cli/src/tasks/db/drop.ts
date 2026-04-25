import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const dropAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `drop`, log: params?.log, config })
}

export const drop: TTask = {
  name: `drop`,
  alias: [`drp`],
  action: dropAct,
  example: `tdsk db drop`,
  description: `Drop a migration (interactive)`,
  options: {
    log: sharedOpts.shared.log,
  },
}
