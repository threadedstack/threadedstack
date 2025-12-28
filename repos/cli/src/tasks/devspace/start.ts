import type { TTask, TTaskAction } from '@TSCL/types'

import { devspace } from '@TSCL/utils/devspace'
import { clean } from '@TSCL/tasks/devspace/clean'
import { pickKeys } from '@keg-hub/jsutils/pickKeys'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const cleanParams = [...Object.keys(clean.options), `env`]

/**
 * Runs a devspace start command and returns the output
 * @function
 * @public
 * @returns {Void}
 */
const startAct:TTaskAction = async (args) => {
  const { params } = args

  params?.use
    && await devspace.use(args)

  params?.clean
    && await clean.action({...args, params: pickKeys(params, cleanParams)})

  await devspace.start(args)
}

export const start:TTask = {
  name: `start`,
  alias: [`st`],
  action: startAct,
  example: `pnpm tdsk ds start <options>`,
  description: `Calls the devspace start command`,
  options: {
    context: sharedOpts.shared.context,
    log: sharedOpts.shared.log,
    envs: sharedOpts.shared.envs,
    use: sharedOpts.devspace.use,
    args: sharedOpts.devspace.args,
    debug: sharedOpts.devspace.debug,
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
    
    build: {
      type: `boolean`,
      description: `Adds the "--build" argument to the devspace command`,
    },
    purge: {
      type: `boolean`,
      description: `Adds the "--force-purge" argument to the devspace command`,
    },
    deploy: {
      type: `boolean`,
      description: `Adds the "--force-deploy" argument to the devspace command`,
    },
    clean: {
      type: `boolean`,
      alias: [`cln`],
      example: `--clean`,
      description: `Cleans the deployment before deploying. Same as running the "clean" task`
    },
    ...clean.options,
  },
}
