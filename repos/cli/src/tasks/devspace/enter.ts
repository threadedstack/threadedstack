import type { TTask, TTaskAction } from '@TSCL/types'

import { devspace } from '@TSCL/utils/devspace'
import { sharedOpts } from '@TSCL/utils/tasks/options'

/**
 * Runs a devspace log command and returns the output
 * @function
 * @public
 * @returns {Void}
 */
const enterAct: TTaskAction = async (args) => {
  await devspace.enter(args)
}

export const enter: TTask = {
  name: `enter`,
  action: enterAct,
  alias: [`enter`, `exec`],
  example: `pnpm tdsk ds enter <options>`,
  description: `Calls the devspace enter command`,
  options: {
    context: sharedOpts.shared.context,
    cmd: sharedOpts.devspace.cmd,
    log: sharedOpts.shared.log,
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
  },
}
