import type { TTask, TTaskAction } from '@TSCL/types'
import { kubectl } from '@TSCL/utils/kube/kubectl'

/**
 * Sets the active kubernetes namespace
 * @function
 * @public
 * @returns {Void}
 */
const namespaceAction: TTaskAction = async (args) => {
  const { params } = args
  const { namespace, context = `--current` } = params
  !namespace && console.error(`Namespace is required`)

  await kubectl({
    ...params,
    output: true,
    args: [`config`, `set-context`, context, `--namespace`, namespace],
  })
}

export const namespace: TTask = {
  name: `namespace`,
  alias: [`nsp`, `ns`],
  action: namespaceAction,
  example: `tdsk kube namespace <options>`,
  description: `Sets the active kubernetes namespace for the current context`,
  options: {
    namespace: {
      required: true,
      alias: [`ns`, `name`],
      example: `--namespace my-namespace`,
      description: `Namespace to set as active`,
    },
    context: {
      alias: [`ctx`],
      default: `--current`,
      example: `--context my-context`,
      description: `Kubernetes context to use`,
    },
    log: {
      type: `boolean`,
      description: `Log command before it is run`,
    },
  },
}
