import type { TTask, TTaskAction } from '@TSCL/types'

import path from 'node:path'
import { exec } from '@TSCL/utils/proc/exec'

const packTsa: TTaskAction = async (args) => {
  const { config } = args

  const tsaDir = path.join(config.paths.repos, `tsa`)

  console.log(`Cross-compiling for all platforms...`)
  exec({ cmd: `bun run build:publish`, cwd: tsaDir })

  console.log(`\nPacking @tdsk/tsa...`)
  exec({ cmd: `npm pack`, cwd: tsaDir })
}

export const pack: TTask = {
  name: `pack`,
  alias: [`pk`],
  action: packTsa,
  example: `tdsk npm pack`,
  description: `Build and pack @tdsk/tsa for local testing`,
}
