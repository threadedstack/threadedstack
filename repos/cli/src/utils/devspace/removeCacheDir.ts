import type { TTaskActionArgs } from '@TSCL/types'

import fs from 'fs'
import path from 'path'
import { Logger } from '@tdsk/logger'

/**
 * Removes the devspace cache directory if it exists at `deploy/.devspace`
 */
export const removeCacheDir = (props: TTaskActionArgs) => {
  const { params, config } = props

  params.log && Logger.info(`\nRemoving devspace cache folder...`)
  fs.rmSync(path.join(config.paths.deploy, `.devspace`), {
    recursive: true,
    force: true,
  })
}
