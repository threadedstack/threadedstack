import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const certsAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `certs`, log: params?.log, config })
}

export const certs: TTask = {
  name: `certs`,
  alias: [`cert`],
  action: certsAct,
  example: `pnpm tdsk db certs`,
  description: `Restore Caddy root CA cert/key from local files to database`,
  options: {
    log: sharedOpts.shared.log,
  },
}
