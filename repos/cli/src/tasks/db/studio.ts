import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const studioAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `studio`, log: params?.log, config })
}

export const studio: TTask = {
  name: `studio`,
  alias: [`ui`],
  action: studioAct,
  example: `tdsk db studio`,
  description: `Launch Drizzle Studio visual database browser`,
  options: {
    log: sharedOpts.shared.log,
  },
}
