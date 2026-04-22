import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const introspectAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `introspect`, log: params?.log, config })
}

export const introspect: TTask = {
  name: `introspect`,
  alias: [`intro`, `inspect`],
  action: introspectAct,
  example: `pnpm tdsk db introspect`,
  description: `Introspect existing database schema`,
  options: {
    log: sharedOpts.shared.log,
  },
}
