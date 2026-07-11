import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { taskError } from '@TSCL/utils/tasks/error'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const generateAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({ script: `generate`, log: params?.log, config })

  const code = await dbSpawn({
    script: `check:destructive`,
    log: params?.log,
    config,
  })
  if (code !== 0)
    taskError(
      `Destructive+additive migration mix detected — split the destructive change (DROP TABLE/DROP COLUMN) into its own migration, separate from any additive change (ADD COLUMN/CREATE TABLE).`
    )
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
