import type { TTask, TTaskActionArgs } from '../../types'

import { Logger } from '@tdsk/logger'
import { devspace } from '@TSCL/utils/devspace'
import { sharedOpts } from '@TSCL/utils/tasks/options'
import { removeCacheDir } from '@TSCL/utils/devspace/removeCacheDir'

const cleanAct = async (props: TTaskActionArgs) => {
  const { images, cache, log } = props.params
  log && Logger.info(`\nCleaning Dev Environment...`)

  await devspace.purge(props)

  images && (await devspace.clean(props))
  cache && (await removeCacheDir(props))

  log && Logger.success(`\nFinished cleaning Dev Environment\n`)
}

export const clean: TTask = {
  name: `clean`,
  action: cleanAct,
  alias: [`purge`, `stop`, `kill`],
  example: `pnpm task clean <options>`,
  description: `Calls the pnpm devspace clean command`,
  options: {
    images: {
      alias: [`imgs`, `image`, `img`],
      type: `boolean`,
      default: false,
      description: `Remove images when running the clean command`,
    },
    cache: {
      type: `boolean`,
      default: true,
      description: `Remove devspace cache directory when running the clean command`,
    },
    log: sharedOpts.shared.log,
  },
}
