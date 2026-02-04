import type { TTask, TTaskAction } from '@TSCL/types'

import { kubectl } from '@TSCL/utils/kube/kubectl'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { taskError } from '@TSCL/utils/tasks/error'

/**
 * Deletes kubernetes resources
 * @function
 * @public
 * @returns {Void}
 */
const removeAction: TTaskAction = async (args) => {
  const { params } = args
  const ctx = getCtx(args)
  !ctx && taskError(`Build context name is missing or invalid`)

  const { resource } = params
  !resource && console.error(`Resource type is required`)

  const deleteArgs = [ctx.deployment]

  resource === `pod`
    ? await kubectl.delete.pod(args, deleteArgs)
    : await kubectl.delete(args, [resource, ...deleteArgs])
}

export const remove: TTask = {
  name: `remove`,
  alias: [`rm`, `delete`],
  action: removeAction,
  example: `pnpm tdsk kube remove <options>`,
  description: `Delete kubernetes resources (pods, services, deployments, etc.)`,
  options: {
    context: {
      alias: [`ctx`, `name`, `n`],
      required: true,
      example: `--context my-pod`,
      description: `Name of the resource to delete`,
    },
    resource: {
      default: `pod`,
      alias: [`type`, `res`],
      example: `--resource pod`,
      description: `Type of resource to delete`,
    },
    log: {
      type: `boolean`,
      description: `Log command before it is run`,
    },
  },
}
