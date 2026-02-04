import type { TTask, TTaskAction } from '@TSCL/types'
import { kubectl } from '@TSCL/utils/kube/kubectl'

/**
 * Deletes kubernetes resources
 * @function
 * @public
 * @returns {Void}
 */
const removeAction: TTaskAction = async (args) => {
  const { params } = args
  const { resource, name, namespace } = params
  !resource && console.error(`Resource type is required`)
  !name && console.error(`Resource name is required`)

  const deleteArgs = [name]
  namespace && deleteArgs.push(`--namespace`, namespace)

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
    resource: {
      required: true,
      alias: [`type`, `res`],
      example: `--resource pod`,
      description: `Type of resource to delete`,
    },
    name: {
      required: true,
      description: `Name of the resource to delete`,
      example: `--name my-pod`,
      alias: [`n`],
    },
    namespace: {
      alias: [`ns`],
      description: `Namespace of the resource`,
      example: `--namespace my-namespace`,
    },
    context: {
      description: `Kubernetes context to use`,
      example: `--context my-context`,
    },
    log: {
      type: `boolean`,
      description: `Log command before it is run`,
    },
  },
}
