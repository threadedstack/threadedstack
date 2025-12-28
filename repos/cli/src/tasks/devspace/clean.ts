import type { TTask, TTaskActionArgs } from '../../types'

import { Logger } from '@tdsk/logger'
import { devspace } from '@TSCL/utils/devspace'
import { sharedOpts } from '@TSCL/utils/tasks/options'
import { removeCacheDir } from '@TSCL/utils/devspace/removeCacheDir'


/**
 * Cleans the devspace environment and lingering images that may not be needed
 * @param {Object} props - arguments passed from the runTask method
 * @param {string} props.command - Root task name
 * @param {Object} props.tasks - All registered tasks of the CLI
 * @param {string} props.task - Task Definition of the task being run
 * @param {Array} props.options - arguments passed from the command line
 * @param {Object} props.globalConfig - Global config object for the keg-cli
 * @param {Object} props.params - Passed in options, converted into an object
 *
 * @returns {void}
 */
const cleanAct = async (props:TTaskActionArgs) => {
  const { images, cache, log } = props.params
  log && Logger.info(`\nCleaning Dev Environment...`)

  await devspace.purge(props)

  images && (await devspace.clean(props))
  cache && (await removeCacheDir(props))

  log && Logger.success(`\nFinished cleaning Dev Environment\n`)
}

export const clean:TTask = {
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
