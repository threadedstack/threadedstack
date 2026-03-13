import type { TTask, TTaskAction } from '@TSCL/types'

import { devspace } from '@TSCL/utils/devspace'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const attachAct: TTaskAction = async (args) => {
  await devspace.attach(args)
}

export const attach: TTask = {
  name: `attach`,
  action: attachAct,
  alias: [`attach`, `att`],
  example: `pnpm tdsk ds attach <options>`,
  description: `Calls the devspace attach command`,
  options: {
    context: sharedOpts.shared.context,
    log: sharedOpts.shared.log,
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
  },
}
