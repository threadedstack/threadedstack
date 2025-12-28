import type { TTask, TTaskAction } from '@TSCL/types'


import { devspace } from '@TSCL/utils/devspace'
import { sharedOpts } from '@TSCL/utils/tasks/options'


/**
 * Runs a devspace use command and returns the output
 * @function
 * @public
 * @returns {Void}
 */
const useAct:TTaskAction = async (args) => {
  await devspace.use(args)
}

export const use:TTask = {
  name: `use`,
  alias: [`st`],
  action: useAct,
  example: `pnpm tdsk ds use <options>`,
  description: `Calls the devspace use command`,
  options: {
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
    debug: sharedOpts.devspace.debug,
    args: sharedOpts.devspace.args,
    envs: sharedOpts.shared.envs,
    log: sharedOpts.shared.log,
  },
}
