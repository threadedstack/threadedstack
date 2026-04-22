import type { TTask, TTaskAction } from '@TSCL/types'

import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const dkAct: TTaskAction = async (args) => {
  const { params, config } = args
  await dbSpawn({
    script: `dk`,
    log: params?.log,
    config,
    args: params?.args || [],
  })
}

export const dk: TTask = {
  name: `dk`,
  alias: [`drizzle`, `kit`],
  action: dkAct,
  example: `pnpm tdsk db dk generate --custom`,
  description: `Direct drizzle-kit passthrough — pass any drizzle-kit command`,
  options: {
    log: sharedOpts.shared.log,
    args: {
      type: `array`,
      alias: [`params`, `arg`],
      description: `Arguments to pass directly to drizzle-kit`,
    },
  },
}
