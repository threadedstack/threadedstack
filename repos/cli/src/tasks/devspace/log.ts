import type { TTask, TTaskAction } from '@TSCL/types'

import { devspace } from '@TSCL/utils/devspace'
import { sharedOpts } from '@TSCL/utils/tasks/options'

/**
 * Runs a devspace log command and returns the output
 * @function
 * @public
 * @returns {Void}
 */
const logAct: TTaskAction = async (args) => {
  await devspace.logs(args)
}

export const log: TTask = {
  name: `log`,
  action: logAct,
  alias: [`logs`, `lg`, `lgs`],
  example: `pnpm tdsk ds log <options>`,
  description: `Calls the devspace logs command`,
  options: {
    context: sharedOpts.shared.context,
    log: sharedOpts.shared.log,
    follow: sharedOpts.devspace.follow,
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
  },
}
