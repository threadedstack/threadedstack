import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const dbExportAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `export`, log: params?.log, config })
}

export const dbExport: TTask = {
  name: `export`,
  alias: [`exp`],
  action: dbExportAct,
  example: `tdsk db export`,
  description: `Export database schema as SQL`,
  options: {
    log: sharedOpts.shared.log,
  },
}
