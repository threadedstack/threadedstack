import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const generateAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `generate`, log: params?.log, config })
}

export const generate: TTask = {
  name: `generate`,
  alias: [`gen`],
  action: generateAct,
  example: `tdsk db generate`,
  description: `Generate migration files from schema changes`,
  options: {
    log: sharedOpts.shared.log,
  },
}
