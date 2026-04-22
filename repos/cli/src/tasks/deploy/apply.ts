import type { TTask, TTaskAction } from '@TSCL/types'

import { devspace } from '@TSCL/utils/devspace'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const applyAct: TTaskAction = async (args) => {
  const { params } = args

  if (params?.dryRun) return await devspace.render(args)

  await devspace.deploy(args)
}

export const apply: TTask = {
  name: `apply`,
  alias: [`ap`, `dep`],
  action: applyAct,
  example: `pnpm tdsk deploy apply --env production`,
  description: `Deploy services to the target Kubernetes cluster via DevSpace`,
  options: {
    log: sharedOpts.shared.log,
    envs: sharedOpts.shared.envs,
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
    args: sharedOpts.devspace.args,
    build: {
      type: `boolean`,
      description: `Force rebuild images before deploying`,
    },
    dryRun: {
      type: `boolean`,
      alias: [`dry`, `render`],
      description: `Render templates without applying (same as devspace render)`,
    },
  },
}
