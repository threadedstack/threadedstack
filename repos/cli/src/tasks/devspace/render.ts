import type { TTask, TTaskAction } from '@TSCL/types'

import { devspace } from '@TSCL/utils/devspace'
import { sharedOpts } from '@TSCL/utils/tasks/options'

/**
 * Runs a devspace log command and returns the output
 * @function
 * @public
 * @returns {Void}
 */
const renderAct: TTaskAction = async (args) => {
  await devspace.render(args)
}

export const render: TTask = {
  name: `render`,
  action: renderAct,
  alias: [`renders`, `rd`],
  example: `pnpm tdsk ds render <options>`,
  description: `Calls the devspace render command`,
  options: {
    log: sharedOpts.shared.log,
    follow: sharedOpts.devspace.follow,
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
  },
}
