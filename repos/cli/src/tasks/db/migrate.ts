import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const migrateAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `migrate`, log: params?.log, config })
}

export const migrate: TTask = {
  name: `migrate`,
  alias: [`mig`],
  action: migrateAct,
  example: `pnpm tdsk db migrate --env production`,
  description: `Apply pending migrations to the database`,
  options: {
    log: sharedOpts.shared.log,
  },
}
